"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CharacterOperation } from "@/src/rules/operations";
import {
  ackApply,
  applyOperations,
  connectBridge,
  isLocalHost,
  probeBridge,
  pushCharacter,
  readAutoApply,
  rejectProposal,
  requestApply,
  writeAutoApply,
  type ProposalView,
} from "@/lib/soulhunter/bridge";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";

type BridgeStatus = "idle" | "connecting" | "connected" | "offline";

const ATTRIBUTE_LABEL: Record<string, string> = {
  body: "体魄",
  mind: "智慧",
  soul: "心魂",
};

const SKILL_LABEL: Record<string, string> = {
  athletics: "运动",
  operation: "操作",
  stealth: "隐秘",
  investigation: "调查",
  insight: "洞察",
  persuasion: "说服",
  "hunter-lore": "狩魂学识",
};

const KIND_LABEL: Record<string, string> = {
  martial: "武技",
  spell: "术法",
  specialty: "专长",
  imprint: "灵能印记",
};

function shortCardName(id: string): string {
  const parts = id.split(".");
  return parts.length > 1 ? parts.slice(1).join(".") : id;
}

function describeOp(op: CharacterOperation): string {
  switch (op.op) {
    case "setAttribute":
      return `${ATTRIBUTE_LABEL[op.attribute] ?? op.attribute}设为 ${op.value}`;
    case "setInsight":
      return `灵识设为 ${op.value}`;
    case "setSkill":
      return `${SKILL_LABEL[op.skill] ?? op.skill}分配 ${op.value} 点`;
    case "addCard":
      return `加入${KIND_LABEL[op.kind] ?? op.kind}：${shortCardName(op.id)}`;
    case "removeCard":
      return `移除${KIND_LABEL[op.kind] ?? op.kind}：${shortCardName(op.id)}`;
    case "replaceCard":
      return `替换${KIND_LABEL[op.kind] ?? op.kind}：${shortCardName(op.oldId)} → ${shortCardName(op.newId)}`;
    case "setUltimate":
      return op.id ? `设置 ${op.tier} 挡绝技：${shortCardName(op.id)}` : `清空 ${op.tier} 挡绝技`;
    case "setStyle":
      return `选择风格：${shortCardName(op.styleId)}`;
    case "setCombinedStyle":
      return `组合风格「${op.name}」，${op.styleIds.length} 个基础风格`;
    case "setBond":
      return `羁绊：${op.category} / ${op.name}`;
    case "setAbilityField":
      return `灵能力字段 ${op.field} 更新`;
    case "setExperienceTags":
      return `经历标签：${op.tags.join("、") || "清空"}`;
    case "setSoulWeaponName":
      return `灵魂武器命名为「${op.value}」`;
    case "setIdentityField":
      return `身份字段 ${op.field} 更新`;
  }
}

export function AiPanel() {
  const character = useCharacterStore((state) => state.character);
  const hydrated = useCharacterStore((state) => state.hydrated);

  const [local, setLocal] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [token, setToken] = useState("");
  const [proposals, setProposals] = useState<ProposalView[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [autoApply, setAutoApply] = useState(false);

  const autoApplyRef = useRef(false);
  const applyRef = useRef<(proposal: ProposalView) => void>(() => {});

  const applyProposal = useCallback(
    async (proposal: ProposalView) => {
      if (!token) return;
      setBusyId(proposal.id);
      setNotice(null);

      const result = await requestApply(proposal.id, token);
      if (!result.ok || !result.ops) {
        setNotice(result.error ?? "应用失败");
        setProposals((list) => list.filter((item) => item.id !== proposal.id));
        setBusyId(null);
        return;
      }

      applyOperations(result.ops);
      const nextCharacter = useCharacterStore.getState().character;
      const ack = await ackApply(proposal.id, nextCharacter, token);
      if (!ack.ok) {
        setNotice(ack.error ?? "确认失败，请检查本地服务");
      }
      setProposals((list) => list.filter((item) => item.id !== proposal.id));
      setBusyId(null);
    },
    [token],
  );

  applyRef.current = applyProposal;

  useEffect(() => {
    setLocal(isLocalHost());
    setAutoApply(readAutoApply());
  }, []);

  useEffect(() => {
    autoApplyRef.current = autoApply;
  }, [autoApply]);

  useEffect(() => {
    if (!isLocalHost()) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let timer: number | undefined;

    const start = async () => {
      setStatus((prev) => (prev === "connected" ? prev : "connecting"));
      const found = await probeBridge();
      if (cancelled) return;

      if (!found) {
        setStatus("offline");
        timer = window.setTimeout(start, 4_000);
        return;
      }

      setToken(found.health.token);
      setStatus("connected");
      controller = new AbortController();

      try {
        await connectBridge(
          found.health.token,
          {
            onProposal: (proposal) => {
              setProposals((list) => {
                const rest = list.filter((item) => item.id !== proposal.id);
                return proposal.status === "pending" ? [proposal, ...rest] : rest;
              });
            },
            onApplyRequested: (id) => {
              if (!autoApplyRef.current) {
                setNotice("AI 请求应用提案，请在面板确认。");
                return;
              }
              setProposals((list) => {
                const proposal = list.find((item) => item.id === id);
                if (proposal) void applyRef.current(proposal);
                return list;
              });
            },
            onCharacterUpdated: () => {
              // revision 变化由 bridge 自身的推送触发，这里不需要额外动作
            },
          },
          controller.signal,
        );
      } catch {
        // 断流后重连
      }

      if (cancelled) return;
      setStatus("offline");
      timer = window.setTimeout(start, 3_000);
    };

    void start();

    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (status !== "connected" || !token || !hydrated) return;
    const timer = window.setTimeout(() => {
      void pushCharacter(character, token);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [character, status, token, hydrated]);

  if (!local) return null;

  const connected = status === "connected";

  return (
    <div className="no-print fixed bottom-20 right-3 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div className="w-[min(420px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[#e4e4e7] bg-white shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)]">
          <header className="flex items-center justify-between border-b bg-zinc-50/80 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-zinc-600" />
              <span className="text-xs font-semibold text-zinc-800">AI 助手</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                  connected
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : status === "connecting"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-zinc-200 bg-zinc-100 text-zinc-500",
                )}
              >
                {status === "connecting" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                {connected ? "已连接" : status === "connecting" ? "连接中" : "未连接"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="flex cursor-pointer items-center gap-1 text-[10px] text-zinc-500">
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-zinc-900"
                  checked={autoApply}
                  onChange={(event) => {
                    const value = event.target.checked;
                    setAutoApply(value);
                    autoApplyRef.current = value;
                    writeAutoApply(value);
                  }}
                />
                自动应用
              </label>
              <button
                type="button"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => setOpen(false)}
                aria-label="收起 AI 助手"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          <div className="max-h-[54vh] space-y-2 overflow-y-auto px-3 py-3">
            {status === "offline" || status === "idle" ? (
              <div className="rounded-md border border-dashed px-3 py-4 text-[11px] leading-relaxed text-zinc-500">
                本地助手未启动。在项目根目录运行
                <code className="mx-1 rounded bg-zinc-100 px-1 py-0.5 text-[10px] text-zinc-700">
                  npm run ai
                </code>
                后会自动连接。
              </div>
            ) : proposals.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-4 text-[11px] leading-relaxed text-zinc-500">
                已连接。在 Trae 或 Claude 里使用 soul-hunter-ai 工具，读取当前角色并生成提案后，会显示在这里。
              </div>
            ) : (
              proposals.map((proposal) => (
                <div key={proposal.id} className="rounded-lg border border-[#e4e4e7] p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-800">{proposal.title}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">{proposal.reason}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-400">
                      r{proposal.baseRevision}
                    </span>
                  </div>

                  <ul className="mt-1.5 space-y-0.5">
                    {proposal.ops.map((op, index) => (
                      <li key={`${proposal.id}-${index}`} className="text-[11px] leading-snug text-zinc-700">
                        · {describeOp(op)}
                      </li>
                    ))}
                  </ul>

                  {proposal.warnings.length > 0 ? (
                    <p className="mt-1.5 text-[10px] leading-snug text-amber-700">
                      {proposal.warnings.join("；")}
                    </p>
                  ) : null}

                  {proposal.issues.filter((issue) => issue.level === "error").length > 0 ? (
                    <p className="mt-1 text-[10px] leading-snug text-destructive">
                      应用后会出现 {proposal.issues.filter((issue) => issue.level === "error").length} 个错误：
                      {proposal.issues
                        .filter((issue) => issue.level === "error")
                        .slice(0, 2)
                        .map((issue) => issue.message)
                        .join("；")}
                    </p>
                  ) : null}

                  <div className="mt-2 flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 px-2.5 text-[11px]"
                      disabled={busyId === proposal.id}
                      onClick={() => void applyProposal(proposal)}
                    >
                      {busyId === proposal.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      应用
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[11px]"
                      disabled={busyId === proposal.id}
                      onClick={() => {
                        void rejectProposal(proposal.id, token);
                        setProposals((list) => list.filter((item) => item.id !== proposal.id));
                      }}
                    >
                      拒绝
                    </Button>
                  </div>
                </div>
              ))
            )}

            {notice ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                {notice}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-lg transition-colors hover:bg-zinc-50"
      >
        <Bot className="h-3.5 w-3.5" />
        AI 助手
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            connected ? "bg-emerald-500" : status === "connecting" ? "bg-amber-400" : "bg-zinc-300",
          )}
        />
        {proposals.length > 0 ? (
          <span className="rounded-full bg-zinc-900 px-1.5 text-[10px] text-white">
            {proposals.length}
          </span>
        ) : null}
      </button>
    </div>
  );
}

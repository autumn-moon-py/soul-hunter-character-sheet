"use client";

import { useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";
import {
  ackApply,
  applyOperations,
  connectBridge,
  isLocalHost,
  probeBridge,
  pushCharacter,
  requestApply,
  type ProposalView,
} from "@/lib/soulhunter/bridge";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";

type BridgeStatus = "idle" | "connecting" | "connected" | "offline";

const STATUS_VIEW: Record<BridgeStatus, { label: string; dot: string }> = {
  idle: { label: "AI 未连接", dot: "bg-zinc-300" },
  connecting: { label: "AI 连接中", dot: "bg-amber-400" },
  connected: { label: "AI 已连接", dot: "bg-emerald-500" },
  offline: { label: "AI 未连接", dot: "bg-zinc-300" },
};

/** 底部工具条里的本地桥接状态按钮，同时负责健康检查、SSE 与角色同步 */
export function AiStatusButton() {
  const character = useCharacterStore((state) => state.character);
  const hydrated = useCharacterStore((state) => state.hydrated);

  const [local, setLocal] = useState(false);
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [token, setToken] = useState("");
  const [probeNonce, setProbeNonce] = useState(0);

  // 没有面板可供确认，提案按 AI 的请求直接应用，保证 apply_changes 仍然可用
  const proposalsRef = useRef(new Map<string, ProposalView>());

  useEffect(() => {
    setLocal(isLocalHost());
  }, []);

  useEffect(() => {
    if (!isLocalHost()) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let timer: number | undefined;

    const applyProposal = async (proposal: ProposalView, bridgeToken: string) => {
      const result = await requestApply(proposal.id, bridgeToken);
      if (!result.ok || !result.ops) return;
      applyOperations(result.ops);
      const nextCharacter = useCharacterStore.getState().character;
      await ackApply(proposal.id, nextCharacter, bridgeToken);
    };

    const start = async () => {
      setStatus((prev) => (prev === "connected" ? prev : "connecting"));
      const found = await probeBridge();
      if (cancelled) return;

      if (!found) {
        setStatus("offline");
        timer = window.setTimeout(start, 4_000);
        return;
      }

      const bridgeToken = found.health.token;
      setToken(bridgeToken);
      setStatus("connected");
      controller = new AbortController();

      try {
        await connectBridge(
          bridgeToken,
          {
            onProposal: (proposal) => {
              if (proposal.status === "pending") {
                proposalsRef.current.set(proposal.id, proposal);
              } else {
                proposalsRef.current.delete(proposal.id);
              }
            },
            onApplyRequested: (id) => {
              const proposal = proposalsRef.current.get(id);
              if (!proposal) return;
              proposalsRef.current.delete(id);
              void applyProposal(proposal, bridgeToken);
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
  }, [probeNonce]);

  useEffect(() => {
    if (status !== "connected" || !token || !hydrated) return;
    const timer = window.setTimeout(() => {
      void pushCharacter(character, token);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [character, status, token, hydrated]);

  if (!local) return null;

  const view = STATUS_VIEW[status];
  const hint = status === "connected" ? "已连接" : status === "connecting" ? "连接中" : "未连接";

  return (
    <button
      type="button"
      title={`本地 AI 桥接${hint}，点击重新检测`}
      aria-label={`本地 AI 桥接${hint}，点击重新检测`}
      onClick={() => setProbeNonce((value) => value + 1)}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-zinc-100",
        status === "connected" ? "text-zinc-700" : "text-zinc-500",
      )}
    >
      <Bot className="h-3.5 w-3.5" />
      <span className={cn("h-1.5 w-1.5 rounded-full", view.dot)} />
      {view.label}
    </button>
  );
}

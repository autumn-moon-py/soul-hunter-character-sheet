"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { catalog } from "@/src/content";
import { derive } from "@/src/rules/derive";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";
import { Block, Line } from "./paper-kit";

const STYLE_EXCLUDED = new Set(["通用"]);
const STYLE_COSTS = [5, 10, 15, 20, 25] as const;

export function StyleBlock() {
  const character = useCharacterStore((state) => state.character);
  const setStyle = useCharacterStore((state) => state.setStyle);
  const setCombinedStyle = useCharacterStore((state) => state.setCombinedStyle);
  const derived = useMemo(() => derive(character), [character]);
  const [editing, setEditing] = useState(false);

  const styleOptions = catalog.styles.filter(
    (style) =>
      !STYLE_EXCLUDED.has(style.name) &&
      (!style.expansion || character.expansions.includes(style.expansion)),
  );
  const mode = character.style.mode ?? "preset";
  const selectedStyleIds = character.style.styleIds ?? [];
  const selectedStyles = styleOptions.filter((style) => selectedStyleIds.includes(style.id));
  const showEditor = editing || selectedStyleIds.length === 0;
  const universalActions = catalog.styleActions.filter((action) => action.style === "通用");
  const actions = character.style.actionIds.flatMap((id) => {
    const card = catalog.byId.get(id);
    return card && card.kind === "styleAction" ? [card] : [];
  });

  const rebuildActionIds = (styleIds: string[]) => {
    if (styleIds.length === 0) return [];
    const styles = catalog.styles.filter((style) => styleIds.includes(style.id));
    const selected = STYLE_COSTS.flatMap((cost) => {
      const current = character.style.actionIds.find((id) => {
        const action = catalog.byId.get(id);
        return (
          action?.kind === "styleAction" &&
          action.cost === cost &&
          action.style !== "通用" &&
          styles.some((style) => style.actionIds.includes(id))
        );
      });
      if (current) return [current];
      const candidate = catalog.styleActions.find(
        (action) =>
          action.style !== "通用" &&
          action.cost === cost &&
          styles.some((style) => style.actionIds.includes(action.id)),
      );
      return candidate ? [candidate.id] : [];
    });
    return [...selected, ...universalActions.map((action) => action.id)];
  };

  const toggleCombined = (checked: boolean) => {
    if (!checked) {
      setStyle(character.style.styleId ?? "");
      setEditing(false);
      return;
    }
    setCombinedStyle({
      name: "组合风格",
      styleIds: [],
      actionIds: [],
    });
    setEditing(true);
  };

  const toggleStyle = (styleId: string) => {
    setEditing(true);
    const next = selectedStyleIds.includes(styleId)
      ? selectedStyleIds.filter((id) => id !== styleId)
      : [...selectedStyleIds, styleId];
    setCombinedStyle({
      name: character.style.name ?? "组合风格",
      styleIds: next,
      actionIds: rebuildActionIds(next),
    });
  };

  const setCostAction = (cost: number, actionId: string) => {
    const universalIds = character.style.actionIds.filter((id) => {
      const action = catalog.byId.get(id);
      return action?.kind === "styleAction" && action.style === "通用";
    });
    const others = character.style.actionIds.filter((id) => {
      const action = catalog.byId.get(id);
      return action?.kind === "styleAction" && action.style !== "通用" && action.cost !== cost;
    });
    setCombinedStyle({
      name: character.style.name ?? "组合风格",
      styleIds: selectedStyleIds,
      actionIds: [...others, actionId, ...universalIds],
    });
  };

  const actionList = (
    <div className="space-y-1">
      {actions.map((action) => (
        <div
          key={action.id}
          className="border-b border-dashed border-[#e8e2d6] pb-1 last:border-0 last:pb-0"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-[11px] font-medium">{action.name}</span>
              {action.style === "通用" ? (
                <span className="shrink-0 rounded border border-[#d9d2c4] px-1 text-[8px] leading-4 text-[#8b8474]">
                  通用
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-[9px] text-[#8b8474]">{action.cost} 时髦值</span>
          </div>
          <p className="whitespace-pre-line text-[10px] leading-snug text-[#4a4438]">
            {action.effect}
          </p>
        </div>
      ))}
    </div>
  );

  return (
    <Block
      title="时髦动作"
      meta={
        <span className="tabular-nums">
          {character.style.actionIds.length} / {derived.quotas.styleActions}
        </span>
      }
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="inline-flex overflow-hidden rounded border border-[#d9d2c4]">
          <button
            type="button"
            className={cn(
              "px-2 py-0.5 text-[10px]",
              mode !== "combined" ? "bg-[#2b2b2b] text-white" : "bg-white text-[#4a4438]",
            )}
            onClick={() => mode === "combined" && toggleCombined(false)}
          >
            单一风格
          </button>
          <button
            type="button"
            className={cn(
              "px-2 py-0.5 text-[10px]",
              mode === "combined" ? "bg-[#2b2b2b] text-white" : "bg-white text-[#4a4438]",
            )}
            onClick={() => mode !== "combined" && toggleCombined(true)}
          >
            组合使用
          </button>
        </div>
        {mode === "combined" ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[#8b8474]">
              已选 {selectedStyleIds.length} 个风格
            </span>
            {selectedStyleIds.length > 0 ? (
              <button
                type="button"
                className="rounded border border-[#d9d2c4] px-1.5 py-0.5 text-[9px] text-[#4a4438] transition-colors hover:bg-[#f4f4f5]"
                onClick={() => setEditing((value) => !value)}
              >
                {showEditor ? "完成" : "编辑"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {mode === "combined" ? (
        showEditor ? (
          <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Line label="名称">
              <Input
                value={character.style.name ?? ""}
                onChange={(event) =>
                  setCombinedStyle({
                    name: event.target.value,
                    styleIds: selectedStyleIds,
                    actionIds: character.style.actionIds,
                  })
                }
              />
            </Line>

            <div>
              <div className="text-[9px] text-[#8b8474]">选择风格</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {styleOptions.map((style) => {
                  const active = selectedStyleIds.includes(style.id);
                  return (
                    <button
                      key={style.id}
                      type="button"
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                        active
                          ? "border-[#2b2b2b] bg-[#2b2b2b] text-white"
                          : "border-[#d9d2c4] bg-[#f7f4ed] text-[#4a4438] hover:border-[#a1a1aa]",
                      )}
                      onClick={() => toggleStyle(style.id)}
                    >
                      {style.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedStyleIds.length === 0 ? (
              <p className="rounded border border-dashed border-[#d9d2c4] px-2 py-3 text-center text-[10px] text-[#8b8474]">
                尚未选择风格。先选择一个或多个风格，再为每档消耗选择动作。
              </p>
            ) : (
              <div className="space-y-0.5">
              {STYLE_COSTS.map((cost) => {
                const currentId = character.style.actionIds.find((id) => {
                  const action = catalog.byId.get(id);
                  return (
                    action?.kind === "styleAction" &&
                    action.cost === cost &&
                    action.style !== "通用"
                  );
                });
                const options = catalog.styleActions.filter(
                  (action) =>
                    action.style !== "通用" &&
                    action.cost === cost &&
                    selectedStyles.some((style) => style.actionIds.includes(action.id)),
                );
                return (
                  <div key={cost} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 text-[10px] text-[#6b6455]">{cost} 点</span>
                    <Select
                      value={currentId ?? ""}
                      onValueChange={(value) => setCostAction(cost, value)}
                    >
                      <SelectTrigger className="h-6 text-[11px]">
                        <SelectValue placeholder="选择动作" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((action) => (
                          <SelectItem key={action.id} value={action.id}>
                            {action.style} · {action.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              </div>
            )}
          </div>

          <div>
            {selectedStyleIds.length === 0 ? (
              <p className="flex min-h-[96px] items-center justify-center rounded border border-dashed border-[#d9d2c4] px-3 py-3 text-center text-[10px] text-[#8b8474]">
                选择风格后，这里会显示可用动作和效果。
              </p>
            ) : (
              actionList
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <span className="text-[11px] font-semibold">
              {character.style.name?.trim() || "组合风格"}
            </span>
            <span className="text-[9px] text-[#8b8474]">
              {selectedStyles.map((style) => style.name).join(" + ")}
            </span>
          </div>
          {actionList}
        </div>
      )
    ) : (
      <>
        <Select
            value={character.style.styleId ?? ""}
            onValueChange={(value) => setStyle(value === "none" ? "" : value)}
          >
            <SelectTrigger className="h-6 text-[11px]">
              <SelectValue placeholder="选择风格" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-[#8b8474]">
                不选择
              </SelectItem>
              {styleOptions.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-1.5">{actionList}</div>
        </>
      )}
    </Block>
  );
}

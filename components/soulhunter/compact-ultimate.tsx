"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Block, Line } from "./paper-kit";

export function CompactUltimateBlock({ tier }: { tier: 1 | 2 }) {
  const character = useCharacterStore((state) => state.character);
  const setUltimate = useCharacterStore((state) => state.setUltimate);
  const derived = useMemo(() => derive(character), [character]);
  const [detailOpen, setDetailOpen] = useState(false);

  const selectedId =
    tier === 1 ? character.selections.ultimateTier1Id : character.selections.ultimateTier2Id;
  const options = catalog.ultimates.filter(
    (card) => card.tier === tier && (!card.expansion || character.expansions.includes(card.expansion)),
  );
  const selected = selectedId ? catalog.byId.get(selectedId) : undefined;
  const ultimate = selected?.kind === "ultimate" ? selected : undefined;
  const unlocked = derived.quotas.ultimates >= tier;

  return (
    <>
      <Block title={tier === 1 ? "一挡绝技" : "二挡绝技"} flush>
        <Line label="选择" labelWidth={44}>
          <Select
            value={selectedId ?? "none"}
            onValueChange={(value) => setUltimate(tier, value === "none" ? undefined : value)}
          >
            <SelectTrigger className="h-[22px] text-[11px]" disabled={!unlocked}>
              <SelectValue placeholder={unlocked ? "选择绝技" : "灵识不足"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">不选择</SelectItem>
              {options.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  {card.name}（{card.soul}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Line>

        {ultimate ? (
          <div className="border-t border-[#d9d2c4] px-2 py-0.5">
            <div className="flex flex-wrap gap-x-3 text-[9px] text-[#8b8474]">
              <span>类型：{ultimate.domain}</span>
              <span>对应魂魄：{ultimate.soul}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[#4a4438]">
              {ultimate.effect}
            </p>
            <button
              type="button"
              className="mt-0.5 text-[9px] text-[#8b8474] hover:text-[#3f3f46]"
              onClick={() => setDetailOpen(true)}
            >
              详情
            </button>
          </div>
        ) : (
          <p className="px-2 py-1 text-[10px] text-[#8b8474]">尚未选择</p>
        )}
      </Block>

      {ultimate ? (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="dialog-surface max-h-[80vh] overflow-y-auto p-5 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{ultimate.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-xs leading-relaxed">
              <p className="text-muted-foreground">
                {ultimate.soul} · {ultimate.domain}
              </p>
              <p className="whitespace-pre-line">{ultimate.effect}</p>
              <p className="whitespace-pre-line text-muted-foreground">{ultimate.description}</p>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

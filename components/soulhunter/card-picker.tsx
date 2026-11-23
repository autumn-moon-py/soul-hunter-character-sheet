"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BASE_MARTIAL_ID, catalog } from "@/src/content";
import { derive } from "@/src/rules/derive";
import { isSecretAllowed } from "@/src/rules/grades";
import type { AnyContentCard, SoulHunterCharacter } from "@/src/types";
import type { CardKind } from "@/lib/soulhunter/store";
import { CARD_KIND_LABEL, getQuota, isBaseCard } from "@/lib/soulhunter/card-kind";
import { isCardSelected, useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";
import { EmptyHint, MetaBadge } from "./ui-bits";


function cardsOfKind(kind: CardKind): AnyContentCard[] {
  switch (kind) {
    case "martial":
      return catalog.martialArts;
    case "spell":
      return catalog.spells;
    case "specialty":
      return catalog.specialties;
    case "imprint":
      return catalog.imprints;
  }
}



function cardText(card: AnyContentCard): string {
  if (card.kind === "martial") {
    return [card.name, card.cost, card.target, card.effect, card.flavor ?? ""].join(" ");
  }
  if (card.kind === "spell") {
    return [card.name, card.category, card.type, card.cost, card.target, card.effect, card.flavor ?? ""].join(" ");
  }
  if (card.kind === "specialty" || card.kind === "imprint") {
    return [card.name, card.description].join(" ");
  }
  return card.name;
}

const SPELL_CATEGORIES = ["符箓", "祷诀", "凭术", "阵法", "基础"] as const;

function costBucket(cost: string): "none" | "low" | "mid" | "high" {
  if (!cost || cost.includes("无")) return "none";
  const match = cost.match(/\d+/);
  const value = match ? Number(match[0]) : 0;
  if (value <= 2) return "low";
  if (value <= 4) return "mid";
  return "high";
}

function canAddCard(
  character: SoulHunterCharacter,
  kind: CardKind,
  card: AnyContentCard,
  quota: { used: number; max: number },
  selected: boolean,
): boolean {
  if (card.expansion && !character.expansions.includes(card.expansion)) return false;
  if (selected) return false;

  if (kind === "spell" && isBaseCard(kind, card.id)) return true;
  if (kind === "martial" && card.id === BASE_MARTIAL_ID) return true;

  if (quota.max - quota.used <= 0) return false;

  if (card.kind === "martial" && card.secret && !isSecretAllowed("body", character.attributes.body)) {
    return false;
  }
  if (card.kind === "spell" && card.secret && !isSecretAllowed("mind", character.attributes.mind)) {
    return false;
  }
  return true;
}

/** 替换时不占用新配额，但仍要满足秘传门槛 */
function canReplaceCard(
  character: SoulHunterCharacter,
  card: AnyContentCard,
  selected: boolean,
): boolean {
  if (card.expansion && !character.expansions.includes(card.expansion)) return false;
  if (selected) return false;
  if (card.kind === "martial" && card.secret && !isSecretAllowed("body", character.attributes.body)) {
    return false;
  }
  if (card.kind === "spell" && card.secret && !isSecretAllowed("mind", character.attributes.mind)) {
    return false;
  }
  return true;
}

const CardRow = memo(function CardRow({
  card,
  selected,
  enabled,
  base,
  onToggle,
}: {
  card: AnyContentCard;
  selected: boolean;
  enabled: boolean;
  base: boolean;
  onToggle: (id: string) => void;
}) {
  const effect =
    card.kind === "martial" || card.kind === "spell"
      ? card.effect
      : card.kind === "specialty" || card.kind === "imprint"
        ? card.description
        : "";

  return (
    <div
      data-selected={selected}
      className={cn(
        "entry-row card-row rounded-lg p-3",
        !enabled && !selected && "opacity-55",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{card.name}</span>
            {base ? <MetaBadge tone="accent">天生</MetaBadge> : null}
            {"secret" in card && card.secret ? <MetaBadge tone="outline">秘传</MetaBadge> : null}
            {card.expansion ? (
              <MetaBadge>{catalog.expansions.find((item) => item.id === card.expansion)?.name ?? card.expansion}</MetaBadge>
            ) : null}
            {card.kind === "spell" ? <MetaBadge>{card.category}</MetaBadge> : null}
            {card.kind === "spell" ? <MetaBadge>{card.type}</MetaBadge> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {"cost" in card ? <span>消耗：{card.cost}</span> : null}
            {"target" in card ? <span>目标：{card.target}</span> : null}
          </div>
          {effect ? (
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-foreground/80">
              {effect}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={selected ? "outline" : "default"}
          className={cn(
            "shrink-0",
            selected &&
              "border-border bg-muted text-muted-foreground hover:bg-muted",
          )}
          disabled={!selected && !enabled}
          onClick={() => onToggle(card.id)}
        >
          {selected ? (
            <>
              <Check className="mr-1 h-3.5 w-3.5" />
              已选
            </>
          ) : enabled ? (
            "选择"
          ) : (
            "不可选"
          )}
        </Button>
      </div>
    </div>
  );
});

export function CardPicker({
  kind,
  open,
  replaceId,
  onClose,
}: {
  kind: CardKind;
  open: boolean;
  replaceId?: string;
  onClose: () => void;
}) {
  const character = useCharacterStore((state) => state.character);
  const [query, setQuery] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [hideSelected, setHideSelected] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [secretFilter, setSecretFilter] = useState("all");
  const [costFilter, setCostFilter] = useState("all");
  const showTypeFilters = kind === "spell" || kind === "martial";
  const [isTwoColumn, setIsTwoColumn] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const update = () => setIsTwoColumn(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const derived = useMemo(() => derive(character), [character]);
  const quota = useMemo(
    () => getQuota(character, kind, derived),
    [character, kind, derived],
  );
  const allCards = useMemo(() => cardsOfKind(kind), [kind]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return allCards.filter((card) => {
      if (term && !cardText(card).toLowerCase().includes(term)) return false;
      if (
        kind === "spell" &&
        card.kind === "spell" &&
        typeFilter !== "all" &&
        card.category !== typeFilter
      ) {
        return false;
      }
      if (kind === "martial" && card.kind === "martial") {
        if (typeFilter === "support" && !card.support) return false;
        if (typeFilter === "normal" && card.support) return false;
      }
      if (showTypeFilters && secretFilter !== "all") {
        const isSecret = "secret" in card && card.secret;
        if (secretFilter === "secret" && !isSecret) return false;
        if (secretFilter === "normal" && isSecret) return false;
      }
      if (showTypeFilters && costFilter !== "all") {
        if ("cost" in card && costBucket(String(card.cost)) !== costFilter) return false;
      }
      const selected = isCardSelected(character, kind, card.id);
      if (hideSelected && selected) return false;
      if (replaceId) return !selected && canReplaceCard(character, card, selected);
      return onlyAvailable
        ? canAddCard(character, kind, card, quota, selected) || selected
        : true;
    });
  }, [allCards, character, hideSelected, kind, onlyAvailable, query, quota, replaceId, showTypeFilters, secretFilter, typeFilter, costFilter]);

  // 两列时按奇偶交替分配，保持左右阅读顺序，同时每列内部间距一致
  const columns = useMemo(() => {
    const left: AnyContentCard[] = [];
    const right: AnyContentCard[] = [];
    filtered.forEach((card, index) => {
      if (index % 2 === 0) left.push(card);
      else right.push(card);
    });
    return { left, right };
  }, [filtered]);

  const handleToggle = useCallback(
    (cardId: string) => {
      const state = useCharacterStore.getState();
      if (replaceId) {
        state.replaceCard(kind, replaceId, cardId);
        onClose();
        return;
      }
      if (isCardSelected(state.character, kind, cardId)) {
        state.removeCard(kind, cardId);
      } else {
        state.addCard(kind, cardId);
      }
    },
    [kind, onClose, replaceId],
  );

  const renderCard = (card: AnyContentCard) => {
    const selected = isCardSelected(character, kind, card.id);
    return (
      <CardRow
        key={card.id}
        card={card}
        selected={selected}
        enabled={
          replaceId
            ? canReplaceCard(character, card, selected)
            : canAddCard(character, kind, card, quota, selected)
        }
        base={isBaseCard(kind, card.id)}
        onToggle={handleToggle}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="dialog-surface flex h-[min(760px,88vh)] w-[min(1080px,calc(100vw-1rem))] max-w-none flex-col gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            {replaceId ? "替换" : "选择"}
            {CARD_KIND_LABEL[kind]}
            <span className="rounded border bg-muted px-1.5 py-0.5 text-xs font-normal tabular-nums text-muted-foreground">
              {quota.used} / {quota.max}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
          {showTypeFilters ? (
            <>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[108px] text-xs" aria-label="类别筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {kind === "spell" ? "全部类别" : "全部类型"}
                  </SelectItem>
                  {kind === "spell" ? (
                    SPELL_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="support">辅助</SelectItem>
                      <SelectItem value="normal">非辅助</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <Select value={secretFilter} onValueChange={setSecretFilter}>
                <SelectTrigger className="h-9 w-[96px] text-xs" aria-label="秘传筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部秘传</SelectItem>
                  <SelectItem value="secret">仅秘传</SelectItem>
                  <SelectItem value="normal">非秘传</SelectItem>
                </SelectContent>
              </Select>
              <Select value={costFilter} onValueChange={setCostFilter}>
                <SelectTrigger className="h-9 w-[104px] text-xs" aria-label="消耗筛选">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部消耗</SelectItem>
                  <SelectItem value="none">无消耗</SelectItem>
                  <SelectItem value="low">1-2 点</SelectItem>
                  <SelectItem value="mid">3-4 点</SelectItem>
                  <SelectItem value="high">5 点以上</SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : null}
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名称、效果、类别……"
              className="h-9 pl-8"
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-2.5 text-muted-foreground"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={onlyAvailable}
                onCheckedChange={(checked) => setOnlyAvailable(checked === true)}
              />
              只显示可选
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={hideSelected}
                onCheckedChange={(checked) => setHideSelected(checked === true)}
              />
              隐藏已添加
            </label>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-5 py-3">
            {filtered.length === 0 ? (
              <EmptyHint>没有匹配的内容。</EmptyHint>
            ) : isTwoColumn ? (
              <div className="grid grid-cols-2 items-start gap-3">
                <div className="flex flex-col gap-3">{columns.left.map(renderCard)}</div>
                <div className="flex flex-col gap-3">{columns.right.map(renderCard)}</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">{filtered.map(renderCard)}</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

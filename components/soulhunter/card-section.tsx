"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  BASE_MARTIAL_ID,
  BASE_SPELL_ID,
  CHOICE_BASE_SPELL_IDS,
  catalog,
} from "@/src/content";
import { derive } from "@/src/rules/derive";
import type { AnyContentCard, DerivedStats, SoulHunterCharacter } from "@/src/types";
import type { CardKind } from "@/lib/soulhunter/store";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { CARD_KIND_LABEL, getQuota, getSelectedIds, isBaseCard } from "@/lib/soulhunter/card-kind";
import { cn } from "@/lib/utils";
import { Block } from "./paper-kit";
import { CardPicker } from "./card-picker";

function canRemove(character: SoulHunterCharacter, kind: CardKind, id: string): boolean {
  if (kind === "martial" && id === BASE_MARTIAL_ID) return false;
  if (kind === "spell" && id === BASE_SPELL_ID) return false;
  if (
    kind === "spell" &&
    character.attributes.mind >= 5 &&
    CHOICE_BASE_SPELL_IDS.includes(id as (typeof CHOICE_BASE_SPELL_IDS)[number])
  ) {
    return false;
  }
  return true;
}

function baseIdsOf(kind: CardKind, derived: DerivedStats): string[] {
  if (kind === "martial") return [BASE_MARTIAL_ID];
  if (kind === "spell") return derived.baseSpellIds;
  return [];
}

function cardMeta(card: AnyContentCard): string {
  if (card.kind === "martial") {
    return `消耗 ${card.cost} · 目标 ${card.target} · 灵能力辅助：${card.support ? "可" : "不可"}`;
  }
  if (card.kind === "spell") return `${card.category} · 消耗 ${card.cost} · 目标 ${card.target}`;
  return "";
}

function cardBody(card: AnyContentCard): string {
  if (card.kind === "martial" || card.kind === "spell") return card.effect;
  if (card.kind === "specialty" || card.kind === "imprint") return card.description;
  return "";
}

function CardEntry({
  card,
  kind,
  meta,
  removable,
  onRemove,
  onReplace,
  compact = false,
}: {
  card: AnyContentCard;
  kind: CardKind;
  meta: string;
  removable: boolean;
  onRemove: () => void;
  onReplace: () => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const body = cardBody(card);
  const long = body.length > 48;

  return (
    <article className={cn("group rounded border border-paper-line", compact ? "p-1" : "p-1.5")}>
      <div className="flex items-start justify-between gap-1">
        <span className="min-w-0 text-pc-md font-medium leading-tight">{card.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          {isBaseCard(kind, card.id) ? (
            <span className="text-pc-xs text-ink-hint">天生</span>
          ) : null}
          {"secret" in card && card.secret ? (
            <span className="text-pc-xs text-ink-hint">秘传</span>
          ) : null}
          {removable ? (
            <span className="hidden items-center gap-1 group-hover:flex">
              <button
                type="button"
                className="text-pc-xs text-ink-hint hover:text-ink"
                onClick={onReplace}
              >
                替换
              </button>
              <button
                type="button"
                aria-label={`移除${card.name}`}
                className="text-ink-hint hover:text-destructive"
                onClick={onRemove}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : null}
        </span>
      </div>

      {compact ? (
        (meta || long) ? (
          <div className="flex items-baseline justify-between gap-2 text-pc-xs text-ink-muted">
            <span className="min-w-0">{meta}</span>
            {long ? (
              <button
                type="button"
                data-export-expand
                data-export-label
                className="shrink-0 text-ink-hint hover:text-ink-soft"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "收起" : "展开"}
              </button>
            ) : null}
          </div>
        ) : null
      ) : meta ? (
        <div className="text-pc-xs text-ink-muted">{meta}</div>
      ) : null}

      {body ? (
        compact ? (
          <p
            data-export-collapsible
            data-export-clamp="line-clamp-2"
            className={cn(
              "mt-0.5 whitespace-pre-line text-pc-sm leading-snug text-ink-soft",
              long && !expanded && "line-clamp-2",
            )}
          >
            {body}
          </p>
        ) : (
          <div className="mt-0.5 border-t border-dashed border-paper-line-faint pt-0.5">
            <button
              type="button"
              data-export-expand
              className="block w-full text-left"
              aria-expanded={expanded}
              onClick={() => long && setExpanded((value) => !value)}
            >
              <span
                data-export-collapsible
                data-export-clamp="line-clamp-3"
                className={cn(
                  "block whitespace-pre-line text-pc-sm leading-snug text-ink-soft",
                  long && !expanded && "line-clamp-3",
                )}
              >
                {body}
              </span>
            </button>
            {long ? (
              <button
                type="button"
                data-export-expand
                data-export-label
                className="mt-0.5 text-pc-xs text-ink-hint hover:text-ink-soft"
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "收起" : "展开"}
              </button>
            ) : null}
          </div>
        )
      ) : null}
    </article>
  );
}

export function CardSection({
  kind,
  embedded = false,
}: {
  kind: CardKind;
  embedded?: boolean;
}) {
  const character = useCharacterStore((state) => state.character);
  const removeCard = useCharacterStore((state) => state.removeCard);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replaceId, setReplaceId] = useState<string>();

  const derived = useMemo(() => derive(character), [character]);
  const quota = getQuota(character, kind, derived);
  const baseIds = baseIdsOf(kind, derived);
  const ids = getSelectedIds(character, kind);
  const cards = ids.flatMap((id) => {
    const card = catalog.byId.get(id);
    return card ? [card] : [];
  });
  const canAdd = quota.used < quota.max;

  const openPicker = (target?: string) => {
    setReplaceId(target);
    setPickerOpen(true);
  };

  const content =
    quota.max === 0 && cards.length === 0 ? (
      <p className="flex items-center justify-center rounded border border-dashed border-paper-line py-3 text-pc-xs text-ink-hint">
        未解锁
      </p>
    ) : (
      <div className={cn("grid", embedded ? "gap-1.5" : "gap-0.5")}>
        {cards.map((card) => (
          <CardEntry
            key={card.id}
            card={card}
            kind={kind}
            meta={cardMeta(card)}
            compact
            removable={canRemove(character, kind, card.id) && !baseIds.includes(card.id)}
            onRemove={() => removeCard(kind, card.id)}
            onReplace={() => openPicker(card.id)}
          />
        ))}
        {canAdd ? (
          <button
            type="button"
            className="flex min-h-[38px] items-center justify-center gap-1 self-start rounded border border-dashed border-paper-line text-pc-xs text-ink-hint transition-colors hover:border-paper-line-hover hover:text-ink-soft"
            onClick={() => openPicker()}
          >
            <Plus className="h-3 w-3" />
            添加{CARD_KIND_LABEL[kind]}
          </button>
        ) : null}
      </div>
    );

  const picker = (
    <CardPicker
      kind={kind}
      open={pickerOpen}
      replaceId={replaceId}
      onClose={() => {
        setPickerOpen(false);
        setReplaceId(undefined);
      }}
    />
  );

  if (embedded) {
    return (
      <>
        <div>
          <div className="flex h-6 items-center justify-between border-b border-paper-line bg-paper-tint px-2 text-pc-xs font-medium text-ink-soft">
            <span>{CARD_KIND_LABEL[kind]}</span>
            <span className="text-pc-xs tabular-nums">
              {quota.used} / {quota.max}
            </span>
          </div>
          <div className="mx-2 my-1.5">{content}</div>
        </div>
        {picker}
      </>
    );
  }

  return (
    <>
      <Block
        title={CARD_KIND_LABEL[kind]}
        meta={
          <span className="tabular-nums">
            {kind === "martial" ? `强度 ${derived.strengths.body} · ` : null}
            {kind === "spell" ? `强度 ${derived.strengths.mind} · ` : null}
            {quota.used} / {quota.max}
          </span>
        }
      >
        {content}
      </Block>
      {picker}
    </>
  );
}

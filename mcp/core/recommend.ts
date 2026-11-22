import { catalog } from "../../src/content";
import { derive } from "../../src/rules/derive";
import { extractAbilityTags, isSecretAllowed } from "../../src/rules/grades";
import type { AnyContentCard, SoulHunterCharacter } from "../../src/types";
import { quotaUsage } from "./character";

export type RecommendKind = "martial" | "spell" | "specialty" | "imprint" | "ultimate";

export interface RecommendInput {
  kind: RecommendKind;
  intent?: string;
  limit?: number;
}

function fullEffect(entry: AnyContentCard): string {
  if (entry.kind === "imprint" || entry.kind === "specialty" || entry.kind === "bond") {
    return entry.description;
  }
  if (entry.kind === "ultimate") return `${entry.description}\n${entry.effect}`;
  return entry.effect;
}

function splitKeywords(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/[\s,，、。；;:：/|【】[\]]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function matchedKeywords(text: string, keywords: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
}

function expansionBlocked(character: SoulHunterCharacter, entry: AnyContentCard): boolean {
  return Boolean(entry.expansion && !character.expansions.includes(entry.expansion));
}

function selectedIdsOf(character: SoulHunterCharacter, kind: RecommendKind): Set<string> {
  switch (kind) {
    case "martial":
      return new Set(character.selections.martialArtIds);
    case "spell":
      return new Set(character.selections.spellIds);
    case "specialty":
      return new Set(character.selections.specialtyIds);
    case "imprint":
      return new Set(character.selections.imprintIds);
    case "ultimate":
      return new Set(
        [character.selections.ultimateTier1Id, character.selections.ultimateTier2Id].filter(
          (id): id is string => Boolean(id),
        ),
      );
  }
}

function poolOf(kind: RecommendKind): AnyContentCard[] {
  switch (kind) {
    case "martial":
      return catalog.martialArts;
    case "spell":
      return catalog.spells;
    case "specialty":
      return catalog.specialties;
    case "imprint":
      return catalog.imprints;
    case "ultimate":
      return catalog.ultimates;
  }
}

export function recommendCards(
  character: SoulHunterCharacter,
  input: RecommendInput,
): Record<string, unknown> {
  const derived = derive(character);
  const quotas = quotaUsage(character, derived);
  const selected = selectedIdsOf(character, input.kind);
  const intentKeywords = splitKeywords(input.intent);
  const abilityKeywords = extractAbilityTags(character.ability.description);
  const keywords = [...intentKeywords, ...abilityKeywords];
  const notes: string[] = [];

  if (character.expansions.length === 0) {
    notes.push("当前未启用任何扩展，扩展卡不会出现在候选中。");
  }

  const quotaKey =
    input.kind === "martial"
      ? "martial"
      : input.kind === "spell"
        ? "spell"
        : input.kind === "specialty"
          ? "specialty"
          : input.kind === "imprint"
            ? "imprint"
            : "ultimate";
  const quota = quotas[quotaKey];

  const candidates = poolOf(input.kind)
    .filter((entry) => !expansionBlocked(character, entry))
    .map((entry) => {
      const reasons: string[] = [];
      let available = true;

      if (selected.has(entry.id)) {
        return null;
      }
      reasons.push("尚未选择");

      if (entry.kind === "martial" || entry.kind === "spell") {
        const attribute = entry.kind === "martial" ? "body" : "mind";
        if (entry.secret && !isSecretAllowed(attribute, character.attributes[attribute])) {
          available = false;
          reasons.push(`${attribute === "body" ? "体魄" : "智慧"}未达 SS，秘传不可选`);
        }
      }

      if (entry.kind === "ultimate") {
        if (entry.tier === 2 && derived.quotas.ultimates < 2) {
          available = false;
          reasons.push("灵识未达 18，二挡绝技未解锁");
        }
        if (entry.tier === 1 && derived.quotas.ultimates < 1) {
          available = false;
          reasons.push("灵识未达 14，一挡绝技未解锁");
        }
      }

      if (quota.remaining <= 0) {
        available = false;
        reasons.push(`配额已满（${quota.used}/${quota.max}），需要先替换`);
      } else {
        reasons.push(`配额尚余 ${quota.remaining}`);
      }

      const text = `${entry.name} ${fullEffect(entry)}`;
      const matched = matchedKeywords(text, keywords);

      return {
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        expansion: entry.expansion ?? null,
        available,
        reasons,
        matchedKeywords: matched,
        effect: fullEffect(entry),
        raw: entry,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.matchedKeywords.length !== b.matchedKeywords.length) {
        return b.matchedKeywords.length - a.matchedKeywords.length;
      }
      return a.name.localeCompare(b.name, "zh-CN");
    });

  const limit = input.limit ?? 10;

  return {
    kind: input.kind,
    intent: input.intent ?? null,
    quota,
    notes,
    total: candidates.length,
    candidates: candidates.slice(0, limit).map(({ raw: _raw, ...rest }) => rest),
  };
}

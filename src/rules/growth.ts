import { catalog as defaultCatalog } from "../content";
import type {
  AttributeId,
  ContentCatalog,
  SoulHunterCharacter,
} from "../types";
import { BASE, GROWTH_COSTS } from "./constants";
import { derive } from "./derive";

export interface GrowthResult {
  ok: boolean;
  character: SoulHunterCharacter;
  error?: string;
}

function clone(character: SoulHunterCharacter): SoulHunterCharacter {
  return structuredClone(character);
}

function expOf(character: SoulHunterCharacter): number {
  return character.resources.exp ?? 0;
}

export function canIncreaseInsight(character: SoulHunterCharacter): boolean {
  return expOf(character) >= GROWTH_COSTS.insight;
}

export function tryIncreaseInsight(
  character: SoulHunterCharacter,
  attribute: AttributeId,
): GrowthResult {
  if (!canIncreaseInsight(character)) {
    return {
      ok: false,
      character,
      error: `提升灵识需要 ${GROWTH_COSTS.insight} 点经验，当前只有 ${expOf(character)} 点`,
    };
  }

  const max = BASE.attributeMax;
  if (character.attributes[attribute] >= max) {
    return {
      ok: false,
      character,
      error: `属性 ${attribute} 已达到当前上限 ${max}`,
    };
  }

  const next = clone(character);
  next.resources.exp = expOf(character) - GROWTH_COSTS.insight;
  next.insight += 1;
  next.attributes[attribute] += 1;
  return { ok: true, character: next };
}

export function canCreateImprint(
  character: SoulHunterCharacter,
  options: { catalog?: ContentCatalog } = {},
): boolean {
  const catalog = options.catalog ?? defaultCatalog;
  const quota = derive(character, { catalog }).quotas.imprints;
  return (
    expOf(character) >= GROWTH_COSTS.imprint &&
    character.selections.imprintIds.length < quota
  );
}

export function tryCreateImprint(
  character: SoulHunterCharacter,
  imprintId: string,
  options: { catalog?: ContentCatalog } = {},
): GrowthResult {
  const catalog = options.catalog ?? defaultCatalog;
  if (expOf(character) < GROWTH_COSTS.imprint) {
    return {
      ok: false,
      character,
      error: `锻造灵能印记需要 ${GROWTH_COSTS.imprint} 点经验`,
    };
  }
  const card = catalog.byId.get(imprintId);
  if (!card || card.kind !== "imprint") {
    return { ok: false, character, error: `灵能印记不存在：${imprintId}` };
  }
  if (card.expansion && !character.expansions.includes(card.expansion)) {
    return { ok: false, character, error: `灵能印记「${card.name}」所属扩展未启用` };
  }
  if (character.selections.imprintIds.includes(imprintId)) {
    return { ok: false, character, error: `已经拥有灵能印记「${card.name}」` };
  }
  const quota = derive(character, { catalog }).quotas.imprints;
  if (character.selections.imprintIds.length >= quota) {
    return {
      ok: false,
      character,
      error: `灵能印记数量已达上限 ${quota}，需要先提升心魂或灵识`,
    };
  }

  const next = clone(character);
  next.resources.exp = expOf(character) - GROWTH_COSTS.imprint;
  next.selections.imprintIds = [...next.selections.imprintIds, imprintId];
  return { ok: true, character: next };
}

export function canCreateExperienceTag(character: SoulHunterCharacter): boolean {
  return expOf(character) >= GROWTH_COSTS.experienceTag && character.experienceTags.length < 3;
}

export function tryCreateExperienceTag(
  character: SoulHunterCharacter,
  tag: string,
): GrowthResult {
  const trimmed = tag.trim();
  if (!trimmed) {
    return { ok: false, character, error: "经历标签不能为空" };
  }
  if (expOf(character) < GROWTH_COSTS.experienceTag) {
    return {
      ok: false,
      character,
      error: `创造经历标签需要 ${GROWTH_COSTS.experienceTag} 点经验`,
    };
  }
  if (character.experienceTags.length >= 3) {
    return {
      ok: false,
      character,
      error: "经历标签已达上限 3 个，需要先替换旧的标签",
    };
  }
  if (character.experienceTags.includes(trimmed)) {
    return { ok: false, character, error: `已经拥有经历标签「${trimmed}」` };
  }

  const next = clone(character);
  next.resources.exp = expOf(character) - GROWTH_COSTS.experienceTag;
  next.experienceTags = [...next.experienceTags, trimmed];
  return { ok: true, character: next };
}

/** 用新标签替换已有经历标签，同样消耗 4 点经验 */
export function tryReplaceExperienceTag(
  character: SoulHunterCharacter,
  oldTag: string,
  newTag: string,
): GrowthResult {
  const trimmed = newTag.trim();
  if (!trimmed) {
    return { ok: false, character, error: "经历标签不能为空" };
  }
  if (!character.experienceTags.includes(oldTag)) {
    return { ok: false, character, error: `没有找到要替换的经历标签「${oldTag}」` };
  }
  if (character.experienceTags.includes(trimmed)) {
    return { ok: false, character, error: `已经拥有经历标签「${trimmed}」` };
  }
  if (expOf(character) < GROWTH_COSTS.experienceTag) {
    return {
      ok: false,
      character,
      error: `替换经历标签需要 ${GROWTH_COSTS.experienceTag} 点经验`,
    };
  }

  const next = clone(character);
  next.resources.exp = expOf(character) - GROWTH_COSTS.experienceTag;
  next.experienceTags = next.experienceTags.map((tag) => (tag === oldTag ? trimmed : tag));
  return { ok: true, character: next };
}

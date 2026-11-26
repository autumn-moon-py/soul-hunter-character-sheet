import type { ContentCatalog, SoulHunterStyle } from "../types";
import {
  MARTIAL_THRESHOLDS,
  SPELL_THRESHOLDS,
} from "./constants";
import { strengthFromValue } from "./grades";

export function martialQuota(body: number): number {
  const base = MARTIAL_THRESHOLDS.filter((threshold) => body >= threshold).length;
  // 官方拓展允许属性突破 9，体魄达到 11 时再多一项
  return base + (body >= 11 ? 1 : 0);
}

export function spellQuota(mind: number): number {
  return 2 * SPELL_THRESHOLDS.filter((threshold) => mind >= threshold).length;
}

export function specialtyQuota(insight: number): number {
  if (insight >= 16) return 2;
  if (insight >= 10) return 1;
  return 0;
}

export function ultimateQuota(insight: number): number {
  if (insight >= 18) return 2;
  if (insight >= 14) return 1;
  return 0;
}

export function imprintQuota(insight: number, soul: number): number {
  const strength = strengthFromValue(soul);
  // 需先觉醒灵魂武器；配额不能超过心魂强度
  if (!(insight >= 12 || soul >= 3) || strength < 1) return 0;
  return strength;
}

/** 天生术法：灵迹固定；凝爆/超感在智慧 5 时补全 */
export function baseSpellCount(mind: number): number {
  return mind >= 5 ? 3 : 2;
}

export function universalStyleActions(
  catalog: ContentCatalog,
  expansions: readonly string[],
): string[] {
  return catalog.styleActions
    .filter(
      (action) =>
        action.style === "通用" &&
        (!action.expansion || expansions.includes(action.expansion)),
    )
    .map((action) => action.id);
}

export function styleActionQuota(
  catalog: ContentCatalog,
  style: SoulHunterStyle,
  expansions: readonly string[],
): number {
  const universal = universalStyleActions(catalog, expansions).length;
  if (style.mode === "combined") {
    return 5 + universal;
  }
  const preset = catalog.styles.find((candidate) => candidate.id === style.styleId);
  if (!preset || preset.name === "通用") {
    return universal;
  }
  return preset.actionIds.length + universal;
}

export function requiredStyleActionIds(
  catalog: ContentCatalog,
  style: SoulHunterStyle,
  expansions: readonly string[],
): string[] {
  const universal = universalStyleActions(catalog, expansions);
  if (style.mode === "combined") {
    return universal;
  }
  const preset = catalog.styles.find((candidate) => candidate.id === style.styleId);
  if (!preset || preset.name === "通用") {
    return universal;
  }
  return [...preset.actionIds, ...universal];
}

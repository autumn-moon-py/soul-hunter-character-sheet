import { GROWTH_COSTS, INSIGHT_UNLOCKS } from "../../src/rules/constants";
import { derive } from "../../src/rules/derive";
import { tryIncreaseInsight } from "../../src/rules/growth";
import type { AttributeId, SoulHunterCharacter } from "../../src/types";

export type GrowthGoal = "insight" | "specialty" | "ultimate" | "imprint" | "any";

interface GrowthStep {
  action: string;
  cost: number;
  attribute?: AttributeId;
  insight?: number;
  unlock?: string | null;
  note?: string;
}

function nextUnlockAfter(insight: number) {
  return INSIGHT_UNLOCKS.find((entry) => entry.insight > insight) ?? null;
}

function targetInsight(character: SoulHunterCharacter, goal: GrowthGoal): number {
  const current = character.insight;
  switch (goal) {
    case "insight":
    case "any":
      return nextUnlockAfter(current)?.insight ?? current;
    case "imprint":
      return Math.max(current, 12);
    case "specialty":
      if (current < 10) return 10;
      if (current < 16) return 16;
      return current;
    case "ultimate":
      if (current < 14) return 14;
      if (current < 18) return 18;
      return current;
  }
}

export function planGrowth(
  character: SoulHunterCharacter,
  input: { expBudget?: number; goal?: GrowthGoal } = {},
): Record<string, unknown> {
  const budget = input.expBudget ?? character.resources.exp ?? 0;
  const goal = input.goal ?? "any";
  let remaining = budget;
  let current = structuredClone(character);
  current.resources.exp = remaining;

  const steps: GrowthStep[] = [];
  const warnings: string[] = [];

  const preferred: AttributeId[] =
    goal === "imprint" ? ["soul", "body", "mind"] : ["mind", "soul", "body"];
  const allAttributes: AttributeId[] = ["body", "mind", "soul"];
  const target = targetInsight(current, goal);

  while (remaining >= GROWTH_COSTS.insight && current.insight < target) {
    const attribute =
      preferred.find((id) => current.attributes[id] < 9) ??
      allAttributes.find((id) => current.attributes[id] < 9);
    if (!attribute) {
      warnings.push("三项属性均达到上限 9，无法继续提升灵识。");
      break;
    }
    current.resources.exp = remaining;
    const result = tryIncreaseInsight(current, attribute);
    if (!result.ok) {
      warnings.push(result.error ?? "提升灵识失败。");
      break;
    }
    current = result.character;
    remaining = current.resources.exp ?? 0;
    steps.push({
      action: "increase-insight",
      attribute,
      cost: GROWTH_COSTS.insight,
      insight: current.insight,
      unlock: INSIGHT_UNLOCKS.find((entry) => entry.insight === current.insight)?.label ?? null,
    });
  }

  if (goal === "imprint" || goal === "any" || goal === "insight") {
    const derived = derive(current);
    let imprintCount = current.selections.imprintIds.length;
    while (remaining >= GROWTH_COSTS.imprint && imprintCount < derived.quotas.imprints) {
      steps.push({
        action: "create-imprint",
        cost: GROWTH_COSTS.imprint,
        note: "需要选择具体灵能印记",
      });
      remaining -= GROWTH_COSTS.imprint;
      imprintCount += 1;
    }
    if (imprintCount >= derived.quotas.imprints && remaining >= GROWTH_COSTS.imprint) {
      warnings.push(
        derived.quotas.imprints === 0
          ? "灵能印记尚未解锁，需要灵识达到 12 或心魂达到 3。"
          : "灵能印记配额已满，继续锻造需要先提升心魂或灵识。",
      );
    }
  }

  if (goal === "any") {
    let tagCount = current.experienceTags.length;
    while (remaining >= GROWTH_COSTS.experienceTag && tagCount < 3) {
      steps.push({
        action: "create-experience-tag",
        cost: GROWTH_COSTS.experienceTag,
        note: "需要提供具体经历标签",
      });
      remaining -= GROWTH_COSTS.experienceTag;
      tagCount += 1;
    }
  }

  return {
    expBudget: budget,
    goal,
    spent: budget - remaining,
    remaining,
    targetInsight: target,
    resultingInsight: current.insight,
    resultingAttributes: current.attributes,
    steps,
    warnings,
    nextUnlock: nextUnlockAfter(current.insight),
  };
}

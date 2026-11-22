import { describe, expect, it } from "vitest";
import { catalog } from "../../src/content";
import { createInitialCharacter } from "../../src/rules/create-character";
import { derive } from "../../src/rules/derive";
import { createLegalCharacter } from "../../src/rules/fixtures";
import { searchCards } from "./catalog";
import { explainCharacter, quotaUsage } from "./character";
import { checkContent } from "./checks";
import { diffCharacters } from "./diff";
import { planGrowth } from "./growth-plan";
import { recommendCards } from "./recommend";

describe("catalog", () => {
  it("按类型和关键词过滤，并遵守 limit", () => {
    const result = searchCards({ kind: "martial", query: "掌", limit: 1 }) as {
      total: number;
      returned: number;
      items: Array<{ kind: string; name: string }>;
    };
    expect(result.total).toBeGreaterThan(1);
    expect(result.returned).toBe(1);
    expect(result.items[0]?.kind).toBe("martial");
    expect(result.items[0]?.name).toContain("掌");
  });
});

describe("recommendCards", () => {
  it("体魄未达 SS 时过滤秘传武技", () => {
    const character = createLegalCharacter();
    character.selections.martialArtIds = ["martial.常规攻击"];
    character.attributes.body = 4;

    const secret = catalog.martialArts.find((card) => card.secret);
    expect(secret).toBeDefined();

    const result = recommendCards(character, { kind: "martial", limit: 100 }) as {
      candidates: Array<{ id: string; available: boolean; reasons: string[] }>;
    };
    const candidate = result.candidates.find((item) => item.id === secret!.id);
    expect(candidate).toBeDefined();
    expect(candidate!.available).toBe(false);
    expect(candidate!.reasons.join("")).toContain("秘传");
  });

  it("配额满时把候选标记为不可用", () => {
    const character = createLegalCharacter();
    const usage = quotaUsage(character).spell;
    expect(usage.remaining).toBe(0);

    const result = recommendCards(character, { kind: "spell", limit: 5 }) as {
      candidates: Array<{ available: boolean; reasons: string[] }>;
    };
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      expect(candidate.available).toBe(false);
      expect(candidate.reasons.join("")).toContain("配额已满");
    }
  });
});

describe("explainCharacter", () => {
  it("从描述里的「」提取灵能力标签并计入配额", () => {
    const character = createLegalCharacter();
    character.ability.description = "「甲」「乙」「丙」";
    expect(quotaUsage(character).abilityTags).toEqual({
      used: 3,
      max: 3,
      remaining: 0,
    });
  });

  it("派生值与 derive 一致", () => {
    const character = createLegalCharacter();
    const explained = explainCharacter(character) as {
      resources: { hpMax: number; mpMax: number; defense: number };
      skillPoints: { total: number; remaining: number };
    };
    const derived = derive(character);

    expect(explained.resources.hpMax).toBe(derived.hpMax);
    expect(explained.resources.mpMax).toBe(derived.mpMax);
    expect(explained.resources.defense).toBe(derived.defense);
    expect(explained.skillPoints.total).toBe(derived.skillPointsTotal);
    expect(explained.skillPoints.remaining).toBe(derived.skillPointsRemaining);
  });
});

describe("planGrowth", () => {
  it("花销与剩余经验守恒", () => {
    const plan = planGrowth(createLegalCharacter(), { expBudget: 20 }) as {
      spent: number;
      remaining: number;
      steps: Array<{ cost: number }>;
      resultingInsight: number;
    };

    const stepTotal = plan.steps.reduce((total, step) => total + step.cost, 0);
    expect(stepTotal).toBe(plan.spent);
    expect(plan.spent + plan.remaining).toBe(20);
    expect(plan.resultingInsight).toBeGreaterThan(9);
  });

  it("预算不足时不产生步骤", () => {
    const character = createInitialCharacter("no-budget");
    character.resources.exp = 0;
    const plan = planGrowth(character, { expBudget: 0 }) as { steps: unknown[] };
    expect(plan.steps).toHaveLength(0);
  });
});

describe("diffCharacters", () => {
  it("识别属性与数组变化", () => {
    const before = createLegalCharacter();
    const after = structuredClone(before);
    after.attributes.body = 5;
    after.selections.spellIds = [...after.selections.spellIds, "spell.超感"];

    const { changes } = diffCharacters(before, after);
    expect(changes.some((change) => change.path === "attributes.body")).toBe(true);
    expect(changes.some((change) => change.path === "selections.spellIds")).toBe(true);
  });
});

describe("checkContent", () => {
  it("读取报告并与运行时卡池一致", async () => {
    const result = (await checkContent(process.cwd())) as {
      summary: { errors: number };
      catalogCounts: { martial: number; spell: number };
    };
    expect(result.summary.errors).toBe(0);
    expect(result.catalogCounts.martial).toBe(catalog.martialArts.length);
    expect(result.catalogCounts.spell).toBe(catalog.spells.length);
  });
});

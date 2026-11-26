import { describe, expect, it } from "vitest";
import type { SoulHunterCharacter } from "../types";
import { derive } from "./derive";
import { createLegalCharacter } from "./fixtures";

function withAttributes(
  character: SoulHunterCharacter,
  attributes: SoulHunterCharacter["attributes"],
  insight: number,
): SoulHunterCharacter {
  return { ...character, attributes, insight };
}

describe("derive", () => {
  it("derives a legal creation character", () => {
    const derived = derive(createLegalCharacter());

    expect(derived.insight).toBe(9);
    expect(derived.grades).toEqual({ body: "B", mind: "C", soul: "D" });
    expect(derived.strengths).toEqual({ body: 2, mind: 1, soul: 1 });
    expect(derived.hpMax).toBe(7);
    expect(derived.mpMax).toBe(13);
    expect(derived.defense).toBe(10);

    expect(derived.skillBase).toEqual({
      athletics: 2,
      operation: 1,
      stealth: 1,
      investigation: 1,
      insight: 1,
      persuasion: 1,
      "hunter-lore": 0,
    });
    expect(derived.skills.athletics).toBe(2);
    expect(derived.skills.operation).toBe(2);
    expect(derived.skills.stealth).toBe(2);
    expect(derived.skillPointsTotal).toBe(2);
    expect(derived.skillPointsSpent).toBe(2);
    expect(derived.skillPointsRemaining).toBe(0);

    expect(derived.quotas).toEqual({
      martialArts: 2,
      spells: 4,
      specialties: 0,
      ultimates: 0,
      imprints: 0,
      abilityTags: 3,
      abilityChars: 80,
      experienceTags: 3,
      styleActions: 6,
    });
    expect(derived.baseSpellIds).toEqual(["spell.灵迹", "spell.凝爆"]);
    expect(derived.unlocked).toEqual([]);
  });

  it("keeps core HP and defense regardless of dormant expansion data", () => {
    const character = { ...createLegalCharacter(), expansions: [] };
    const derived = derive(character);
    expect(derived.hpMax).toBe(7);
    expect(derived.defense).toBe(10);
    expect(derived.mpMax).toBe(13);
  });

  it("raises ability limits at soul 7", () => {
    const character = withAttributes(createLegalCharacter(), { body: 1, mind: 1, soul: 7 }, 9);
    const derived = derive(character);
    expect(derived.quotas.abilityTags).toBe(4);
    expect(derived.quotas.abilityChars).toBe(100);
  });

  it("unlocks specialties and ultimates at insight thresholds", () => {
    const at16 = withAttributes(createLegalCharacter(), { body: 5, mind: 5, soul: 6 }, 16);
    expect(derive(at16).quotas.specialties).toBe(2);
    expect(derive(at16).quotas.ultimates).toBe(1);
    expect(derive(at16).quotas.imprints).toBe(3);

    const at18 = withAttributes(createLegalCharacter(), { body: 6, mind: 6, soul: 6 }, 18);
    expect(derive(at18).quotas.specialties).toBe(2);
    expect(derive(at18).quotas.ultimates).toBe(2);
    expect(derive(at18).unlocked).toContain("习得二挡狩魂绝技");
  });

  it("applies specialty 深度灵体合一 by converting HP max into MP max", () => {
    const base = createLegalCharacter();
    const character: SoulHunterCharacter = {
      ...base,
      selections: { ...base.selections, specialtyIds: ["specialty.深度灵体合一"] },
    };
    const derived = derive(character);
    // 原生命上限 7，保留 1 点，其余 6 点按 1:4 转为灵力上限，再扣 5 点
    expect(derived.hpMax).toBe(1);
    expect(derived.mpMax).toBe(13 + 6 * 4 - 5);
  });

  it("applies specialty 有备而来 item point cap", () => {
    const base = createLegalCharacter();
    expect(derive(base).itemPointsMax).toBe(3);
    const character: SoulHunterCharacter = {
      ...base,
      selections: { ...base.selections, specialtyIds: ["specialty.有备而来"] },
    };
    expect(derive(character).itemPointsMax).toBe(4);
  });

  it("gives a fallback grade for invalid values but keeps raw strengths", () => {
    const character = withAttributes(createLegalCharacter(), { body: 0, mind: 10, soul: 2 }, 9);
    const derived = derive(character);
    expect(derived.grades.body).toBe("E");
    expect(derived.grades.mind).toBe("E");
    expect(derived.strengths.mind).toBe(5);
  });
});

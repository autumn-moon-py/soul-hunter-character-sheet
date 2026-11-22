import { describe, expect, it } from "vitest";
import type { SoulHunterCharacter } from "../types";
import { createLegalCharacter } from "./fixtures";
import { validate } from "./validate";

function clone(): SoulHunterCharacter {
  return structuredClone(createLegalCharacter());
}

function codes(character: SoulHunterCharacter): string[] {
  return validate(character).map((issue) => issue.code);
}

describe("validate", () => {
  it("accepts a legal creation character", () => {
    const issues = validate(createLegalCharacter());
    expect(issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("rejects insight that does not equal attribute sum", () => {
    const character = clone();
    character.insight = 10;
    expect(codes(character)).toContain("insight-mismatch");
  });

  it("rejects attributes above 5 during creation but allows them in advancement", () => {
    const character = clone();
    character.attributes = { body: 6, mind: 2, soul: 1 };
    character.insight = 9;
    expect(codes(character)).toContain("attribute-range");

    const advancement = validate(character, { mode: "advancement" });
    expect(advancement.some((issue) => issue.code === "attribute-range")).toBe(false);
  });

  it("rejects skill point overflow", () => {
    const character = clone();
    character.skills.operation = 3;
    expect(codes(character)).toContain("skill-overflow");
  });

  it("rejects martial arts over quota", () => {
    const character = clone();
    character.selections.martialArtIds.push("martial.太极云手");
    expect(codes(character)).toContain("martial-overflow");
  });

  it("rejects secret martial arts without the required body grade", () => {
    const character = clone();
    character.selections.martialArtIds.push("martial.炁贯百会");
    expect(codes(character)).toContain("secret-martial");
  });

  it("rejects cards that are not in the core content catalog", () => {
    const character = clone();
    character.selections.martialArtIds.push("martial.枪诀壹·破阵枪");
    expect(codes(character)).toContain("unknown-card");
  });

  it("requires one of 凝爆/超感 when mind is below 5", () => {
    const character = clone();
    character.selections.spellIds = character.selections.spellIds.filter(
      (id) => id !== "spell.凝爆",
    );
    expect(codes(character)).toContain("base-spell-choice-missing");
  });

  it("requires both 凝爆/超感 when mind reaches 5", () => {
    const character = clone();
    character.attributes = { body: 3, mind: 5, soul: 1 };
    character.insight = 9;
    character.selections.spellIds = character.selections.spellIds.filter(
      (id) => id !== "spell.超感",
    );
    expect(codes(character)).toContain("base-spell-choice-incomplete");
  });

  it("rejects ability tags over the limit", () => {
    const character = clone();
    character.ability.description = "「甲」「乙」「丙」「丁」";
    expect(codes(character)).toContain("ability-tags-overflow");
  });

  it("rejects imprints over quota", () => {
    const character = clone();
    character.selections.imprintIds.push("imprint.缩小");
    expect(codes(character)).toContain("imprint-overflow");
  });

  it("rejects out-of-range resources", () => {
    const character = clone();
    character.resources.hpCurrent = 99;
    expect(codes(character)).toContain("resource-range");
  });

  it("rejects ultimates before the insight threshold", () => {
    const character = clone();
    character.selections.ultimateTier1Id = "ultimate.狩猎哨兵";
    expect(codes(character)).toContain("ultimate1-not-unlocked");
  });

  it("warns when style actions are missing", () => {
    const character = clone();
    character.style.actionIds = character.style.actionIds.slice(0, 5);
    expect(codes(character)).toContain("style-actions-missing");
  });

  it("treats unknown bonds as self-authored", () => {
    const character = clone();
    character.bond = { category: "自创", name: "不存在" };
    expect(codes(character)).toContain("bond-unknown");
  });

  it("warns when a bond category is chosen without a relation", () => {
    const character = clone();
    character.bond = { category: "家族", name: "" };
    expect(codes(character)).toContain("bond-incomplete");
  });

  it("rejects unknown expansions", () => {
    const character = clone();
    character.expansions.push("unknown-expansion");
    expect(codes(character)).toContain("unknown-expansion");
  });

  it("rejects duplicate and wrong-kind selections", () => {
    const character = clone();
    character.selections.martialArtIds.push("martial.转掌");
    character.selections.martialArtIds.push("spell.灵迹");
    const result = codes(character);
    expect(result).toContain("duplicate-selection");
    expect(result).toContain("wrong-card-kind");
  });
});

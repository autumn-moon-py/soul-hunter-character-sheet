import { describe, expect, it } from "vitest";
import { catalog } from "../content";
import { createLegalCharacter } from "./fixtures";
import { simulateOps } from "./operations";

describe("simulateOps", () => {
  it("智慧低于 5 时，凝爆与超感只能保留一个", () => {
    const base = createLegalCharacter();
    expect(base.attributes.mind).toBeLessThan(5);
    expect(base.selections.spellIds).toContain("spell.凝爆");

    const { character } = simulateOps(base, [
      { op: "addCard", kind: "spell", id: "spell.超感" },
    ]);

    expect(character.selections.spellIds).toContain("spell.超感");
    expect(character.selections.spellIds).not.toContain("spell.凝爆");
  });

  it("不能移除天生武技与天生术法", () => {
    const base = createLegalCharacter();
    const { character } = simulateOps(base, [
      { op: "removeCard", kind: "martial", id: "martial.常规攻击" },
      { op: "removeCard", kind: "spell", id: "spell.灵迹" },
    ]);

    expect(character.selections.martialArtIds).toContain("martial.常规攻击");
    expect(character.selections.spellIds).toContain("spell.灵迹");
  });

  it("心魂低于 SSS+ 时清除第二专精", () => {
    const base = createLegalCharacter();
    base.ability.specialization2 = "伤害";

    const { character } = simulateOps(base, [
      { op: "setAttribute", attribute: "soul", value: 2 },
    ]);

    expect(character.ability.specialization2).toBeUndefined();
  });

  it("选择预设风格时补全风格自带动作", () => {
    const base = createLegalCharacter();
    const { character } = simulateOps(base, [
      { op: "setStyle", styleId: "style.策定山河" },
    ]);

    expect(character.style.mode).toBe("preset");
    expect(character.style.styleId).toBe("style.策定山河");
    expect(character.style.actionIds.length).toBeGreaterThan(0);
    for (const actionId of character.style.actionIds) {
      expect(catalog.byId.get(actionId)?.kind).toBe("styleAction");
    }
  });

  it("切换羁绊时替换旧经历标签", () => {
    const base = createLegalCharacter();
    const previousTag = base.bond?.experienceTag;
    const target = catalog.bonds.find(
      (bond) => bond.experienceTag && bond.experienceTag !== previousTag,
    );
    expect(target).toBeDefined();

    const { character } = simulateOps(base, [
      { op: "setBond", category: target!.category, name: target!.name },
    ]);

    if (previousTag) {
      expect(character.experienceTags).not.toContain(previousTag);
    }
    expect(character.experienceTags).toContain(target!.experienceTag);
    expect(character.experienceTags.length).toBeLessThanOrEqual(3);
  });

  it("跳过不存在的卡片并给出警告", () => {
    const base = createLegalCharacter();
    const { character, warnings } = simulateOps(base, [
      { op: "addCard", kind: "spell", id: "spell.不存在的卡" },
    ]);

    expect(character.selections.spellIds).toEqual(base.selections.spellIds);
    expect(warnings).toHaveLength(1);
  });
});

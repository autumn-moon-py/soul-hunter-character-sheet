import { describe, expect, it } from "vitest";
import { createInitialCharacter } from "./create-character";

describe("createInitialCharacter", () => {
  it("only keeps fixed innate content", () => {
    const character = createInitialCharacter();

    expect(character.selections.martialArtIds).toEqual(["martial.常规攻击"]);
    expect(character.selections.spellIds).toEqual(["spell.灵迹"]);
    expect(character.selections.specialtyIds).toEqual([]);
    expect(character.selections.imprintIds).toEqual([]);
    expect(character.skills).toEqual({});
    expect(character.bond).toBeUndefined();
    expect(character.experienceTags).toEqual([]);
    expect(character.style.actionIds).toEqual([]);
    expect(character.attributes).toEqual({ body: 0, mind: 0, soul: 0 });
    expect(character.insight).toBe(9);
    expect(character.resources.hpCurrent).toBeUndefined();
    expect(character.resources.mpCurrent).toBeUndefined();
  });

  it("does not preselect 凝爆 or 超感", () => {
    const character = createInitialCharacter();
    expect(character.selections.spellIds).not.toContain("spell.凝爆");
    expect(character.selections.spellIds).not.toContain("spell.超感");
  });
});

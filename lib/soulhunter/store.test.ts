import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "@/src/content";
import { createInitialCharacter } from "@/src/rules/create-character";
import { useCharacterStore } from "./store";

const bond = catalog.bonds.find(
  (candidate) => candidate.category === "关系" && candidate.name === "救赎",
);

beforeEach(() => {
  useCharacterStore.getState().setCharacter(createInitialCharacter("test-bond"));
});

describe("setBond", () => {
  it("keeps a category-only empty state", () => {
    useCharacterStore.getState().setBond("关系", "");
    const character = useCharacterStore.getState().character;

    expect(character.bond).toEqual({ category: "关系", name: "" });
    expect(character.experienceTags).toEqual([]);
  });

  it("adds the bond experience tag and removes it when the relation is cleared", () => {
    expect(bond).toBeDefined();

    useCharacterStore.getState().setBond("关系", "救赎");
    const tagged = useCharacterStore.getState().character;
    expect(tagged.bond?.name).toBe("救赎");
    expect(tagged.experienceTags).toContain(bond?.experienceTag);

    useCharacterStore.getState().setBond("关系", "");
    const cleared = useCharacterStore.getState().character;
    expect(cleared.bond).toEqual({ category: "关系", name: "" });
    expect(cleared.experienceTags).not.toContain(bond?.experienceTag);
  });

  it("clears everything when the category is cleared", () => {
    useCharacterStore.getState().setBond("关系", "救赎");
    useCharacterStore.getState().setBond("", "");

    const character = useCharacterStore.getState().character;
    expect(character.bond).toBeUndefined();
    expect(character.experienceTags).toEqual([]);
  });
});

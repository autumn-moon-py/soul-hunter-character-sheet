import { describe, expect, it } from "vitest";
import type { SoulHunterCharacter } from "../types";
import { createLegalCharacter } from "./fixtures";
import {
  canCreateExperienceTag,
  canCreateImprint,
  canIncreaseInsight,
  tryCreateExperienceTag,
  tryCreateImprint,
  tryIncreaseInsight,
  tryReplaceExperienceTag,
} from "./growth";

function withExp(exp: number): SoulHunterCharacter {
  const character = structuredClone(createLegalCharacter());
  character.resources.exp = exp;
  return character;
}

describe("growth", () => {
  it("spends 6 exp to raise insight and one attribute", () => {
    expect(canIncreaseInsight(withExp(5))).toBe(false);
    expect(canIncreaseInsight(withExp(6))).toBe(true);

    const result = tryIncreaseInsight(withExp(6), "body");
    expect(result.ok).toBe(true);
    expect(result.character.insight).toBe(10);
    expect(result.character.attributes.body).toBe(5);
    expect(result.character.resources.exp).toBe(0);
  });

  it("refuses insight growth when the attribute is capped", () => {
    const character = withExp(6);
    character.attributes.body = 9;
    character.insight = 14;
    character.attributes.mind = 3;
    character.attributes.soul = 2;
    const result = tryIncreaseInsight(character, "body");
    expect(result.ok).toBe(false);
  });

  it("creates experience tags for 4 exp, up to 3", () => {
    expect(canCreateExperienceTag(withExp(4))).toBe(true);
    const result = tryCreateExperienceTag(withExp(4), "你了解一些阴德与福报的知识");
    expect(result.ok).toBe(true);
    expect(result.character.experienceTags).toHaveLength(2);
    expect(result.character.resources.exp).toBe(0);

    const full = withExp(4);
    full.experienceTags = ["一", "二", "三"];
    expect(tryCreateExperienceTag(full, "四").ok).toBe(false);
  });

  it("replaces an experience tag for 4 exp", () => {
    const character = withExp(4);
    const result = tryReplaceExperienceTag(
      character,
      character.experienceTags[0] ?? "",
      "你了解一些阴德与福报的知识",
    );
    expect(result.ok).toBe(true);
    expect(result.character.experienceTags).toEqual(["你了解一些阴德与福报的知识"]);
    expect(result.character.resources.exp).toBe(0);
  });

  it("creates imprints only when the quota allows it", () => {
    const low = withExp(4);
    expect(canCreateImprint(low)).toBe(false);
    expect(tryCreateImprint(low, "imprint.缩小").ok).toBe(false);

    const high = withExp(4);
    high.insight = 12;
    high.attributes = { body: 4, mind: 5, soul: 3 };
    expect(canCreateImprint(high)).toBe(true);

    const result = tryCreateImprint(high, "imprint.缩小");
    expect(result.ok).toBe(true);
    expect(result.character.selections.imprintIds).toEqual(["imprint.缩小"]);
    expect(result.character.resources.exp).toBe(0);
  });

  it("refuses duplicate imprints", () => {
    const character = withExp(4);
    character.insight = 12;
    character.attributes = { body: 4, mind: 5, soul: 3 };
    character.selections.imprintIds = ["imprint.缩小"];
    const result = tryCreateImprint(character, "imprint.缩小");
    expect(result.ok).toBe(false);
  });
});

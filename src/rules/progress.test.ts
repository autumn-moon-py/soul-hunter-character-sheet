import { describe, expect, it } from "vitest";
import { createInitialCharacter } from "./create-character";
import { createLegalCharacter } from "./fixtures";
import { buildProgress } from "./progress";

function withAbility(name: string) {
  const character = createLegalCharacter();
  return {
    ...character,
    ability: {
      ...character.ability,
      name,
      description: "以墨为媒，操纵文字丝线攻击、束缚与牵引。",
      tags: ["丝线操纵"],
    },
  };
}

describe("buildProgress", () => {
  it("does not count placeholder defaults as completed", () => {
    const progress = buildProgress(createInitialCharacter());
    expect(progress.percent).toBeLessThan(100);
    expect(progress.items.find((item) => item.id === "name")?.done).toBe(false);
    expect(progress.items.find((item) => item.id === "codename")?.done).toBe(false);
    expect(progress.items.find((item) => item.id === "ability")?.done).toBe(false);
  });

  it("reaches 100 percent for a filled creation-stage character", () => {
    const progress = buildProgress(withAbility("墨形"));
    expect(progress.percent).toBe(100);
    expect(progress.done).toBe(progress.total);
  });

  it("only includes milestones that are already unlocked", () => {
    const base = buildProgress(withAbility("墨形"));
    expect(base.items.some((item) => item.id === "specialty")).toBe(false);
    expect(base.items.some((item) => item.id === "imprint")).toBe(false);
    expect(base.items.some((item) => item.id === "ultimate")).toBe(false);
    expect(base.nextUnlock?.insight).toBe(10);

    const advanced = {
      ...withAbility("墨形"),
      insight: 10,
      attributes: { body: 4, mind: 3, soul: 3 },
    };
    const advancedProgress = buildProgress(advanced);
    expect(advancedProgress.items.some((item) => item.id === "specialty")).toBe(true);
    expect(advancedProgress.items.some((item) => item.id === "soul-weapon")).toBe(true);
  });
});

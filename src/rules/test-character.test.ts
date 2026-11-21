import { describe, expect, it } from "vitest";
import type { SoulHunterCharacter } from "../types";
import { derive } from "./derive";
import { createLegalCharacter } from "./fixtures";
import { validate } from "./validate";

/**
 * 取自实际测试车卡「仁天思-10-墨形」。
 * 灵识 10，组合风格「白纸黑字」，灵魂武器「通灵卷」。
 */
const renTiansi: SoulHunterCharacter = {
  ...createLegalCharacter(),
  id: "ren-tiansi",
  identity: {
    name: "仁天思",
    codename: "墨形",
    gender: "",
    age: "",
    appearance: "",
    personality: "",
    background: "文科生，毕业前回老家收拾遗物，发现一本会自己续写的手帐。",
  },
  bond: {
    category: "家族",
    name: "衣钵",
    description: "祖上曾经有人担任过狩魂者，你继承了这份遗产。",
    experienceTag: "读过祖上狩魂手记，知晓旧年灵界传闻",
  },
  insight: 10,
  attributes: { body: 2, mind: 3, soul: 5 },
  skills: { investigation: 1, "hunter-lore": 1 },
  ability: {
    name: "墨形",
    description:
      "以书为媒：丝线操纵文字丝线攻击、束缚、牵引；焚词焚烧书中一词令其含义于目标显现；墨宠驱使墨水化心意相通之墨宠。灵力过载书页自燃，该检定成功等级-1并得经验。",
    tags: ["丝线操纵", "焚词", "墨宠"],
    specialization: "伤害",
  },
  style: {
    mode: "combined",
    name: "白纸黑字",
    styleIds: ["style.策定山河", "style.玩世不恭", "style.百折不挠"],
    actionIds: [
      "styleAction.策定山河.修养身心",
      "styleAction.玩世不恭.不行重来",
      "styleAction.百折不挠.顽强意志",
      "styleAction.玩世不恭.叙事闪回",
      "styleAction.策定山河.胜天半子",
      "styleAction.通用.超灵觉醒",
    ],
  },
  selections: {
    martialArtIds: ["martial.常规攻击", "martial.鬼步"],
    spellIds: [
      "spell.灵迹",
      "spell.超感",
      "spell.天罗地网",
      "spell.替影术",
      "spell.祝灵术",
      "spell.隐身符",
    ],
    specialtyIds: ["specialty.灵力觉醒"],
    imprintIds: ["imprint.智能", "imprint.守护"],
  },
  soulWeapon: {
    name: "通灵卷",
    form: "卷轴",
    appearance: "一本会自己续写的手帐，封面有墨色纹路。",
  },
  experienceTags: ["读过祖上狩魂手记，知晓旧年灵界传闻"],
  resources: {
    hpCurrent: 6,
    mpCurrent: 16,
    stylePoints: 10,
    itemPoints: 3,
    exp: 0,
  },
  expansions: [],
};

describe("actual test character 仁天思-10-墨形", () => {
  it("derives the expected values", () => {
    const derived = derive(renTiansi);
    expect(derived.insight).toBe(10);
    expect(derived.hpMax).toBe(6);
    expect(derived.mpMax).toBe(16);
    expect(derived.defense).toBe(10);
    expect(derived.skillPointsTotal).toBe(2);
    expect(derived.skillPointsSpent).toBe(2);
    expect(derived.skillPointsRemaining).toBe(0);
    expect(derived.quotas.martialArts).toBe(1);
    expect(derived.quotas.spells).toBe(4);
    expect(derived.quotas.specialties).toBe(1);
    expect(derived.quotas.ultimates).toBe(0);
    expect(derived.quotas.imprints).toBe(2);
    expect(derived.quotas.styleActions).toBe(6);
  });

  it("passes advancement validation without errors", () => {
    const issues = validate(renTiansi, { mode: "advancement" });
    expect(issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("rejects a combined style with duplicate cost tiers", () => {
    const broken = structuredClone(renTiansi);
    broken.style.actionIds = [
      ...broken.style.actionIds,
      "styleAction.策定山河.早有预料",
    ];
    const issues = validate(broken, { mode: "advancement" });
    expect(issues.some((issue) => issue.code === "style-combined-duplicate-cost")).toBe(true);
  });
});

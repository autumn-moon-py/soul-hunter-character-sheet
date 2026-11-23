import { catalog } from "../content";
import type { SoulHunterCharacter } from "../types";
import { createInitialCharacter } from "./create-character";
import { requiredStyleActionIds } from "./quotas";

/**
 * 测试用合法建卡示例。
 * 空白模板之上补齐一套完整选择，避免测试依赖产品默认值。
 */
export function createLegalCharacter(): SoulHunterCharacter {
  const character = createInitialCharacter("test-legal");
  const styleId = "style.策定山河";

  return {
    ...character,
    attributes: { body: 4, mind: 3, soul: 2 },
    identity: {
      ...character.identity,
      name: "吴焰",
      codename: "血焰子",
      gender: "男",
      age: "24",
      background: "挚友死于神秘事件，因此成为狩魂者。",
    },
    bond: {
      category: "关系",
      name: "救赎",
      description: "你的挚友因神秘事件而丧生。",
      experienceTag: "你能够预判一些鬼怪的行动。",
    },
    skills: { operation: 1, stealth: 1 },
    ability: {
      name: "未命名灵能力",
      description: "描述你的灵能力能做什么，尽量具体、有画面感。",
      specialization: "伤害",
    },
    style: {
      mode: "preset",
      styleId,
      actionIds: requiredStyleActionIds(catalog, { mode: "preset", styleId, actionIds: [] }, []),
    },
    selections: {
      martialArtIds: ["martial.常规攻击", "martial.转掌", "martial.云手受"],
      spellIds: [
        "spell.灵迹",
        "spell.凝爆",
        "spell.安宅符",
        "spell.和合帖",
        "spell.文昌签",
        "spell.避水诀",
      ],
      specialtyIds: [],
      imprintIds: [],
    },
    experienceTags: ["你能够预判一些鬼怪的行动。"],
    resources: {
      hpCurrent: 7,
      mpCurrent: 13,
      stylePoints: 10,
      itemPoints: 3,
      exp: 0,
    },
  };
}

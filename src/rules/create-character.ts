import { BASE_MARTIAL_ID, BASE_SPELL_ID } from "../content";
import type { SoulHunterCharacter } from "../types";

/**
 * 新建存档的空白模板：只保留规则固定的天生武技「常规攻击」与天生术法「灵迹」，
 * 凝爆/超感由玩家在智慧低于 5 时自行二选一；其余内容全部为空。
 */
export function createInitialCharacter(id = "local-character"): SoulHunterCharacter {
  return {
    schemaVersion: 1,
    id,
    identity: {
      name: "",
      codename: "",
      gender: "",
      age: "",
      appearance: "",
      personality: "",
      background: "",
    },
    insight: 9,
    attributes: { body: 0, mind: 0, soul: 0 },
    skills: {},
    ability: {
      name: "",
      description: "",
    },
    style: {
      mode: "preset",
      actionIds: [],
    },
    selections: {
      martialArtIds: [BASE_MARTIAL_ID],
      spellIds: [BASE_SPELL_ID],
      specialtyIds: [],
      imprintIds: [],
    },
    experienceTags: [],
    resources: {
      stylePoints: 10,
      itemPoints: 3,
      exp: 0,
    },
    expansions: [],
  };
}

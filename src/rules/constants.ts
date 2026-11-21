import type { AttributeId, Grade, SkillId } from "../types";

export interface SkillDefinition {
  id: SkillId;
  name: string;
  attribute: AttributeId | null;
}

export const SKILLS: SkillDefinition[] = [
  { id: "athletics", name: "运动", attribute: "body" },
  { id: "operation", name: "操作", attribute: "mind" },
  { id: "stealth", name: "隐秘", attribute: "mind" },
  { id: "investigation", name: "调查", attribute: "mind" },
  { id: "insight", name: "洞察", attribute: "soul" },
  { id: "persuasion", name: "说服", attribute: "soul" },
  { id: "hunter-lore", name: "狩魂学识", attribute: null },
];

export const GRADE_BY_VALUE: Readonly<Record<number, Grade>> = {
  1: "E",
  2: "D",
  3: "C",
  4: "B",
  5: "A",
  6: "S",
  7: "SS",
  8: "SSS",
  9: "SSS+",
};

export const BASE = {
  insight: 9,
  attributeMin: 1,
  attributeMaxAtCreation: 5,
  attributeMax: 9,
  hpBase: 5,
  mpBase: 5,
  defense: 10,
  itemPoints: 3,
  stylePoints: 10,
  stylePointsMax: 100,
  expMax: 10,
} as const;

/** 体魄每跨过一档，额外获得 1 项自选武技 */
export const MARTIAL_THRESHOLDS = [2, 3, 5, 7, 9] as const;

/** 智慧每跨过一档，额外获得 2 项自选术法 */
export const SPELL_THRESHOLDS = [2, 3, 5, 7, 9] as const;

export const SECRET_GRADE_VALUE = 7;

/** 规则书 4.6 武器形态列表；自定义形态由玩家自行填写 */
export const SOUL_WEAPON_FORM_GROUPS = [
  { category: "灵活武器", forms: ["指虎", "手刺", "拳套", "利爪", "短斧", "短镰刀", "匕首"] },
  { category: "握持武器", forms: ["砍刀", "长剑", "巨斧", "巨剑", "双手剑", "刺剑"] },
  { category: "长柄武器", forms: ["枪", "戟", "矛", "长镰刀", "长棍", "长柄斧"] },
  { category: "射击武器", forms: ["弓箭", "弩枪", "手枪", "步枪", "霰弹枪"] },
] as const;

export const INSIGHT_UNLOCKS = [
  { insight: 10, unlock: "specialty1", label: "获得一项自选专长" },
  { insight: 12, unlock: "soulWeapon", label: "获得灵魂武器" },
  { insight: 14, unlock: "ultimate1", label: "习得一挡狩魂绝技" },
  { insight: 16, unlock: "specialty2", label: "获得另一项自选专长" },
  { insight: 18, unlock: "ultimate2", label: "习得二挡狩魂绝技" },
] as const;

export const GROWTH_COSTS = {
  insight: 6,
  imprint: 4,
  experienceTag: 4,
} as const;

/** 规则书 3.6 通用效果表，灵能力专精从中选择一项 */
export const ABILITY_SPECIALTIES = [
  { name: "恢复", description: "增加你 X 点生命值（X=成功等级）。" },
  { name: "伤害", description: "减少目标 X 点生命值（X=成功等级）。" },
  { name: "增加灵力", description: "你增加 X 点灵力值（X=成功等级）。" },
  { name: "减少灵力", description: "目标减少 X 点灵力值（X=成功等级）。" },
  {
    name: "强化攻击",
    description: "直到你下个回合结束时，你下次攻击检定获得 X 枚加骰（X=成功等级）。",
  },
  {
    name: "削弱攻击",
    description: "直到你下个回合结束时，目标下次攻击检定减少 X 枚加骰（X=成功等级）。",
  },
  { name: "强化防御", description: "基础防御增加 X 点（X=成功等级×2）。" },
  { name: "削弱防御", description: "基础防御减少 X 点（X=成功等级×2）。" },
  { name: "清除效果", description: "清除目标身上的 X 级效果（X=成功等级）。" },
  { name: "时髦", description: "获得 X 点时髦值（X=成功等级×2）。" },
  { name: "叙事", description: "成功等级≥2 时，按你期望的方式推动叙事。" },
  {
    name: "获得抗性",
    description: "获得 X 层伤害抗性（X=成功等级÷2，向下取整）。",
  },
  {
    name: "赋予易伤",
    description: "目标获得 X 层伤害易伤（X=成功等级÷2，向下取整）。",
  },
  {
    name: "属性附加",
    description: "直到你下个回合结束时，你下次造成伤害时可转化伤害类型（需 1 个成功等级）。",
  },
  {
    name: "造物",
    description: "获得 X 点道具点（X=成功等级÷2，向下取整）。",
  },
] as const;

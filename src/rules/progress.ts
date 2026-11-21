import type { SoulHunterCharacter } from "../types";
import { BASE, INSIGHT_UNLOCKS } from "./constants";
import { derive } from "./derive";
import { baseSpellCount } from "./quotas";

export type ProgressPage = "one" | "two" | "three";

export interface ProgressItem {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  page: ProgressPage;
}

export interface CharacterProgress {
  percent: number;
  done: number;
  total: number;
  items: ProgressItem[];
  /** 下一个灵识里程碑；全部解锁后为 undefined */
  nextUnlock?: { insight: number; label: string };
}

const PLACEHOLDERS = new Set([
  "",
  "无名",
  "未命名",
  "未命名灵能力",
  "描述你的灵能力能做什么，尽量具体、有画面感。",
  "第一个标签",
  "第二个标签",
  "第三个标签",
]);

function filled(value?: string): boolean {
  const text = value?.trim() ?? "";
  return text.length > 0 && !PLACEHOLDERS.has(text);
}

/** 建卡完成度：只统计当前阶段适用的项目，避免未解锁内容拖低百分比 */
export function buildProgress(character: SoulHunterCharacter): CharacterProgress {
  const derived = derive(character);
  const { body, mind, soul } = character.attributes;
  const items: ProgressItem[] = [];

  const add = (
    id: string,
    label: string,
    hint: string,
    done: boolean,
    page: ProgressPage,
  ) => {
    items.push({ id, label, hint, done, page });
  };

  add("name", "真名", "填写角色在正常世界中的姓名", filled(character.identity.name), "one");
  add(
    "codename",
    "绰号",
    "狩魂者之间通常用绰号互相称呼",
    filled(character.identity.codename),
    "one",
  );
  add("bond", "羁绊", "选择成为狩魂者的理由", Boolean(character.bond?.name), "one");
  add(
    "background",
    "背景故事",
    "写几句来历，方便主持与队友理解",
    filled(character.identity.background),
    "one",
  );
  add(
    "appearance",
    "形象与性格",
    "外貌、性格、习惯任选填写",
    filled(character.identity.appearance) || filled(character.identity.personality),
    "one",
  );

  add(
    "ability",
    "灵能力名称与描述",
    "两者都要填写，描述受心魂字数限制",
    filled(character.ability.name) && filled(character.ability.description),
    "one",
  );

  const attributeSum = body + mind + soul;
  add(
    "attributes",
    "基础属性",
    "三项属性之和应等于灵识",
    attributeSum === character.insight &&
      character.insight >= BASE.insight &&
      body >= BASE.attributeMin &&
      mind >= BASE.attributeMin &&
      soul >= BASE.attributeMin,
    "one",
  );
  add(
    "skills",
    "技能点",
    "把当前可用的技能点分配完",
    derived.skillPointsRemaining === 0,
    "one",
  );

  const martialUsed = Math.max(0, character.selections.martialArtIds.length - 1);
  if (derived.quotas.martialArts > 0) {
    add(
      "martial",
      "武技",
      "填满当前体魄提供的武技槽位",
      martialUsed >= derived.quotas.martialArts,
      "one",
    );
  }

  const spellUsed = Math.max(
    0,
    character.selections.spellIds.length - baseSpellCount(mind),
  );
  if (derived.quotas.spells > 0) {
    add(
      "spell",
      "术法",
      "填满当前智慧提供的术法槽位",
      spellUsed >= derived.quotas.spells,
      "one",
    );
  }

  if (derived.quotas.specialties > 0) {
    add(
      "specialty",
      "专长",
      "灵识 10 起可获得自选专长",
      character.selections.specialtyIds.length >= derived.quotas.specialties,
      "one",
    );
  }

  if (derived.quotas.imprints > 0) {
    add(
      "imprint",
      "灵能印记",
      "灵魂武器解锁后可用经验锻造印记",
      character.selections.imprintIds.length >= derived.quotas.imprints,
      "one",
    );
  }

  if (derived.quotas.ultimates > 0) {
    const ultimateUsed =
      Number(Boolean(character.selections.ultimateTier1Id)) +
      Number(Boolean(character.selections.ultimateTier2Id));
    add(
      "ultimate",
      "狩魂绝技",
      "灵识 14 与 18 分别解锁一挡、二挡绝技",
      ultimateUsed >= derived.quotas.ultimates,
      "two",
    );
  }

  const styleChosen =
    character.style.mode === "combined"
      ? (character.style.styleIds?.length ?? 0) >= 2
      : Boolean(character.style.styleId);
  add(
    "style",
    "时髦风格",
    "选择预设风格或组合风格，并带齐动作",
    styleChosen && character.style.actionIds.length >= derived.quotas.styleActions,
    "two",
  );

  const weaponUnlocked = character.insight >= 12 || soul >= 3;
  if (weaponUnlocked) {
    add(
      "soul-weapon",
      "灵魂武器",
      "解锁后为灵魂武器命名",
      filled(character.soulWeapon?.name),
      "one",
    );
  }

  const done = items.filter((item) => item.done).length;
  const total = items.length;
  const next = INSIGHT_UNLOCKS.find((entry) => character.insight < entry.insight);

  return {
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    done,
    total,
    items,
    nextUnlock: next ? { insight: next.insight, label: next.label } : undefined,
  };
}

import {
  CHOICE_BASE_SPELL_IDS,
  catalog as defaultCatalog,
} from "../content";
import type {
  AttributeId,
  ContentCatalog,
  DerivedStats,
  Grade,
  SkillId,
  SoulHunterCharacter,
} from "../types";
import { BASE, INSIGHT_UNLOCKS, SKILLS } from "./constants";
import {
  abilityCharLimit,
  abilityTagLimit,
  gradeFromValue,
  strengthFromValue,
} from "./grades";
import {
  imprintQuota,
  martialQuota,
  spellQuota,
  specialtyQuota,
  styleActionQuota,
  ultimateQuota,
} from "./quotas";

export interface DeriveOptions {
  catalog?: ContentCatalog;
}

function attributeGrade(value: number): Grade {
  return gradeFromValue(value) ?? "E";
}

export function derive(
  character: SoulHunterCharacter,
  options: DeriveOptions = {},
): DerivedStats {
  const catalog = options.catalog ?? defaultCatalog;
  const { body, mind, soul } = character.attributes;

  const grades: Record<AttributeId, Grade> = {
    body: attributeGrade(body),
    mind: attributeGrade(mind),
    soul: attributeGrade(soul),
  };

  const strengths: Record<AttributeId, number> = {
    body: strengthFromValue(body),
    mind: strengthFromValue(mind),
    soul: strengthFromValue(soul),
  };

  const skillBase = {} as Record<SkillId, number>;
  const skills = {} as Record<SkillId, number>;
  for (const skill of SKILLS) {
    const base = skill.attribute ? strengths[skill.attribute] : 0;
    skillBase[skill.id] = base;
    skills[skill.id] = base + (character.skills[skill.id] ?? 0);
  }

  const skillPointsSpent = SKILLS.reduce(
    (total, skill) => total + Math.max(0, character.skills[skill.id] ?? 0),
    0,
  );
  const skillPointsTotal = Math.max(0, mind - 1);

  const baseHpMax = BASE.hpBase + strengths.body;
  // 专长「深度灵体合一」：生命上限恒为 1，减少的部分按 1:4 转为灵力上限，再扣 5 点
  const deepFusion = character.selections.specialtyIds.includes("specialty.深度灵体合一");
  const hpMax = deepFusion ? 1 : baseHpMax;
  const mpMax =
    BASE.mpBase +
    mind * 2 +
    soul +
    (deepFusion ? (baseHpMax - 1) * 4 - 5 : 0);
  const defense = BASE.defense;
  // 专长「有备而来」：道具点上限 +1
  const itemPointsMax =
    BASE.itemPoints + (character.selections.specialtyIds.includes("specialty.有备而来") ? 1 : 0);

  const unlocked = INSIGHT_UNLOCKS.filter(
    (entry) => character.insight >= entry.insight,
  ).map((entry) => entry.label);

  const chosenBaseSpells = CHOICE_BASE_SPELL_IDS.filter((id) =>
    character.selections.spellIds.includes(id),
  );
  const baseSpellIds = [
    "spell.灵迹",
    ...(mind >= 5 ? Array.from(CHOICE_BASE_SPELL_IDS) : chosenBaseSpells.slice(0, 1)),
  ];

  return {
    insight: character.insight,
    grades,
    strengths,
    hpMax,
    mpMax,
    itemPointsMax,
    defense,
    skillBase,
    skills,
    skillPointsTotal,
    skillPointsSpent,
    skillPointsRemaining: skillPointsTotal - skillPointsSpent,
    quotas: {
      martialArts: martialQuota(body),
      spells: spellQuota(mind),
      specialties: specialtyQuota(character.insight),
      ultimates: ultimateQuota(character.insight),
      imprints: imprintQuota(character.insight, soul),
      abilityTags: abilityTagLimit(soul),
      abilityChars: abilityCharLimit(soul),
      experienceTags: 3,
      styleActions: styleActionQuota(
        catalog,
        character.style,
        character.expansions,
      ),
    },
    baseSpellIds,
    unlocked,
  };
}

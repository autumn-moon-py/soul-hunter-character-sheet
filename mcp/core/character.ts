import { BASE_MARTIAL_ID } from "../../src/content";
import { BASE } from "../../src/rules/constants";
import { derive } from "../../src/rules/derive";
import {
  abilityCharLimit,
  extractAbilityTags,
  hanLength,
} from "../../src/rules/grades";
import { buildProgress } from "../../src/rules/progress";
import { baseSpellCount } from "../../src/rules/quotas";
import { validate, type ValidationMode } from "../../src/rules/validate";
import type { DerivedStats, SoulHunterCharacter } from "../../src/types";

export function validationModeOf(character: SoulHunterCharacter): ValidationMode {
  return character.insight > BASE.insight ? "advancement" : "creation";
}

export interface QuotaUsage {
  used: number;
  max: number;
  remaining: number;
}

function usage(used: number, max: number): QuotaUsage {
  return { used, max, remaining: Math.max(0, max - used) };
}

export function quotaUsage(
  character: SoulHunterCharacter,
  derived: DerivedStats = derive(character),
): Record<string, QuotaUsage> {
  const hasBaseMartial = character.selections.martialArtIds.includes(BASE_MARTIAL_ID);
  const martialUsed = Math.max(
    0,
    character.selections.martialArtIds.length - (hasBaseMartial ? 1 : 0),
  );
  const spellUsed = Math.max(
    0,
    character.selections.spellIds.length - baseSpellCount(character.attributes.mind),
  );
  const ultimateUsed =
    Number(Boolean(character.selections.ultimateTier1Id)) +
    Number(Boolean(character.selections.ultimateTier2Id));

  return {
    martial: usage(martialUsed, derived.quotas.martialArts),
    spell: usage(spellUsed, derived.quotas.spells),
    specialty: usage(character.selections.specialtyIds.length, derived.quotas.specialties),
    imprint: usage(character.selections.imprintIds.length, derived.quotas.imprints),
    ultimate: usage(ultimateUsed, derived.quotas.ultimates),
    styleAction: usage(character.style.actionIds.length, derived.quotas.styleActions),
    abilityTags: usage(
      extractAbilityTags(character.ability.description).length,
      derived.quotas.abilityTags,
    ),
    abilityChars: usage(
      hanLength(character.ability.description),
      abilityCharLimit(character.attributes.soul),
    ),
    experienceTags: usage(character.experienceTags.length, derived.quotas.experienceTags),
  };
}

/** 桥接快照时剥离头像与口袋长文本，避免把数 MB 的 data URL 推进本地服务 */
export function stripForBridge(character: SoulHunterCharacter): SoulHunterCharacter {
  const next = structuredClone(character);
  if (next.identity) delete next.identity.avatar;
  return next;
}

export function explainCharacter(character: SoulHunterCharacter): Record<string, unknown> {
  const derived = derive(character);
  const issues = validate(character, { mode: validationModeOf(character) });
  const progress = buildProgress(character);
  const quotas = quotaUsage(character, derived);

  const skills = Object.fromEntries(
    Object.entries(derived.skills).map(([id, total]) => [
      id,
      {
        base: derived.skillBase[id as keyof typeof derived.skillBase],
        allocated: character.skills[id as keyof typeof character.skills] ?? 0,
        total,
      },
    ]),
  );

  return {
    identity: {
      name: character.identity.name,
      codename: character.identity.codename,
      hasAvatar: Boolean(character.identity.avatar),
    },
    insight: character.insight,
    attributes: character.attributes,
    grades: derived.grades,
    strengths: derived.strengths,
    resources: {
      hpMax: derived.hpMax,
      mpMax: derived.mpMax,
      defense: derived.defense,
      itemPointsMax: derived.itemPointsMax,
      current: character.resources,
    },
    skills,
    skillPoints: {
      total: derived.skillPointsTotal,
      spent: derived.skillPointsSpent,
      remaining: derived.skillPointsRemaining,
    },
    quotas,
    unlocks: derived.unlocked,
    nextUnlock: progress.nextUnlock ?? null,
    progress: { percent: progress.percent, done: progress.done, total: progress.total },
    selections: {
      martialArtIds: character.selections.martialArtIds,
      spellIds: character.selections.spellIds,
      specialtyIds: character.selections.specialtyIds,
      imprintIds: character.selections.imprintIds,
      ultimateTier1Id: character.selections.ultimateTier1Id ?? null,
      ultimateTier2Id: character.selections.ultimateTier2Id ?? null,
      style: {
        mode: character.style.mode ?? "preset",
        styleId: character.style.styleId ?? null,
        styleIds: character.style.styleIds ?? [],
        name: character.style.name ?? null,
        actionIds: character.style.actionIds,
      },
    },
    bond: character.bond ?? null,
    experienceTags: character.experienceTags,
    expansions: character.expansions,
    issues,
  };
}

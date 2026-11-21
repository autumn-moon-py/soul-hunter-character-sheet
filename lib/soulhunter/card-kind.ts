import { BASE_MARTIAL_ID, BASE_SPELL_ID, CHOICE_BASE_SPELL_IDS } from "@/src/content";
import { baseSpellCount } from "@/src/rules/quotas";
import type { DerivedStats, SoulHunterCharacter } from "@/src/types";
import type { CardKind } from "./store";

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  martial: "武技",
  spell: "术法",
  specialty: "专长",
  imprint: "灵能印记",
};

export function getSelectedIds(
  character: SoulHunterCharacter,
  kind: CardKind,
): string[] {
  switch (kind) {
    case "martial":
      return character.selections.martialArtIds;
    case "spell":
      return character.selections.spellIds;
    case "specialty":
      return character.selections.specialtyIds;
    case "imprint":
      return character.selections.imprintIds;
  }
}

export function isBaseCard(kind: CardKind, id: string): boolean {
  if (kind === "martial") return id === BASE_MARTIAL_ID;
  if (kind === "spell") {
    return (
      id === BASE_SPELL_ID ||
      CHOICE_BASE_SPELL_IDS.includes(id as (typeof CHOICE_BASE_SPELL_IDS)[number])
    );
  }
  return false;
}

export function getQuota(
  character: SoulHunterCharacter,
  kind: CardKind,
  derived: DerivedStats,
): { used: number; max: number } {
  if (kind === "martial") {
    const selected = character.selections.martialArtIds;
    return {
      used: Math.max(
        0,
        selected.length - (selected.includes(BASE_MARTIAL_ID) ? 1 : 0),
      ),
      max: derived.quotas.martialArts,
    };
  }
  if (kind === "spell") {
    return {
      used: Math.max(
        0,
        character.selections.spellIds.length -
          baseSpellCount(character.attributes.mind),
      ),
      max: derived.quotas.spells,
    };
  }
  if (kind === "specialty") {
    return {
      used: character.selections.specialtyIds.length,
      max: derived.quotas.specialties,
    };
  }
  return {
    used: character.selections.imprintIds.length,
    max: derived.quotas.imprints,
  };
}

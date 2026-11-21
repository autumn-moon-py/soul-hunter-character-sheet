"use client";

import { create } from "zustand";
import {
  BASE_MARTIAL_ID,
  BASE_SPELL_ID,
  CHOICE_BASE_SPELL_IDS,
  catalog,
} from "@/src/content";
import { createInitialCharacter } from "@/src/rules/create-character";
import { derive } from "@/src/rules/derive";
import { requiredStyleActionIds } from "@/src/rules/quotas";
import type {
  AttributeId,
  SkillId,
  SoulHunterAbility,
  SoulHunterCharacter,
  SoulHunterIdentity,
  SoulHunterResources,
} from "@/src/types";

export type CardKind = "martial" | "spell" | "specialty" | "imprint";

interface CharacterStore {
  character: SoulHunterCharacter;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  setCharacter: (character: SoulHunterCharacter) => void;
  update: (mutator: (draft: SoulHunterCharacter) => void) => void;
  setIdentityField: (field: keyof SoulHunterIdentity, value: string) => void;
  setBond: (category: string, name: string) => void;
  setAttribute: (attribute: AttributeId, value: number) => void;
  setInsight: (value: number) => void;
  setSkillAllocation: (skill: SkillId, value: number) => void;
  setAbilityField: (field: keyof SoulHunterAbility, value: string) => void;
  setAbilityTags: (tags: string[]) => void;
  setStyle: (styleId: string) => void;
  setCombinedStyle: (input: {
    name: string;
    styleIds: string[];
    actionIds: string[];
  }) => void;
  setSoulWeaponField: (
    field: "name" | "form" | "appearance",
    value: string,
  ) => void;
  addCard: (kind: CardKind, id: string) => void;
  removeCard: (kind: CardKind, id: string) => void;
  replaceCard: (kind: CardKind, oldId: string, newId: string) => void;
  setUltimate: (tier: 1 | 2, id?: string) => void;
  setResource: (key: keyof SoulHunterResources, value: number) => void;
  setExperienceTags: (tags: string[]) => void;
  setPockets: (value: string) => void;
}

function clone(character: SoulHunterCharacter): SoulHunterCharacter {
  return structuredClone(character);
}

type ArraySelectionKey =
  | "martialArtIds"
  | "spellIds"
  | "specialtyIds"
  | "imprintIds";

function selectionKey(kind: CardKind): ArraySelectionKey {
  switch (kind) {
    case "martial":
      return "martialArtIds";
    case "spell":
      return "spellIds";
    case "specialty":
      return "specialtyIds";
    case "imprint":
      return "imprintIds";
  }
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  character: createInitialCharacter(),
  hydrated: false,

  setHydrated: (value) => set({ hydrated: value }),
  setCharacter: (character) => set({ character }),

  update: (mutator) =>
    set((state) => {
      const draft = clone(state.character);
      mutator(draft);
      return { character: draft };
    }),


  setIdentityField: (field, value) =>
    get().update((draft) => {
      draft.identity[field] = value;
    }),

  setBond: (category, name) =>
    get().update((draft) => {
      const previousTag = draft.bond?.experienceTag;
      const clearPreviousTag = () => {
        if (previousTag) {
          draft.experienceTags = draft.experienceTags.filter((tag) => tag !== previousTag);
        }
      };

      // 清空羁绊
      if (!category) {
        draft.bond = undefined;
        clearPreviousTag();
        return;
      }

      const bond = name
        ? catalog.bonds.find(
            (candidate) => candidate.category === category && candidate.name === name,
          )
        : undefined;

      // 只选类别、未选具体关系，或关系不在范例表中
      if (!bond) {
        draft.bond = { category, name: name ?? "" };
        clearPreviousTag();
        return;
      }

      // 规则 2.2：确定羁绊后获得一个对应经历标签；切换羁绊时替换旧标签
      const nextTag = bond.experienceTag ?? "";
      let tags = draft.experienceTags;
      if (previousTag) tags = tags.filter((tag) => tag !== previousTag);
      if (nextTag && !tags.includes(nextTag)) tags = [...tags, nextTag];

      draft.experienceTags = tags.slice(0, 3);
      draft.bond = {
        category: bond.category,
        name: bond.name,
        description: bond.description,
        experienceTag: nextTag,
      };
    }),

  setAttribute: (attribute, value) =>
    get().update((draft) => {
      // 0 表示尚未分配；灵识由玩家单独填写，不再随属性联动
      draft.attributes[attribute] = Math.max(0, Math.min(9, Math.round(value)));
      // 心魂不足 SSS+ 时，第二项专精不再成立
      if (draft.attributes.soul < 9) draft.ability.specialization2 = undefined;
    }),

  setInsight: (value) =>
    get().update((draft) => {
      draft.insight = Math.max(0, Math.round(value));
    }),

  setSkillAllocation: (skill, value) =>
    get().update((draft) => {
      const next = Math.max(0, Math.round(value));
      draft.skills[skill] = next;
      const derived = derive(draft);
      if (derived.skillPointsSpent > derived.skillPointsTotal) {
        draft.skills[skill] = Math.max(0, next - (derived.skillPointsSpent - derived.skillPointsTotal));
      }
    }),

  setAbilityField: (field, value) =>
    get().update((draft) => {
      if (field === "tags") return;
      draft.ability[field] = value;
    }),

  setAbilityTags: (tags) =>
    get().update((draft) => {
      const limit = derive(draft).quotas.abilityTags;
      draft.ability.tags = tags.slice(0, limit).map((tag) => tag.trim());
    }),

  setStyle: (styleId) =>
    get().update((draft) => {
      draft.style = {
        mode: "preset",
        styleId,
        actionIds: styleId
          ? requiredStyleActionIds(
              catalog,
              { mode: "preset", styleId, actionIds: [] },
              draft.expansions,
            )
          : [],
      };
    }),

  setCombinedStyle: ({ name, styleIds, actionIds }) =>
    get().update((draft) => {
      draft.style = {
        mode: "combined",
        name,
        styleIds,
        actionIds,
      };
    }),

  setSoulWeaponField: (field, value) =>
    get().update((draft) => {
      draft.soulWeapon = {
        ...(draft.soulWeapon ?? { name: "" }),
        [field]: value,
      };
    }),

  addCard: (kind, id) =>
    get().update((draft) => {
      const card = catalog.byId.get(id);
      if (!card || card.kind !== kind) return;
      if (card.expansion && !draft.expansions.includes(card.expansion)) return;

      const key = selectionKey(kind);
      const current = draft.selections[key];
      if (current.includes(id)) return;

      if (kind === "spell" && draft.attributes.mind < 5) {
        const choice = CHOICE_BASE_SPELL_IDS.find((spellId) => spellId === id);
        if (choice) {
          draft.selections.spellIds = draft.selections.spellIds.filter(
            (spellId) => !CHOICE_BASE_SPELL_IDS.includes(spellId as (typeof CHOICE_BASE_SPELL_IDS)[number]),
          );
        }
      }

      draft.selections[key] = [...draft.selections[key], id];
    }),

  removeCard: (kind, id) =>
    get().update((draft) => {
      if (kind === "martial" && id === BASE_MARTIAL_ID) return;
      if (kind === "spell" && id === BASE_SPELL_ID) return;
      if (
        kind === "spell" &&
        draft.attributes.mind >= 5 &&
        CHOICE_BASE_SPELL_IDS.includes(id as (typeof CHOICE_BASE_SPELL_IDS)[number])
      ) {
        return;
      }

      const key = selectionKey(kind);
      draft.selections[key] = draft.selections[key].filter(
        (candidate) => candidate !== id,
      );
    }),

  replaceCard: (kind, oldId, newId) =>
    get().update((draft) => {
      const card = catalog.byId.get(newId);
      if (!card || card.kind !== kind) return;
      if (card.expansion && !draft.expansions.includes(card.expansion)) return;
      const key = selectionKey(kind);
      const ids = draft.selections[key];
      if (!ids.includes(oldId) || ids.includes(newId)) return;
      draft.selections[key] = ids.map((id) => (id === oldId ? newId : id));
    }),

  setUltimate: (tier, id) =>
    get().update((draft) => {
      if (!id) {
        if (tier === 1) draft.selections.ultimateTier1Id = undefined;
        else draft.selections.ultimateTier2Id = undefined;
        return;
      }
      const card = catalog.byId.get(id);
      if (card?.kind !== "ultimate" || card.tier !== tier) return;
      if (card.expansion && !draft.expansions.includes(card.expansion)) return;
      if (tier === 1) draft.selections.ultimateTier1Id = id;
      else draft.selections.ultimateTier2Id = id;
    }),

  setResource: (key, value) =>
    get().update((draft) => {
      draft.resources[key] = Math.max(0, Math.round(value));
    }),

  setExperienceTags: (tags) =>
    get().update((draft) => {
      draft.experienceTags = tags.slice(0, 3).map((tag) => tag.trim());
    }),

  setPockets: (value) =>
    get().update((draft) => {
      draft.pockets = value;
    }),
}));

export function isCardSelected(
  character: SoulHunterCharacter,
  kind: CardKind,
  id: string,
): boolean {
  const key = selectionKey(kind);
  return (character.selections[key] as string[]).includes(id);
}



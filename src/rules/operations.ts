import {
  BASE_MARTIAL_ID,
  BASE_SPELL_ID,
  CHOICE_BASE_SPELL_IDS,
  catalog as defaultCatalog,
} from "../content";
import type {
  AttributeId,
  ContentCatalog,
  SkillId,
  SoulHunterCharacter,
} from "../types";
import { requiredStyleActionIds } from "./quotas";

export type CardOperationKind = "martial" | "spell" | "specialty" | "imprint";

/**
 * 受控变更操作：MCP 提案与网页面板共用。
 * 这里只定义「意图」，最终落库仍由 store 的 action 执行。
 */
export type CharacterOperation =
  | { op: "setAttribute"; attribute: AttributeId; value: number }
  | { op: "setInsight"; value: number }
  | { op: "setSkill"; skill: SkillId; value: number }
  | { op: "addCard"; kind: CardOperationKind; id: string }
  | { op: "removeCard"; kind: CardOperationKind; id: string }
  | { op: "replaceCard"; kind: CardOperationKind; oldId: string; newId: string }
  | { op: "setUltimate"; tier: 1 | 2; id?: string }
  | { op: "setStyle"; styleId: string }
  | { op: "setCombinedStyle"; name: string; styleIds: string[]; actionIds: string[] }
  | { op: "setBond"; category: string; name: string }
  | {
      op: "setAbilityField";
      field: "name" | "description" | "defect" | "specialization" | "specialization2";
      value: string;
    }
  | { op: "setExperienceTags"; tags: string[] }
  | { op: "setSoulWeaponName"; value: string }
  | { op: "setPockets"; value: string }
  | {
      op: "setIdentityField";
      field: "name" | "codename" | "gender" | "age" | "background";
      value: string;
    };

export interface SimulateResult {
  character: SoulHunterCharacter;
  warnings: string[];
}

type SelectionKey = "martialArtIds" | "spellIds" | "specialtyIds" | "imprintIds";

function selectionKey(kind: CardOperationKind): SelectionKey {
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

/**
 * 在角色副本上预演操作，供 diff、校验与提案预览使用。
 * 数值类修正（技能点截断等）不在预演中做，交给 validate 暴露，应用时以 store 为准。
 */
export function simulateOps(
  character: SoulHunterCharacter,
  operations: readonly CharacterOperation[],
  options: { catalog?: ContentCatalog } = {},
): SimulateResult {
  const catalog = options.catalog ?? defaultCatalog;
  const next = structuredClone(character);
  const warnings: string[] = [];

  for (const op of operations) {
    switch (op.op) {
      case "setAttribute": {
        next.attributes[op.attribute] = Math.max(0, Math.min(9, Math.round(op.value)));
        if (next.attributes.soul < 9) next.ability.specialization2 = undefined;
        break;
      }
      case "setInsight": {
        next.insight = Math.max(0, Math.round(op.value));
        break;
      }
      case "setSkill": {
        next.skills[op.skill] = Math.max(0, Math.round(op.value));
        break;
      }
      case "addCard": {
        const card = catalog.byId.get(op.id);
        if (!card || card.kind !== op.kind) {
          warnings.push(`跳过不存在的卡片：${op.id}`);
          break;
        }
        const key = selectionKey(op.kind);
        if (next.selections[key].includes(op.id)) break;
        if (op.kind === "spell" && next.attributes.mind < 5) {
          const isChoice = CHOICE_BASE_SPELL_IDS.some((id) => id === op.id);
          if (isChoice) {
            next.selections.spellIds = next.selections.spellIds.filter(
              (id) => !CHOICE_BASE_SPELL_IDS.some((choice) => choice === id),
            );
          }
        }
        next.selections[key] = [...next.selections[key], op.id];
        break;
      }
      case "removeCard": {
        if (op.kind === "martial" && op.id === BASE_MARTIAL_ID) break;
        if (op.kind === "spell" && op.id === BASE_SPELL_ID) break;
        if (
          op.kind === "spell" &&
          next.attributes.mind >= 5 &&
          CHOICE_BASE_SPELL_IDS.some((id) => id === op.id)
        ) {
          break;
        }
        const key = selectionKey(op.kind);
        next.selections[key] = next.selections[key].filter((id) => id !== op.id);
        break;
      }
      case "replaceCard": {
        const card = catalog.byId.get(op.newId);
        if (!card || card.kind !== op.kind) {
          warnings.push(`跳过不存在的替换卡片：${op.newId}`);
          break;
        }
        const key = selectionKey(op.kind);
        if (!next.selections[key].includes(op.oldId)) break;
        if (next.selections[key].includes(op.newId)) break;
        next.selections[key] = next.selections[key].map((id) =>
          id === op.oldId ? op.newId : id,
        );
        break;
      }
      case "setUltimate": {
        if (!op.id) {
          if (op.tier === 1) next.selections.ultimateTier1Id = undefined;
          else next.selections.ultimateTier2Id = undefined;
          break;
        }
        if (op.tier === 1) next.selections.ultimateTier1Id = op.id;
        else next.selections.ultimateTier2Id = op.id;
        break;
      }
      case "setStyle": {
        next.style = {
          mode: "preset",
          styleId: op.styleId,
          actionIds: op.styleId
            ? requiredStyleActionIds(
                catalog,
                { mode: "preset", styleId: op.styleId, actionIds: [] },
                next.expansions,
              )
            : [],
        };
        break;
      }
      case "setCombinedStyle": {
        next.style = {
          mode: "combined",
          name: op.name,
          styleIds: [...op.styleIds],
          actionIds: [...op.actionIds],
        };
        break;
      }
      case "setBond": {
        const previousTag = next.bond?.experienceTag;
        const clearPrevious = () => {
          if (previousTag) {
            next.experienceTags = next.experienceTags.filter((tag) => tag !== previousTag);
          }
        };
        if (!op.category) {
          next.bond = undefined;
          clearPrevious();
          break;
        }
        const bond = op.name
          ? catalog.bonds.find(
              (candidate) => candidate.category === op.category && candidate.name === op.name,
            )
          : undefined;
        if (!bond) {
          next.bond = { category: op.category, name: op.name };
          clearPrevious();
          break;
        }
        const nextTag = bond.experienceTag ?? "";
        clearPrevious();
        let tags = next.experienceTags;
        if (nextTag && !tags.includes(nextTag)) tags = [...tags, nextTag];
        next.experienceTags = tags.slice(0, 3);
        next.bond = {
          category: bond.category,
          name: bond.name,
          description: bond.description,
          experienceTag: nextTag,
        };
        break;
      }
      case "setAbilityField": {
        if (op.field === "specialization2" && next.attributes.soul < 9) break;
        next.ability[op.field] = op.value;
        break;
      }
      case "setExperienceTags": {
        next.experienceTags = op.tags.slice(0, 3).map((tag) => tag.trim());
        break;
      }
      case "setSoulWeaponName": {
        next.soulWeapon = { ...(next.soulWeapon ?? { name: "" }), name: op.value };
        break;
      }
      case "setPockets": {
        next.pockets = op.value;
        break;
      }
      case "setIdentityField": {
        next.identity[op.field] = op.value;
        break;
      }
    }
  }

  return { character: next, warnings };
}

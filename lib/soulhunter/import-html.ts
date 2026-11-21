import { createInitialCharacter } from "@/src/rules/create-character";
import { SKILLS } from "@/src/rules/constants";
import type {
  AttributeId,
  AttributeValues,
  SkillId,
  SoulHunterAbility,
  SoulHunterCharacter,
  SoulHunterIdentity,
  SoulHunterResources,
  SoulHunterSelections,
  SoulHunterSoulWeapon,
  SoulHunterStyle,
} from "@/src/types";
import { CHARACTER_DATA_SCRIPT_ID } from "./export-html";

export type ImportResult =
  | { ok: true; character: SoulHunterCharacter }
  | { ok: false; error: string };

const MAX_AVATAR_LENGTH = 2_000_000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const DATA_PATTERN = new RegExp(
  `<script\\b[^>]*id=["']${CHARACTER_DATA_SCRIPT_ID}["'][^>]*>([\\s\\S]*?)<\\/script>`,
  "i",
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function newId(): string {
  return `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function stringArrayOr(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? stringArray(value) : [...fallback];
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** 从导出的 HTML 中取出内嵌角色数据；找不到或 JSON 损坏时返回 null */
export function extractCharacterPayload(html: string): unknown | null {
  const match = html.match(DATA_PATTERN);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

/** 把未知 JSON 归一化成当前版本的存档；结构不可识别时返回 null */
export function normalizeImportedCharacter(raw: unknown): SoulHunterCharacter | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) return null;

  const base = createInitialCharacter(newId());
  const identityRaw = isRecord(raw.identity) ? raw.identity : {};
  const abilityRaw = isRecord(raw.ability) ? raw.ability : {};
  const styleRaw = isRecord(raw.style) ? raw.style : {};
  const selectionsRaw = isRecord(raw.selections) ? raw.selections : {};
  const resourcesRaw = isRecord(raw.resources) ? raw.resources : {};
  const attributesRaw = isRecord(raw.attributes) ? raw.attributes : {};
  const skillsRaw = isRecord(raw.skills) ? raw.skills : {};
  const bondRaw = isRecord(raw.bond) ? raw.bond : null;
  const weaponRaw = isRecord(raw.soulWeapon) ? raw.soulWeapon : null;

  const identity: SoulHunterIdentity = {
    ...base.identity,
    name: stringOr(identityRaw.name, base.identity.name),
    codename: stringOr(identityRaw.codename, base.identity.codename),
    gender: optionalString(identityRaw.gender) ?? base.identity.gender,
    age: optionalString(identityRaw.age) ?? base.identity.age,
    appearance: optionalString(identityRaw.appearance) ?? base.identity.appearance,
    personality: optionalString(identityRaw.personality) ?? base.identity.personality,
    background: optionalString(identityRaw.background) ?? base.identity.background,
  };
  const avatar = optionalString(identityRaw.avatar);
  if (avatar?.startsWith("data:image/") && avatar.length <= MAX_AVATAR_LENGTH) {
    identity.avatar = avatar;
  }

  const attributes: AttributeValues = {
    body: finiteNumber(attributesRaw.body) ?? base.attributes.body,
    mind: finiteNumber(attributesRaw.mind) ?? base.attributes.mind,
    soul: finiteNumber(attributesRaw.soul) ?? base.attributes.soul,
  };

  const skills: Partial<Record<SkillId, number>> = {};
  for (const skill of SKILLS) {
    const value = finiteNumber(skillsRaw[skill.id]);
    if (value !== undefined && value >= 0) {
      skills[skill.id] = Math.round(value);
    }
  }

  const ability: SoulHunterAbility = {
    name: stringOr(abilityRaw.name, base.ability.name),
    description: stringOr(abilityRaw.description, base.ability.description),
    tags: stringArrayOr(abilityRaw.tags, base.ability.tags),
    defect: optionalString(abilityRaw.defect),
    specialization: optionalString(abilityRaw.specialization) ?? base.ability.specialization,
    specialization2:
      attributes.soul >= 9
        ? (optionalString(abilityRaw.specialization2) ?? base.ability.specialization2)
        : undefined,
  };

  const style: SoulHunterStyle = {
    mode: styleRaw.mode === "combined" ? "combined" : "preset",
    styleId: optionalString(styleRaw.styleId) ?? base.style.styleId,
    styleIds: stringArray(styleRaw.styleIds),
    name: optionalString(styleRaw.name),
    actionIds: stringArrayOr(styleRaw.actionIds, base.style.actionIds),
  };

  const selections: SoulHunterSelections = {
    martialArtIds: stringArrayOr(
      selectionsRaw.martialArtIds,
      base.selections.martialArtIds,
    ),
    spellIds: stringArrayOr(selectionsRaw.spellIds, base.selections.spellIds),
    specialtyIds: stringArrayOr(
      selectionsRaw.specialtyIds,
      base.selections.specialtyIds,
    ),
    imprintIds: stringArrayOr(selectionsRaw.imprintIds, base.selections.imprintIds),
    ultimateTier1Id: optionalString(selectionsRaw.ultimateTier1Id),
    ultimateTier2Id: optionalString(selectionsRaw.ultimateTier2Id),
  };

  const resources: SoulHunterResources = {};
  for (const [key, value] of Object.entries(resourcesRaw)) {
    const number = finiteNumber(value);
    if (number !== undefined) resources[key] = Math.round(number);
  }

  const insight = finiteNumber(raw.insight);

  const soulWeapon: SoulHunterSoulWeapon | undefined = weaponRaw
    ? {
        name: stringOr(weaponRaw.name, ""),
        form: optionalString(weaponRaw.form),
        appearance: optionalString(weaponRaw.appearance),
      }
    : undefined;

  return {
    schemaVersion: 1,
    id: newId(),
    saveName: optionalString(raw.saveName),
    identity,
    bond:
      bondRaw && optionalString(bondRaw.category) && optionalString(bondRaw.name)
        ? {
            category: stringOr(bondRaw.category, ""),
            name: stringOr(bondRaw.name, ""),
            description: optionalString(bondRaw.description),
            experienceTag: optionalString(bondRaw.experienceTag),
          }
        : base.bond,
    insight: insight ?? attributes.body + attributes.mind + attributes.soul,
    attributes,
    skills,
    ability,
    style,
    selections,
    soulWeapon,
    experienceTags: stringArrayOr(raw.experienceTags, base.experienceTags),
    pockets: optionalString(raw.pockets),
    resources: {
      ...base.resources,
      ...resources,
    },
    expansions: stringArray(raw.expansions),
  };
}

/** 读取用户选择的 HTML 文件并归一化成新存档 */
export async function importCharacterFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "文件超过 8 MB，请确认选择的是导出的角色卡 HTML。" };
  }

  let html: string;
  try {
    html = await file.text();
  } catch {
    return { ok: false, error: "无法读取文件，请重试。" };
  }

  const payload = extractCharacterPayload(html);
  if (!payload) {
    return {
      ok: false,
      error: "没有找到内嵌角色数据。请使用当前版本导出的角色卡 HTML。",
    };
  }

  const character = normalizeImportedCharacter(payload);
  if (!character) {
    return { ok: false, error: "角色数据版本或格式不受支持，无法导入。" };
  }

  return { ok: true, character };
}

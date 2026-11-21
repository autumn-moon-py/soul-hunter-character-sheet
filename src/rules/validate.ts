import {
  BASE_MARTIAL_ID,
  BASE_SPELL_ID,
  CHOICE_BASE_SPELL_IDS,
  catalog as defaultCatalog,
} from "../content";
import type {
  AttributeId,
  ContentCatalog,
  IssueLevel,
  SoulHunterCharacter,
  ValidationIssue,
} from "../types";
import { BASE, SKILLS } from "./constants";
import { derive } from "./derive";
import {
  abilityCharLimit,
  abilityTagLimit,
  isSecretAllowed,
  hanLength,
} from "./grades";
import {
  baseSpellCount,
  requiredStyleActionIds,
  styleActionQuota,
} from "./quotas";

export type ValidationMode = "creation" | "advancement";

export interface ValidateOptions {
  mode?: ValidationMode;
  catalog?: ContentCatalog;
}

export function validate(
  character: SoulHunterCharacter,
  options: ValidateOptions = {},
): ValidationIssue[] {
  const mode = options.mode ?? "creation";
  const catalog = options.catalog ?? defaultCatalog;
  const derived = derive(character, { catalog });
  const issues: ValidationIssue[] = [];

  const add = (
    level: IssueLevel,
    code: string,
    message: string,
    path?: string,
  ) => {
    issues.push({ level, code, message, path });
  };

  if (character.schemaVersion !== 1) {
    add("error", "schema-version", `不支持的存档版本：${character.schemaVersion}`);
  }

  // ===== 属性 =====
  const attributes = character.attributes;
  const attributeIds: AttributeId[] = ["body", "mind", "soul"];
  const maxAttribute =
    mode === "creation" ? BASE.attributeMaxAtCreation : BASE.attributeMax;
  const hasUnassignedAttribute = attributeIds.some((id) => attributes[id] === 0);
  for (const id of attributeIds) {
    const value = attributes[id];
    if (!Number.isInteger(value)) {
      add("error", "attribute-not-integer", `属性 ${id} 不是整数：${value}`, id);
      continue;
    }
    // 0 表示玩家尚未分配
    if (value === 0) continue;
    if (value < BASE.attributeMin || value > maxAttribute) {
      add(
        "error",
        "attribute-range",
        `属性 ${id} 必须在 ${BASE.attributeMin}–${maxAttribute} 之间，当前为 ${value}`,
        id,
      );
    }
  }

  const attributeSum = attributes.body + attributes.mind + attributes.soul;
  if (hasUnassignedAttribute) {
    add("info", "attribute-unset", "还有基础属性尚未分配");
  } else if (attributeSum !== character.insight) {
    add(
      "error",
      "insight-mismatch",
      `灵识标注为 ${character.insight}，三项属性之和为 ${attributeSum}`,
      "insight",
    );
  }
  if (character.insight < BASE.insight) {
    add("error", "insight-min", `灵识不能低于初始值 ${BASE.insight}`);
  }
  if (character.insight > 18) {
    add("info", "insight-beyond-table", `灵识 ${character.insight} 已超过提升表 18 点，后续无新增里程碑`);
  }

  // ===== 技能 =====
  for (const [skillId, value] of Object.entries(character.skills)) {
    if (!SKILLS.some((skill) => skill.id === skillId)) {
      add("warning", "unknown-skill", `未知技能：${skillId}`, `skills.${skillId}`);
      continue;
    }
    if (!Number.isInteger(value) || (value ?? 0) < 0) {
      add("error", "skill-invalid", `技能 ${skillId} 的分配点数必须是非负整数`, `skills.${skillId}`);
    }
  }

  if (derived.skillPointsRemaining < 0) {
    add(
      "error",
      "skill-overflow",
      `技能点超支 ${Math.abs(derived.skillPointsRemaining)} 点（可用 ${derived.skillPointsTotal}，已用 ${derived.skillPointsSpent}）`,
      "skills",
    );
  } else if (derived.skillPointsRemaining > 0) {
    add(
      "warning",
      "skill-unspent",
      `还有 ${derived.skillPointsRemaining} 点技能点未分配`,
      "skills",
    );
  }

  // ===== 灵能力 =====
  const ability = character.ability;
  if (!ability.name.trim()) {
    add("warning", "ability-name-empty", "灵能力还没有名称");
  }
  if (!ability.description.trim()) {
    add("warning", "ability-description-empty", "灵能力还没有描述");
  } else {
    const length = hanLength(ability.description);
    if (length > abilityCharLimit(attributes.soul)) {
      add(
        "error",
        "ability-too-long",
        `灵能力描述 ${length} 字，超过上限 ${abilityCharLimit(attributes.soul)} 字`,
        "ability.description",
      );
    }
  }
  const tagLimit = abilityTagLimit(attributes.soul);
  if (ability.tags.length > tagLimit) {
    add(
      "error",
      "ability-tags-overflow",
      `灵能力标签 ${ability.tags.length} 个，超过上限 ${tagLimit} 个`,
      "ability.tags",
    );
  }
  if (ability.tags.some((tag) => !tag.trim())) {
    add("warning", "ability-tag-empty", "存在空的灵能力标签", "ability.tags");
  }
  if (new Set(ability.tags.filter(Boolean)).size !== ability.tags.filter(Boolean).length) {
    add("warning", "ability-tag-duplicate", "灵能力标签有重复", "ability.tags");
  }

  // ===== 经历标签 =====
  if (character.experienceTags.length > 3) {
    add("error", "experience-tags-overflow", "经历标签不能超过 3 个", "experienceTags");
  }
  if (character.experienceTags.some((tag) => !tag.trim())) {
    add("warning", "experience-tag-empty", "存在空的经历标签", "experienceTags");
  }
  if (
    new Set(character.experienceTags.filter(Boolean)).size !==
    character.experienceTags.filter(Boolean).length
  ) {
    add("warning", "experience-tag-duplicate", "经历标签有重复", "experienceTags");
  }

  // ===== 扩展 =====
  const expansionIds = new Set(catalog.expansions.map((item) => item.id));
  const seenExpansions = new Set<string>();
  for (const id of character.expansions) {
    if (!expansionIds.has(id)) {
      add("error", "unknown-expansion", `未知扩展：${id}`, "expansions");
    }
    if (seenExpansions.has(id)) {
      add("warning", "duplicate-expansion", `扩展重复启用：${id}`, "expansions");
    }
    seenExpansions.add(id);
  }

  // ===== 选择内容 =====
  const checkCards = (
    ids: string[],
    kind: string,
    label: string,
    path: string,
  ): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        add("error", "duplicate-selection", `${label}重复选择：${id}`, path);
        continue;
      }
      seen.add(id);
      const card = catalog.byId.get(id);
      if (!card) {
        add("error", "unknown-card", `${label}不存在：${id}`, path);
        continue;
      }
      if (card.kind !== kind) {
        add("error", "wrong-card-kind", `${id} 不是${label}，实际类型为 ${card.kind}`, path);
      }
      if (card.expansion && !character.expansions.includes(card.expansion)) {
        add(
          "error",
          "card-expansion-disabled",
          `${label}「${card.name}」属于未启用的扩展 ${card.expansion}`,
          path,
        );
      }
    }
  };

  checkCards(character.selections.martialArtIds, "martial", "武技", "selections.martialArtIds");
  checkCards(character.selections.spellIds, "spell", "术法", "selections.spellIds");
  checkCards(character.selections.specialtyIds, "specialty", "专长", "selections.specialtyIds");
  checkCards(character.selections.imprintIds, "imprint", "灵能印记", "selections.imprintIds");

  // 武技
  const martialIds = character.selections.martialArtIds;
  const hasBaseMartial = martialIds.includes(BASE_MARTIAL_ID);
  if (!hasBaseMartial) {
    add("warning", "base-martial-missing", "缺少天生武技「常规攻击」", "selections.martialArtIds");
  }
  const additionalMartial = martialIds.length - (hasBaseMartial ? 1 : 0);
  if (additionalMartial > derived.quotas.martialArts) {
    add(
      "error",
      "martial-overflow",
      `武技 ${additionalMartial} 项，超过当前体魄可习得上限 ${derived.quotas.martialArts} 项`,
      "selections.martialArtIds",
    );
  }
  for (const id of martialIds) {
    const card = catalog.byId.get(id);
    if (card?.kind === "martial" && card.secret && !isSecretAllowed("body", attributes.body)) {
      add(
        "error",
        "secret-martial",
        `体魄未达 SS，不能学习秘传武技「${card.name}」`,
        "selections.martialArtIds",
      );
    }
  }

  // 术法
  const spellIds = character.selections.spellIds;
  const hasBaseSpell = spellIds.includes(BASE_SPELL_ID);
  if (!hasBaseSpell) {
    add("warning", "base-spell-missing", "缺少天生术法「灵迹」", "selections.spellIds");
  }
  const chosenBaseSpells = CHOICE_BASE_SPELL_IDS.filter((id) => spellIds.includes(id));
  if (attributes.mind < 5) {
    if (chosenBaseSpells.length === 0) {
      add(
        "error",
        "base-spell-choice-missing",
        "智慧低于 5 时，必须在「凝爆」和「超感」中选择一个",
        "selections.spellIds",
      );
    } else if (chosenBaseSpells.length > 1) {
      add(
        "error",
        "base-spell-choice-overflow",
        "智慧低于 5 时，只能在「凝爆」和「超感」中选择一个",
        "selections.spellIds",
      );
    }
  } else if (chosenBaseSpells.length < 2) {
    add(
      "error",
      "base-spell-choice-incomplete",
      "智慧达到 5 时，应同时习得「凝爆」和「超感」",
      "selections.spellIds",
    );
  }
  const additionalSpells = spellIds.length - baseSpellCount(attributes.mind);
  if (additionalSpells > derived.quotas.spells) {
    add(
      "error",
      "spell-overflow",
      `术法 ${additionalSpells} 项，超过当前智慧可习得上限 ${derived.quotas.spells} 项`,
      "selections.spellIds",
    );
  }
  for (const id of spellIds) {
    const card = catalog.byId.get(id);
    if (card?.kind === "spell" && card.secret && !isSecretAllowed("mind", attributes.mind)) {
      add(
        "error",
        "secret-spell",
        `智慧未达 SS，不能学习秘传术法「${card.name}」`,
        "selections.spellIds",
      );
    }
  }

  // 专长
  if (character.selections.specialtyIds.length > derived.quotas.specialties) {
    add(
      "error",
      "specialty-overflow",
      `专长 ${character.selections.specialtyIds.length} 项，超过当前灵识可获得的 ${derived.quotas.specialties} 项`,
      "selections.specialtyIds",
    );
  }

  // 灵能印记
  if (character.selections.imprintIds.length > derived.quotas.imprints) {
    add(
      "error",
      "imprint-overflow",
      `灵能印记 ${character.selections.imprintIds.length} 个，超过当前上限 ${derived.quotas.imprints} 个`,
      "selections.imprintIds",
    );
  }

  // 灵魂武器
  if (
    (character.insight >= 12 || attributes.soul >= 3) &&
    !character.soulWeapon?.name.trim()
  ) {
    add("warning", "soul-weapon-missing", "灵魂武器已解锁，但还没有命名", "soulWeapon");
  }

  // 绝技
  const { ultimateTier1Id, ultimateTier2Id } = character.selections;
  if (ultimateTier1Id) {
    if (derived.quotas.ultimates < 1) {
      add("error", "ultimate1-not-unlocked", "灵识未达 14，不能习得一挡绝技", "selections.ultimateTier1Id");
    }
    const card = catalog.byId.get(ultimateTier1Id);
    if (card?.kind !== "ultimate" || card.tier !== 1) {
      add("error", "ultimate1-kind", "一挡绝技槽位必须是 tier=1 的绝技", "selections.ultimateTier1Id");
    }
  } else if (derived.quotas.ultimates >= 1) {
    add("warning", "ultimate1-missing", "灵识已达到 14，但还没有选择一挡绝技", "selections.ultimateTier1Id");
  }
  if (ultimateTier2Id) {
    if (derived.quotas.ultimates < 2) {
      add("error", "ultimate2-not-unlocked", "灵识未达 18，不能习得二挡绝技", "selections.ultimateTier2Id");
    }
    const card = catalog.byId.get(ultimateTier2Id);
    if (card?.kind !== "ultimate" || card.tier !== 2) {
      add("error", "ultimate2-kind", "二挡绝技槽位必须是 tier=2 的绝技", "selections.ultimateTier2Id");
    }
  } else if (derived.quotas.ultimates >= 2) {
    add("warning", "ultimate2-missing", "灵识已达到 18，但还没有选择二挡绝技", "selections.ultimateTier2Id");
  }
  if (ultimateTier1Id && ultimateTier1Id === ultimateTier2Id) {
    add("error", "ultimate-duplicate", "一挡与二挡不能选择同一项绝技", "selections");
  }

  // ===== 时髦风格 =====
  const style = character.style;
  const styleMode = style.mode ?? "preset";
  if (styleMode === "combined") {
    const styleIds = style.styleIds ?? [];
    if (styleIds.length < 2) {
      add("error", "style-combined-min", "组合风格至少需要选择 2 个基础风格", "style.styleIds");
    }
    if (!style.name?.trim()) {
      add("warning", "style-combined-name", "组合风格还没有命名", "style.name");
    }

    const selectedStyles = styleIds.flatMap((id) => {
      const candidate = catalog.styles.find((item) => item.id === id);
      if (!candidate) {
        add("error", "style-unknown", `基础风格不存在：${id}`, "style.styleIds");
        return [];
      }
      return [candidate];
    });

    const seenActions = new Set<string>();
    const seenCosts = new Set<number>();
    const costs = [5, 10, 15, 20, 25];
    for (const actionId of style.actionIds) {
      if (seenActions.has(actionId)) {
        add("error", "style-action-duplicate", `时髦动作重复：${actionId}`, "style.actionIds");
      }
      seenActions.add(actionId);
      const action = catalog.byId.get(actionId);
      if (!action || action.kind !== "styleAction") {
        add("error", "style-action-unknown", `时髦动作不存在：${actionId}`, "style.actionIds");
        continue;
      }
      if (action.expansion && !character.expansions.includes(action.expansion)) {
        add("error", "style-action-expansion-disabled", `时髦动作「${action.name}」属于未启用的扩展`, "style.actionIds");
      }
      if (action.style !== "通用") {
        if (!costs.includes(action.cost)) {
          add("error", "style-combined-cost", `组合风格动作「${action.name}」不在 5–25 时髦值档位内`, "style.actionIds");
        } else if (seenCosts.has(action.cost)) {
          add("error", "style-combined-duplicate-cost", `组合风格在 ${action.cost} 时髦值档位只能保留一个动作`, "style.actionIds");
        } else {
          seenCosts.add(action.cost);
        }
        const belongs = selectedStyles.some((item) => item.actionIds.includes(actionId));
        if (!belongs) {
          add("error", "style-combined-source", `时髦动作「${action.name}」不属于已选的基础风格`, "style.actionIds");
        }
      }
    }

    const missingCosts = costs.filter((cost) => !seenCosts.has(cost));
    if (missingCosts.length > 0) {
      add("warning", "style-combined-missing-cost", `组合风格缺少档位：${missingCosts.join("、")}`, "style.actionIds");
    }

    const requiredActions = requiredStyleActionIds(catalog, style, character.expansions);
    const missing = requiredActions.filter((id) => !seenActions.has(id));
    if (missing.length > 0) {
      add("warning", "style-actions-missing", `缺少通用动作：${missing.join("、")}`, "style.actionIds");
    }

    const quota = styleActionQuota(catalog, style, character.expansions);
    if (style.actionIds.length > quota) {
      add("error", "style-actions-overflow", `时髦动作 ${style.actionIds.length} 个，超过组合风格上限 ${quota} 个`, "style.actionIds");
    }
  } else {
    const styleId = style.styleId;
    if (!styleId) {
      add("warning", "style-missing", "还没有选择时髦风格", "style.styleId");
    } else {
      const preset = catalog.styles.find((candidate) => candidate.id === styleId);
      if (!preset) {
        add("error", "style-unknown", `时髦风格不存在：${styleId}`, "style.styleId");
      } else if (preset.expansion && !character.expansions.includes(preset.expansion)) {
        add("error", "style-expansion-disabled", `时髦风格「${preset.name}」属于未启用的扩展`, "style.styleId");
      }

      const seenActions = new Set<string>();
      for (const actionId of style.actionIds) {
        if (seenActions.has(actionId)) {
          add("error", "style-action-duplicate", `时髦动作重复：${actionId}`, "style.actionIds");
        }
        seenActions.add(actionId);
        const action = catalog.byId.get(actionId);
        if (!action) {
          add("error", "style-action-unknown", `时髦动作不存在：${actionId}`, "style.actionIds");
        } else if (action.kind !== "styleAction") {
          add("error", "style-action-kind", `${actionId} 不是时髦动作`, "style.actionIds");
        } else if (action.expansion && !character.expansions.includes(action.expansion)) {
          add("error", "style-action-expansion-disabled", `时髦动作「${action.name}」属于未启用的扩展`, "style.actionIds");
        }
      }

      const requiredActions = requiredStyleActionIds(catalog, style, character.expansions);
      const missing = requiredActions.filter((id) => !seenActions.has(id));
      if (missing.length > 0) {
        add("warning", "style-actions-missing", `缺少风格自带动作：${missing.join("、")}`, "style.actionIds");
      }
      const extra = style.actionIds.filter((id) => !requiredActions.includes(id));
      if (extra.length > 0) {
        add("warning", "style-actions-extra", `存在不属于当前风格的动作：${extra.join("、")}`, "style.actionIds");
      }

      const quota = styleActionQuota(catalog, style, character.expansions);
      if (style.actionIds.length > quota) {
        add("error", "style-actions-overflow", `时髦动作 ${style.actionIds.length} 个，超过当前风格上限 ${quota} 个`, "style.actionIds");
      }
    }
  }

  // ===== 羁绊 =====
  const selectedBond = character.bond;
  if (!selectedBond || !selectedBond.category) {
    add("warning", "bond-missing", "还没有选择狩魂者羁绊");
  } else if (!selectedBond.name) {
    add(
      "warning",
      "bond-incomplete",
      `已选择羁绊类别「${selectedBond.category}」，但还没有选择具体关系`,
      "bond",
    );
  } else {
    const bond = catalog.bonds.find(
      (candidate) =>
        candidate.category === selectedBond.category &&
        candidate.name === selectedBond.name,
    );
    if (!bond) {
      add(
        "warning",
        "bond-unknown",
        `羁绊「${selectedBond.category}/${selectedBond.name}」不在范例表中，视为自创羁绊`,
        "bond",
      );
    }
  }

  // ===== 资源 =====
  const resources = character.resources;
  const checkResource = (
    key: string,
    value: number | undefined,
    min: number,
    max: number,
  ) => {
    if (value === undefined) return;
    if (!Number.isFinite(value)) {
      add("error", "resource-invalid", `资源 ${key} 不是有效数字`, `resources.${key}`);
      return;
    }
    if (value < min || value > max) {
      add(
        "error",
        "resource-range",
        `资源 ${key}=${value} 超出范围 ${min}–${max}`,
        `resources.${key}`,
      );
    }
  };
  checkResource("hpCurrent", resources.hpCurrent, 0, derived.hpMax);
  checkResource("mpCurrent", resources.mpCurrent, 0, derived.mpMax);
  checkResource("stylePoints", resources.stylePoints, 0, BASE.stylePointsMax);
  checkResource("itemPoints", resources.itemPoints, 0, derived.itemPointsMax);
  checkResource("exp", resources.exp, 0, BASE.expMax);

  // ===== 身份 =====
  if (!character.identity.name.trim()) {
    add("warning", "name-empty", "还没有填写狩魂者真名");
  }
  if (!character.identity.codename.trim()) {
    add("warning", "codename-empty", "还没有填写狩魂者绰号");
  }

  return issues;
}

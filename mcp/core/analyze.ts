import { derive } from "../../src/rules/derive";
import { buildProgress } from "../../src/rules/progress";
import { validate } from "../../src/rules/validate";
import type { SoulHunterCharacter } from "../../src/types";
import { quotaUsage, validationModeOf } from "./character";
import { recommendCards } from "./recommend";

interface Gap {
  area: string;
  message: string;
  severity: "info" | "warning";
}

interface BuildOption {
  title: string;
  rationale: string;
  candidates?: Array<{ id: string; name: string; effect: string }>;
}

function candidatePreview(
  character: SoulHunterCharacter,
  kind: "martial" | "spell" | "specialty" | "imprint",
): Array<{ id: string; name: string; effect: string }> {
  const result = recommendCards(character, { kind, limit: 3 }) as {
    candidates?: Array<{ id: string; name: string; effect: string; available: boolean }>;
  };
  return (result.candidates ?? [])
    .filter((item) => item.available)
    .slice(0, 3)
    .map((item) => ({ id: item.id, name: item.name, effect: item.effect }));
}

export function analyzeBuild(character: SoulHunterCharacter): Record<string, unknown> {
  const derived = derive(character);
  const issues = validate(character, { mode: validationModeOf(character) });
  const quotas = quotaUsage(character, derived);
  const progress = buildProgress(character);

  const gaps: Gap[] = [];
  if (derived.skillPointsRemaining > 0) {
    gaps.push({
      area: "skills",
      message: `还有 ${derived.skillPointsRemaining} 点技能点未分配（可用 ${derived.skillPointsTotal}）`,
      severity: "warning",
    });
  }
  const quotaLabels: Record<string, string> = {
    martial: "武技",
    spell: "术法",
    specialty: "专长",
    imprint: "灵能印记",
    ultimate: "绝技",
  };
  for (const [key, label] of Object.entries(quotaLabels)) {
    const quota = quotas[key];
    if (quota && quota.max > 0 && quota.remaining > 0) {
      gaps.push({
        area: key,
        message: `${label}还有 ${quota.remaining} 个空位（${quota.used}/${quota.max}）`,
        severity: "info",
      });
    }
  }
  if (character.insight >= 12 && !character.soulWeapon?.name.trim()) {
    gaps.push({
      area: "soulWeapon",
      message: "灵魂武器已解锁，但还没有命名",
      severity: "warning",
    });
  }

  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  const options: BuildOption[] = [];
  if (errors.length > 0) {
    options.push({
      title: "先解决阻断错误",
      rationale: errors.map((issue) => issue.message).join("；"),
    });
  }
  if (quotas.martial.remaining > 0 && quotas.martial.max > 0) {
    options.push({
      title: "补齐武技槽位",
      rationale: `体魄 ${character.attributes.body}（${derived.grades.body}）还能习得 ${quotas.martial.remaining} 项武技`,
      candidates: candidatePreview(character, "martial"),
    });
  }
  if (quotas.spell.remaining > 0 && quotas.spell.max > 0) {
    options.push({
      title: "补齐术法槽位",
      rationale: `智慧 ${character.attributes.mind}（${derived.grades.mind}）还能习得 ${quotas.spell.remaining} 项术法`,
      candidates: candidatePreview(character, "spell"),
    });
  }
  if (quotas.specialty.remaining > 0 && quotas.specialty.max > 0) {
    options.push({
      title: "补一项专长",
      rationale: `灵识 ${character.insight} 还有 ${quotas.specialty.remaining} 个专长空位`,
      candidates: candidatePreview(character, "specialty"),
    });
  }
  if (quotas.imprint.remaining > 0 && quotas.imprint.max > 0) {
    options.push({
      title: "考虑灵能印记",
      rationale: `还有 ${quotas.imprint.remaining} 个印记空位，锻造消耗 ${4} 点经验`,
      candidates: candidatePreview(character, "imprint"),
    });
  }
  options.splice(3);

  return {
    summary: `灵识 ${character.insight}，属性 ${character.attributes.body}/${character.attributes.mind}/${character.attributes.soul}；${errors.length} 个错误，${warnings.length} 个提醒，建卡完成度 ${progress.percent}%。`,
    facts: {
      insight: character.insight,
      attributes: character.attributes,
      grades: derived.grades,
      strengths: derived.strengths,
      resources: {
        hpMax: derived.hpMax,
        mpMax: derived.mpMax,
        defense: derived.defense,
        itemPointsMax: derived.itemPointsMax,
      },
      skillPoints: {
        total: derived.skillPointsTotal,
        spent: derived.skillPointsSpent,
        remaining: derived.skillPointsRemaining,
      },
      quotas,
      unlocks: derived.unlocked,
      nextUnlock: progress.nextUnlock ?? null,
      progress: { percent: progress.percent, done: progress.done, total: progress.total },
    },
    gaps,
    risks: issues
      .filter((issue) => issue.level !== "info")
      .slice(0, 20)
      .map((issue) => ({ level: issue.level, code: issue.code, message: issue.message, path: issue.path ?? null })),
    options,
    note: "以上为确定性规则结论。卡牌强弱与团风适配需要结合完整 effect 文本判断，不要把它当作唯一最优解。",
  };
}

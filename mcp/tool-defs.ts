import { validate } from "../src/rules/validate";
import { simulateOps, type CharacterOperation } from "../src/rules/operations";
import type { SoulHunterCharacter, ValidationIssue } from "../src/types";
import { analyzeBuild } from "./core/analyze";
import { getCards, searchCards, type CardKind } from "./core/catalog";
import {
  explainCharacter,
  quotaUsage,
  validationModeOf,
} from "./core/character";
import { checkContent, checkSaveCompatibility, runProjectChecks, type ProjectCheckName } from "./core/checks";
import { diffCharacters } from "./core/diff";
import { planGrowth, type GrowthGoal } from "./core/growth-plan";
import { recommendCards, type RecommendKind } from "./core/recommend";
import { toolInputs } from "./schema";
import type { ToolContext, ToolDef, ToolResult } from "./types";

function asCharacter(raw: unknown): SoulHunterCharacter | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<SoulHunterCharacter>;
  if (candidate.schemaVersion !== 1) return null;
  if (!candidate.attributes || !candidate.selections || !candidate.ability) return null;
  return candidate as SoulHunterCharacter;
}

function resolveCharacter(
  ctx: ToolContext,
  raw: unknown,
): { character: SoulHunterCharacter } | { error: string } {
  if (raw !== undefined) {
    const character = asCharacter(raw);
    if (!character) return { error: "角色数据格式不受支持，需要 schemaVersion 1 的完整角色 JSON。" };
    return { character };
  }
  const snapshot = ctx.getSnapshot();
  if (!snapshot) {
    return { error: "网页尚未连接，没有当前角色。请运行 npm run ai 并打开本地车卡器页面。" };
  }
  return { character: snapshot.character };
}

function issueKey(issue: ValidationIssue): string {
  return `${issue.level}:${issue.code}:${issue.message}`;
}

function issueDelta(before: ValidationIssue[], after: ValidationIssue[]) {
  const beforeKeys = new Set(before.map(issueKey));
  const afterKeys = new Set(after.map(issueKey));
  return {
    added: after.filter((issue) => !beforeKeys.has(issueKey(issue))),
    removed: before.filter((issue) => !afterKeys.has(issueKey(issue))),
  };
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_character",
    title: "读取当前角色",
    description:
      "读取车卡器网页实时同步过来的当前角色快照，附带派生值、配额、校验问题与 revision。写操作前先用它确认 revision。",
    inputShape: toolInputs.get_character.shape,
    run: (_args, ctx) => {
      const snapshot = ctx.getSnapshot();
      if (!snapshot) {
        return {
          ok: true,
          data: {
            connected: false,
            hint: "网页尚未连接。运行 npm run ai，打开本地车卡器页面，面板显示已连接后重试。",
          },
        };
      }
      return {
        ok: true,
        data: {
          connected: true,
          revision: snapshot.revision,
          updatedAt: snapshot.updatedAt,
          source: snapshot.source,
          character: snapshot.character,
          derived: explainCharacter(snapshot.character),
        },
      };
    },
  },
  {
    name: "search_cards",
    title: "检索卡池",
    description:
      "按类型、关键词、扩展检索武技、术法、专长、印记、绝技、风格动作、风格和羁绊。返回摘要与截断的 effect，详细文本用 get_cards。",
    inputShape: toolInputs.search_cards.shape,
    run: (args) => ({
      ok: true,
      data: searchCards({
        kind: args.kind as CardKind | undefined,
        query: args.query as string | undefined,
        expansion: args.expansion as string | undefined,
        limit: args.limit as number | undefined,
      }),
    }),
  },
  {
    name: "get_cards",
    title: "读取完整卡牌",
    description: "按 id 读取完整卡牌数据，包含未截断的 effect 与所有结构化字段。",
    inputShape: toolInputs.get_cards.shape,
    run: (args) => ({
      ok: true,
      data: getCards(args.ids as string[]),
    }),
  },
  {
    name: "explain_character",
    title: "解读角色数值",
    description:
      "输出派生值、属性等级与强度、技能点、配额使用、解锁进度、建卡完成度和全部校验问题。所有数值来自项目规则引擎。",
    inputShape: toolInputs.explain_character.shape,
    run: (args, ctx) => {
      const resolved = resolveCharacter(ctx, args.character);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      return { ok: true, data: explainCharacter(resolved.character) };
    },
  },
  {
    name: "recommend_cards",
    title: "推荐候选卡",
    description:
      "按当前角色做确定性过滤：排除已选、未启用扩展、未达秘传门槛与已满配额，并用意图和灵能力标签做关键词粗匹配。返回完整 effect 原文供判断。",
    inputShape: toolInputs.recommend_cards.shape,
    run: (args, ctx) => {
      const resolved = resolveCharacter(ctx, undefined);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      return {
        ok: true,
        data: recommendCards(resolved.character, {
          kind: args.kind as RecommendKind,
          intent: args.intent as string | undefined,
          limit: args.limit as number | undefined,
        }),
      };
    },
  },
  {
    name: "analyze_build",
    title: "分析构筑",
    description:
      "输出确定性的构筑诊断：现状事实、配额缺口、规则风险和三组可选方向。不提供虚构的强度评分，卡牌取舍仍需结合 effect 判断。",
    inputShape: toolInputs.analyze_build.shape,
    run: (args, ctx) => {
      const resolved = resolveCharacter(ctx, args.character);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      return { ok: true, data: analyzeBuild(resolved.character) };
    },
  },
  {
    name: "plan_growth",
    title: "规划成长",
    description:
      "按经验预算规划提升顺序：灵识（6 经验，属性 +1）、灵能印记（4 经验）、经历标签（4 经验）。返回步骤、解锁内容与剩余经验。",
    inputShape: toolInputs.plan_growth.shape,
    run: (args, ctx) => {
      const resolved = resolveCharacter(ctx, undefined);
      if ("error" in resolved) return { ok: false, error: resolved.error };
      return {
        ok: true,
        data: planGrowth(resolved.character, {
          expBudget: args.expBudget as number | undefined,
          goal: args.goal as GrowthGoal | undefined,
        }),
      };
    },
  },
  {
    name: "diff_character",
    title: "对比角色或提案",
    description:
      "对比两份角色数据，或对比当前角色与某个提案。输出字段级差异、配额变化与校验问题增减。",
    inputShape: toolInputs.diff_character.shape,
    run: (args, ctx) => {
      let before: SoulHunterCharacter | null = null;
      let after: SoulHunterCharacter | null = null;

      if (args.proposalId) {
        const snapshot = ctx.getSnapshot();
        const proposal = ctx.getProposal(args.proposalId as string);
        if (!snapshot) return { ok: false, error: "网页尚未连接，无法以当前角色为基准。" };
        if (!proposal) return { ok: false, error: `提案不存在：${args.proposalId}` };
        before = snapshot.character;
        after = simulateOps(snapshot.character, proposal.ops).character;
      } else {
        before = asCharacter(args.before);
        after = asCharacter(args.after);
      }

      if (!before || !after) {
        return { ok: false, error: "需要提供完整的 before/after 角色，或一个 proposalId。" };
      }

      const changes = diffCharacters(before, after);
      const issuesBefore = validate(before, { mode: validationModeOf(before) });
      const issuesAfter = validate(after, { mode: validationModeOf(after) });

      return {
        ok: true,
        data: {
          ...changes,
          quotaBefore: quotaUsage(before),
          quotaAfter: quotaUsage(after),
          issues: issueDelta(issuesBefore, issuesAfter),
        },
      };
    },
  },
  {
    name: "propose_changes",
    title: "提交变更提案",
    description:
      "把一组受控操作提交为提案，推送到网页面板等待用户确认。不会直接修改角色。返回 proposalId、预览 diff 与新增的校验问题。",
    inputShape: toolInputs.propose_changes.shape,
    run: (args, ctx) => {
      const snapshot = ctx.getSnapshot();
      if (!snapshot) return { ok: false, error: "网页尚未连接，无法提交提案。" };

      const ops = args.ops as unknown as CharacterOperation[];
      const simulated = simulateOps(snapshot.character, ops);
      const before = snapshot.character;
      const after = simulated.character;
      const issuesBefore = validate(before, { mode: validationModeOf(before) });
      const issuesAfter = validate(after, { mode: validationModeOf(after) });
      const changes = diffCharacters(before, after);

      const proposal = ctx.createProposal({
        title: (args.title as string | undefined) ?? `${ops.length} 项调整`,
        reason: args.reason as string,
        ops,
        warnings: simulated.warnings,
        issuesBefore,
        issuesAfter,
      });

      return {
        ok: true,
        data: {
          proposalId: proposal.id,
          baseRevision: proposal.baseRevision,
          title: proposal.title,
          warnings: proposal.warnings,
          diff: changes,
          issuesAdded: issueDelta(issuesBefore, issuesAfter).added,
          next: "等待用户在网页面板点击应用；面板未连接时不会落库。",
        },
      };
    },
  },
  {
    name: "apply_changes",
    title: "请求应用提案",
    description:
      "请求网页面板应用指定提案，并等待确认（默认 30 秒）。失败会返回冲突或超时原因。角色数据仍由网页写入 localStorage。",
    inputShape: toolInputs.apply_changes.shape,
    run: async (args, ctx) => {
      const proposal = ctx.getProposal(args.proposalId as string);
      if (!proposal) return { ok: false, error: `提案不存在：${args.proposalId}` };
      if (proposal.status === "applied") {
        return { ok: true, data: { status: "applied", proposal } };
      }
      if (proposal.status !== "pending") {
        return { ok: false, error: `提案状态为 ${proposal.status}，无法应用。` };
      }
      if (proposal.baseRevision !== ctx.getRevision()) {
        return {
          ok: false,
          error: `角色已变化（提案基于 revision ${proposal.baseRevision}，当前 ${ctx.getRevision()}），请重新提交提案。`,
        };
      }
      if (!ctx.isPanelConnected()) {
        return { ok: false, error: "网页面板未连接，无法应用。请打开本地车卡器页面。" };
      }

      ctx.requestApply(proposal.id);
      const result = await ctx.waitForProposal(
        proposal.id,
        (args.timeoutMs as number | undefined) ?? 30_000,
      );

      if (result.status === "pending") {
        return { ok: false, error: "等待超时，用户尚未在面板确认。" };
      }
      if (result.status !== "applied") {
        return { ok: false, error: `提案被拒绝或已失效（${result.status}）。` };
      }
      return {
        ok: true,
        data: {
          status: "applied",
          proposalId: result.id,
          appliedAt: result.appliedAt,
          revision: ctx.getRevision(),
        },
      };
    },
  },
  {
    name: "check_content",
    title: "检查卡池一致性",
    description: "读取 content/report.json 的交叉校验结果，汇总 error/warning 明细，并对比运行时卡池数量。",
    inputShape: toolInputs.check_content.shape,
    run: async (_args, ctx) => ({ ok: true, data: await checkContent(ctx.projectRoot) }),
  },
  {
    name: "check_save_compat",
    title: "检查存档兼容",
    description:
      "读取指定 HTML 或 JSON 存档，走网页相同的归一化逻辑，报告失败原因与 id 变化警告。",
    inputShape: toolInputs.check_save_compat.shape,
    run: async (args, ctx) => ({
      ok: true,
      data: await checkSaveCompatibility(args.paths as string[]),
    }),
  },
  {
    name: "run_project_checks",
    title: "运行项目检查",
    description:
      "串行运行白名单脚本：typecheck、test、validate:content。validate:content 会重写 content/report.json。使用 execFile 不经 shell，cwd 固定项目根，超时 120 秒。",
    inputShape: toolInputs.run_project_checks.shape,
    run: async (args, ctx) => ({
      ok: true,
      data: await runProjectChecks(
        args.checks as unknown as ProjectCheckName[],
        ctx.projectRoot,
      ),
    }),
  },
];

export const TOOL_MAP = new Map(TOOL_DEFS.map((def) => [def.name, def]));

export async function runTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const def = TOOL_MAP.get(name);
  if (!def) return { ok: false, error: `未知工具：${name}` };

  const schema = toolInputs[name as keyof typeof toolInputs];
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: "参数校验失败",
      data: parsed.error.issues,
    };
  }

  try {
    return await def.run(parsed.data as Record<string, unknown>, ctx);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

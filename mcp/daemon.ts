import { randomUUID } from "node:crypto";
import http from "node:http";
import path from "node:path";
import type { SoulHunterCharacter, ValidationIssue } from "../src/types";
import { saveBackup } from "./backup";
import { stripForBridge } from "./core/character";
import {
  applyCors,
  buildAllowedOrigins,
  readJson,
  sendJson,
  startSse,
  writeSse,
} from "./http";
import { findProjectRoot } from "./paths";
import { runTool } from "./tool-defs";
import type { CharacterSnapshot, ProposalRecord, ToolContext } from "./types";

const projectRoot = findProjectRoot(
  process.env.SOUL_HUNTER_PROJECT_ROOT ?? process.cwd(),
);
const backupDir =
  process.env.SOUL_HUNTER_AI_BACKUPS ?? path.join(projectRoot, "ai-backups");
const allowedOrigins = buildAllowedOrigins(process.env.SOUL_HUNTER_WEB_ORIGINS);
// 允许固定 token，便于调试时重启守护进程后让已连接的 MCP 服务继续复用
const bridgeToken =
  process.env.SOUL_HUNTER_AI_TOKEN?.trim() || randomUUID();

let snapshot: CharacterSnapshot | null = null;
let revision = 0;
const proposals = new Map<string, ProposalRecord>();
const clients = new Set<http.ServerResponse>();

function broadcast(event: string, data: unknown): void {
  for (const client of clients) {
    writeSse(client, event, data);
  }
}

function proposalSummary(proposal: ProposalRecord): Record<string, unknown> {
  return {
    id: proposal.id,
    title: proposal.title,
    reason: proposal.reason,
    ops: proposal.ops,
    baseRevision: proposal.baseRevision,
    createdAt: proposal.createdAt,
    status: proposal.status,
    warnings: proposal.warnings,
    issues: proposal.issuesAfter.filter((issue) => issue.level !== "info"),
  };
}

function setSnapshot(
  character: SoulHunterCharacter,
  source: "web" | "file",
): CharacterSnapshot {
  const nextCharacter = stripForBridge(character);

  // 页面每次挂载都会推一次快照；内容未变时只刷新时间，避免 revision 漂移让提案过期
  if (
    snapshot &&
    JSON.stringify(snapshot.character) === JSON.stringify(nextCharacter)
  ) {
    snapshot = { ...snapshot, updatedAt: Date.now() };
    return snapshot;
  }

  revision += 1;
  snapshot = {
    character: nextCharacter,
    revision,
    updatedAt: Date.now(),
    source,
  };
  broadcast("character.updated", {
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
  });
  return snapshot;
}

function createProposal(input: {
  title: string;
  reason: string;
  ops: ProposalRecord["ops"];
  warnings: string[];
  issuesBefore: ValidationIssue[];
  issuesAfter: ValidationIssue[];
}): ProposalRecord {
  const proposal: ProposalRecord = {
    id: `p-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`,
    title: input.title,
    reason: input.reason,
    ops: input.ops,
    baseRevision: revision,
    createdAt: Date.now(),
    status: "pending",
    warnings: input.warnings,
    issuesBefore: input.issuesBefore,
    issuesAfter: input.issuesAfter,
  };
  proposals.set(proposal.id, proposal);
  broadcast("proposal.created", proposalSummary(proposal));
  return proposal;
}

function markProposal(
  id: string,
  patch: Partial<Pick<ProposalRecord, "status" | "appliedAt" | "warnings">>,
): ProposalRecord | undefined {
  const proposal = proposals.get(id);
  if (!proposal) return undefined;
  Object.assign(proposal, patch);
  broadcast("proposal.updated", proposalSummary(proposal));
  return proposal;
}

async function waitForProposal(
  id: string,
  timeoutMs: number,
): Promise<ProposalRecord> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const proposal = proposals.get(id);
    if (proposal && proposal.status !== "pending") return proposal;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return (
    proposals.get(id) ?? {
      id,
      title: "",
      reason: "",
      ops: [],
      baseRevision: revision,
      createdAt: 0,
      status: "expired",
      warnings: [],
      issuesBefore: [],
      issuesAfter: [],
    }
  );
}

const ctx: ToolContext = {
  projectRoot,
  backupDir,
  getSnapshot: () => snapshot,
  getRevision: () => revision,
  setSnapshot,
  createProposal,
  listProposals: () => [...proposals.values()],
  getProposal: (id) => proposals.get(id),
  markProposal,
  broadcast,
  isPanelConnected: () => clients.size > 0,
  waitForProposal,
  requestApply: (id) => {
    markProposal(id, {});
    broadcast("proposal.apply-requested", { id });
  },
  saveBackup: (proposal, character) =>
    saveBackup(backupDir, proposal, character, revision),
};

const server = http.createServer(async (req, res) => {
  if (!applyCors(req, res, allowedOrigins)) {
    sendJson(res, 403, { ok: false, error: "Origin 不在白名单" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        name: "soul-hunter-ai",
        revision,
        hasCharacter: Boolean(snapshot),
        pendingProposals: [...proposals.values()].filter(
          (proposal) => proposal.status === "pending",
        ).length,
        panelConnected: clients.size > 0,
        token: bridgeToken,
        pid: process.pid,
        projectRoot,
        backupDir,
      });
      return;
    }

    const providedToken =
      req.headers["x-sh-token"] ?? url.searchParams.get("token");
    if (providedToken !== bridgeToken) {
      sendJson(res, 401, { ok: false, error: "token 无效" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/events") {
      const close = startSse(req, res);
      clients.add(res);
      writeSse(res, "hello", {
        revision,
        hasCharacter: Boolean(snapshot),
      });
      // 补发已有待办提案，避免面板晚连时丢失
      for (const proposal of proposals.values()) {
        if (proposal.status === "pending") {
          writeSse(res, "proposal.created", proposalSummary(proposal));
        }
      }
      req.on("close", () => {
        close();
        clients.delete(res);
      });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/character") {
      const body = (await readJson(req)) as { character?: SoulHunterCharacter };
      if (!body.character || body.character.schemaVersion !== 1) {
        sendJson(res, 400, { ok: false, error: "缺少合法的角色数据" });
        return;
      }
      const next = setSnapshot(body.character, "web");
      sendJson(res, 200, { ok: true, revision: next.revision });
      return;
    }

    if (req.method === "GET" && url.pathname === "/proposals") {
      sendJson(res, 200, {
        ok: true,
        items: [...proposals.values()]
          .filter((proposal) => proposal.status === "pending")
          .map(proposalSummary),
      });
      return;
    }

    const proposalRoute = url.pathname.match(
      /^\/proposals\/([^/]+)\/(apply|reject|ack)$/,
    );
    if (req.method === "POST" && proposalRoute) {
      const [, id, action] = proposalRoute;
      const proposal = proposals.get(id);
      if (!proposal) {
        sendJson(res, 404, { ok: false, error: "提案不存在" });
        return;
      }

      if (action === "apply") {
        if (proposal.status !== "pending") {
          sendJson(res, 409, {
            ok: false,
            error: `提案状态为 ${proposal.status}`,
          });
          return;
        }
        if (proposal.baseRevision !== revision) {
          sendJson(res, 409, {
            ok: false,
            error: "角色已变化，提案过期",
            baseRevision: proposal.baseRevision,
            revision,
          });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          proposal: {
            id: proposal.id,
            title: proposal.title,
            reason: proposal.reason,
            ops: proposal.ops,
            baseRevision: proposal.baseRevision,
          },
        });
        return;
      }

      if (action === "reject") {
        markProposal(id, { status: "rejected" });
        sendJson(res, 200, { ok: true });
        return;
      }

      if (action === "ack") {
        if (proposal.status === "applied") {
          sendJson(res, 200, { ok: true, already: true, revision });
          return;
        }
        if (proposal.baseRevision !== revision) {
          sendJson(res, 409, {
            ok: false,
            error: "角色已变化，无法确认提案",
            baseRevision: proposal.baseRevision,
            revision,
          });
          return;
        }
        const body = (await readJson(req)) as { character?: SoulHunterCharacter };
        if (!body.character || body.character.schemaVersion !== 1) {
          sendJson(res, 400, { ok: false, error: "缺少应用后的角色数据" });
          return;
        }
        const next = setSnapshot(body.character, "web");
        const applied = markProposal(id, {
          status: "applied",
          appliedAt: Date.now(),
        });
        const backup = applied
          ? saveBackup(backupDir, applied, next.character, next.revision)
          : null;
        sendJson(res, 200, {
          ok: true,
          revision: next.revision,
          backup,
        });
        return;
      }
    }

    if (req.method === "POST" && url.pathname === "/call") {
      const body = (await readJson(req)) as { name?: string; args?: unknown };
      if (!body.name) {
        sendJson(res, 400, { ok: false, error: "缺少工具名" });
        return;
      }
      const result = await runTool(body.name, body.args, ctx);
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }

    sendJson(res, 404, { ok: false, error: "未知路由" });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

const port = Number(process.env.SOUL_HUNTER_AI_PORT ?? 4317);

server.on("error", (error) => {
  console.error(`[soul-hunter-ai] 启动失败：${error.message}`);
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.error(
    `[soul-hunter-ai] listening http://127.0.0.1:${port} (project ${projectRoot})`,
  );
});

function shutdown(): void {
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1_000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

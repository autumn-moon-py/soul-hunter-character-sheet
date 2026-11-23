import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { findProjectRoot } from "./paths";
import { TOOL_DEFS } from "./tool-defs";

interface Health {
  ok: boolean;
  token: string;
  revision: number;
  hasCharacter: boolean;
  pid: number;
}

const BASE_URL = process.env.SOUL_HUNTER_AI_URL ?? "http://127.0.0.1:4317";
let bridgeToken = "";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 编辑器启动 MCP 时 cwd 不确定，优先从入口文件位置推断项目根 */
function resolveProjectRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(currentDir, ".."), // mcp/server.ts
    path.resolve(currentDir, "../.."), // mcp/dist/server.js
  ];
  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, "package.json")) &&
      existsSync(path.join(candidate, "content", "report.json"))
    ) {
      return candidate;
    }
  }
  return findProjectRoot(process.env.SOUL_HUNTER_PROJECT_ROOT ?? process.cwd());
}

async function probe(): Promise<Health | null> {
  try {
    const response = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return null;
    return (await response.json()) as Health;
  } catch {
    return null;
  }
}

async function ensureDaemon(): Promise<Health> {
  const existing = await probe();
  if (existing) {
    bridgeToken = existing.token;
    return existing;
  }

  const projectRoot = resolveProjectRoot();
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const entry = [
    path.join(currentDir, "daemon.ts"),
    path.join(currentDir, "daemon.js"),
  ].find((candidate) => existsSync(candidate));

  if (!entry) {
    throw new Error("找不到 daemon 入口，请先执行 npm run ai:build 或手动运行 npm run ai。");
  }

  const isTypeScript = entry.endsWith(".ts");
  const args = isTypeScript ? ["--import", "tsx", entry] : [entry];
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, SOUL_HUNTER_PROJECT_ROOT: projectRoot },
  });
  child.unref();

  for (let attempt = 0; attempt < 25; attempt += 1) {
    await sleep(200);
    const health = await probe();
    if (health) {
      bridgeToken = health.token;
      return health;
    }
  }

  throw new Error(
    `无法连接本地 AI 服务（${BASE_URL}）。请手动运行 npm run ai 后重试。`,
  );
}

async function postCall(name: string, args: unknown): Promise<Response> {
  return fetch(`${BASE_URL}/call`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sh-token": bridgeToken,
    },
    body: JSON.stringify({ name, args }),
  });
}

async function callDaemon(
  name: string,
  args: unknown,
): Promise<{ ok: boolean; data?: unknown; error?: string; warnings?: string[] }> {
  if (!bridgeToken) await ensureDaemon();

  let response: Response;
  try {
    response = await postCall(name, args);
    // 守护进程重启后 token 会变化，重新握手后再试一次
    if (response.status === 401) {
      await ensureDaemon();
      response = await postCall(name, args);
    }
  } catch {
    await ensureDaemon();
    response = await postCall(name, args);
  }

  return (await response.json()) as {
    ok: boolean;
    data?: unknown;
    error?: string;
    warnings?: string[];
  };
}

const server = new McpServer({
  name: "soul-hunter-ai",
  version: "0.1.0",
});

for (const def of TOOL_DEFS) {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputShape as any,
    },
    async (args: Record<string, unknown>) => {
      try {
        const result = await callDaemon(def.name, args);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          isError: result.ok === false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `调用失败：${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}

async function main(): Promise<void> {
  try {
    const health = await ensureDaemon();
    console.error(
      `[soul-hunter-mcp] 已连接本地服务 pid=${health.pid} revision=${health.revision}`,
    );
  } catch (error) {
    // 不阻塞 MCP 启动，工具调用时会再次尝试
    console.error(
      `[soul-hunter-mcp] ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

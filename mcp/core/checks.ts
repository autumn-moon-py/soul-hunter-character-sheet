import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { catalog } from "../../src/content";
import {
  extractCharacterPayload,
  normalizeImportedCharacter,
} from "../../lib/soulhunter/import-html";

const execFileAsync = promisify(execFile);

export const ALLOWED_CHECKS = ["typecheck", "test", "validate:content"] as const;
export type ProjectCheckName = (typeof ALLOWED_CHECKS)[number];

interface ReportIssue {
  level: "error" | "warning" | "info";
  kind: string;
  message: string;
}

function tail(text: string, length = 2000): string {
  return text.length > length ? `…${text.slice(-length)}` : text;
}

export async function checkContent(projectRoot: string): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(path.join(projectRoot, "content/report.json"), "utf8");
  const report = JSON.parse(raw) as {
    generatedAt?: string;
    summary?: Record<string, number>;
    counts?: Record<string, number>;
    issues?: ReportIssue[];
  };
  const issues = report.issues ?? [];

  return {
    generatedAt: report.generatedAt ?? null,
    summary: report.summary ?? null,
    counts: report.counts ?? null,
    catalogCounts: {
      martial: catalog.martialArts.length,
      spell: catalog.spells.length,
      imprint: catalog.imprints.length,
      specialty: catalog.specialties.length,
      ultimate: catalog.ultimates.length,
      styleAction: catalog.styleActions.length,
      style: catalog.styles.length,
      bond: catalog.bonds.length,
    },
    problems: issues.filter((issue) => issue.level !== "info").slice(0, 50),
    infoCount: issues.filter((issue) => issue.level === "info").length,
    totalIssues: issues.length,
  };
}

async function expandFiles(inputs: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  for (const input of inputs) {
    const stat = await fs.stat(input);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(input, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.(html?|json)$/i.test(entry.name)) {
          files.push(path.join(input, entry.name));
        }
      }
      continue;
    }
    files.push(input);
  }
  return files;
}

export async function checkSaveCompatibility(
  paths: readonly string[],
): Promise<Record<string, unknown>> {
  const files = await expandFiles(paths);
  const results: unknown[] = [];

  for (const file of files) {
    try {
      const text = await fs.readFile(file, "utf8");
      const parsed = /\.html?$/i.test(file)
        ? extractCharacterPayload(text)
        : (JSON.parse(text) as unknown);

      // 审计备份是 { savedAt, revision, character } 包裹，取内层角色
      const payload =
        typeof parsed === "object" &&
        parsed !== null &&
        "character" in parsed &&
        !("schemaVersion" in parsed)
          ? (parsed as { character?: unknown }).character
          : parsed;

      if (!payload) {
        results.push({ file, ok: false, error: "没有找到内嵌角色数据" });
        continue;
      }

      const normalized = normalizeImportedCharacter(payload);
      if (!normalized) {
        results.push({ file, ok: false, error: "角色数据版本或格式不受支持" });
        continue;
      }

      const warnings: string[] = [];
      const originalId =
        typeof payload === "object" && payload !== null && "id" in payload
          ? String((payload as { id?: unknown }).id ?? "")
          : "";
      if (originalId && originalId !== normalized.id) {
        warnings.push(`归一化会重新生成 id：${originalId} -> ${normalized.id}`);
      }

      results.push({
        file,
        ok: true,
        warnings,
        character: {
          name: normalized.identity.name,
          codename: normalized.identity.codename,
          insight: normalized.insight,
          schemaVersion: normalized.schemaVersion,
        },
      });
    } catch (error) {
      results.push({ file, ok: false, error: String(error) });
    }
  }

  return { fileCount: files.length, results };
}

export async function runProjectChecks(
  names: readonly ProjectCheckName[],
  projectRoot: string,
): Promise<Record<string, unknown>> {
  const results: unknown[] = [];

  for (const name of names) {
    if (!ALLOWED_CHECKS.includes(name)) {
      results.push({ name, ok: false, error: "不在白名单内" });
      continue;
    }

    const startedAt = Date.now();
    try {
      const { stdout, stderr } = await execFileAsync("npm", ["run", name], {
        cwd: projectRoot,
        timeout: 120_000,
        maxBuffer: 200 * 1024,
      });
      results.push({
        name,
        ok: true,
        durationMs: Date.now() - startedAt,
        output: tail(stdout),
        stderr: tail(stderr),
      });
    } catch (error) {
      const failure = error as { message?: string; stdout?: string; stderr?: string; killed?: boolean };
      results.push({
        name,
        ok: false,
        durationMs: Date.now() - startedAt,
        timedOut: Boolean(failure.killed),
        error: failure.message ?? String(error),
        output: tail(failure.stdout ?? ""),
        stderr: tail(failure.stderr ?? ""),
      });
    }
  }

  return { results };
}

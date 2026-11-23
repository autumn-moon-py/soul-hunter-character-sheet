import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SoulHunterCharacter } from "../src/types";
import type { ProposalRecord } from "./types";

/** 每个角色默认保留的备份份数，可用 SOUL_HUNTER_AI_BACKUP_KEEP 覆盖 */
const DEFAULT_KEEP = 20;

function safeName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return cleaned || "character";
}

function keepLimit(): number {
  const raw = Number(process.env.SOUL_HUNTER_AI_BACKUP_KEEP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_KEEP;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 只清理同一角色、文件名符合 `${id}-时间戳.json` 的旧备份，保留最新的 keep 份 */
function pruneBackups(backupDir: string, prefix: string, keep: number): void {
  const pattern = new RegExp(
    `^${escapeRegExp(prefix)}-\\d{4}-\\d{2}-\\d{2}T[\\dTZ-]+\\.json$`,
  );
  // 文件名内嵌 ISO 时间戳，按名称倒序即按时间从新到旧
  const names = readdirSync(backupDir)
    .filter((name) => pattern.test(name))
    .sort((a, b) => b.localeCompare(a));

  for (const name of names.slice(keep)) {
    try {
      rmSync(path.join(backupDir, name));
    } catch {
      // 删除失败不影响本次备份，下次写入时再清理
    }
  }
}

/** 审计落盘：文件名由服务端生成，不接受外部路径，避免路径穿越 */
export function saveBackup(
  backupDir: string,
  proposal: ProposalRecord,
  character: SoulHunterCharacter,
  revision: number,
): string {
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const prefix = safeName(character.id);
  const file = path.join(backupDir, `${prefix}-${stamp}.json`);

  writeFileSync(
    file,
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        revision,
        proposalId: proposal.id,
        reason: proposal.reason,
        character,
      },
      null,
      2,
    ),
    "utf8",
  );

  pruneBackups(backupDir, prefix, keepLimit());

  return file;
}

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SoulHunterCharacter } from "../src/types";
import type { ProposalRecord } from "./types";

function safeName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return cleaned || "character";
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
  const file = path.join(backupDir, `${safeName(character.id)}-${stamp}.json`);

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

  return file;
}

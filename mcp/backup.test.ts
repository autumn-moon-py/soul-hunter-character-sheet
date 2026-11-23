import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLegalCharacter } from "../src/rules/fixtures";
import { saveBackup } from "./backup";
import type { ProposalRecord } from "./types";

let dir = "";

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sh-backup-"));
  process.env.SOUL_HUNTER_AI_BACKUP_KEEP = "3";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.SOUL_HUNTER_AI_BACKUP_KEEP;
  rmSync(dir, { recursive: true, force: true });
});

function fakeProposal(id: string): ProposalRecord {
  return {
    id,
    title: "测试提案",
    reason: "测试",
    ops: [],
    baseRevision: 1,
    createdAt: Date.now(),
    status: "applied",
    warnings: [],
    issuesBefore: [],
    issuesAfter: [],
  };
}

describe("saveBackup", () => {
  it("只保留最新的若干份，删除更早的备份", () => {
    const character = createLegalCharacter();

    for (let index = 0; index < 6; index += 1) {
      saveBackup(dir, fakeProposal(`p-${index}`), character, index + 1);
      vi.advanceTimersByTime(1_000);
    }

    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(3);
    // 保留下来的应是最新的三份（时间戳递增）
    expect(files[2]).toContain("2026-01-01T00-00-05");
  });

  it("不同角色的备份互不影响", () => {
    const first = createLegalCharacter();
    const other = { ...createLegalCharacter(), id: "other-character" };

    for (let index = 0; index < 4; index += 1) {
      saveBackup(dir, fakeProposal(`p-${index}`), first, index + 1);
      vi.advanceTimersByTime(1_000);
    }
    saveBackup(dir, fakeProposal("p-other"), other, 1);

    const files = readdirSync(dir);
    expect(files).toHaveLength(4);
    expect(files.some((name) => name.startsWith("other-character-"))).toBe(true);
  });
});

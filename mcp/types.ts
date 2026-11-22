import type { CharacterOperation } from "../src/rules/operations";
import type { SoulHunterCharacter, ValidationIssue } from "../src/types";

export interface CharacterSnapshot {
  character: SoulHunterCharacter;
  revision: number;
  updatedAt: number;
  source: "web" | "file" | "none";
}

export type ProposalStatus = "pending" | "applied" | "rejected" | "expired";

export interface ProposalRecord {
  id: string;
  title: string;
  reason: string;
  ops: CharacterOperation[];
  baseRevision: number;
  createdAt: number;
  status: ProposalStatus;
  appliedAt?: number;
  warnings: string[];
  issuesBefore: ValidationIssue[];
  issuesAfter: ValidationIssue[];
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  warnings?: string[];
}

export interface ToolContext {
  projectRoot: string;
  backupDir: string;
  getSnapshot(): CharacterSnapshot | null;
  getRevision(): number;
  setSnapshot(character: SoulHunterCharacter, source: "web" | "file"): CharacterSnapshot;
  createProposal(input: {
    title: string;
    reason: string;
    ops: CharacterOperation[];
    warnings: string[];
    issuesBefore: ValidationIssue[];
    issuesAfter: ValidationIssue[];
  }): ProposalRecord;
  listProposals(): ProposalRecord[];
  getProposal(id: string): ProposalRecord | undefined;
  markProposal(
    id: string,
    patch: Partial<Pick<ProposalRecord, "status" | "appliedAt" | "warnings">>,
  ): ProposalRecord | undefined;
  broadcast(event: string, data: unknown): void;
  isPanelConnected(): boolean;
  waitForProposal(id: string, timeoutMs: number): Promise<ProposalRecord>;
  requestApply(id: string): void;
  saveBackup(proposal: ProposalRecord, character: SoulHunterCharacter): string;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputShape: Record<string, unknown>;
  run(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> | ToolResult;
}

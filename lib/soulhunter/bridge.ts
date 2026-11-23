"use client";

import type { CharacterOperation } from "@/src/rules/operations";
import type { SoulHunterCharacter } from "@/src/types";
import { useCharacterStore } from "./store";

const BASE_KEY = "soul-hunter.ai.base";
const DEFAULT_BASE = "http://127.0.0.1:4317";

export interface BridgeHealth {
  ok: boolean;
  token: string;
  revision: number;
  hasCharacter: boolean;
  pendingProposals: number;
  panelConnected: boolean;
  pid: number;
  projectRoot: string;
  backupDir: string;
}

export interface ProposalIssue {
  level: string;
  code: string;
  message: string;
}

export interface ProposalView {
  id: string;
  title: string;
  reason: string;
  ops: CharacterOperation[];
  baseRevision: number;
  createdAt: number;
  status: string;
  warnings: string[];
  issues: ProposalIssue[];
}

export interface BridgeHandlers {
  onProposal: (proposal: ProposalView) => void;
  onApplyRequested: (id: string) => void;
  onCharacterUpdated: (revision: number) => void;
}

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function bridgeBase(): string {
  return storageGet(BASE_KEY) ?? DEFAULT_BASE;
}

export function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export async function probeBridge(
  timeoutMs = 800,
): Promise<{ health: BridgeHealth } | null> {
  if (!isLocalHost()) return null;
  try {
    const response = await fetch(`${bridgeBase()}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const health = (await response.json()) as BridgeHealth;
    return health.ok ? { health } : null;
  } catch {
    return null;
  }
}

function parseEventChunk(chunk: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}

export async function connectBridge(
  token: string,
  handlers: BridgeHandlers,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${bridgeBase()}/events`, {
    headers: { "x-sh-token": token },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error("无法建立事件流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const parsed = parseEventChunk(chunk);
      if (!parsed) continue;

      if (parsed.event === "proposal.created" || parsed.event === "proposal.updated") {
        handlers.onProposal(parsed.data as ProposalView);
      } else if (parsed.event === "proposal.apply-requested") {
        const id = (parsed.data as { id?: string }).id;
        if (id) handlers.onApplyRequested(id);
      } else if (parsed.event === "character.updated") {
        const revision = (parsed.data as { revision?: number }).revision;
        if (typeof revision === "number") handlers.onCharacterUpdated(revision);
      }
    }
  }
}

export async function pushCharacter(
  character: SoulHunterCharacter,
  token: string,
): Promise<boolean> {
  const stripped = structuredClone(character);
  delete stripped.identity.avatar;
  try {
    const response = await fetch(`${bridgeBase()}/character`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-sh-token": token,
      },
      body: JSON.stringify({ character: stripped }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface ApplyResult {
  ok: boolean;
  status: number;
  error?: string;
  ops?: CharacterOperation[];
}

export async function requestApply(
  id: string,
  token: string,
): Promise<ApplyResult> {
  try {
    const response = await fetch(`${bridgeBase()}/proposals/${id}/apply`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sh-token": token },
      body: "{}",
    });
    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      proposal?: { ops: CharacterOperation[] };
    };
    return {
      ok: Boolean(body.ok),
      status: response.status,
      error: body.error,
      ops: body.proposal?.ops,
    };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}

export async function ackApply(
  id: string,
  character: SoulHunterCharacter,
  token: string,
): Promise<{ ok: boolean; error?: string; revision?: number; backup?: string }> {
  const stripped = structuredClone(character);
  delete stripped.identity.avatar;
  try {
    const response = await fetch(`${bridgeBase()}/proposals/${id}/ack`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sh-token": token },
      body: JSON.stringify({ character: stripped }),
    });
    return (await response.json()) as {
      ok: boolean;
      error?: string;
      revision?: number;
      backup?: string;
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export async function rejectProposal(id: string, token: string): Promise<void> {
  try {
    await fetch(`${bridgeBase()}/proposals/${id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sh-token": token },
      body: "{}",
    });
  } catch {
    // 本地服务已断开时忽略
  }
}

/** 把受控操作逐条交给现有 store action，保留其业务规则 */
export function applyOperations(ops: readonly CharacterOperation[]): void {
  const store = useCharacterStore.getState();

  for (const op of ops) {
    switch (op.op) {
      case "setAttribute":
        store.setAttribute(op.attribute, op.value);
        break;
      case "setInsight":
        store.setInsight(op.value);
        break;
      case "setSkill":
        store.setSkillAllocation(op.skill, op.value);
        break;
      case "addCard":
        store.addCard(op.kind, op.id);
        break;
      case "removeCard":
        store.removeCard(op.kind, op.id);
        break;
      case "replaceCard":
        store.replaceCard(op.kind, op.oldId, op.newId);
        break;
      case "setUltimate":
        store.setUltimate(op.tier, op.id);
        break;
      case "setStyle":
        store.setStyle(op.styleId);
        break;
      case "setCombinedStyle":
        store.setCombinedStyle({
          name: op.name,
          styleIds: op.styleIds,
          actionIds: op.actionIds,
        });
        break;
      case "setBond":
        store.setBond(op.category, op.name);
        break;
      case "setAbilityField":
        store.setAbilityField(op.field, op.value);
        break;
      case "setExperienceTags":
        store.setExperienceTags(op.tags);
        break;
      case "setSoulWeaponName":
        store.setSoulWeaponField("name", op.value);
        break;
      case "setPockets":
        store.setPockets(op.value);
        break;
      case "setIdentityField":
        store.setIdentityField(op.field, op.value);
        break;
    }
  }
}

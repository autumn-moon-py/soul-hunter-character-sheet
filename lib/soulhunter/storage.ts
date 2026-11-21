import type { SoulHunterCharacter } from "@/src/types";

const INDEX_KEY = "soul-hunter.saves.v1";
const SAVE_PREFIX = "soul-hunter.save.v1.";
const CURRENT_KEY = "soul-hunter.current.v1";
const LEGACY_KEY = "soul-hunter.character.v1";

export interface SaveMeta {
  id: string;
  name: string;
  codename: string;
  insight: number;
  updatedAt: number;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toMeta(character: SoulHunterCharacter): SaveMeta {
  return {
    id: character.id,
    name: character.saveName?.trim() || character.identity.name || "无名",
    codename: character.identity.codename || "",
    insight: character.insight,
    updatedAt: Date.now(),
  };
}

/** 把旧版单存档迁移到多存档结构，避免已有角色丢失 */
function ensureMigrated(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(INDEX_KEY)) return;

  const legacy = safeParse<SoulHunterCharacter>(window.localStorage.getItem(LEGACY_KEY));
  if (!legacy || legacy.schemaVersion !== 1) return;

  window.localStorage.setItem(`${SAVE_PREFIX}${legacy.id}`, JSON.stringify(legacy));
  window.localStorage.setItem(INDEX_KEY, JSON.stringify([toMeta(legacy)]));
  window.localStorage.setItem(CURRENT_KEY, legacy.id);
  window.localStorage.removeItem(LEGACY_KEY);
}

function readIndex(): SaveMeta[] {
  return safeParse<SaveMeta[]>(window.localStorage.getItem(INDEX_KEY)) ?? [];
}

function writeIndex(list: SaveMeta[]): void {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

export function listSaves(): SaveMeta[] {
  if (typeof window === "undefined") return [];
  ensureMigrated();
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCurrentSaveId(): string | null {
  if (typeof window === "undefined") return null;
  ensureMigrated();
  return window.localStorage.getItem(CURRENT_KEY);
}

export function setCurrentSaveId(id: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CURRENT_KEY, id);
}

export function loadSave(id: string): SoulHunterCharacter | null {
  if (typeof window === "undefined") return null;
  const parsed = safeParse<SoulHunterCharacter>(
    window.localStorage.getItem(`${SAVE_PREFIX}${id}`),
  );
  if (parsed?.schemaVersion !== 1) return null;
  return parsed;
}

export function loadCharacter(): SoulHunterCharacter | null {
  if (typeof window === "undefined") return null;
  ensureMigrated();

  const currentId = getCurrentSaveId();
  if (currentId) {
    const current = loadSave(currentId);
    if (current) return current;
  }

  const first = listSaves()[0];
  return first ? loadSave(first.id) : null;
}

export function saveCharacter(character: SoulHunterCharacter): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(`${SAVE_PREFIX}${character.id}`, JSON.stringify(character));
  const list = readIndex().filter((item) => item.id !== character.id);
  list.unshift(toMeta(character));
  writeIndex(list);
  setCurrentSaveId(character.id);
}

/** 删除存档，返回按列表顺序的下一个存档 id（用于删除当前存档后的切换） */
export function deleteSave(id: string): string | null {
  if (typeof window === "undefined") return null;

  window.localStorage.removeItem(`${SAVE_PREFIX}${id}`);
  writeIndex(readIndex().filter((item) => item.id !== id));

  const nextId = listSaves()[0]?.id ?? null;
  if (getCurrentSaveId() === id) {
    if (nextId) setCurrentSaveId(nextId);
    else window.localStorage.removeItem(CURRENT_KEY);
  }
  return nextId;
}

export function renameSave(id: string, name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (!trimmed) return;

  writeIndex(
    readIndex().map((item) =>
      item.id === id ? { ...item, name: trimmed, updatedAt: Date.now() } : item,
    ),
  );

  const character = loadSave(id);
  if (character) {
    character.saveName = trimmed;
    window.localStorage.setItem(`${SAVE_PREFIX}${id}`, JSON.stringify(character));
  }
}

export function duplicateSave(id: string): string | null {
  if (typeof window === "undefined") return null;
  const source = loadSave(id);
  if (!source) return null;

  const nextId = `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const copy = structuredClone(source);
  copy.id = nextId;
  copy.saveName = `${source.saveName?.trim() || source.identity.name || "无名"} 副本`;

  window.localStorage.setItem(`${SAVE_PREFIX}${nextId}`, JSON.stringify(copy));
  const list = readIndex();
  list.unshift(toMeta(copy));
  writeIndex(list);
  return nextId;
}

export function clearCharacter(): void {
  if (typeof window === "undefined") return;
  const id = getCurrentSaveId();
  if (id) deleteSave(id);
}

import { catalog } from "../../src/content";
import type {
  AnyContentCard,
  BondDefinition,
  StyleDefinition,
} from "../../src/types";

export type CatalogEntry = AnyContentCard | StyleDefinition;

export type CardKind =
  | "martial"
  | "spell"
  | "specialty"
  | "imprint"
  | "ultimate"
  | "styleAction"
  | "style"
  | "bond";

function entriesOf(kind: CardKind): CatalogEntry[] {
  switch (kind) {
    case "martial":
      return catalog.martialArts;
    case "spell":
      return catalog.spells;
    case "specialty":
      return catalog.specialties;
    case "imprint":
      return catalog.imprints;
    case "ultimate":
      return catalog.ultimates;
    case "styleAction":
      return catalog.styleActions;
    case "style":
      return catalog.styles;
    case "bond":
      return catalog.bonds;
  }
}

function effectText(entry: CatalogEntry): string {
  if (entry.kind === "bond") return entry.description;
  if (entry.kind === "style") return entry.description ?? "";
  if (entry.kind === "imprint" || entry.kind === "specialty") return entry.description;
  if (entry.kind === "ultimate") return `${entry.description}\n${entry.effect}`;
  return entry.effect;
}

function truncate(text: string, length = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length)}…` : normalized;
}

export function cardSummary(entry: CatalogEntry): Record<string, unknown> {
  const base = {
    id: entry.id,
    kind: entry.kind,
    name: entry.name,
    expansion: entry.expansion ?? null,
  };

  switch (entry.kind) {
    case "martial":
      return {
        ...base,
        secret: entry.secret,
        support: entry.support,
        cost: entry.cost,
        target: entry.target,
        effect: truncate(entry.effect),
      };
    case "spell":
      return {
        ...base,
        secret: entry.secret,
        category: entry.category,
        type: entry.type,
        cost: entry.cost,
        target: entry.target,
        effect: truncate(entry.effect),
      };
    case "imprint":
    case "specialty":
      return { ...base, description: truncate(entry.description) };
    case "ultimate":
      return {
        ...base,
        tier: entry.tier,
        soul: entry.soul,
        domain: entry.domain,
        effect: truncate(entry.effect),
      };
    case "styleAction":
      return {
        ...base,
        style: entry.style,
        cost: entry.cost,
        effect: truncate(entry.effect),
      };
    case "style":
      return {
        ...base,
        description: entry.description ?? "",
        actionIds: entry.actionIds,
        actionCount: entry.actionIds.length,
      };
    case "bond":
      return {
        ...base,
        category: entry.category,
        roll: entry.roll,
        description: truncate(entry.description),
        experienceTag: entry.experienceTag ?? null,
      };
  }
}

export interface SearchInput {
  kind?: CardKind;
  query?: string;
  expansion?: string;
  limit?: number;
}

export function searchCards(input: SearchInput = {}): Record<string, unknown> {
  const limit = input.limit ?? 20;
  const pool = input.kind ? entriesOf(input.kind) : [
    ...catalog.martialArts,
    ...catalog.spells,
    ...catalog.specialties,
    ...catalog.imprints,
    ...catalog.ultimates,
    ...catalog.styleActions,
    ...catalog.styles,
    ...catalog.bonds,
  ];

  const query = input.query?.trim().toLowerCase();
  const matched = pool.filter((entry) => {
    if (input.expansion && (entry.expansion ?? null) !== input.expansion) return false;
    if (!query) return true;
    const haystack = `${entry.name} ${effectText(entry)}`.toLowerCase();
    return haystack.includes(query);
  });

  return {
    total: matched.length,
    returned: Math.min(matched.length, limit),
    items: matched.slice(0, limit).map(cardSummary),
  };
}

export function getCards(ids: readonly string[]): Record<string, unknown> {
  const items: unknown[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const entry =
      catalog.byId.get(id) ?? catalog.styles.find((style) => style.id === id);
    if (!entry) {
      missing.push(id);
      continue;
    }
    items.push(entry);
  }

  return { items, missing };
}

export function allBonds(): BondDefinition[] {
  return catalog.bonds;
}

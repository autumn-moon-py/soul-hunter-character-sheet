type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface DiffChange {
  path: string;
  before: unknown;
  after: unknown;
}

export function diffCharacters(
  before: unknown,
  after: unknown,
): { changes: DiffChange[]; truncated: boolean } {
  const changes: DiffChange[] = [];
  let truncated = false;

  const walk = (a: unknown, b: unknown, path: string): void => {
    if (changes.length >= 200) {
      truncated = true;
      return;
    }
    if (path === "identity.avatar") return;

    if (isRecord(a) && isRecord(b)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        walk(a[key], b[key], path ? `${path}.${key}` : key);
      }
      return;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        changes.push({ path, before: a, after: b });
      }
      return;
    }

    if (a !== b) {
      changes.push({ path, before: a ?? null, after: b ?? null });
    }
  };

  walk(before, after, "");
  return { changes, truncated };
}

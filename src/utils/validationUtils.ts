// Argument checks for model edits: return the clean value or throw a readable error

/** A usable entity name: trimmed and not empty */
export const requireName = (name: unknown): string => {
  const value = typeof name === "string" ? name.trim() : "";
  if (!value) throw new Error("The name must not be empty");
  return value;
};

/** One of the allowed values, or a readable error listing them */
export const requireOneOf = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  if (!allowed.includes(value as T)) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return value as T;
};

interface Rooted {
  i: number;
  removed?: boolean;
  origins?: (number | null)[] | null;
}

/** Origins for an entity: the first is primary (0 = top level), the rest secondary. None may descend from it */
export function requireOrigins(list: Rooted[], id: number, origins: number[]): number[] {
  if (!Array.isArray(origins) || !origins.length) throw new Error("Name at least one origin; 0 is the top level");
  const unique = [...new Set(origins)];
  const ancestors = (from: number, seen = new Set<number>()): Set<number> => {
    for (const origin of list[from]?.origins ?? []) {
      if (!origin || seen.has(origin)) continue;
      seen.add(origin);
      ancestors(origin, seen);
    }
    return seen;
  };
  for (const [index, origin] of unique.entries()) {
    if (origin === 0 && !index) continue;
    const entity = list[origin];
    if (!Number.isInteger(origin) || !origin || !entity || entity.removed || entity.i !== origin)
      throw new Error(`Origin ${origin} does not exist; only the primary origin may be 0, the top level`);
    if (origin === id || ancestors(origin).has(id))
      throw new Error(`${origin} descends from ${id} and cannot be its origin`);
  }
  return unique;
}

/** A short code of 1 to 3 characters */
export function requireCode(code: unknown): string {
  const value = typeof code === "string" ? code.trim() : "";
  if (!value || value.length > 3) throw new Error("The code must be 1 to 3 characters");
  return value;
}

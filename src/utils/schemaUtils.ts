import type { z } from "zod";

/** Where a repair looks for the value to stand in for an invalid one */
export type TemplateLookup = (source: any, key: PropertyKey, parentKey: PropertyKey | undefined) => unknown;

const plainLookup: TemplateLookup = (source, key) => source?.[key];

/**
 * Adopt an untrusted object one section at a time: a section that validates is taken as is, a
 * section that fails is repaired value by value from the defaults, and only a section beyond
 * repair falls back whole. Every boundary an object crosses - `localStorage`, a `.map` file -
 * parses through this, so one stale field never costs the user the object around it.
 *
 * A repair strips unknown keys, which is how values from a newer or abandoned shape stop
 * travelling, and drops the single entry of a definition set that cannot be repaired rather than
 * the set around it. See docs/architecture/configuration.md#validation
 */
export function parseSections<T extends Record<string, unknown>>(
  schema: z.ZodObject<any>,
  defaults: Readonly<Record<string, unknown>>,
  input: unknown,
  label: string,
  templateFor: TemplateLookup = plainLookup
): T {
  const source = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const result: Record<string, unknown> = {};

  for (const [section, sectionSchema] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    const parsed = sectionSchema.safeParse(source[section]);
    if (parsed.success) {
      result[section] = parsed.data;
      continue;
    }

    const fallback = structuredClone(defaults[section]);
    const repaired = replaceInvalidValues(source[section], fallback, parsed.error, templateFor);
    const reparsed = repaired === undefined ? undefined : sectionSchema.safeParse(repaired);

    if (reparsed?.success) {
      const stripped = parsed.error.issues.every(issue => issue.code === "unrecognized_keys");
      console.warn(
        stripped
          ? `${label}: unknown "${section}" keys stripped`
          : `${label}: invalid "${section}" values replaced with defaults`
      );
      result[section] = reparsed.data;
    } else {
      console.warn(`${label}: invalid or missing "${section}", default used`);
      result[section] = fallback;
    }
  }

  return result as T;
}

// replaces the failing values alone, so one bad attribute does not cost the section around it;
// undefined when that cannot be done, leaving the caller its whole-section fallback
function replaceInvalidValues(
  input: unknown,
  fallback: unknown,
  error: z.ZodError,
  templateFor: TemplateLookup
): unknown {
  if (typeof input !== "object" || input === null) return undefined;

  const repaired = structuredClone(input) as Record<PropertyKey, any>;
  const dropped = new Map<unknown[], Set<number>>();

  for (const issue of error.issues) {
    // a key from a newer or abandoned schema: strip it, and keep the section around it
    if (issue.code === "unrecognized_keys") {
      const container = resolve(repaired, issue.path);
      if (container === undefined) return undefined;
      for (const key of issue.keys) delete container[key];
      continue;
    }

    const path = issue.path;
    if (!path.length) return undefined;

    // an entry of a definition set has no counterpart in the defaults to be repaired from, so the
    // entry alone is dropped and the rest of the user's set survives
    const entry = arrayEntryOn(repaired, path);
    if (entry) {
      const indices = dropped.get(entry.list) ?? new Set<number>();
      indices.add(entry.index);
      dropped.set(entry.list, indices);
      continue;
    }

    let target: any = repaired;
    let source: any = fallback;
    let parentKey: PropertyKey | undefined;
    for (const key of path.slice(0, -1)) {
      target = target?.[key];
      source = templateFor(source, key, parentKey);
      parentKey = key;
    }

    const key = path[path.length - 1];
    if (target === undefined || target === null || source === undefined || source === null) return undefined;
    const sourceValue = templateFor(source, key, parentKey);
    if (sourceValue === undefined) return undefined;
    target[key] = structuredClone(sourceValue);
  }

  for (const [list, indices] of dropped) {
    for (const index of [...indices].sort((a, b) => b - a)) list.splice(index, 1);
  }
  return repaired;
}

/** The object a path points at, or undefined when the path does not lead to one */
function resolve(root: Record<PropertyKey, any>, path: readonly PropertyKey[]): Record<PropertyKey, any> | undefined {
  let node: any = root;
  for (const key of path) node = node?.[key];
  return typeof node === "object" && node !== null ? node : undefined;
}

/** The array element a path passes through, when it passes through one */
function arrayEntryOn(
  root: Record<PropertyKey, any>,
  path: readonly PropertyKey[]
): { list: unknown[]; index: number } | undefined {
  let node: any = root;
  for (const key of path) {
    if (Array.isArray(node) && typeof key === "number") return { list: node, index: key };
    node = node?.[key];
    if (node === undefined || node === null) return undefined;
  }
  return undefined;
}

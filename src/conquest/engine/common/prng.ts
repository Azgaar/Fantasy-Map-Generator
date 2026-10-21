/**
 * Deterministic helpers: canonical serialization, content hashing, seeded PRNG.
 * total-war/.plans/PLAN.md §2.1 principle 3 — no Math.random() anywhere in the engine.
 */
import { sha256Hex } from "./sha256";

/** Recursively sort object keys and stringify — stable across runs and machines. */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(",")}}`;
}

/** sha256 hex of the canonical form. */
export function canonicalHash(value: unknown): string {
  // Synchronous on purpose: this runs inside the engine's hot paths (a hash after
  // every command), so `crypto.subtle` is not an option. See common/sha256.ts.
  return sha256Hex(canonicalStringify(value));
}

/**
 * Hash a map pack for determinism tests: everything except volatile meta fields
 * (compiledAt, sourceFile). Same source + same compiler ⇒ same hash.
 */
export function hashMapPack(pack: { meta: { mapId: string }; [key: string]: unknown }): string {
  const { meta, ...rest } = pack;
  return canonicalHash({ mapId: meta.mapId, ...rest });
}

/** mulberry32 — the workspace PRNG convention. Returns () => [0, 1). */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

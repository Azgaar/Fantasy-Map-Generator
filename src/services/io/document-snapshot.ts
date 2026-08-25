/**
 * Produces a stable JSON representation for document-immutability tests.
 * Callers supply only serialized map data and may exclude volatile save metadata.
 */
export function createCanonicalDocumentSnapshot(value: unknown, excludedKeys: readonly string[] = []): string {
  return JSON.stringify(normalize(value, new Set(excludedKeys)));
}

function normalize(value: unknown, excludedKeys: ReadonlySet<string>): unknown {
  if (isTypedArray(value)) return Array.from(value, item => (typeof item === "bigint" ? item.toString() : item));
  if (Array.isArray(value)) return value.map(item => normalize(item, excludedKeys));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !excludedKeys.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalize(item, excludedKeys)])
  );
}

function isTypedArray(value: unknown): value is ArrayLike<number | bigint> {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

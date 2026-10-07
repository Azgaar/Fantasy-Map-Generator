import { expect, it } from "vitest";
import { stylesSchema } from "@/generators/styles-schema";
import { KEY_LABELS } from "./field-labels";

/** Every object key in a zod schema, nested ones included */
function schemaKeys(schema: unknown, keys = new Set<string>(), seen = new Set<unknown>()): Set<string> {
  if (!schema || typeof schema !== "object" || seen.has(schema)) return keys;
  seen.add(schema);
  const def = (schema as { _zod?: { def?: Record<string, unknown> } })._zod?.def;
  if (!def) return keys;
  for (const [key, value] of Object.entries((def.shape as Record<string, unknown>) ?? {})) {
    keys.add(key);
    schemaKeys(value, keys, seen);
  }
  for (const field of ["innerType", "valueType", "element", "in", "out"]) schemaKeys(def[field], keys, seen);
  for (const option of (def.options as unknown[]) ?? []) schemaKeys(option, keys, seen);
  return keys;
}

it("has a translatable label for every style schema key", () => {
  const missing = [...schemaKeys(stylesSchema)].filter(key => !(key in KEY_LABELS));
  expect(missing).toEqual([]);
});

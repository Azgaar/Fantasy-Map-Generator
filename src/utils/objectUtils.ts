// Working with plain objects: the merge every restore path goes through

/** A `{}` literal or a null-prototype object - not an array, a Date or a class instance */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// assigning these walks out of the object and into the prototype chain: a `.map` file must not
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Overlay `source` on `target`, in place and recursively, and return the target.
 *
 * Objects are merged key by key, so a source carrying only part of a group keeps the rest of it.
 * Everything else replaces: an array, a Date, a class instance is taken whole - half of an old
 * array of label groups underneath a new one is not a thing any caller wants. `undefined` means
 * "the source does not carry this", so it never erases a value, and nested objects are copied
 * rather than shared with the source.
 *
 * Lodash's `merge` is the closest library equivalent, but it merges arrays by index, which is the
 * one behaviour this must not have
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Record<string, unknown>): T {
  const writable = target as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;

    const value = source[key];
    if (value === undefined) continue;

    const current = writable[key];
    if (isPlainObject(current) && isPlainObject(value)) deepMerge(current, value);
    else writable[key] = isPlainObject(value) ? deepMerge({}, value) : value;
  }

  return target;
}

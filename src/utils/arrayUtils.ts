/**
 * Get the last element of an array
 * @param {Array} array - The array to get the last element from
 * @returns The last element of the array
 */
export const last = <T>(array: readonly T[]): T => {
  return array[array.length - 1];
};

/**
 * Get unique elements from an array
 * @param {Array} array - The array to get unique elements from
 * @returns An array with unique elements
 */
export const unique = <T>(array: T[]): T[] => {
  return [...new Set(array)];
};

/** Keys grouped by their value, such as painted cells by the entity they go to */
export const groupByValue = <K, V>(entries: ReadonlyMap<K, V>): Map<V, K[]> => {
  const groups = new Map<V, K[]>();
  for (const [key, value] of entries) {
    const group = groups.get(value);
    if (group) group.push(key);
    else groups.set(value, [key]);
  }
  return groups;
};

export const TYPED_ARRAY_MAX = {
  INT8: 127,
  UINT8: 255,
  UINT16: 65535,
  UINT32: 4294967295
};

declare global {
  interface Window {
    last: typeof last;
    unique: typeof unique;
    TYPED_ARRAY_MAX: typeof TYPED_ARRAY_MAX;
  }
}

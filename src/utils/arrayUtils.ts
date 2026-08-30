/**
 * Get the last element of an array
 * @param {Array} array - The array to get the last element from
 * @returns The last element of the array
 */
export const last = <T>(array: T[]): T => {
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

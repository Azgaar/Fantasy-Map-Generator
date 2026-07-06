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

/**
 * Get the appropriate typed array constructor based on the maximum value
 * @param {number} maxValue - The maximum value that will be stored in the array
 * @returns The typed array constructor
 * @deprecated This function is deprecated and may be removed in future versions. Use typed array constructors directly for type safety.
 */
export const getTypedArray = (maxValue: number) => {
  console.assert(
    Number.isInteger(maxValue) && maxValue >= 0 && maxValue <= TYPED_ARRAY_MAX.UINT32,
    `Array maxValue must be an integer between 0 and ${TYPED_ARRAY_MAX.UINT32}, got ${maxValue}`
  );

  if (maxValue <= TYPED_ARRAY_MAX.UINT8) return Uint8Array;
  if (maxValue <= TYPED_ARRAY_MAX.UINT16) return Uint16Array;
  if (maxValue <= TYPED_ARRAY_MAX.UINT32) return Uint32Array;
  return Uint32Array;
};

/**
 * Create a typed array based on the maximum value and length or from an existing array
 * @param {Object} options - The options for creating the typed array
 * @param {number} options.maxValue - The maximum value that will be stored in the array
 * @param {number} options.length - The length of the typed array to create
 * @param {Array} [options.from] - An optional array to create the typed array from
 * @returns The created typed array
 * @deprecated This function is deprecated and may be removed in future versions. Use typed array constructors directly for type safety.
 */
export const createTypedArray = ({
  maxValue,
  length,
  from
}: {
  maxValue: number;
  length: number;
  from?: ArrayLike<number>;
}): Uint8Array | Uint16Array | Uint32Array => {
  const typedArray = getTypedArray(maxValue);
  if (!from) return new typedArray(length);
  return typedArray.from(from);
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
    getTypedArray: typeof getTypedArray;
    createTypedArray: typeof createTypedArray;
    TYPED_ARRAY_MAX: typeof TYPED_ARRAY_MAX;
  }
}

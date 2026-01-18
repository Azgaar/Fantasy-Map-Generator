/**
 * Get the last element of an array
 * @param {Array} array - The array to get the last element from
 * @returns The last element of the array
 */
export const last = <T>(array: T[]): T => {
  return array[array.length - 1];
}

/**
 * Get unique elements from an array
 * @param {Array} array - The array to get unique elements from
 * @returns An array with unique elements
 */
export const unique = <T>(array: T[]): T[] => {
  return [...new Set(array)];
}

/**
 * Deep copy an object or array
 * @param {Object|Array} obj - The object or array to deep copy
 * @returns A deep copy of the object or array
 */
export const deepCopy = <T>(obj: T): T => {
  const id = (x: T): T => x;
  const dcTArray = (a: T[]): T[] => a.map(id);
  const dcObject = (x: object): object => Object.fromEntries(Object.entries(x).map(([k, d]) => [k, dcAny(d)]));
  const dcAny = (x: any): any => (x instanceof Object ? (cf.get(x.constructor) || id)(x) : x);
  // don't map keys, probably this is what we would expect
  const dcMapCore = (m: Map<any, any>): [any, any][] => [...m.entries()].map(([k, v]) => [k, dcAny(v)]);

  const cf: Map<Function, (x: any) => any> = new Map<any, (x: any) => any>([
    [Int8Array, dcTArray],
    [Uint8Array, dcTArray],
    [Uint8ClampedArray, dcTArray],
    [Int16Array, dcTArray],
    [Uint16Array, dcTArray],
    [Int32Array, dcTArray],
    [Uint32Array, dcTArray],
    [Float32Array, dcTArray],
    [Float64Array, dcTArray],
    [BigInt64Array, dcTArray],
    [BigUint64Array, dcTArray],
    [Map, m => new Map(dcMapCore(m))],
    [WeakMap, m => new WeakMap(dcMapCore(m))],
    [Array, a => a.map(dcAny)],
    [Set, s => [...s.values()].map(dcAny)],
    [Date, d => new Date(d.getTime())],
    [Object, dcObject]
    // ... extend here to implement their custom deep copy
  ]);

  return dcAny(obj);
}

/**
 * Get the appropriate typed array constructor based on the maximum value
 * @param {number} maxValue - The maximum value that will be stored in the array
 * @returns The typed array constructor
 */
export const getTypedArray = (maxValue: number) => {
  console.assert(
    Number.isInteger(maxValue) && maxValue >= 0 && maxValue <= TYPED_ARRAY_MAX_VALUES.UINT32_MAX,
    `Array maxValue must be an integer between 0 and ${TYPED_ARRAY_MAX_VALUES.UINT32_MAX}, got ${maxValue}`
  );

  if (maxValue <= TYPED_ARRAY_MAX_VALUES.UINT8_MAX) return Uint8Array;
  if (maxValue <= TYPED_ARRAY_MAX_VALUES.UINT16_MAX) return Uint16Array;
  if (maxValue <= TYPED_ARRAY_MAX_VALUES.UINT32_MAX) return Uint32Array;
  return Uint32Array;
}

/**
 * Create a typed array based on the maximum value and length or from an existing array
 * @param {Object} options - The options for creating the typed array
 * @param {number} options.maxValue - The maximum value that will be stored in the array
 * @param {number} options.length - The length of the typed array to create
 * @param {Array} [options.from] - An optional array to create the typed array from
 * @returns The created typed array
 */
export const createTypedArray = ({maxValue, length, from}: {maxValue: number; length: number; from?: ArrayLike<number>}) => {
  const typedArray = getTypedArray(maxValue);
  if (!from) return new typedArray(length);
  return typedArray.from(from);
}

// typed arrays max values
export const TYPED_ARRAY_MAX_VALUES = {
  INT8_MAX: 127,
  UINT8_MAX: 255,
  UINT16_MAX: 65535,
  UINT32_MAX: 4294967295
};

declare global {
  interface Window {
    last: typeof last;
    unique: typeof unique;
    deepCopy: typeof deepCopy;
    getTypedArray: typeof getTypedArray;
    createTypedArray: typeof createTypedArray;
    INT8_MAX: number;
    UINT8_MAX: number;
    UINT16_MAX: number;
    UINT32_MAX: number;
  }
}

import {UINT8_MAX, UINT16_MAX, UINT32_MAX} from "/src/constants";

export function last<T>(array: T[]) {
  return array[array.length - 1];
}

export function unique<T>(array: T[]) {
  return [...new Set(array)];
}

interface ICreateTypedArray {
  maxValue: number;
  length: number;
  from?: ArrayLike<number>;
}

export function createTypedArray({maxValue, length, from}: ICreateTypedArray) {
  const typedArray = getTypedArray(maxValue);
  if (!from) return new typedArray(length);
  return typedArray.from(from);
}

function getTypedArray(maxValue: number) {
  console.assert(
    Number.isInteger(maxValue) && maxValue >= 0 && maxValue <= UINT32_MAX,
    `Array maxValue must be an integer between 0 and ${UINT32_MAX}, got ${maxValue}`
  );

  if (maxValue <= UINT8_MAX) return Uint8Array;
  if (maxValue <= UINT16_MAX) return Uint16Array;
  if (maxValue <= UINT32_MAX) return Uint32Array;
  return Uint32Array;
}

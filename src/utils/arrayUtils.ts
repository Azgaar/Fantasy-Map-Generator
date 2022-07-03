import {UINT16_MAX, UINT32_MAX, UINT8_MAX} from "../constants";

export function last<T>(array: T[]) {
  return array[array.length - 1];
}

export function unique<T>(array: T[]) {
  return [...new Set(array)];
}

interface ICreateTypesArrayLength {
  maxValue: number;
  length: number;
}

interface ICreateTypesArrayFrom {
  maxValue: number;
  from: ArrayLike<number>;
}

export function createTypedArray(params: ICreateTypesArrayLength | ICreateTypesArrayFrom) {
  const typedArray = getTypedArray(params.maxValue);
  if ("from" in params) {
    typedArray.from(params.from);
  } else if ("length" in params) {
    return new typedArray(params.length);
  }

  return typedArray;
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

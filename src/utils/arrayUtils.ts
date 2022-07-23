import {UINT16_MAX, UINT32_MAX, UINT8_MAX} from "../config/constants";

export function last<T>(array: T[]) {
  return array[array.length - 1];
}

export function unique<T>(array: T[]) {
  return [...new Set(array)];
}

export function sliceFragment<T>(array: T[], index: number, zone: number) {
  if (zone + 1 + zone >= array.length) {
    return array.slice();
  }

  const start = index - zone;
  const end = index + zone;

  if (start < 0) {
    return array.slice(0, end).concat(array.slice(start));
  }

  if (end >= array.length) {
    return array.slice(start).concat(array.slice(0, end % array.length));
  }

  return array.slice(start, end);
}

window.sliceFragment = sliceFragment;

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
    return typedArray.from(params.from);
  }

  return new typedArray(params.length);
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

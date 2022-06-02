"use strict";

function last(array) {
  return array[array.length - 1];
}

function unique(array) {
  return [...new Set(array)];
}

// deep copy for Arrays (and other objects)
function deepCopy(obj) {
  const id = x => x;
  const dcTArray = a => a.map(id);
  const dcObject = x => Object.fromEntries(Object.entries(x).map(([k, d]) => [k, dcAny(d)]));
  const dcAny = x => (x instanceof Object ? (cf.get(x.constructor) || id)(x) : x);
  // don't map keys, probably this is what we would expect
  const dcMapCore = m => [...m.entries()].map(([k, v]) => [k, dcAny(v)]);

  const cf = new Map([
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

function getTypedArray(maxValue) {
  console.assert(
    Number.isInteger(maxValue) && maxValue >= 0 && maxValue <= UINT32_MAX,
    `Array maxValue must be an integer between 0 and ${UINT32_MAX}, got ${maxValue}`
  );

  if (maxValue <= UINT8_MAX) return Uint8Array;
  if (maxValue <= UINT16_MAX) return Uint16Array;
  if (maxValue <= UINT32_MAX) return Uint32Array;
  return Uint32Array;
}

function createTypedArray({maxValue, length, from}) {
  const typedArray = getTypedArray(maxValue);
  if (!from) return new typedArray(length);
  return typedArray.from(from);
}

function unique(array) {
  return [...new Set(array)];
}

// deep copy for Arrays (and other objects)
function deepCopy(obj) {
  const id = x => x;
  const dcTArray = a => a.map(id);
  const dcObject = x => Object.fromEntries(Object.entries(x).map(([k, d]) => [k, dcAny(d)]));
  const dcAny = x => (x instanceof Object ? (cf.get(x.constructor) || id)(x) : x);
  // don't map keys, probably this is what we would expect
  const dcMapCore = m => [...m.entries()].map(([k, v]) => [k, dcAny(v)]);

  const cf = new Map([
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
    // other types will be referenced
    // ... extend here to implement their custom deep copy
  ]);

  return dcAny(obj);
}

function getTypedArray(maxValue) {
  console.assert(
    Number.isInteger(maxValue) && maxValue >= 0 && maxValue <= 4294967295,
    `Array maxValue must be an integer between 0 and 4294967295, got ${maxValue}`
  );

  if (maxValue <= UINT8_MAX) return Uint8Array;
  if (maxValue <= UINT16_MAX) return Uint16Array;
  if (maxValue <= UINT32_MAX) return Uint32Array;
  return Uint32Array;
}

function createTypedArray({maxValue, length, from}) {
  const typedArray = getTypedArray(maxValue);
  if (!from) return new typedArray(length);
  return typedArray.from(from);
}

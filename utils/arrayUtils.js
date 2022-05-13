"use strict";
// FMG utils related to arrays

// return the last element of array
function last(array) {
  return array[array.length - 1];
}

/**
 * Return common elements between two arrays.
 * @param {*} a array of any type.
 * @param {*} b array of any type.
 * @returns Array of common elements between A and B.
 * @example
 * const a = [1, 2, 3, 4];
 * const b = [1, 3, 6, 7];
 * const result = common(a, b);
 * console.log(result); // => [1, 3];
 */
function common(a, b) {
  return a.filter(element => b.includes(element));
}

function unique(array) {
  return [...new Set(array)];
}

// deep copy for Arrays (and other objects)
function deepCopy(obj) {
  const id = x=>x;
  const dcTArray = a => a.map(id);
  const dcObject = x => Object.fromEntries(Object.entries(x).map(([k,d])=>[k,dcAny(d)]));
  const dcAny = x => x instanceof Object ? (cf.get(x.constructor)||id)(x) : x;
  // don't map keys, probably this is what we would expect
  const dcMapCore = m => [...m.entries()].map(([k,v])=>[k, dcAny(v)]);

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
      [Object, dcObject],
      // other types will be referenced
      // ... extend here to implement their custom deep copy
  ]);

  return dcAny(obj);
}

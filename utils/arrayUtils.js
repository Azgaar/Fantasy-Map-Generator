"use strict";
// FMG utils related to arrays

// return the last element of array
function last(array) {
  return array[array.length - 1];
}

// return array of values common for both array a and array b
function common(a, b) {
  const setB = new Set(b);
  return [...new Set(a)].filter(a => setB.has(a));
}

"use strict";
// FMG utils related to numbers

// typed arrays max values
export const INT8_MAX = 127;
export const UINT8_MAX = 255;
export const UINT16_MAX = 65535;
export const UINT32_MAX = 4294967295;

// round value to d decimals
function rn(v, d = 0) {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}

function minmax(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// return value in range [0, 100]
function lim(v) {
  return minmax(v, 0, 100);
}

// normalization function
function normalize(val, min, max) {
  return minmax((val - min) / (max - min), 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export { rn, minmax, lim, normalize, lerp };

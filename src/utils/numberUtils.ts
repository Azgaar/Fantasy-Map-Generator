// round value to d decimals
export function rn(value: number, decimals: number = 0) {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

export function minmax(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// return value clamped to [0, 100]
export function lim(value: number) {
  return minmax(value, 0, 100);
}

// normalization function
export function normalize(val: number, min: number, max: number) {
  return minmax((val - min) / (max - min), 0, 1);
}

// import {rn, minmax, lim, normalize} from '/src/utils/numberUtils';

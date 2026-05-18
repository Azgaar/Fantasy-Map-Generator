/**
 * Rounds a number to a specified number of decimal places.
 * @param v - The number to be rounded.
 * @param d - The number of decimal places to round to (default is 0).
 * @returns The rounded number.
 */
export const rn = (v: number, d: number = 0) => {
  const m = 10 ** d;
  return Math.round(v * m) / m;
};

/**
 * Clamps a number between a minimum and maximum value.
 * @param value - The number to be clamped.
 * @param min - The minimum value.
 * @param max - The maximum value.
 * @returns The clamped number.
 */
export const minmax = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Clamps a number between 0 and 100.
 * @param v - The number to be clamped.
 * @returns The clamped number.
 */
export const lim = (v: number) => {
  return minmax(v, 0, 100);
};

/**
 * Normalizes a number within a specified range to a value between 0 and 1.
 * @param val - The number to be normalized.
 * @param min - The minimum value of the range.
 * @param max - The maximum value of the range.
 * @returns The normalized number.
 */
export const normalize = (val: number, min: number, max: number) => {
  return minmax((val - min) / (max - min), 0, 1);
};

/**
 * Performs linear interpolation between two values.
 * @param a - The starting value.
 * @param b - The ending value.
 * @param t - The interpolation factor (between 0 and 1).
 * @returns The interpolated value.
 */
export const lerp = (a: number, b: number, t: number) => {
  return a + (b - a) * t;
};

declare global {
  interface Window {
    rn: typeof rn;
    minmax: typeof minmax;
    lim: typeof lim;
    normalize: typeof normalize;
    lerp: typeof lerp;
  }
}

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

/**
 * Convert number to short string with SI postfix
 * @param {number} n - The number to convert
 * @returns {string} - The converted string
 */
export const si = (n: number): string => {
  if (n >= 1e9) return `${rn(n / 1e9, 1)}B`;
  if (n >= 1e8) return `${rn(n / 1e6)}M`;
  if (n >= 1e6) return `${rn(n / 1e6, 1)}M`;
  if (n >= 1e4) return `${rn(n / 1e3)}K`;
  if (n >= 1e3) return `${rn(n / 1e3, 1)}K`;
  return rn(n).toString();
};

/**
 * Calculate squared distance between two points
 * @param {[number, number]} p1 - First point [x1, y1]
 * @param {[number, number]} p2 - Second point [x2, y2]
 * @returns {number} - Squared distance between p1 and p2
 */
export const distanceSquared = ([x1, y1]: [number, number], [x2, y2]: [number, number]) => {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
};

import { randomNormal } from "d3";
import { minmax, rn } from "./numberUtils";

/**
 * Creates a random number between min and max (inclusive).
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @return {number} random integer between min and max
 */
export const rand = (min?: number, max?: number): number => {
  if (min === undefined && max === undefined) return Math.random();
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.floor(Math.random() * (max! - min! + 1)) + min!;
};

/**
 * Returns a boolean based on the given probability.
 * @param {number} probability - probability between 0 and 1
 * @return {boolean} true with the given probability
 */
export const P = (probability: number): boolean => {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return Math.random() < probability;
};

/**
 * Returns true every n times.
 * @param {number} n - the interval
 * @return {function} function that takes the current index and returns true every n times
 */
export const each = (n: number) => {
  return (i: number) => i % n === 0;
};

/**
 * Random Gaussian number generator
 * Uses randomNormal.source(Math.random) to ensure it uses the current PRNG
 * @param {number} expected - expected value
 * @param {number} deviation - standard deviation
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @param {number} round - round value to n decimals
 * @return {number} random number
 */
export const gauss = (
  expected = 100,
  deviation = 30,
  min = 0,
  max = 300,
  round = 0,
) => {
  // Use .source() to get a version that uses the current Math.random (which may be seeded)
  return rn(
    minmax(
      randomNormal.source(() => Math.random())(expected, deviation)(),
      min,
      max,
    ),
    round,
  );
};

/**
 * Returns the integer part of a float plus one with the probability of the decimal part.
 * @param {number} float - the float number
 * @return {number} the resulting integer
 */
export const Pint = (float: number): number => {
  return ~~float + +P(float % 1);
};

/**
 * Returns a random element from an array.
 * @param {Array} array - the array to pick from
 * @return {any} a random element from the array
 */
export const ra = (array: any[]): any => {
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Returns a random key from an object where values are weights.
 * @param {Object} object - object with keys and their weights
 * @return {string} a random key based on weights
 *
 * @example
 * const obj = { a: 1, b: 3, c: 6 };
 * const randomKey = rw(obj); // 'a' has 10% chance, 'b' has 30% chance, 'c' has 60% chance
 */
export const rw = (object: { [key: string]: number }): string => {
  const array = [];
  for (const key in object) {
    for (let i = 0; i < object[key]; i++) {
      array.push(key);
    }
  }
  return array[Math.floor(Math.random() * array.length)];
};

/**
 * Returns a random integer from min to max biased towards one end based on exponent distribution (the bigger ex the higher bias towards min).
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @param {number} ex - exponent for bias
 * @return {number} biased random integer
 */
export const biased = (min: number, max: number, ex: number): number => {
  return Math.round(min + (max - min) * Math.random() ** ex);
};

const ERROR = false;
/**
 * Get number from string in format "1-3" or "2" or "0.5"
 * @param {string} r - range string
 * @return {number} parsed number
 */
export const getNumberInRange = (r: string): number => {
  if (typeof r !== "string") {
    ERROR && console.error("Range value should be a string", r);
    return 0;
  }
  if (!Number.isNaN(+r)) return ~~r + +P(+r - ~~r);
  const sign = r[0] === "-" ? -1 : 1;
  if (Number.isNaN(+r[0])) r = r.slice(1);
  const range = r.includes("-") ? r.split("-") : null;
  if (!range) {
    ERROR && console.error("Cannot parse the number. Check the format", r);
    return 0;
  }
  const count = rand(parseFloat(range[0]) * sign, +parseFloat(range[1]));
  if (Number.isNaN(count) || count < 0) {
    ERROR && console.error("Cannot parse number. Check the format", r);
    return 0;
  }
  return count;
};
/**
 * Generate a random seed string
 * @return {string} random seed
 */
export const generateSeed = (): string => {
  return String(Math.floor(Math.random() * 1e9));
};

declare global {
  interface Window {
    rand: typeof rand;
    P: typeof P;
    each: typeof each;
    gauss: typeof gauss;
    Pint: typeof Pint;
    ra: typeof ra;
    rw: typeof rw;
    biased: typeof biased;
    getNumberInRange: typeof getNumberInRange;
    generateSeed: typeof generateSeed;
  }
}

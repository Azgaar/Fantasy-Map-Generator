import { randomNormal } from "d3";
import { minmax, rn } from "./number-utils";

/**
 * Creates a random number between min and max (inclusive). If only one argument is provided, it will be considered as max and min will be 0. If no arguments are provided, it returns a random float between 0 and 1.
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
export const gauss = (expected = 100, deviation = 30, min = 0, max = 300, round = 0) => {
  // Use .source() to get a version that uses the current Math.random (which may be seeded)
  return rn(minmax(randomNormal.source(() => Math.random())(expected, deviation)(), min, max), round);
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
 * Returns a random element from an array or any other indexed collection, a typed array included.
 * @param {ArrayLike} array - the collection to pick from
 * @return {any} a random element from the collection
 */
export const ra = <T>(array: ArrayLike<T>): T => {
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

/**
 * Get number from string in format "1-3" or "2" or "0.5"
 * @param {string} r - range string
 * @return {number} parsed number
 */
export const getNumberInRange = (r: string): number => {
  if (typeof r !== "string") {
    return 0;
  }
  if (!Number.isNaN(+r)) return ~~r + +P(+r - ~~r);
  const sign = r[0] === "-" ? -1 : 1;
  if (Number.isNaN(+r[0])) r = r.slice(1);
  const range = r.includes("-") ? r.split("-") : null;
  if (!range) {
    return 0;
  }
  const count = rand(parseFloat(range[0]) * sign, +parseFloat(range[1]));
  if (Number.isNaN(count) || count < 0) {
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

/** A random sequence of a seed, for many short ones: far cheaper to start than Alea. FNV-1a hash, then mulberry32 */
export function seededRandom(seed: string): () => number {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 0x01000193);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let roll = Math.imul(state ^ (state >>> 15), state | 1);
    roll ^= roll + Math.imul(roll ^ (roll >>> 7), roll | 61);
    return ((roll ^ (roll >>> 14)) >>> 0) / 0x100000000;
  };
}

/** Run a function on a random sequence of its own, leaving the ambient sequence where it was */
export function seeded<T>(seed: string, run: () => T): T {
  const ambient = Math.random;
  Math.random = seededRandom(seed);
  try {
    return run();
  } finally {
    Math.random = ambient;
  }
}

/** One of the items, each as likely as its weight; with no weight at all the same pick as `ra` */
export function pickWeighted<T>(items: T[], weights: number[], random: () => number = Math.random): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return ra(items);
  let roll = random() * total;
  for (const [index, item] of items.entries()) {
    roll -= weights[index];
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

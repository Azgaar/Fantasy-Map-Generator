import * as d3 from "d3";

import {ERROR} from "../config/logging";
import {minmax, rn} from "./numberUtils";

// random number in range
export function rand(min: number, max?: number) {
  if (max === undefined) {
    max = min;
    min = 0;
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// probability shorthand
export function P(probability: number) {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return Math.random() < probability;
}

export function each(n: number) {
  return (i: number) => i % n === 0;
}

// random number using normal distribution
export function gauss(expected = 100, deviation = 30, min = 0, max = 300, round = 0) {
  const randomValue = d3.randomNormal(expected, deviation);
  const clamped = minmax(randomValue(), min, max);
  return rn(clamped, round);
}

// probability shorthand for floats
export function Pint(float: number) {
  return ~~float + +P(float % 1);
}

// return random value from the array
export function ra<T>(array: T[]) {
  return array[Math.floor(Math.random() * array.length)];
}

// return random value from weighted array
export function rw<T extends string>(object: {[key in T]: number}) {
  const entries = Object.entries<number>(object);
  const weightedArray: T[] = entries.map(([choise, weight]) => new Array(weight).fill(choise)).flat();
  return ra(weightedArray);
}

// return a random integer from min to max biased towards one end based on exponent distribution
// the bigger exponent the higher bias towards min
// biased(0, 10, 10): {0: 74%, 1: 9%, 2: 4%, 3: 3%, 4: 2%, 5: 2%, 6: 2%, 7: 1%, 8: 1%, 9: 1%, 10: 0%}
// biased(0, 10, 5): {0: 55%, 1: 14%, 2: 7%, 3: 5%, 4: 4%, 5: 4%, 6: 3%, 7%: 3%, 8: 2%, 9: 2%, 10: 1%}
// biased(0, 10, 4): {0: 46%, 1: 15%, 2: 8%, 3: 6%, 4: 5%, 5: 4%, 6: 4%, 7%: 3, 8: 3%, 9: 3%, 10: 1%}
// biased(0, 10, 3): {0: 36%, 1: 16%, 2: 10%, 3: 8%, 4: 6%, 5: 5%, 6: 5%, 7%: 4, 8: 4%, 9: 4%, 10: 2%}
// biased(0, 10, 2): {0: 22%, 1: 17%, 2: 11%, 3: 9%, 4: 8%, 5: 7%, 6: 6%, 7%: 6, 8: 6%, 9: 5%, 10: 2%}
// biased{0, 10, 1): {0: 5%, 1: 10%, 2: 10%, 3: 10%, 4: 10%, 5: 10%, 6: 10%, 7%: 10, 8%: 10, 9: 10%, 10: 5%}
export function biased(min: number, max: number, exponent: number) {
  if (exponent <= 1) throw new Error("Exponent must be greater than 1");
  return Math.round(min + (max - min) * Math.pow(Math.random(), exponent));
}

// get number from string in format "1-3" or "2" or "0.5"
export function getNumberInRange(rangeString: string) {
  if (typeof rangeString !== "string") {
    ERROR && console.error("The value should be a string", rangeString);
    return 0;
  }

  const rangeNumber = Number(rangeString);
  if (!isNaN(rangeNumber)) return Pint(rangeNumber);

  const negative = rangeString.startsWith("-");
  const sign = negative ? -1 : 1;
  if (negative) rangeString = rangeString.substring(1);

  const [min, max] = rangeString.split("-");
  const count = rand(sign * +min, +max);

  if (isNaN(count) || count < 0) {
    ERROR && console.error("Cannot parse number. Check the format", rangeString);
    return 0;
  }

  return count;
}

export function generateSeed() {
  return String(Math.floor(Math.random() * 1e9));
}

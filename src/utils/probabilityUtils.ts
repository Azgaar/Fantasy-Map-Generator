import {ERROR} from "@/config/logging";
import {minmax, rn} from "./numberUtils";

const d3 = window.d3;

// random number in range
export function rand(min: number, max: number) {
  if (min === undefined && max === undefined) return Math.random();
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
export function rw(object: {[key: string]: number}) {
  const weightedArray = Object.entries(object)
    .map(([choise, weight]) => new Array(weight).fill(choise))
    .flat();
  return ra(weightedArray);
}

// return a random integer from min to max biased towards one end based on exponent distribution (the bigger ex the higher bias towards min)
export function biased(min: number, max: number, ex: number) {
  return Math.round(min + (max - min) * Math.pow(Math.random(), ex));
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

"use strict";
// FMG utils related to randomness

// random number in a range
function rand(min, max) {
  if (min === undefined && max === undefined) return Math.random();
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// probability shorthand
function P(probability) {
  if (probability >= 1) return true;
  if (probability <= 0) return false;
  return Math.random() < probability;
}

function each(n) {
  return i => i % n === 0;
}

/* Random Gaussian number generator
 * @param {number} expected - expected value
 * @param {number} deviation - standard deviation
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @param {number} round - round value to n decimals
 * @return {number} random number
 */
function gauss(expected = 100, deviation = 30, min = 0, max = 300, round = 0) {
  return rn(minmax(d3.randomNormal(expected, deviation)(), min, max), round);
}

// probability shorthand for floats
function Pint(float) {
  return ~~float + +P(float % 1);
}

// return random value from the array
function ra(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// return random value from weighted array {"key1":weight1, "key2":weight2}
function rw(object) {
  const array = [];
  for (const key in object) {
    for (let i = 0; i < object[key]; i++) {
      array.push(key);
    }
  }
  return array[Math.floor(Math.random() * array.length)];
}

// return a random integer from min to max biased towards one end based on exponent distribution (the bigger ex the higher bias towards min)
function biased(min, max, ex) {
  return Math.round(min + (max - min) * Math.pow(Math.random(), ex));
}

// get number from string in format "1-3" or "2" or "0.5"
function getNumberInRange(r) {
  if (typeof r !== "string") {
    ERROR && console.error("Range value should be a string", r);
    return 0;
  }
  if (!isNaN(+r)) return ~~r + +P(r - ~~r);
  const sign = r[0] === "-" ? -1 : 1;
  if (isNaN(+r[0])) r = r.slice(1);
  const range = r.includes("-") ? r.split("-") : null;
  if (!range) {
    ERROR && console.error("Cannot parse the number. Check the format", r);
    return 0;
  }
  const count = rand(range[0] * sign, +range[1]);
  if (isNaN(count) || count < 0) {
    ERROR && console.error("Cannot parse number. Check the format", r);
    return 0;
  }
  return count;
}

function generateSeed() {
  return String(Math.floor(Math.random() * 1e9));
}

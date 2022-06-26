import {rn} from "./numberUtils";

// round numbers in string to d decimals
export function round(str: string, d = 1) {
  return str.replace(/[\d\.-][\d\.e-]*/g, n => String(rn(+n, d)));
}

// return string with 1st char capitalized
export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// split string into 2 almost equal parts not breaking words
export function splitInTwo(str: string) {
  const half = str.length / 2;
  const ar = str.split(" ");
  if (ar.length < 2) return ar; // only one word

  let first = "",
    last = "",
    middle = "",
    rest = "";

  ar.forEach((w, d) => {
    if (d + 1 !== ar.length) w += " ";
    rest += w;
    if (!first || rest.length < half) first += w;
    else if (!middle) middle = w;
    else last += w;
  });

  if (!last) return [first, middle];
  if (first.length < last.length) return [first + middle, last];
  return [first, middle + last];
}

// transform string to array [translateX,translateY,rotateDeg,rotateX,rotateY,scale]
export function parseTransform(str: string) {
  if (!str) return [0, 0, 0, 0, 0, 1];

  const a = str
    .replace(/[a-z()]/g, "")
    .replace(/[ ]/g, ",")
    .split(",");
  return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0, a[4] || 0, a[5] || 1];
}

// check if string is a valid for JSON parse
export const isJsonValid = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

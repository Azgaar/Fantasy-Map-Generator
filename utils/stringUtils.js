import {rn} from "/src/utils/numberUtils";

// round numbers in string to d decimals
function round(s, d = 1) {
  return s.replace(/[\d\.-][\d\.e-]*/g, function (n) {
    return rn(n, d);
  });
}

// return string with 1st char capitalized
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// split string into 2 almost equal parts not breaking words
function splitInTwo(str) {
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
function parseTransform(string) {
  if (!string) return [0, 0, 0, 0, 0, 1];

  const a = string
    .replace(/[a-z()]/g, "")
    .replace(/[ ]/g, ",")
    .split(",");
  return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0, a[4] || 0, a[5] || 1];
}

// check if string is a valid for JSON parse
JSON.isValid = str => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

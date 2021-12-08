"use strict";
// FMG utils related to strings

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

// check if char is vowel or can serve as vowel
function vowel(c) {
  return `aeiouyɑ'əøɛœæɶɒɨɪɔɐʊɤɯаоиеёэыуюяàèìòùỳẁȁȅȉȍȕáéíóúýẃőűâêîôûŷŵäëïöüÿẅãẽĩõũỹąęįǫųāēīōūȳăĕĭŏŭǎěǐǒǔȧėȯẏẇạẹịọụỵẉḛḭṵṳ`.includes(c);
}

// remove vowels from the end of the string
function trimVowels(string) {
  while (string.length > 3 && vowel(last(string))) {
    string = string.slice(0, -1);
  }
  return string;
}

// get adjective form from noun
function getAdjective(string) {
  // special cases for some suffixes
  if (string.length > 8 && string.slice(-6) === "orszag") return string.slice(0, -6);
  if (string.length > 6 && string.slice(-4) === "stan") return string.slice(0, -4);
  if (P(0.5) && string.slice(-4) === "land") return string + "ic";
  if (string.slice(-4) === " Guo") string = string.slice(0, -4);

  // don't change is name ends on suffix
  if (string.slice(-2) === "an") return string;
  if (string.slice(-3) === "ese") return string;
  if (string.slice(-1) === "i") return string;

  const end = string.slice(-1); // last letter of string
  if (end === "a") return (string += "n");
  if (end === "o") return (string = trimVowels(string) + "an");
  if (vowel(end) || end === "c") return (string += "an"); // ceiuy
  if (end === "m" || end === "n") return (string += "ese");
  if (end === "q") return (string += "i");
  return trimVowels(string) + "ian";
}

// get ordinal out of integer: 1 => 1st
const nth = n => n + (["st", "nd", "rd"][((((n + 90) % 100) - 10) % 10) - 1] || "th");

// get two-letters code (abbreviation) from string
function abbreviate(name, restricted = []) {
  const parsed = name.replace("Old ", "O ").replace(/[()]/g, ""); // remove Old prefix and parentheses
  const words = parsed.split(" ");
  const letters = words.join("");

  let code = words.length === 2 ? words[0][0] + words[1][0] : letters.slice(0, 2);
  for (let i = 1; i < letters.length - 1 && restricted.includes(code); i++) {
    code = letters[0] + letters[i].toUpperCase();
  }
  return code;
}

// conjunct array: [A,B,C] => "A, B and C"
function list(array) {
  if (!Intl.ListFormat) return array.join(", ");
  const conjunction = new Intl.ListFormat(window.lang || "en", {style: "long", type: "conjunction"});
  return conjunction.format(array);
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

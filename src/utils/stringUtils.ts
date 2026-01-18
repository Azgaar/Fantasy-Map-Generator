import { rn } from "./numberUtils";

/**
 * Round all numbers in a string to d decimal places
 * @param {string} inputString - The input string
 * @param {number} decimals - Number of decimal places (default is 1)
 * @returns {string} - The string with rounded numbers
 */
export const round = (inputString: string, decimals: number = 1) => {
  return inputString.replace(/[\d\.-][\d\.e-]*/g, (n: string) => {
    return rn(parseFloat(n), decimals).toString();
  });
}

/**
 * Capitalize the first letter of a string
 * @param {string} inputString - The input string
 * @returns {string} - The capitalized string
 */
export const capitalize = (inputString: string) => {
  return inputString.charAt(0).toUpperCase() + inputString.slice(1);
}

/**
 * Split a string into two parts, trying to balance their lengths
 * @param {string} inputString - The input string
 * @returns {[string, string]} - An array with two parts of the string
 */
export const splitInTwo = (inputString: string): string[] => {
  const half = inputString.length / 2;
  const ar = inputString.split(" ");
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

/**
 * Parse an SVG transform string into an array of numbers
 * @param {string} string - The SVG transform string
 * @returns {[number, number, number, number, number, number]} - The parsed transform as an array
 * 
 * @example
 * parseTransform("matrix(1, 0, 0, 1, 100, 200)") // returns [1, 0, 0, 1, 100, 200]
 * parseTransform("translate(50, 75)") // returns [50, 75, 0, 0, 0, 1]
 */
export const parseTransform = (string: string) => {
  if (!string) return [0, 0, 0, 0, 0, 1];

  const a = string
    .replace(/[a-z()]/g, "")
    .replace(/[ ]/g, ",")
    .split(",");
  return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0, a[4] || 0, a[5] || 1];
}

/**
 * Check if a string is valid JSON
 * @param {string} str - The string to check
 * @returns {boolean} - True if the string is valid JSON, false otherwise
 */
export const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Safely parse a JSON string
 * @param {string} str - The JSON string to parse
 * @returns {any|null} - The parsed object, or null if parsing failed
 */
export const safeParseJSON = (str: string) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};

/**
 * Sanitize a string to be used as an ID
 * @param {string} string - The input string
 * @returns {string} - The sanitized ID string
 */
export const sanitizeId = (inputString: string) => {
  if (!inputString) throw new Error("No string provided");

  let sanitized = inputString
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "") // no invalid characters
    .replace(/\s+/g, "-"); // replace spaces with hyphens

  // remove leading numbers
  if (sanitized.match(/^\d/)) sanitized = "_" + sanitized;

  return sanitized;
}

declare global {
  interface Window {
    round: typeof round;
    capitalize: typeof capitalize;
    splitInTwo: typeof splitInTwo;
    parseTransform: typeof parseTransform;
    sanitizeId: typeof sanitizeId;
  }
}
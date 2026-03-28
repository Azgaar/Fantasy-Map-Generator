import { last } from "./arrayUtils";
import { P } from "./probabilityUtils";

export const gender: Record<string, Record<string, string>> = {
  fr: {},
};

/**
 * Check if character is a vowel
 * @param c - The character to check.
 * @returns True if the character is a vowel, false otherwise.
 */
export const isVowel = (c: string): boolean => {
  const VOWELS = `aeiouyɑ'əøɛœæɶɒɨɪɔɐʊɤɯаоиеёэыуюяàèìòùỳẁȁȅȉȍȕáéíóúýẃőűâêîôûŷŵäëïöüÿẅãẽĩõũỹąęįǫųāēīōūȳăĕĭŏŭǎěǐǒǔȧėȯẏẇạẹịọụỵẉḛḭṵṳ`;
  return VOWELS.includes(c);
};

/**
 * Remove trailing vowels from a string until it reaches a minimum length.
 * @param string - The input string.
 * @param minLength - The minimum length of the string after trimming (default is 3).
 * @returns The trimmed string.
 */
export const trimVowels = (string: string, minLength: number = 3) => {
  while (string.length > minLength && isVowel(last(Array.from(string)))) {
    string = string.slice(0, -1);
  }
  return string;
};

/**
 * Get adjective form of a noun based on predefined rules.
 * @param noun - The noun to be converted to an adjective.
 * @returns The adjective form of the noun.
 */
export const getAdjective = (nounToBeAdjective: string) => {
  const adjectivizationRules: Record<string, any> = {
    en: [
      {
        name: "guo",
        probability: 1,
        condition: / Guo$/,
        action: (noun: string) => noun.slice(0, -4),
      },
      {
        name: "orszag",
        probability: 1,
        condition: /orszag$/,
        action: (noun: string) =>
          noun.length < 9 ? `${noun}ian` : noun.slice(0, -6),
      },
      {
        name: "stan",
        probability: 1,
        condition: /stan$/,
        action: (noun: string) =>
          noun.length < 9 ? `${noun}i` : trimVowels(noun.slice(0, -4)),
      },
      {
        name: "land",
        probability: 1,
        condition: /land$/,
        action: (noun: string) => {
          if (noun.length > 9) return noun.slice(0, -4);
          const root = trimVowels(noun.slice(0, -4), 0);
          if (root.length < 3) return `${noun}ic`;
          if (root.length < 4) return `${root}lish`;
          return `${root}ish`;
        },
      },
      {
        name: "que",
        probability: 1,
        condition: /que$/,
        action: (noun: string) => noun.replace(/que$/, "can"),
      },
      {
        name: "a",
        probability: 1,
        condition: /a$/,
        action: (noun: string) => `${noun}n`,
      },
      {
        name: "o",
        probability: 1,
        condition: /o$/,
        action: (noun: string) => noun.replace(/o$/, "an"),
      },
      {
        name: "u",
        probability: 1,
        condition: /u$/,
        action: (noun: string) => `${noun}an`,
      },
      {
        name: "i",
        probability: 1,
        condition: /i$/,
        action: (noun: string) => `${noun}an`,
      },
      {
        name: "e",
        probability: 1,
        condition: /e$/,
        action: (noun: string) => `${noun}an`,
      },
      {
        name: "ay",
        probability: 1,
        condition: /ay$/,
        action: (noun: string) => `${noun}an`,
      },
      {
        name: "os",
        probability: 1,
        condition: /os$/,
        action: (noun: string) => {
          const root = trimVowels(noun.slice(0, -2), 0);
          if (root.length < 4) return noun.slice(0, -1);
          return `${root}ian`;
        },
      },
      {
        name: "es",
        probability: 1,
        condition: /es$/,
        action: (noun: string) => {
          const root = trimVowels(noun.slice(0, -2), 0);
          if (root.length > 7) return noun.slice(0, -1);
          return `${root}ian`;
        },
      },
      {
        name: "l",
        probability: 0.8,
        condition: /l$/,
        action: (noun: string) => `${noun}ese`,
      },
      {
        name: "n",
        probability: 0.8,
        condition: /n$/,
        action: (noun: string) => `${noun}ese`,
      },
      {
        name: "ad",
        probability: 0.8,
        condition: /ad$/,
        action: (noun: string) => `${noun}ian`,
      },
      {
        name: "an",
        probability: 0.8,
        condition: /an$/,
        action: (noun: string) => `${noun}ian`,
      },
      {
        name: "ish",
        probability: 0.25,
        condition: /^[a-zA-Z]{6}$/,
        action: (noun: string) => `${trimVowels(noun.slice(0, -1))}ish`,
      },
      {
        name: "an",
        probability: 0.5,
        condition: /^[a-zA-Z]{0,7}$/,
        action: (noun: string) => `${trimVowels(noun)}an`,
      },
    ],
    fr: [
      {
        name: "guo",
        probability: 1,
        condition: / Guo$/,
        action: (noun: string) => noun.slice(0, -4),
      },
      {
        name: "orszag",
        probability: 1,
        condition: /orszag$/,
        action: (noun: string) =>
          noun.length < 9 ? `${noun}ian` : noun.slice(0, -6),
      },
      {
        name: "stan",
        probability: 1,
        condition: /stan$/,
        action: (noun: string) => `${noun}ais`,
      },
      {
        name: "land",
        probability: 1,
        condition: /land$/,
        action: (noun: string) => `${noun}ais`,
      },
      {
        name: "que",
        probability: 1,
        condition: /que$/,
        action: (noun: string) => noun.replace(/que$/, "cain"),
      },
      {
        name: "ia",
        probability: 1,
        condition: /ia$/,
        action: (noun: string) => noun.replace(/a$/, "en"),
      },
      {
        name: "a",
        probability: 1,
        condition: /a$/,
        action: (noun: string) => `${noun}n`,
      },
      {
        name: "o",
        probability: 1,
        condition: /o$/,
        action: (noun: string) => `${noun}lais`,
      },
      {
        name: "u",
        probability: 1,
        condition: /u$/,
        action: (noun: string) => `${noun}en`,
      },
      {
        name: "i",
        probability: 1,
        condition: /i$/,
        action: (noun: string) => `${noun}en`,
      },
      {
        name: "ie",
        probability: 1,
        condition: /e$/,
        action: (noun: string) => `${noun}n`,
      },
      {
        name: "e",
        probability: 0.5,
        condition: /e$/,
        action: (noun: string) => noun.replace(/e$/, "ais"),
      },
      {
        name: "e",
        probability: 0.5,
        condition: /e$/,
        action: (noun: string) => noun.replace(/e$/, "ois"),
      },
      {
        name: "e",
        probability: 0.5,
        condition: /e$/,
        action: (noun: string) => noun.replace(/e$/, "ien"),
      },
      {
        name: "e",
        probability: 1,
        condition: /e$/,
        action: (noun: string) => noun.replace(/e$/, "éen"),
      },
      {
        name: "ay",
        probability: 1,
        condition: /ay$/,
        action: (noun: string) => `${noun}en`,
      },
      {
        name: "os",
        probability: 1,
        condition: /os$/,
        action: (noun: string) => {
          const root = trimVowels(noun.slice(0, -2), 0);
          if (root.length < 4) return noun.slice(0, -1);
          return `${root}ien`;
        },
      },
      {
        name: "es",
        probability: 1,
        condition: /es$/,
        action: (noun: string) => {
          const root = trimVowels(noun.slice(0, -2), 0);
          if (root.length > 7) return noun.slice(0, -1);
          return `${root}ien`;
        },
      },
      {
        name: "l",
        probability: 0.8,
        condition: /l$/,
        action: (noun: string) => `${noun}ais`,
      },
      {
        name: "n",
        probability: 0.8,
        condition: /n$/,
        action: (noun: string) => `${noun}ais`,
      },
      {
        name: "n",
        probability: 0.5,
        condition: /n$/,
        action: (noun: string) => `${noun}ois`,
      },
      {
        name: "ad",
        probability: 0.8,
        condition: /ad$/,
        action: (noun: string) => `${noun}ien`,
      },
      {
        name: "an",
        probability: 0.8,
        condition: /an$/,
        action: (noun: string) => `${noun}ien`,
      },
      {
        name: "ish",
        probability: 0.25,
        condition: /^[a-zA-Z]{6}$/,
        action: (noun: string) => `${trimVowels(noun.slice(0, -1))}ish`,
      },
      {
        name: "an",
        probability: 0.5,
        condition: /^[a-zA-Z]{0,7}$/,
        action: (noun: string) => `${trimVowels(noun)}an`,
      },
    ],
  };
  const rules =
    adjectivizationRules[options.language] ?? adjectivizationRules.en;
  for (const rule of rules) {
    if (P(rule.probability) && rule.condition.test(nounToBeAdjective)) {
      return rule.action(nounToBeAdjective);
    }
  }
  return nounToBeAdjective; // no rule applied, return noun as is
};

/**
 * Get the ordinal suffix for a given number.
 * @param n - The number.
 * @returns The number with its ordinal suffix.
 */
export const nth = (n: number) =>
  n + (["st", "nd", "rd"][((((n + 90) % 100) - 10) % 10) - 1] || "th");

/**
 * Generate an abbreviation for a given name, avoiding restricted codes.
 * @param name - The name to be abbreviated.
 * @param restricted - An array of restricted abbreviations to avoid (default is an empty array).
 * @returns The generated abbreviation.
 */
export const abbreviate = (name: string, restricted: string[] = []) => {
  const parsed = name.replace("Old ", "O ").replace(/[()]/g, ""); // remove Old prefix and parentheses
  const words = parsed.split(" ");
  const letters = words.join("");

  let code =
    words.length === 2 ? words[0][0] + words[1][0] : letters.slice(0, 2);
  for (let i = 1; i < letters.length - 1 && restricted.includes(code); i++) {
    code = letters[0] + letters[i].toUpperCase();
  }
  return code;
};

/**
 * Format a list of strings into a human-readable list.
 * @param array - The array of strings to be formatted.
 * @returns The formatted list as a string.
 */
export const list = (array: string[]) => {
  if (!Intl.ListFormat) return array.join(", ");
  const conjunction = new Intl.ListFormat(
    document.documentElement.lang || "en",
    { style: "long", type: "conjunction" },
  );
  return conjunction.format(array);
};

declare global {
  interface Window {
    vowel: typeof isVowel;
    trimVowels: typeof trimVowels;
    getAdjective: typeof getAdjective;
    nth: typeof nth;
    abbreviate: typeof abbreviate;
    list: typeof list;
  }
}

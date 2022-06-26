import {P} from "./probabilityUtils";

// chars that serve as vowels
const VOWELS = `aeiouyɑ'əøɛœæɶɒɨɪɔɐʊɤɯаоиеёэыуюяàèìòùỳẁȁȅȉȍȕáéíóúýẃőűâêîôûŷŵäëïöüÿẅãẽĩõũỹąęįǫųāēīōūȳăĕĭŏŭǎěǐǒǔȧėȯẏẇạẹịọụỵẉḛḭṵṳ`;

export function vowel(char: string) {
  return VOWELS.includes(char);
}

// remove vowels from the end of the string
export function trimVowels(str: string, minLength = 3) {
  while (str.length > minLength && str.length && vowel(str.at(-1) as string)) {
    str = str.slice(0, -1);
  }
  return str;
}

interface AdjectivizationRule {
  name: string;
  probability: number;
  condition: RegExp;
  action: (noun: string) => string;
}

const adjectivizationRules: AdjectivizationRule[] = [
  {name: "guo", probability: 1, condition: new RegExp(" Guo$"), action: noun => noun.slice(0, -4)},
  {
    name: "orszag",
    probability: 1,
    condition: new RegExp("orszag$"),
    action: noun => (noun.length < 9 ? noun + "ian" : noun.slice(0, -6))
  },
  {
    name: "stan",
    probability: 1,
    condition: new RegExp("stan$"),
    action: noun => (noun.length < 9 ? noun + "i" : trimVowels(noun.slice(0, -4)))
  },
  {
    name: "land",
    probability: 1,
    condition: new RegExp("land$"),
    action: noun => {
      if (noun.length > 9) return noun.slice(0, -4);
      const root = trimVowels(noun.slice(0, -4), 0);
      if (root.length < 3) return noun + "ic";
      if (root.length < 4) return root + "lish";
      return root + "ish";
    }
  },
  {
    name: "que",
    probability: 1,
    condition: new RegExp("que$"),
    action: noun => noun.replace(/que$/, "can")
  },
  {
    name: "a",
    probability: 1,
    condition: new RegExp("a$"),
    action: noun => noun + "n"
  },
  {
    name: "o",
    probability: 1,
    condition: new RegExp("o$"),
    action: noun => noun.replace(/o$/, "an")
  },
  {
    name: "u",
    probability: 1,
    condition: new RegExp("u$"),
    action: noun => noun + "an"
  },
  {
    name: "i",
    probability: 1,
    condition: new RegExp("i$"),
    action: noun => noun + "an"
  },
  {
    name: "e",
    probability: 1,
    condition: new RegExp("e$"),
    action: noun => noun + "an"
  },
  {
    name: "ay",
    probability: 1,
    condition: new RegExp("ay$"),
    action: noun => noun + "an"
  },
  {
    name: "os",
    probability: 1,
    condition: new RegExp("os$"),
    action: noun => {
      const root = trimVowels(noun.slice(0, -2), 0);
      if (root.length < 4) return noun.slice(0, -1);
      return root + "ian";
    }
  },
  {
    name: "es",
    probability: 1,
    condition: new RegExp("es$"),
    action: noun => {
      const root = trimVowels(noun.slice(0, -2), 0);
      if (root.length > 7) return noun.slice(0, -1);
      return root + "ian";
    }
  },
  {
    name: "l",
    probability: 0.8,
    condition: new RegExp("l$"),
    action: noun => noun + "ese"
  },
  {
    name: "n",
    probability: 0.8,
    condition: new RegExp("n$"),
    action: noun => noun + "ese"
  },
  {
    name: "ad",
    probability: 0.8,
    condition: new RegExp("ad$"),
    action: noun => noun + "ian"
  },
  {
    name: "an",
    probability: 0.8,
    condition: new RegExp("an$"),
    action: noun => noun + "ian"
  },
  {
    name: "ish",
    probability: 0.25,
    condition: new RegExp("^[a-zA-Z]{6}$"),
    action: noun => trimVowels(noun.slice(0, -1)) + "ish"
  },
  {
    name: "an",
    probability: 0.5,
    condition: new RegExp("^[a-zA-Z]{0-7}$"),
    action: noun => trimVowels(noun) + "an"
  }
];

// get adjective form from noun
export function getAdjective(noun: string) {
  for (const rule of adjectivizationRules) {
    if (P(rule.probability) && rule.condition.test(noun)) {
      return rule.action(noun);
    }
  }
  return noun; // no rule applied, return noun as is
}

// get English ordinal from integer: 1 => 1st
export const nth = (n: number) => n + (["st", "nd", "rd"][((((n + 90) % 100) - 10) % 10) - 1] || "th");

// get two-letters code (abbreviation) from string
export function abbreviate(str: string, restricted: string[] = []) {
  const parsed = str.replace("Old ", "O ").replace(/[()]/g, ""); // remove Old prefix and parentheses
  const words = parsed.split(" ");
  const letters = words.join("");

  let code = words.length === 2 ? words[0][0] + words[1][0] : letters.slice(0, 2);
  for (let i = 1; i < letters.length - 1 && restricted.includes(code); i++) {
    code = letters[0] + letters[i].toUpperCase();
  }
  return code;
}

// conjunct array: [A,B,C] => "A, B and C"
export function list(array: string[]) {
  if (!Intl.ListFormat) return array.join(", ");
  const conjunction = new Intl.ListFormat("en", {style: "long", type: "conjunction"});
  return conjunction.format(array);
}

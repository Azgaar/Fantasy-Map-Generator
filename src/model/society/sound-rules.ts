import type { NameBase, SoundRule } from "@/data/name-bases";
import { JOIN_RULES, SHARED_RULES } from "@/data/name-rules";
import { log } from "@/utils/logger";

const patterns = new Map<string, RegExp | null>();

/** Rewrite a lowercase word by a base's rules, then by the shared ones; a rule that is no valid regex is skipped */
export function applyRules(word: string, rules: SoundRule[] = []): string {
  const own = rules.filter(rule => !rule.at);
  return rewrite(rewrite(word, own), SHARED_RULES);
}

/** Join a lowercase name made of parts, `+` at each join: the base's join rules first, then the shared ones.
 * The parts stay as they came: a form written for the base is not what its word rules are for */
export function joinParts(name: string, rules: SoundRule[] = []): string {
  const joins = rules.filter(rule => rule.at === "join");
  return rewrite(rewrite(rewrite(name, joins), JOIN_RULES).replaceAll("+", ""), SHARED_RULES);
}

const WORD_START = /(?<=^|[ -])./gu;

/** A lowercase name with each word capitalized */
export const capitalizeWords = (name: string): string => name.replace(WORD_START, letter => letter.toUpperCase());

function rewrite(name: string, rules: SoundRule[]): string {
  for (const { match, replace } of rules) {
    const pattern = compile(match);
    if (pattern) name = name.replace(pattern, replace);
  }
  return name;
}

function compile(match: string): RegExp | null {
  if (!patterns.has(match)) {
    try {
      patterns.set(match, new RegExp(match, "gu"));
    } catch (error) {
      log.error(`Sound rule ${match} is not a valid pattern`, error);
      patterns.set(match, null);
    }
  }
  return patterns.get(match)!;
}

const DOUBLES = /^\((?:\.|\[\^(.+)\])\)\\1\+$/;

/** The rule that keeps a letter from standing twice in a row, but for the letters given */
export const doublesRule = (letters = ""): SoundRule => ({
  match: letters ? `([^${letters.replace(/[\\\]^-]/g, "\\$&")}])\\1+` : "(.)\\1+",
  replace: "$1"
});

/** The letters a base's doubles rule lets stand twice in a row */
export const getDoubles = ({ rules = [] }: NameBase): string =>
  rules
    .map(rule => DOUBLES.exec(rule.match))
    .find(Boolean)?.[1]
    ?.replace(/\\(.)/g, "$1") ?? "";

export function setDoubles(base: NameBase, letters: string): void {
  base.rules ??= [];
  const index = base.rules.findIndex(rule => DOUBLES.test(rule.match));
  if (index < 0) base.rules.unshift(doublesRule(letters));
  else base.rules[index] = doublesRule(letters);
}

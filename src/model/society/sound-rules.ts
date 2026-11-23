import type { NameBase, SoundRule } from "@/data/name-bases";
import { JOIN_RULES, SHARED_RULES } from "@/data/name-rules";
import { log } from "@/utils/logger";

const patterns = new Map<string, RegExp | null>();

const isWordRule = (rule: SoundRule) => !rule.at && !rule.when && !rule.as && rule.chance === undefined;

/** Rewrite a lowercase word by a base's rules, then by the shared ones; a rule that is no valid regex is skipped */
export function applyRules(word: string, rules: SoundRule[] = []): string {
  return rewrite(rewrite(word, rules.filter(isWordRule)), SHARED_RULES);
}

/** Adapt a lowercase root coined in another base by the rules a base keeps for foreign roots */
export function applyForeignRules(root: string, rules: SoundRule[] = []): string {
  return rewrite(
    root,
    rules.filter(rule => rule.when === "foreign")
  );
}

interface JoinOptions {
  rolls?: number[]; // one roll, 0 to 1, per rule with a chance, in the rules' order
  fits?: (name: string) => boolean; // whether the name is short enough: the rules for long names run until it is
}

/** Join a lowercase name made of parts, `+` at each join: the base's join rules, the ones whose chance came up,
 * the shared join rules, then the shared word rules. The parts stay as they came: a form written for the base
 * is not what its word rules are for. A name still too long goes through the rules for long names, one at a time */
export function joinParts(name: string, rules: SoundRule[] = [], { rolls = [], fits }: JoinOptions = {}): string {
  const chances = rules.filter(rule => rule.chance !== undefined && rule.when !== "foreign");
  const fired = chances.filter((rule, index) => (rolls[index] ?? 1) < rule.chance!);
  const joins = rules.filter(rule => rule.at === "join" && !rule.when && rule.chance === undefined);
  let joined = rewrite(rewrite(rewrite(name, [...joins, ...fired]), JOIN_RULES).replaceAll("+", ""), SHARED_RULES);

  for (const rule of rules.filter(rule => rule.when === "long" && rule.chance === undefined)) {
    if (!fits || fits(joined)) break;
    joined = rewrite(joined, [rule]);
  }
  return joined;
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

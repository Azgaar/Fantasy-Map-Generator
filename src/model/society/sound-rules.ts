import type { NameBase, SoundRule } from "@/data/name-bases";
import { SHARED_RULES } from "@/data/name-rules";
import { log } from "@/utils/logger";

const patterns = new Map<string, RegExp | null>();

/** Rewrite a lowercase name by a base's rules, then by the shared ones; a rule that is no valid regex is skipped */
export function applyRules(name: string, rules: SoundRule[] = []): string {
  for (const { match, replace } of [...rules, ...SHARED_RULES]) {
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

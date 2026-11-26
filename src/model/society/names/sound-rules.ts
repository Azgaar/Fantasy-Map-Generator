import { JOIN_RULES, SHARED_RULES } from "@/data/name-rules";
import type { NameBase, SoundRule } from "@/types/names";
import { compileRegex } from "@/utils/string-utils";

const DOUBLES = /^\((?:\.|\[\^(.+)\])\)\\1\+$/;

/** A base's joining words by how they stand */
interface Joining {
  words: Set<string>; // between any two words
  dashed: Set<string>; // between dashes only: written -sur-
  elided?: RegExp; // cut short before the next word: written d'
}

interface JoinOptions {
  rolls?: number[]; // one roll, 0 to 1, per rule with a chance, in the rules' order
  fits?: (name: string) => boolean; // whether the name is short enough: the rules for long names run until it is
}

interface Rewrite {
  regex: RegExp;
  replace: string;
}

/** A base's rules by what they are for */
interface Sorted {
  word: Rewrite[];
  foreign: Rewrite[];
  join: Rewrite[];
  long: Rewrite[];
  chances: { chance: number; rewrites: Rewrite[] }[];
  rolls: number; // of the rules with a chance
  counting: SoundRule[]; // what puts a noun in a class: "tower" in the plural
}

class SoundRulesModule {
  private readonly sorted = new WeakMap<readonly SoundRule[], Sorted>();
  private readonly joinings = new WeakMap<readonly string[], Joining>();

  /** Rewrite a lowercase word by a base's rules, then by the shared ones; a rule that is no valid regex is skipped.
   * A `single` word has no letter twice in a row */
  apply(word: string, rules?: readonly SoundRule[], single = false): string {
    return rewrite(rewrite(single ? rewrite(word, SINGLE) : word, this.sort(rules).word), SHARED);
  }

  /** Adapt a lowercase name coined in another base by the rules a base keeps for foreign names */
  applyForeign(root: string, rules?: readonly SoundRule[]): string {
    return rewrite(root, this.sort(rules).foreign);
  }

  /** Join a lowercase name made of parts, `+` at each join: the base's join rules, the ones whose chance came up,
   * the shared join rules, then the shared word rules. The parts stay as they came: a form written for the base
   * is not what its word rules are for. A name still too long goes through the rules for long names, one at a time */
  join(name: string, rules?: readonly SoundRule[], { rolls = [], fits }: JoinOptions = {}): string {
    const { join, long, chances } = this.sort(rules);
    let parted = rewrite(name, join);
    for (const [index, { chance, rewrites }] of chances.entries())
      if ((rolls[index] ?? 1) < chance) parted = rewrite(parted, rewrites);
    let joined = rewrite(rewrite(parted, JOIN).replaceAll("+", ""), SHARED);

    for (const rule of long) {
      if (!fits || fits(joined)) break;
      joined = rewrite(joined, [rule]);
    }
    return joined;
  }

  /** A lowercase name with each word capitalized, but for a base's joining words between them: Puebla de Sanabria,
   * Pont-sur-Moselle, Pont-d'Ain */
  capitalize(name: string, joining: readonly string[] = NO_WORDS): string {
    const { words, dashed, elided } = this.joiningOf(joining);
    const isJoining = (word: string, before: string) => words.has(word) || (before === "-" && dashed.has(word));
    const parts = name.split(/([ -])/); // words, and the space or dash after each
    const upper = (text: string) => {
      const [letter = ""] = text;
      return letter.toUpperCase() + text.slice(letter.length);
    };
    return parts
      .map((part, index) => {
        if (index % 2) return part;
        if (index && index < parts.length - 1 && isJoining(part, parts[index - 1])) return part;
        if (index && elided?.test(part)) return part.replace(/'(.)/u, (_, letter) => `'${letter.toUpperCase()}`);
        return upper(part);
      })
      .join("");
  }

  private joiningOf(joining: readonly string[]): Joining {
    let known = this.joinings.get(joining);
    if (!known) {
      const [dashed, elided, words] = [new Set<string>(), [] as string[], new Set<string>()];
      for (const word of joining.map(word => word.trim().toLowerCase()).filter(Boolean)) {
        if (/^-.+-$/.test(word)) dashed.add(word.slice(1, -1));
        else if (word.endsWith("'")) elided.push(word.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        else words.add(word);
      }
      known = {
        words,
        dashed,
        elided: elided.length ? new RegExp(`^(?:${elided.join("|")})'(?=\\p{L})`, "u") : undefined
      };
      this.joinings.set(joining, known);
    }
    return known;
  }

  /** The rule that keeps a letter from standing twice in a row, but for the letters given */
  doublesRule(letters = ""): SoundRule {
    return {
      match: letters ? `([^${letters.replace(/[\\\]^-]/g, "\\$&")}])\\1+` : "(.)\\1+",
      replace: "$1"
    };
  }

  /** The letters a base's doubles rule lets stand twice in a row */
  getDoubles({ rules = [] }: NameBase): string {
    return (
      rules
        .map(rule => DOUBLES.exec(rule.match))
        .find(Boolean)?.[1]
        ?.replace(/\\(.)/g, "$1") ?? ""
    );
  }

  setDoubles(base: NameBase, letters: string): void {
    const rules = base.rules ?? [];
    const index = rules.findIndex(rule => DOUBLES.test(rule.match));
    base.rules = index < 0 ? [this.doublesRule(letters), ...rules] : rules.with(index, this.doublesRule(letters));
  }

  /** A base's rules by what they are for, sorted once */
  sort(rules: readonly SoundRule[] = NONE): Sorted {
    let sorted = this.sorted.get(rules);
    if (!sorted) {
      sorted = {
        word: compile(rules.filter(isWordRule)),
        foreign: compile(rules.filter(rule => rule.when === "foreign")),
        join: compile(rules.filter(rule => rule.at === "join" && !rule.when && rule.chance === undefined)),
        long: compile(rules.filter(rule => rule.when === "long" && rule.chance === undefined)),
        chances: rules
          .filter(rule => rule.chance !== undefined && rule.when !== "foreign")
          .map(rule => ({ chance: rule.chance!, rewrites: compile([rule]) })),
        rolls: rules.filter(rule => rule.chance !== undefined).length,
        counting: rules.filter(rule => rule.as)
      };
      this.sorted.set(rules, sorted);
    }
    return sorted;
  }
}

const NONE: SoundRule[] = [];
const NO_WORDS: readonly string[] = [];

/** What a rule is for: a base inherits each purpose's rules whole, where it writes none of its own */
export type RulePurpose = "word" | "join" | "counting" | "foreign";
export const RULE_PURPOSES: RulePurpose[] = ["word", "join", "counting", "foreign"];

export function purposeOf(rule: SoundRule): RulePurpose {
  if (rule.when === "foreign") return "foreign";
  if (rule.as) return "counting";
  return isWordRule(rule) ? "word" : "join";
}

const compile = (rules: readonly SoundRule[]): Rewrite[] =>
  rules.flatMap(({ match, replace }) => {
    const regex = compileRegex(match, "gu");
    return regex ? { regex, replace } : [];
  });

function rewrite(name: string, rewrites: Rewrite[]): string {
  for (const { regex, replace } of rewrites) name = name.replace(regex, replace);
  return name;
}

const isWordRule = (rule: SoundRule) => !rule.at && !rule.when && !rule.as && rule.chance === undefined;

export const SoundRules = new SoundRulesModule();

const [SHARED, JOIN] = [compile(SHARED_RULES), compile(JOIN_RULES)];
const SINGLE = compile([SoundRules.doublesRule()]);

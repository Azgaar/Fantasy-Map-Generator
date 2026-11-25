import { CHAIN_RULES, JOIN_RULES, SHARED_RULES } from "@/data/name-rules";
import type { NameBase, SoundRule } from "@/types/names";
import { compileRegex } from "@/utils/string-utils";

// words that join the others and stay lowercase between them: Saint-Germain-en-Laye, Puebla de Sanabria
const PARTICLES = new Set(
  "of the upon de del della delle dei degli di da dal do dos das du des la las le les en am im der zum zur ad sub e ye wa cha ya ka ki".split(
    " "
  )
);
const DASHED = new Set(["sur", "sous", "lès"]); // between dashes only: Pont-sur-Moselle, but Al Sur Al Kabir
const ELIDED = /^(?:d|l|n|dell|nell|sull|dall|all)'(?=\p{L})/u; // Pont-d'Ain, Castel dell'Ovo, Tizi n'Test
const DOUBLES = /^\((?:\.|\[\^(.+)\])\)\\1\+$/;

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
  private readonly sorted = new WeakMap<SoundRule[], Sorted>();

  /** Rewrite a lowercase word by a base's rules, then by the shared ones; a rule that is no valid regex is skipped.
   * A `single` word has no letter twice in a row */
  apply(word: string, rules?: SoundRule[], single = false): string {
    return rewrite(rewrite(single ? rewrite(word, SINGLE) : word, this.sort(rules).word), WORD);
  }

  /** Adapt a lowercase name coined in another base by the rules a base keeps for foreign names */
  applyForeign(root: string, rules?: SoundRule[]): string {
    return rewrite(root, this.sort(rules).foreign);
  }

  /** Join a lowercase name made of parts, `+` at each join: the base's join rules, the ones whose chance came up,
   * the shared join rules, then the shared word rules. The parts stay as they came: a form written for the base
   * is not what its word rules are for. A name still too long goes through the rules for long names, one at a time */
  join(name: string, rules?: SoundRule[], { rolls = [], fits }: JoinOptions = {}): string {
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

  /** A lowercase name with each word capitalized, but for the joining words between them */
  capitalize(name: string): string {
    const parts = name.split(/([ -])/); // words, and the space or dash after each
    const upper = (text: string) => {
      const [letter = ""] = text;
      return letter.toUpperCase() + text.slice(letter.length);
    };
    return parts
      .map((part, index) => {
        if (index % 2) return part;
        if (index && index < parts.length - 1 && isJoining(part, parts[index - 1])) return part;
        if (index && ELIDED.test(part)) return part.replace(/'(.)/u, (_, letter) => `'${letter.toUpperCase()}`);
        return upper(part);
      })
      .join("");
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
  sort(rules: SoundRule[] = NONE): Sorted {
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

const compile = (rules: SoundRule[]): Rewrite[] =>
  rules.flatMap(({ match, replace }) => {
    const regex = compileRegex(match, "gu");
    return regex ? { regex, replace } : [];
  });

function rewrite(name: string, rewrites: Rewrite[]): string {
  for (const { regex, replace } of rewrites) name = name.replace(regex, replace);
  return name;
}

const isJoining = (word: string, before: string) => PARTICLES.has(word) || (before === "-" && DASHED.has(word));
const isWordRule = (rule: SoundRule) => !rule.at && !rule.when && !rule.as && rule.chance === undefined;

export const SoundRules = new SoundRulesModule();

const [SHARED, JOIN] = [compile(SHARED_RULES), compile(JOIN_RULES)];
const WORD = compile([...SHARED_RULES, ...CHAIN_RULES]); // of a word off a chain
const SINGLE = compile([SoundRules.doublesRule()]);

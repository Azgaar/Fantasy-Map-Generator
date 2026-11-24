import { CHAIN_RULES, JOIN_RULES, SHARED_RULES } from "@/data/name-rules";
import type { NameBase, SoundRule } from "@/types/names";
import { log } from "@/utils/logger";

// words that join the others and stay lowercase between them: Saint-Germain-en-Laye, Puebla de Sanabria
const PARTICLES = new Set(
  "of the upon de del della delle dei degli di da dal do dos das du des la las le les en am im der zum zur ad sub e ye wa cha ya".split(
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

class SoundRulesModule {
  private readonly patterns = new Map<string, RegExp | null>();

  /** Rewrite a lowercase word by a base's rules, then by the shared ones; a rule that is no valid regex is skipped */
  apply(word: string, rules: SoundRule[] = []): string {
    return this.rewrite(this.rewrite(word, rules.filter(isWordRule)), [...SHARED_RULES, ...CHAIN_RULES]);
  }

  /** Adapt a lowercase root coined in another base by the rules a base keeps for foreign roots */
  applyForeign(root: string, rules: SoundRule[] = []): string {
    return this.rewrite(
      root,
      rules.filter(rule => rule.when === "foreign")
    );
  }

  /** Join a lowercase name made of parts, `+` at each join: the base's join rules, the ones whose chance came up,
   * the shared join rules, then the shared word rules. The parts stay as they came: a form written for the base
   * is not what its word rules are for. A name still too long goes through the rules for long names, one at a time */
  join(name: string, rules: SoundRule[] = [], { rolls = [], fits }: JoinOptions = {}): string {
    const chances = rules.filter(rule => rule.chance !== undefined && rule.when !== "foreign");
    const fired = chances.filter((rule, index) => (rolls[index] ?? 1) < rule.chance!);
    const joins = rules.filter(rule => rule.at === "join" && !rule.when && rule.chance === undefined);
    const parted = this.rewrite(this.rewrite(name, [...joins, ...fired]), JOIN_RULES);
    let joined = this.rewrite(parted.replaceAll("+", ""), SHARED_RULES);

    for (const rule of rules.filter(rule => rule.when === "long" && rule.chance === undefined)) {
      if (!fits || fits(joined)) break;
      joined = this.rewrite(joined, [rule]);
    }
    return joined;
  }

  /** A lowercase name with each word capitalized, but for the joining words between them */
  capitalize(name: string): string {
    const parts = name.split(/([ -])/); // words, and the space or dash after each
    const upper = (text: string) => text.replace(/^./u, letter => letter.toUpperCase());
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
    base.rules ??= [];
    const index = base.rules.findIndex(rule => DOUBLES.test(rule.match));
    if (index < 0) base.rules.unshift(this.doublesRule(letters));
    else base.rules[index] = this.doublesRule(letters);
  }

  private rewrite(name: string, rules: SoundRule[]): string {
    for (const { match, replace } of rules) {
      const pattern = this.compile(match);
      if (pattern) name = name.replace(pattern, replace);
    }
    return name;
  }

  private compile(match: string): RegExp | null {
    if (!this.patterns.has(match)) {
      try {
        this.patterns.set(match, new RegExp(match, "gu"));
      } catch (error) {
        log.error(`Sound rule ${match} is not a valid pattern`, error);
        this.patterns.set(match, null);
      }
    }
    return this.patterns.get(match)!;
  }
}

const isJoining = (word: string, before: string) => PARTICLES.has(word) || (before === "-" && DASHED.has(word));
const isWordRule = (rule: SoundRule) => !rule.at && !rule.when && !rule.as && rule.chance === undefined;

export const SoundRules = new SoundRulesModule();

// The short written form of name base data: what a lexicon, a grammar, a template list and a rule list look like as text

import type { Concept } from "@/data/name-concepts";
import type { Derivation, Formant, Grammar, NameBase, SoundRule, Template, WrittenNameBase } from "@/types/names";

const PART = "[^\\s,/~@:+]+?"; // no @, : or + in a form
const FORMANT = new RegExp(`^([-=])?(${PART})(?:~(${PART}))?([-=])?(?:/(${PART}))?(?:\\s+(\\d+))?$`, "u");
const WEIGHTED = /^(.*?)(?:\s+(\d+))?$/;
const DERIVATIONS: Derivation[] = ["stem", "first"];
const SILENT = "_";

class NameNotationModule {
  /** A base with whatever it holds in the written form read */
  read(base: WrittenNameBase): NameBase {
    const { rules, grammar, lexicon, patterns } = base;
    return {
      ...base,
      ...(rules && { rules: rules.flatMap(rule => (typeof rule === "string" ? this.parseRules(rule) : rule)) }),
      ...(typeof grammar === "string" && { grammar: this.parseGrammar(grammar) }),
      ...(lexicon && { lexicon: this.parseLexicon(lexicon) }),
      ...(patterns && {
        patterns: Object.fromEntries(
          Object.entries(patterns).map(([pattern, layout]) => [
            pattern,
            typeof layout?.templates === "string"
              ? { ...layout, templates: this.parseTemplates(layout.templates) }
              : layout
          ])
        )
      })
    } as NameBase;
  }

  /** Forms of a concept from text, commas between. Where a form stands shows in how it is written: `Word` stands
   * on its own, `-Word` too and may follow a name after a dash, `first-` starts a word, `-last` ends one, `stem=` takes a suffix, `=suffix` ends a stem; `form`
   * stands anywhere. Then `~short`, `/class` and a whole-number weight after a space, all optional.
   * A form that does not read is left out */
  parseFormants(text: string): Formant[] {
    return text.split(",").flatMap(item => {
      const [, lead, body, short, trail, nounClass, weight] = FORMANT.exec(item.trim()) ?? [];
      if (!body) return [];
      const word = /^\p{Lu}/u.test(body) || body === SILENT;
      if ((lead && trail) || (word && (trail || lead === "="))) return [];

      const formant: Formant = { form: lead === "=" ? `-${body.toLowerCase()}` : body.toLowerCase() };
      if (weight) formant.weight = +weight;
      const position = word ? "word" : lead === "-" ? "last" : trail === "-" ? "first" : trail === "=" ? "stem" : null;
      if (position) formant.position = position;
      if (short) formant.short = short.toLowerCase();
      if (nounClass) formant.class = nounClass;
      if (word && lead) formant.hyphen = true;
      return formant;
    });
  }

  formatFormants(formants: Formant[] = []): string {
    return formants
      .map(({ form, short, class: nounClass, position, weight, hyphen }) => {
        const suffix = form.startsWith("-");
        let core = (suffix ? form.slice(1) : form) + (short ? `~${short}` : "");
        if (suffix) core = `=${core}`;
        else if (position === "last") core = `-${core}`;
        else if (position === "first") core = `${core}-`;
        else if (position === "stem") core = `${core}=`;
        else if (position === "word") core = (hyphen ? "-" : "") + core.charAt(0).toUpperCase() + core.slice(1);
        return core + (nounClass ? `/${nounClass}` : "") + (weight !== undefined ? ` ${weight}` : "");
      })
      .join(", ");
  }

  /** A lexicon from text, a concept a line as `concept: forms`, `#` starting a comment line; or from a record of
   * concepts to their forms, as text or as they are */
  parseLexicon(lexicon: string | Partial<Record<Concept, Formant[] | string>>): Partial<Record<Concept, Formant[]>> {
    const entries =
      typeof lexicon === "string"
        ? lexicon.split("\n").flatMap(line => {
            const [, concept, forms] = /^\s*(\w+)\s*:(.*)$/.exec(line) ?? [];
            return concept ? [[concept, forms] as const] : [];
          })
        : Object.entries<Formant[] | string | undefined>(lexicon);
    return Object.fromEntries(
      entries.map(([concept, forms]) => [concept, Array.isArray(forms) ? forms : this.parseFormants(forms ?? "")])
    );
  }

  formatLexicon(lexicon: Partial<Record<Concept, Formant[]>> = {}): string {
    return Object.entries<Formant[] | undefined>(lexicon)
      .map(([concept, forms]) => `${concept}: ${this.formatFormants(forms)}`)
      .join("\n");
  }

  /** A grammar from text, a line each: `class: pattern` for a noun class, whose nouns match the regex, the last
   * one empty to take the rest; `*set: class ending, …` for the endings a word written `*set` takes beside each class,
   * `*:` the default set; `stem: match => replace`, likewise `first:`, for a rule that makes such a form of what is
   * written for a concept */
  parseGrammar(text: string): Grammar | undefined {
    const grammar: Required<Grammar> = { classes: {}, endings: {}, derive: {} };
    for (const line of text.split("\n")) {
      const [, name, rest = ""] = /^\s*([^\s:]+)\s*:(.*)$/.exec(line) ?? [];
      if (!name) continue;
      const arrow = rest.indexOf("=>");
      if (name.startsWith("*")) {
        const endings = rest.split(",").map(item => item.trim().split(/\s+/));
        grammar.endings[name.slice(1)] = Object.fromEntries(
          endings.filter(([nounClass]) => nounClass).map(([nounClass, ending = ""]) => [nounClass, ending])
        );
      } else if (DERIVATIONS.includes(name as Derivation) && arrow >= 0) {
        const rule = { match: rest.slice(0, arrow).trim(), replace: rest.slice(arrow + 2).trim() };
        const kind = name as Derivation;
        grammar.derive[kind] = [...(grammar.derive[kind] ?? []), rule];
      } else grammar.classes[name] = rest.trim();
    }
    const parts = Object.entries(grammar).filter(([, part]) => Object.keys(part).length);
    return parts.length ? Object.fromEntries(parts) : undefined;
  }

  formatGrammar({ classes = {}, endings = {}, derive = {} }: Grammar = {}): string {
    const sets = Object.entries(endings).map(
      ([set, byClass]) =>
        `*${set}: ${Object.entries(byClass)
          .map(([nounClass, ending]) => `${nounClass} ${ending}`.trim())
          .join(", ")}`
    );
    const rules = DERIVATIONS.flatMap(kind =>
      (derive[kind] ?? []).map(({ match, replace }) => `${kind}: ${match} => ${replace}`.trim())
    );
    const lines = Object.entries(classes).map(([name, pattern]) => `${name}: ${pattern}`.trim());
    return [lines, sets, rules]
      .filter(group => group.length)
      .map(group => group.join("\n"))
      .join("\n\n");
  }

  /** Templates from text: `{root}s{generic}` and a whole-number weight after a space, commas between, the weight
   * optional */
  parseTemplates(text: string): Template[] {
    return text.split(",").flatMap(item => {
      const [, parts, weight] = WEIGHTED.exec(item.trim()) ?? [];
      if (!parts?.trim()) return [];
      return weight ? { parts: parts.trim(), weight: +weight } : { parts: parts.trim() };
    });
  }

  formatTemplates(templates: Template[] = []): string {
    return templates.map(({ parts, weight }) => (weight === undefined ? parts : `${parts} ${weight}`)).join(", ");
  }

  /** Rules from text, a rule a line: `match => replace`, then ` | ` and any of `join`, `long`, `foreign`, `30%`,
   * or `as` and a noun class for a rule that makes a noun of that class */
  parseRules(text: string): SoundRule[] {
    return text.split("\n").flatMap(line => {
      const arrow = line.indexOf(" =>");
      if (arrow < 1) return [];
      const [replace = "", ...flags] = line.slice(arrow + 3).split(" | ");
      const rule: SoundRule = { match: line.slice(0, arrow).trim(), replace: replace.trim() };
      for (const flag of flags.map(flag => flag.trim())) {
        if (flag === "join") rule.at = "join";
        else if (flag === "long" || flag === "foreign") rule.when = flag;
        else if (flag.startsWith("as ")) rule.as = flag.slice(3).trim();
        else if (/^\d*\.?\d+%$/.test(flag)) rule.chance = Number.parseFloat(flag) / 100;
      }
      return rule;
    });
  }

  formatRules(rules: SoundRule[] = []): string {
    return rules
      .map(({ match, replace, at, when, chance, as }) => {
        const flags = [at, when, as && `as ${as}`, chance !== undefined && `${Math.round(chance * 1000) / 10}%`].filter(
          Boolean
        );
        return [`${match} => ${replace}`, ...flags].join(" | ");
      })
      .join("\n");
  }
}

export const NameNotation = new NameNotationModule();

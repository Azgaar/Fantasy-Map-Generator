// The short written form of name base data: what a lexicon, a template list and a rule list look like as text

import type { Formant, Grammar, SoundRule, Template } from "@/data/name-bases";

const PART = "[^\\s,@:~+/]+";
const FORMANT = new RegExp(
  `^(${PART})(?:~(${PART}))?(?:\\+(${PART}))?(?:/(${PART}))?(?:@(first|last|word|stem))?(?::(\\d*\\.?\\d+))?$`
);

/** Forms of a concept from text: `form~short+link/class@position:weight`, commas between, all but the form
 * optional. `-form` is a suffix, `form*` takes an agreeing ending, `_` is a noun left unsaid.
 * A form that does not read is left out */
export function parseFormants(text: string): Formant[] {
  return text.split(",").flatMap(item => {
    const [, form, short, link, nounClass, position, weight] = FORMANT.exec(item.trim()) ?? [];
    if (!form) return [];
    const formant: Formant = { form };
    if (weight) formant.weight = +weight;
    if (position) formant.position = position as Formant["position"];
    if (short) formant.short = short;
    if (link) formant.link = link;
    if (nounClass) formant.class = nounClass;
    return formant;
  });
}

export function formatFormants(formants: Formant[] = []): string {
  return formants
    .map(({ form, short, link, class: nounClass, position, weight }) => {
      const parts = [
        form,
        short && `~${short}`,
        link && `+${link}`,
        nounClass && `/${nounClass}`,
        position && `@${position}`,
        weight !== undefined && `:${weight}`
      ];
      return parts.filter(Boolean).join("");
    })
    .join(", ");
}

/** A grammar from text, a noun class a line: `class: pattern => ending`. The pattern is a regex the class's nouns
 * match, the ending what a word written with `*` takes beside one; either may be left out */
export function parseGrammar(text: string): Grammar | undefined {
  const classes: Record<string, string> = {};
  const agreement: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [, name, rest = ""] = /^\s*([^\s:]+)\s*:(.*)$/.exec(line) ?? [];
    if (!name) continue;
    const arrow = rest.indexOf("=>");
    classes[name] = (arrow < 0 ? rest : rest.slice(0, arrow)).trim();
    if (arrow >= 0) agreement[name] = rest.slice(arrow + 2).trim();
  }
  return Object.keys(classes).length ? { classes, agreement } : undefined;
}

export function formatGrammar({ classes = {}, agreement = {} }: Grammar = {}): string {
  return [...new Set([...Object.keys(classes), ...Object.keys(agreement)])]
    .map(name => [`${name}:`, classes[name], name in agreement && `=> ${agreement[name]}`].filter(Boolean).join(" "))
    .join("\n");
}

/** A lexicon from a record of concepts to their forms as text */
export function lexiconOf<Concept extends string>(
  forms: Partial<Record<Concept, string>>
): Partial<Record<Concept, Formant[]>> {
  const entries = Object.entries<string | undefined>(forms).map(([concept, text]) => [
    concept,
    parseFormants(text ?? "")
  ]);
  return Object.fromEntries(entries);
}

/** Templates from text: `{root}s{generic}:weight`, commas between, the weight optional */
export function parseTemplates(text: string): Template[] {
  return text.split(",").flatMap(item => {
    const [, parts, weight] = /^(.*?)(?::(\d*\.?\d+))?$/.exec(item.trim()) ?? [];
    if (!parts?.trim()) return [];
    return weight ? { parts: parts.trim(), weight: +weight } : { parts: parts.trim() };
  });
}

export function formatTemplates(templates: Template[] = []): string {
  return templates.map(({ parts, weight }) => (weight === undefined ? parts : `${parts}:${weight}`)).join(", ");
}

/** Rules from text, a rule a line: `match => replace`, then ` | ` and any of `join`, `long`, `foreign`, `30%` */
export function parseRules(text: string): SoundRule[] {
  return text.split("\n").flatMap(line => {
    const arrow = line.indexOf(" =>");
    if (arrow < 1) return [];
    const [replace = "", ...flags] = line.slice(arrow + 3).split(" | ");
    const rule: SoundRule = { match: line.slice(0, arrow).trim(), replace: replace.trim() };
    for (const flag of flags.map(flag => flag.trim())) {
      if (flag === "join") rule.at = "join";
      else if (flag === "long" || flag === "foreign") rule.when = flag;
      else if (/^\d*\.?\d+%$/.test(flag)) rule.chance = Number.parseFloat(flag) / 100;
    }
    return rule;
  });
}

export function formatRules(rules: SoundRule[] = []): string {
  return rules
    .map(({ match, replace, at, when, chance }) => {
      const flags = [at, when, chance !== undefined && `${Math.round(chance * 1000) / 10}%`].filter(Boolean);
      return [`${match} => ${replace}`, ...flags].join(" | ");
    })
    .join("\n");
}

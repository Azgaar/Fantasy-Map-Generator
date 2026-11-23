// What a name shows as: itself, its meaning in the interface language, or its meaning in another name base

import { CONCEPT_LABELS } from "@/data/id-labels";
import type { Concept } from "@/data/name-concepts";
import { gloss, type Meaning, render } from "@/model/society/name-render";
import { Names } from "@/model/society/names-generator";
import { Catalog, t } from "@/utils/i18n";
import { capitalize } from "@/utils/string-utils";

/** A meaning read in the interface language; English reads as the map itself stores a gloss */
export function localGloss(meaning: Meaning): string {
  if (Catalog.language === "en") return gloss(meaning);

  const word = (token: string) =>
    token.startsWith("~") ? token.slice(1) : capitalize(CONCEPT_LABELS[token as Concept] ?? token);
  const [first, second, third] = meaning.tokens.map(word);
  const { pattern } = meaning;
  if (pattern === "simplex") return first;
  if (pattern === "compound") return `${first} ${second} ${third}`;
  if (pattern === "feature") return t("The {{- generic}}", { generic: first, context: "toponym" });
  if (pattern === "owner-generic")
    return t("{{- owner}}'s {{- generic}}", { owner: first, generic: second, context: "toponym" });
  if (pattern === "generic-of")
    return t("{{- generic}} of {{- root}}", { generic: first, root: second, context: "toponym" });
  if (pattern === "root-land")
    return t("{{- generic}} of {{- root}}", { generic: second, root: first, context: "toponym" });
  return `${first} ${second}`;
}

/** The name the labels show for a named thing, by the option: the name itself, what it means, or what a chosen
 * name base makes of its meaning. A name with no meaning, or one that is a proper name, shows as it is */
export function displayName({ name = "", meaning }: { name?: string; meaning?: Meaning }): string {
  const mode = options.app.labels.names;
  if (mode === "native" || !meaning) return name;
  if (mode === "gloss") return meaning.pattern === "simplex" ? name : localGloss(meaning);
  return Names.find(mode) && mode !== meaning.origin ? render(meaning, mode) : name;
}

/** A text that holds a name, with the name as the labels show it: a full name or a label's own text */
export function displayIn(text: string, named: { name?: string; meaning?: Meaning }): string {
  const shown = displayName(named);
  return named.name && shown !== named.name ? text.replaceAll(named.name, shown) : text;
}

import { CONCEPT_LABELS } from "@/data/id-labels";
import type { Concept } from "@/data/name-concepts";
import { Meanings } from "@/model/society/names/meanings";
import type { Meaning } from "@/types/names";
import { Catalog, t } from "@/utils/i18n";
import { capitalize } from "@/utils/string-utils";

/** A meaning read in the interface language; English reads as the map itself stores a Meanings.gloss */
export function localGloss(meaning: Meaning): string {
  if (Catalog.language === "en") return Meanings.gloss(meaning);

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

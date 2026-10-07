// Diplomatic relations, keyed by the value a state stores in `diplomacy` for another state
import { t } from "@/utils/i18n";

export interface Relation {
  /** the relation's name as the interface shows it */
  label: string;
  /** "subject is an ally of object", in the interface language */
  describe: (subject: string, object: string) => string;
  color: string;
  tip: string;
  /** chronicle record of a state taking up the relation towards another; a generic change record if not set */
  event?: { title: string; text: (subject: string, object: string) => string };
}

export const RELATIONS: Record<string, Relation> = {
  Ally: {
    label: t("Ally"),
    describe: (subject, object) => t("{{subject}} is an ally of {{object}}", { subject, object }),
    color: "#00b300",
    tip: t("Allies formed a defensive pact and protect each other in case of third party aggression"),
    event: { title: "Defence pact", text: (subject, object) => `${subject} entered into defensive pact with ${object}` }
  },
  Friendly: {
    label: t("Friendly"),
    describe: (subject, object) => t("{{subject}} is friendly to {{object}}", { subject, object }),
    color: "#d4f8aa",
    tip: t("State is friendly to another state when they share some common interests")
  },
  Neutral: {
    label: t("Neutral"),
    describe: (subject, object) => t("{{subject}} is neutral to {{object}}", { subject, object }),
    color: "#edeee8",
    tip: t("Neutral means states relations are neither positive nor negative")
  },
  Suspicion: {
    label: t("Suspicion"),
    describe: (subject, object) => t("{{subject}} is suspicious of {{object}}", { subject, object }),
    color: "#eeafaa",
    tip: t("Suspicion means state has a cautious distrust of another state")
  },
  Enemy: {
    label: t("Enemy"),
    describe: (subject, object) => t("{{subject}} is at war with {{object}}", { subject, object }),
    color: "#e64b40",
    tip: t("Enemies are states at war with each other"),
    event: { title: "War declaration", text: (subject, object) => `${subject} declared a war on its enemy ${object}` }
  },
  Unknown: {
    label: t("Unknown"),
    describe: (subject, object) => t("{{subject}} does not know about {{object}}", { subject, object }),
    color: "#a9a9a9",
    tip: t("Relations are unknown if states do not have enough information about each other"),
    event: {
      title: "Relations severance",
      text: (subject, object) => `${subject} recalled their ambassadors and wiped all the records about ${object}`
    }
  },
  Rival: {
    label: t("Rival"),
    describe: (subject, object) => t("{{subject}} is a rival of {{object}}", { subject, object }),
    color: "#ad5a1f",
    tip: t("Rivalry is a state of competing for dominance in the region"),
    event: { title: "Rivalization", text: (subject, object) => `${subject} and ${object} became rivals` }
  },
  Vassal: {
    label: t("Vassal"),
    describe: (subject, object) => t("{{subject}} is a vassal of {{object}}", { subject, object }),
    color: "#87CEFA",
    tip: t("Vassal is a state having obligation to its suzerain (selected state)"),
    event: { title: "Vassalization", text: (subject, object) => `${subject} became a vassal of ${object}` }
  },
  Suzerain: {
    label: t("Suzerain"),
    describe: (subject, object) => t("{{subject}} is suzerain to {{object}}", { subject, object }),
    color: "#00008B",
    tip: t("Suzerain is a state having some control over its vassal (selected state)"),
    event: { title: "Vassalization", text: (subject, object) => `${subject} vassalized ${object}` }
  }
};

export const isRelation = (value: string): boolean => Object.hasOwn(RELATIONS, value);

/** the relation the other state holds back */
export const getInverseRelation = (relation: string): string =>
  relation === "Vassal" ? "Suzerain" : relation === "Suzerain" ? "Vassal" : relation;

export const NO_RELATION_COLOR = "#4682b4";

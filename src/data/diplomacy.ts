// Diplomatic relations, keyed by the value a state stores in `diplomacy` for another state

export interface Relation {
  inText: string;
  color: string;
  tip: string;
  /** chronicle record of a state taking up the relation towards another; a generic change record if not set */
  event?: { title: string; text: (subject: string, object: string) => string };
}

export const RELATIONS: Record<string, Relation> = {
  Ally: {
    inText: "is an ally of",
    color: "#00b300",
    tip: "Allies formed a defensive pact and protect each other in case of third party aggression",
    event: { title: "Defence pact", text: (subject, object) => `${subject} entered into defensive pact with ${object}` }
  },
  Friendly: {
    inText: "is friendly to",
    color: "#d4f8aa",
    tip: "State is friendly to another state when they share some common interests"
  },
  Neutral: {
    inText: "is neutral to",
    color: "#edeee8",
    tip: "Neutral means states relations are neither positive nor negative"
  },
  Suspicion: {
    inText: "is suspicious of",
    color: "#eeafaa",
    tip: "Suspicion means state has a cautious distrust of another state"
  },
  Enemy: {
    inText: "is at war with",
    color: "#e64b40",
    tip: "Enemies are states at war with each other",
    event: { title: "War declaration", text: (subject, object) => `${subject} declared a war on its enemy ${object}` }
  },
  Unknown: {
    inText: "does not know about",
    color: "#a9a9a9",
    tip: "Relations are unknown if states do not have enough information about each other",
    event: {
      title: "Relations severance",
      text: (subject, object) => `${subject} recalled their ambassadors and wiped all the records about ${object}`
    }
  },
  Rival: {
    inText: "is a rival of",
    color: "#ad5a1f",
    tip: "Rivalry is a state of competing for dominance in the region",
    event: { title: "Rivalization", text: (subject, object) => `${subject} and ${object} became rivals` }
  },
  Vassal: {
    inText: "is a vassal of",
    color: "#87CEFA",
    tip: "Vassal is a state having obligation to its suzerain (selected state)",
    event: { title: "Vassalization", text: (subject, object) => `${subject} became a vassal of ${object}` }
  },
  Suzerain: {
    inText: "is suzerain to",
    color: "#00008B",
    tip: "Suzerain is a state having some control over its vassal (selected state)",
    event: { title: "Vassalization", text: (subject, object) => `${subject} vassalized ${object}` }
  }
};

export const isRelation = (value: string): boolean => Object.hasOwn(RELATIONS, value);

/** the relation the other state holds back */
export const getInverseRelation = (relation: string): string =>
  relation === "Vassal" ? "Suzerain" : relation === "Suzerain" ? "Vassal" : relation;

export const NO_RELATION_COLOR = "#4682b4";

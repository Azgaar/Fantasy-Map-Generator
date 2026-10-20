// Event text templates for the chronicle; the history generator picks from them at random. See docs/plans/history-generation.md

export type FoundingTemplate = (state: string, culture: string) => string;
export const FOUNDING_TEMPLATES: FoundingTemplate[] = [
  (state, culture) => `The ${state} was founded by the ${culture} people`,
  (state, culture) => `${culture} settlers proclaimed the ${state}`,
  (state, culture) => `The ${state} grew from a ${culture} stronghold on the frontier`,
  (state, culture) => `Chieftains of the ${culture} united to form the ${state}`
];

export type WarTemplate = (name: string, attacker: string, defender: string, start: number, end: number) => string;
export const PAST_WAR_TEMPLATES: WarTemplate[] = [
  (name, attacker, defender, start, end) =>
    `${name} was fought between ${attacker} and ${defender} from ${start} to ${end}`,
  (name, attacker, defender, start, end) =>
    `${name} ravaged the borderlands of ${attacker} and ${defender} between ${start} and ${end}`,
  (name, attacker, defender, start, end) =>
    `${attacker} and ${defender} clashed in ${name}, which lasted from ${start} to ${end}`,
  (name, attacker, defender, start, end) =>
    `${name} ended in exhaustion, with neither ${attacker} nor ${defender} gaining the upper hand (${start}–${end})`
];

export type OngoingWarTemplate = (attacker: string, defender: string) => string;
export const ONGOING_WAR_TEMPLATES: OngoingWarTemplate[] = [
  (attacker, defender) => `${attacker} declared war on ${defender}; the fighting continues`,
  (attacker, defender) => `${attacker} and ${defender} are at war; no peace has been signed`
];

export type SubjugationTemplate = (suzerain: string, vassal: string) => string;
export const SUBJUGATION_TEMPLATES: SubjugationTemplate[] = [
  (suzerain, vassal) => `${suzerain} brought ${vassal} to heel; ${vassal} has paid tribute as its vassal ever since`,
  (suzerain, vassal) => `${vassal} submitted to ${suzerain} after a short campaign, becoming its vassal`,
  (suzerain, vassal) => `The lords of ${vassal} swore fealty to ${suzerain}, binding their lands as a vassal state`
];

export type MigrationTemplate = (child: string, parent: string) => string;
export const MIGRATION_TEMPLATES: MigrationTemplate[] = [
  (child, parent) => `The ${child} culture split from the ${parent}`,
  (child, parent) => `A ${parent} migration birthed the ${child} culture`,
  (child, parent) => `The ${child} people descend from ${parent} wanderers`
];

export type SchismTemplate = (child: string, parent: string) => string;
export const SCHISM_TEMPLATES: Record<string, SchismTemplate[]> = {
  Folk: [
    (child, parent) => `The ${parent} folk belief became the ${child} tradition`,
    (child, parent) => `${child} arose as village interpretations of ${parent} spread`
  ],
  Organized: [
    (child, parent) => `The ${child} faith was organized from the ${parent} tradition`,
    (child, parent) => `Priests of ${parent} organized the ${child} faith`
  ],
  Heresy: [
    (child, parent) => `The ${child} heresy split from the ${parent} church`,
    (child, parent) => `${child} was declared heretical by ${parent}, and its followers split away`
  ],
  Cult: [
    (child, parent) => `The ${child} cult emerged from ${parent} worship`,
    (child, parent) => `Secret rites of ${parent} grew into the ${child} cult`
  ]
};

export type RealmForm = "Empire" | "Dominion" | "Imperium" | "Hegemony"; // single words: the proper name is the rest
export const REALM_FORMS: Record<RealmForm, number> = { Empire: 6, Dominion: 2, Imperium: 2, Hegemony: 1 };

export type RealmFoundingTemplate = (name: string, culture: string) => string;
export const REALM_FOUNDING_TEMPLATES: RealmFoundingTemplate[] = [
  (name, culture) => `${culture} kings proclaimed the ${name}, which came to rule the known world`,
  (name, culture) => `The ${name} rose from the ${culture} heartland, and its word became law`,
  (name, culture) => `${culture} warlords forged the ${name} out of a hundred squabbling realms`
];

export type GoldenAgeTemplate = (name: string) => string;
export const GOLDEN_AGE_TEMPLATES: GoldenAgeTemplate[] = [
  name => `The ${name} reached the height of its power and learning`,
  name => `Under the ${name}, roads were laid, cities swelled and the arts flourished`,
  name => `The ${name} knew peace and plenty; chroniclers call it a golden age`
];

export type FallBattleTemplate = (name: string) => string;
export const FALL_BATTLE_TEMPLATES: FallBattleTemplate[] = [
  name => `The host of the ${name} was shattered in a last great battle on the frontier`,
  name => `The armies of the ${name} met their enemies in the field one final time, and broke`,
  name => `Rebellion and invasion met the ${name} in open battle, and its luck ran out`
];

export type CollapseTemplate = (name: string, year: number, successors: string) => string;
export const COLLAPSE_TEMPLATES: Record<string, CollapseTemplate[]> = {
  collapse: [
    (name, year, successors) => `The ${name} collapsed in ${year}, and its lands were divided among ${successors}`,
    (name, year, successors) => `In ${year} the ${name} fell to ruin; ${successors} rose from its remains`
  ],
  conquest: [
    (name, year, successors) =>
      `The ${name} was broken by invading armies in ${year}; ${successors} inherited what remained`,
    (name, year, successors) => `Invaders sacked the ${name} in ${year}, and ${successors} quarrelled over the spoils`
  ],
  partition: [
    (name, year, successors) => `The ${name} was partitioned in ${year} among ${successors}`,
    (name, year, successors) =>
      `In ${year} the generals of the ${name} divided the realm, and ${successors} each took a piece`
  ]
};

export type IndependenceTemplate = (vassal: string, realm: string) => string;
export const INDEPENDENCE_TEMPLATES: IndependenceTemplate[] = [
  (vassal, realm) => `${vassal} first rose in revolt against the ${realm}, and won its freedom`,
  (vassal, realm) => `${vassal} won its freedom from the ${realm} by the sword`
];

export type RemnantTemplate = (culture: string, realm: string) => string;
export const REMNANT_TEMPLATES: RemnantTemplate[] = [
  (culture, realm) =>
    `Pockets of ${culture} speakers endure in the old ${realm} heartland, relics of imperial resettlement`,
  (culture, realm) => `The ${realm} settled loyal ${culture} families along its roads; their descendants remain`
];

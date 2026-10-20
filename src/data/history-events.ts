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

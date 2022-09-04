import {NAMEBASE as NB} from "config/namebases";

export const NO_BURG: TNoBurg = {i: 0, name: undefined};
export const NEUTRALS: TNeutrals = {i: 0, name: "Neutrals"};

export enum AreaTiers {
  DUCHY = 0,
  GRAND_DUCHY = 1,
  PRINCIPALITY = 2,
  KINGDOM = 3,
  EMPIRE = 4
}

export const StateForms = {
  monarchy: ["Duchy", "Grand Duchy", "Principality", "Kingdom", "Empire"] as const, // per area tier
  republic: {
    Republic: 75,
    Federation: 4,
    "Trade Company": 4,
    "Most Serene Republic": 2,
    Oligarchy: 2,
    Tetrarchy: 1,
    Triumvirate: 1,
    Diarchy: 1,
    Junta: 1
  },
  union: {
    Union: 3,
    League: 4,
    Confederation: 1,
    "United Kingdom": 1,
    "United Republic": 1,
    "United Provinces": 2,
    Commonwealth: 1,
    Heptarchy: 1
  },
  theocracy: {Theocracy: 20, Brotherhood: 1, Thearchy: 2, See: 1, "Holy State": 1},
  anarchy: {"Free Territory": 2, Council: 3, Commune: 1, Community: 1}
};

type TMonarchyForms = typeof StateForms.monarchy[number];

// prettier-ignore
export const culturalMonarchyFormsMap: {[key: number]: {[key in TMonarchyForms]?: string}} = {
  [NB.Ruthenian]: {Kingdom: "Tsardom", Empire: "Tsardom"},
  [NB.Greek]: {Duchy: "Despotate", "Grand Duchy": "Despotate"},
  [NB.Japanese]: {"Grand Duchy": "Shogunate", Kingdom: "Shogunate"},
  [NB.Turkish]: {Duchy: "Beylik", "Grand Duchy": "Horde", Principality: "Great Horde", Kingdom: "Khanate", Empire: "Sultanate"},
  [NB.Berber]: {Duchy: "Sheikhdom", "Grand Duchy": "Emirate", Principality: "Emirate", Empire: "Sultanate"},
  [NB.Arabic]: {Duchy: "Sheikhdom", "Grand Duchy": "Emirate", Principality: "Emirate", Empire: "Sultanate"},
  [NB.Iranian]: {Duchy: "Satrapy", "Grand Duchy": "Satrapy", Kingdom: "Shahdom"},
  [NB.Mongolian]: {Duchy: "Horde", "Grand Duchy": "Horde", Principality: "Ulus", Kingdom: "Khanate", Empire: "Khaganate"}
};

const Catholic = {Duchy: "Diocese", "Grand Duchy": "Аrchdiocese"};
const Orthodox = {
  Duchy: "Eparchy",
  "Grand Duchy": "Eparchy",
  Principality: "Exarchate",
  Kingdom: "Metropolia",
  Empire: "Patriarchate"
};
const Islamic = {
  Duchy: "Imamah",
  "Grand Duchy": "Imamah",
  Principality: "Imamah",
  Kingdom: "Caliphate",
  Empire: "Caliphate"
};

export const culturalTheocracyFormsMap: {[key: number]: {[key in TMonarchyForms]?: string}} = {
  [NB.German]: Catholic,
  [NB.English]: Catholic,
  [NB.French]: Catholic,
  [NB.Italian]: Catholic,
  [NB.Castillian]: Catholic,
  [NB.Roman]: Catholic,
  [NB.Portuguese]: Catholic,
  [NB.Ruthenian]: Orthodox,
  [NB.Ruthenian]: Orthodox,
  [NB.Turkish]: Islamic,
  [NB.Nigerian]: Islamic,
  [NB.Berber]: Islamic,
  [NB.Arabic]: Islamic,
  [NB.Iranian]: Islamic,
  [NB.Swahili]: Islamic
};

// state forms requiring Adjective + Name, all other forms use scheme Form + Of + Name
export const adjectivalForms = [
  "Empire",
  "Sultanate",
  "Khaganate",
  "Shogunate",
  "Caliphate",
  "Despotate",
  "Theocracy",
  "Oligarchy",
  "Union",
  "Confederation",
  "Trade Company",
  "League",
  "Tetrarchy",
  "Triumvirate",
  "Diarchy",
  "Horde",
  "Marches"
];

export const relations = {
  neighbors: {Ally: 1, Friendly: 2, Neutral: 1, Suspicion: 10, Rival: 9},
  neighborsOfNeighbors: {Ally: 10, Friendly: 8, Neutral: 5, Suspicion: 1},
  farStates: {Friendly: 1, Neutral: 12, Suspicion: 2},
  navalToNaval: {Neutral: 2, Suspicion: 2, Rival: 1}
};

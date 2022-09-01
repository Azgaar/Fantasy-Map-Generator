import * as d3 from "d3";

import type {TStateStatistics} from "./collectStatistics";

const generic = {Monarchy: 25, Republic: 2, Union: 1};
const naval = {Monarchy: 25, Republic: 8, Union: 3};

const republic = {
  Republic: 75,
  Federation: 4,
  "Trade Company": 4,
  "Most Serene Republic": 2,
  Oligarchy: 2,
  Tetrarchy: 1,
  Triumvirate: 1,
  Diarchy: 1,
  Junta: 1
};

const union = {
  Union: 3,
  League: 4,
  Confederation: 1,
  "United Kingdom": 1,
  "United Republic": 1,
  "United Provinces": 2,
  Commonwealth: 1,
  Heptarchy: 1
};

const theocracy = {Theocracy: 20, Brotherhood: 1, Thearchy: 2, See: 1, "Holy State": 1};

const anarchy = {"Free Territory": 2, Council: 3, Commune: 1, Community: 1};

const monarchy = ["Duchy", "Grand Duchy", "Principality", "Kingdom", "Empire"]; // per area tier

enum AreaTiers {
  DUCHY = 0,
  GRAND_DUCHY = 1,
  PRINCIPALITY = 2,
  KINGDOM = 3,
  EMPIRE = 4
}

// create 5 area tiers, where 4 are the biggest, 0 the smallest
export function createAreaTiers(statistics: TStateStatistics) {
  const stateAreas = Object.entries(statistics)
    .filter(([id]) => Number(id))
    .map(([, {area}]) => area);
  const medianArea = d3.median(stateAreas)!;

  const topTierIndex = Math.max(Math.ceil(stateAreas.length ** 0.4) - 2, 0);
  const minTopTierArea = stateAreas.sort((a, b) => b - a)[topTierIndex];

  return (area: number) => {
    const tier = Math.min(Math.floor((area / medianArea) * 2.6), 4) as AreaTiers;
    if (tier === AreaTiers.EMPIRE && area < minTopTierArea) return AreaTiers.KINGDOM;
    return tier;
  };
}

export function defineStateForm(type: TCultureType, areaTier: AreaTiers) {
  return {form: "testForm", formName: "testFormName"};
}

import * as d3 from "d3";

import {NAMEBASE} from "config/namebases";
import {getInputNumber} from "utils/nodeUtils";
import {P, rand, rw} from "utils/probabilityUtils";
import {AreaTiers, culturalMonarchyFormsMap, culturalTheocracyFormsMap, StateForms} from "./config";
import type {TStateStatistics} from "./collectStatistics";

// create 5 area tiers, 4 is the biggest, 0 the smallest
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

export function defineStateForm(
  type: TCultureType,
  areaTier: AreaTiers,
  nameBase: number,
  burgsNumber: number,
  neighbors: number[],
  isVassal: boolean
) {
  const form = defineForm(type, areaTier);
  const formName = defineFormName(form, nameBase, areaTier, burgsNumber, neighbors, isVassal);

  return {form, formName};
}

const generic = {Monarchy: 25, Republic: 2, Union: 1};
const naval = {Monarchy: 6, Republic: 2, Union: 1};

function defineForm(type: TCultureType, areaTier: AreaTiers): TStateForm {
  const isAnarchy = P((1 - areaTier / 5) / 100); // [1% - 0.2%] chance
  if (isAnarchy) return "Anarchy";

  // TODO: define Theocracies based on actual religion spread
  const religionsNumberModifier = Math.min(getInputNumber("religionsInput") / 10, 2.5); // [0-2.5]
  const isTheocracy = P(0.2 * religionsNumberModifier); // [0% - 50%] chance, av. 12%
  if (isTheocracy) return "Theocracy";

  if (type === "Naval") return rw(naval);

  return rw(generic);
}

function defineFormName(
  form: ReturnType<typeof defineForm>,
  nameBase: number,
  areaTier: AreaTiers,
  burgsNumber: number,
  neighbors: number[],
  isVassal: boolean
) {
  if (form === "Monarchy") return defineMonarchyForm(nameBase, areaTier, neighbors, isVassal);
  if (form === "Republic") return defineRepublicForm(areaTier, burgsNumber);
  if (form === "Union") return rw(StateForms.union);
  if (form === "Theocracy") return defineTheocracyForm(nameBase, areaTier);
  if (form === "Anarchy") return rw(StateForms.anarchy);

  throw new Error("Unknown state form: " + form);
}

// Default name depends on area tier, some name bases have special names for tiers
function defineMonarchyForm(nameBase: number, areaTier: AreaTiers, neighbors: number[], isVassal: boolean) {
  const form = StateForms.monarchy[areaTier];

  if (isVassal) {
    if (areaTier === AreaTiers.DUCHY && neighbors.length > 1 && rand(6) < neighbors.length) return "Marches";
    if (nameBase === NAMEBASE.English && P(0.3)) return "Dominion";
    if (P(0.3)) return "Protectorate";
  }

  if (culturalMonarchyFormsMap[nameBase]) {
    const culturalForm = culturalMonarchyFormsMap[nameBase][form];
    if (culturalForm) return culturalForm;
  }

  return form;
}

// Default name is from weighted array, special case for small states with only 1 burg
function defineRepublicForm(areaTier: AreaTiers, burgsNumber: number) {
  if (areaTier < AreaTiers.PRINCIPALITY && burgsNumber === 1) return P(0.7) ? "Free City" : "City-state";
  return rw(StateForms.republic);
}

function defineTheocracyForm(nameBase: number, areaTier: AreaTiers) {
  const form = StateForms.monarchy[areaTier];

  if (P(0.05)) return "Divine " + form; // 5%

  if (culturalTheocracyFormsMap[nameBase]) {
    const culturalForm = culturalTheocracyFormsMap[nameBase][form];
    if (culturalForm) return culturalForm;
  }

  return rw(StateForms.theocracy);
}

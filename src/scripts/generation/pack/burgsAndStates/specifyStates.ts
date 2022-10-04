import {TIME} from "config/logging";
import {NEUTRALS} from "./config";
import {createAreaTiers, defineStateForm} from "./defineStateForm";
import {defineFullStateName, defineStateName} from "./defineStateName";
import {defineStateColors} from "./defineStateColors";
import {isBurg} from "utils/typeUtils";
import {generateConflicts} from "./generateConflicts";
import {defineWarAlert} from "./defineWarAlert";

import type {TStateStatistics} from "./collectStatistics";
import type {TStateData} from "./createStateData";
import type {TDiplomacy} from "./generateRelations";

export function specifyStates(
  statesData: TStateData[],
  statistics: TStateStatistics,
  diplomacy: TDiplomacy,
  poles: Dict<TPoint>,
  cultures: TCultures,
  burgs: TBurgs
): {states: TStates; conflicts: IConflict[]} {
  TIME && console.time("specifyStates");

  const colors = defineStateColors(statistics);
  const getNameBase = (cultureId: number) => cultures[cultureId].base;

  const stateAreas = getStateAreas(statistics);
  const totalArea = stateAreas.reduce((a, b) => a + b);
  const totalExpansionism = statesData.map(state => state.expansionism).reduce((a, b) => a + b);
  const getAreaTier = createAreaTiers(stateAreas);

  const states = statesData.map(stateData => {
    const {i, center, type, culture, capital, expansionism} = stateData;
    const {area, burgs: burgsNumber, neighbors, ...stats} = statistics[i];
    const color = colors[i];

    const capitalBurg = burgs[capital];
    const capitalName = isBurg(capitalBurg) ? capitalBurg.name : null;
    if (!capitalName) throw new Error("State capital is not a burg");

    const relations = diplomacy[i];
    const isVassal = relations.includes("Vassal");
    const alert = defineWarAlert(neighbors, relations, area / totalArea, expansionism / totalExpansionism);

    const nameBase = getNameBase(culture);
    const areaTier = getAreaTier(area);
    const {form, formName} = defineStateForm(type, areaTier, nameBase, burgsNumber, neighbors, isVassal);
    const name = defineStateName(center, capitalName, nameBase, formName);
    const fullName = defineFullStateName(name, formName);

    const pole = poles[i];

    const state: IState = {
      name,
      ...stateData,
      form,
      formName,
      fullName,
      color,
      area,
      burgs: burgsNumber,
      ...stats,
      neighbors,
      relations,
      alert,
      pole
    };
    return state;
  });

  const conflicts = generateConflicts(states, cultures); // mutates states

  TIME && console.timeEnd("specifyStates");
  return {states: [NEUTRALS, ...states], conflicts};
}

function getStateAreas(statistics: TStateStatistics) {
  return Object.entries(statistics)
    .filter(([id]) => Number(id))
    .map(([, {area}]) => area);
}

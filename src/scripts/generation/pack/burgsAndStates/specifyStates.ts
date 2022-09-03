import {TIME} from "config/logging";
import {getColors} from "utils/colorUtils";
import {NEUTRALS} from "./config";
import {createAreaTiers, defineStateForm} from "./defineStateForm";
import {defineFullStateName, defineStateName} from "./defineStateName";
import {isBurg} from "utils/typeUtils";

import type {TStateStatistics} from "./collectStatistics";
import type {TStateData} from "./createStateData";

export function specifyStates(
  statesData: TStateData[],
  statistics: TStateStatistics,
  cultures: TCultures,
  burgs: TBurgs
): TStates {
  TIME && console.time("specifyStates");

  const colors = getColors(statesData.length);
  const getAreaTier = createAreaTiers(statistics);
  const getNameBase = (cultureId: number) => cultures[cultureId].base;

  const states: IState[] = statesData.map((stateData, index) => {
    const {i, center, type, culture, capital} = stateData;
    const {area, burgs: burgsNumber, ...stats} = statistics[i];

    const capitalBurg = burgs[capital];
    const capitalName = isBurg(capitalBurg) ? capitalBurg.name : null;
    if (!capitalName) throw new Error("State capital is not a burg");

    const nameBase = getNameBase(culture);
    const areaTier = getAreaTier(area);
    const {form, formName} = defineStateForm(type, areaTier, nameBase, burgsNumber);
    const name = defineStateName(center, capitalName, nameBase, formName);
    const fullName = defineFullStateName(name, formName);

    const color = colors[index];

    const state: IState = {name, ...stateData, form, formName, fullName, color, area, burgs: burgsNumber, ...stats};
    return state;
  });

  TIME && console.timeEnd("specifyStates");
  return [NEUTRALS, ...states];
}

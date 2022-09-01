import {TIME} from "config/logging";
import {getColors} from "utils/colorUtils";
import {NEUTRALS} from "./config";
import {createAreaTiers, defineStateForm} from "./defineStateForm";
import {defineFullStateName} from "./defineStateName";

import type {TStateStatistics} from "./collectStatistics";
import type {TStateData} from "./createStateData";

export function specifyStates(
  statesData: TStateData[],
  statistics: TStateStatistics,
  stateIds: Uint16Array,
  burgIds: Uint16Array
): TStates {
  TIME && console.time("specifyState");

  const colors = getColors(statesData.length);
  const getAreaTier = createAreaTiers(statistics);

  const states: IState[] = statesData.map((stateData, index) => {
    const {i, type, name} = stateData;
    const {area, ...stats} = statistics[i];

    const areaTier = getAreaTier(area);
    const {form, formName} = defineStateForm(type, areaTier);
    const fullName = defineFullStateName(name, form);

    const color = colors[index];

    const state: IState = {...stateData, form, formName, fullName, color, area, ...stats};
    return state;
  });

  TIME && console.timeEnd("specifyState");
  return [NEUTRALS, ...states];
}

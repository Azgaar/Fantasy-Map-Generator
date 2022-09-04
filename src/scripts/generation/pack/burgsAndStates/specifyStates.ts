import {TIME} from "config/logging";
import {NEUTRALS} from "./config";
import {createAreaTiers, defineStateForm} from "./defineStateForm";
import {defineFullStateName, defineStateName} from "./defineStateName";
import {defineStateColors} from "./defineStateColors";
import {isBurg} from "utils/typeUtils";

import type {TStateStatistics} from "./collectStatistics";
import type {TStateData} from "./createStateData";
import type {TDiplomacy} from "./generateDiplomacy";

export function specifyStates(
  statesData: TStateData[],
  statistics: TStateStatistics,
  diplomacy: TDiplomacy,
  cultures: TCultures,
  burgs: TBurgs
): TStates {
  TIME && console.time("specifyStates");

  const colors = defineStateColors(statistics);
  const getAreaTier = createAreaTiers(statistics);
  const getNameBase = (cultureId: number) => cultures[cultureId].base;

  const states: IState[] = statesData.map(stateData => {
    const {i, center, type, culture, capital} = stateData;
    const {area, burgs: burgsNumber, ...stats} = statistics[i];
    const color = colors[i];

    const capitalBurg = burgs[capital];
    const capitalName = isBurg(capitalBurg) ? capitalBurg.name : null;
    if (!capitalName) throw new Error("State capital is not a burg");

    const nameBase = getNameBase(culture);
    const areaTier = getAreaTier(area);
    const {form, formName} = defineStateForm(type, areaTier, nameBase, burgsNumber);
    const name = defineStateName(center, capitalName, nameBase, formName);
    const fullName = defineFullStateName(name, formName);

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
      diplomacy: diplomacy[i]
    };
    return state;
  });

  TIME && console.timeEnd("specifyStates");
  return [NEUTRALS, ...states];
}

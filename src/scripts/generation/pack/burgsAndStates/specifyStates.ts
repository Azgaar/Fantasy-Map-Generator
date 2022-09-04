import {TIME} from "config/logging";
import {NEUTRALS} from "./config";
import {createAreaTiers, defineStateForm} from "./defineStateForm";
import {defineFullStateName, defineStateName} from "./defineStateName";
import {defineStateColors} from "./defineStateColors";
import {isBurg} from "utils/typeUtils";
import {generateConflicts} from "./generateConflicts";

import type {TStateStatistics} from "./collectStatistics";
import type {TStateData} from "./createStateData";
import type {TDiplomacy} from "./generateRelations";

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
    const {area, burgs: burgsNumber, neighbors, ...stats} = statistics[i];
    const color = colors[i];

    const capitalBurg = burgs[capital];
    const capitalName = isBurg(capitalBurg) ? capitalBurg.name : null;
    if (!capitalName) throw new Error("State capital is not a burg");

    const relations = diplomacy[i];
    const isVassal = relations.includes("Vassal");

    const nameBase = getNameBase(culture);
    const areaTier = getAreaTier(area);
    const {form, formName} = defineStateForm(type, areaTier, nameBase, burgsNumber, neighbors, isVassal);
    const name = defineStateName(center, capitalName, nameBase, formName);
    const fullName = defineFullStateName(name, formName);

    return {
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
      relations
    };
  });

  const wars = generateConflicts(states); // mutates states
  console.log(wars);
  console.log(states);

  TIME && console.timeEnd("specifyStates");
  return [NEUTRALS, ...states];
}

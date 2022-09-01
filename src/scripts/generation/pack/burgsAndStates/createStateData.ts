import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {rn} from "utils/numberUtils";
import type {createCapitals} from "./createCapitals";
import {defineStateName} from "./defineStateName";
import {generateStateEmblem} from "./generateStateEmblem";

type TCapitals = ReturnType<typeof createCapitals>;
export type TStateData = Pick<
  IState,
  "i" | "name" | "type" | "culture" | "center" | "expansionism" | "capital" | "coa"
>;

export function createStateData(capitals: TCapitals, cultures: TCultures) {
  TIME && console.time("createStates");

  const powerInput = getInputNumber("powerInput");

  const statesData: TStateData[] = capitals.map((capital, index) => {
    const {cell: cellId, culture: cultureId, name: capitalName} = capital;
    const id = index + 1;
    const name = defineStateName(cellId, capitalName, cultureId, cultures);

    const {type, shield} = cultures[cultureId] as ICulture;
    const expansionism = rn(Math.random() * powerInput + 1, 1);

    const coa = generateStateEmblem(type, shield);

    return {i: id, name, type, center: cellId, expansionism, capital: id, culture: cultureId, coa};
  });

  TIME && console.timeEnd("createStates");
  return statesData;
}

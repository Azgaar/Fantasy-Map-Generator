import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {rn} from "utils/numberUtils";
import type {createCapitals} from "./createCapitals";
import {generateStateEmblem} from "./generateStateEmblem";

type TCapitals = ReturnType<typeof createCapitals>;
export type TStateData = Pick<IState, "i" | "type" | "culture" | "center" | "expansionism" | "capital" | "coa">;

export function createStateData(capitals: TCapitals, cultures: TCultures) {
  TIME && console.time("createStates");

  const powerInput = getInputNumber("powerInput");

  const statesData: TStateData[] = capitals.map((capital, index) => {
    const {cell: cellId, culture: cultureId} = capital;
    const id = index + 1;

    if (cultureId === 0) throw new Error("Culture id cannot be 0");
    const {type, shield} = cultures[cultureId] as ICulture;
    const expansionism = rn(Math.random() * powerInput + 1, 1);
    const coa = generateStateEmblem(type, shield);

    return {i: id, type, center: cellId, expansionism, capital: id, culture: cultureId, coa};
  });

  TIME && console.timeEnd("createStates");
  return statesData;
}

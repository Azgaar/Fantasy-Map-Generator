import {TIME} from "config/logging";
import {getDefaultMilitaryOptions} from "config/military";
import {isState} from "utils/typeUtils";
import {generatePlatoons} from "./generatePlatoons";
import {generateRegiments} from "./generateRegiments";
import {getUnitModifiers} from "./getUnitModifiers";

export type TCellsData = Pick<
  IPack["cells"],
  "i" | "p" | "h" | "f" | "haven" | "pop" | "biome" | "culture" | "state" | "burg" | "province" | "religion"
>;

export function generateMilitary(states: TStates, burgs: TBurgs, provinces: TProvinces, cells: TCellsData) {
  TIME && console.time("generateMilitaryForces");

  if (!options.military) options.military = getDefaultMilitaryOptions();

  const unitModifiers = getUnitModifiers(states);
  const platoons = generatePlatoons(states, burgs, unitModifiers, cells);

  for (const state of states) {
    if (!isState(state)) continue;

    state.regiments = generateRegiments({
      stateId: state.i,
      platoons: platoons[state.i],
      states,
      provinceIds: cells.province,
      provinces,
      burgIds: cells.burg,
      burgs
    });
  }

  console.log({states});

  TIME && console.timeEnd("generateMilitaryForces");
}

import {TIME} from "config/logging";
import {getDefaultMilitaryOptions} from "config/military";
import {getUnitModifiers} from "./getUnitModifiers";

export function generateMilitary(states: TStates) {
  TIME && console.time("generateMilitaryForces");

  if (!options.military) options.military = getDefaultMilitaryOptions();

  // const unitModifiers = getUnitModifiers(states);

  console.log(states);

  TIME && console.timeEnd("generateMilitaryForces");
}

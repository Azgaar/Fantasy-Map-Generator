import {TIME} from "config/logging";
import {getDefaultMilitaryOptions} from "config/military";
import {generatePlatoons} from "./generatePlatoons";
import {getUnitModifiers} from "./getUnitModifiers";

export type TCellsData = Pick<
  IPack["cells"],
  "i" | "p" | "h" | "f" | "haven" | "pop" | "biome" | "culture" | "state" | "burg" | "religion"
>;

export interface IPlatoon {
  unit: IMilitaryUnit;
  cell: number;
  a: number;
  t: number;
  x: number;
  y: number;
}

export function generateMilitary(states: TStates, burgs: TBurgs, cells: TCellsData) {
  TIME && console.time("generateMilitaryForces");

  if (!options.military) options.military = getDefaultMilitaryOptions();

  const unitModifiers = getUnitModifiers(states);
  const platoons = generatePlatoons(states, unitModifiers, cells);

  console.log({states, unitModifiers, platoons});

  TIME && console.timeEnd("generateMilitaryForces");
}

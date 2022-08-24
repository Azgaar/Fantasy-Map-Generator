import {TIME} from "config/logging";
import {unique} from "utils/arrayUtils";
import {findAll} from "utils/graphUtils";
import {generateFolkReligions} from "./generateFolkReligions";
import {generateOrganizedReligionsAndCults} from "./generateOrganizedReligionsAndCults";

type TCellsData = Pick<IPack["cells"], "i" | "c" | "p" | "g" | "h" | "t" | "biome" | "pop" | "burg">;

export function generateReligions({
  states,
  cultures,
  burgs,
  cultureIds,
  stateIds,
  burgIds,
  cells
}: {
  states: TStates;
  cultures: TCultures;
  burgs: TBurgs;
  cultureIds: Uint16Array;
  stateIds: Uint16Array;
  burgIds: Uint16Array;
  cells: TCellsData;
}) {
  TIME && console.time("generateReligions");

  const religionIds = new Uint16Array(cells.c.length);

  const folkReligions = generateFolkReligions(cultures);
  const basicReligions = generateOrganizedReligionsAndCults(
    states,
    cultures,
    burgs,
    cultureIds,
    stateIds,
    burgIds,
    folkReligions,
    {
      i: cells.i,
      p: cells.p,
      pop: cells.pop
    }
  );

  console.log(folkReligions, basicReligions);

  TIME && console.timeEnd("generateReligions");
  return {religionIds};
}

function getReligionsInRadius(
  religionIds: Uint16Array,
  {x, y, r, max}: {x: number; y: number; r: number; max: number}
) {
  if (max === 0) return [0];
  const cellsInRadius = findAll(x, y, r);
  const religions = unique(cellsInRadius.map(i => religionIds[i]).filter(r => r));
  return religions.length ? religions.slice(0, max) : [0];
}

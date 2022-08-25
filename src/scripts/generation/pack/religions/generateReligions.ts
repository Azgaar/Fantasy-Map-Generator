import {TIME} from "config/logging";
import {pick} from "utils/functionUtils";
import {generateFolkReligions} from "./generateFolkReligions";
import {generateOrganizedReligions} from "./generateOrganizedReligions";
import {specifyReligions} from "./specifyReligions";

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

  const folkReligions = generateFolkReligions(cultures);
  const basicReligions = generateOrganizedReligions(burgs, cultureIds, pick(cells, "i", "p", "pop"));
  const {religions, religionIds} = specifyReligions(
    [...folkReligions, ...basicReligions],
    stateIds,
    burgIds,
    cultures,
    states,
    burgs,
    cells.p
  );

  console.log(religions);

  TIME && console.timeEnd("generateReligions");
  return {religionIds, religions};
}

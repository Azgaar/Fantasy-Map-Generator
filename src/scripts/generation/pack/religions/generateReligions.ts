import {TIME} from "config/logging";
import {pick} from "utils/functionUtils";
import {generateFolkReligions} from "./generateFolkReligions";
import {generateOrganizedReligions} from "./generateOrganizedReligions";
import {specifyReligions} from "./specifyReligions";

type TCellsData = Pick<
  IPack["cells"],
  "i" | "c" | "p" | "g" | "h" | "t" | "biome" | "pop" | "culture" | "burg" | "state" | "route"
>;

export function generateReligions({
  states,
  cultures,
  burgs,
  cells
}: {
  states: TStates;
  cultures: TCultures;
  burgs: TBurgs;
  cells: TCellsData;
}) {
  TIME && console.time("generateReligions");

  const folkReligions = generateFolkReligions(cultures);
  const basicReligions = generateOrganizedReligions(burgs, pick(cells, "i", "p", "pop", "culture"));
  const {religions, religionIds} = specifyReligions(
    [...folkReligions, ...basicReligions],
    cultures,
    states,
    burgs,
    pick(cells, "i", "c", "biome", "culture", "burg", "state", "route")
  );

  TIME && console.timeEnd("generateReligions");
  return {religionIds, religions};
}

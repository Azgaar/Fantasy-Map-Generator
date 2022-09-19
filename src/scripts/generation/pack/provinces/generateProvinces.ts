import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {expandProvinces} from "./expandProvinces";
import {generateCoreProvinces} from "./generateCoreProvinces";
import {generateWildProvinces} from "./generateWildProvinces";
import {specifyProvinces} from "./specifyProvinces";

export function generateProvinces(
  states: TStates,
  burgs: TBurgs,
  cultures: TCultures,
  features: TPackFeatures,
  vertices: IGraphVertices,
  cells: Pick<IPack["cells"], "i" | "c" | "v" | "h" | "t" | "f" | "culture" | "state" | "burg">
): {provinceIds: Uint16Array; provinces: TProvinces} {
  TIME && console.time("generateProvinces");

  const percentage = getInputNumber("provincesInput");
  if (states.length < 2 || percentage === 0) return {provinceIds: new Uint16Array(cells.i.length), provinces: [0]};

  const coreProvinces = generateCoreProvinces(states, burgs, cultures, percentage);
  const provinceIds = expandProvinces(percentage, coreProvinces, cells);

  const wildProvinces = generateWildProvinces({
    states,
    burgs,
    cultures,
    features,
    coreProvinces,
    provinceIds,
    percentage,
    cells
  }); // mutates provinceIds

  const provinces = specifyProvinces(provinceIds, coreProvinces, wildProvinces, vertices, cells.c, cells.v);

  TIME && console.timeEnd("generateProvinces");
  return {provinceIds, provinces};
}

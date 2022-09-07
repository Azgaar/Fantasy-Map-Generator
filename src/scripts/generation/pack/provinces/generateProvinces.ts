import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {expandProvinces} from "./expandProvinces";
import {generateCoreProvinces} from "./generateCoreProvinces";
import {generateWildProvinces} from "./generateWildProvinces";

export function generateProvinces(
  states: TStates,
  burgs: TBurgs,
  cultures: TCultures,
  features: TPackFeatures,
  cells: Pick<IPack["cells"], "i" | "c" | "h" | "t" | "f" | "culture" | "state" | "burg">
) {
  TIME && console.time("generateProvinces");

  const percentage = getInputNumber("provincesInput");
  if (states.length < 2 || percentage === 0)
    return {provinceIds: new Uint16Array(cells.i.length), provinces: [] as TProvinces[]};

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

  const provinces = [...coreProvinces, ...wildProvinces];

  TIME && console.timeEnd("generateProvinces");
  return {provinceIds, provinces};
}

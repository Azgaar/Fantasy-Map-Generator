import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {expandProvinces} from "./expandProvinces";
import {generateCoreProvinces} from "./generateCoreProvinces";

export function generateProvinces(
  states: TStates,
  burgs: TBurgs,
  cultures: TCultures,
  cells: Pick<IPack["cells"], "i">
) {
  TIME && console.time("generateProvinces");

  const percentage = getInputNumber("provincesInput");
  if (states.length < 2 || percentage === 0)
    return {provinceIds: new Uint16Array(cells.i.length), provinces: [] as TProvinces[]};

  const coreProvinces = generateCoreProvinces(states, burgs, cultures, percentage);
  const provinceIds = expandProvinces(percentage, cells);

  const provinces = [...coreProvinces];

  TIME && console.timeEnd("generateProvinces");
  return {provinceIds, provinces};
}

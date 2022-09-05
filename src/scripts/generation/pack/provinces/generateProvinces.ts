import {TIME} from "config/logging";
import {getInputNumber} from "utils/nodeUtils";
import {gauss} from "utils/probabilityUtils";

const forms = {
  Monarchy: {County: 22, Earldom: 6, Shire: 2, Landgrave: 2, Margrave: 2, Barony: 2, Captaincy: 1, Seneschalty: 1},
  Republic: {Province: 6, Department: 2, Governorate: 2, District: 1, Canton: 1, Prefecture: 1},
  Theocracy: {Parish: 3, Deanery: 1},
  Union: {Province: 1, State: 1, Canton: 1, Republic: 1, County: 1, Council: 1},
  Anarchy: {Council: 1, Commune: 1, Community: 1, Tribe: 1},
  Wild: {Territory: 10, Land: 5, Region: 2, Tribe: 1, Clan: 1, Dependency: 1, Area: 1}
};

export function generateProvinces(states: TStates, cells: Pick<IPack["cells"], "i">) {
  TIME && console.time("generateProvinces");

  const provinceIds = new Uint16Array(cells.i.length);
  const provinces = [] as TProvinces;

  const percentage = getInputNumber("provincesInput");
  if (states.length < 2 || percentage === 0) return {provinceIds, provinces};

  const maxGrowth = percentage === 100 ? 1000 : gauss(20, 5, 5, 100) * percentage ** 0.5;

  TIME && console.timeEnd("generateProvinces");
  return {provinceIds, provinces};
}

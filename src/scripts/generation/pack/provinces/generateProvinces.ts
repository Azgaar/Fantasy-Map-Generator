import {TIME} from "config/logging";

export function generateProvinces() {
  TIME && console.time("generateProvinces");

  const provinceIds = new Uint16Array(1000); // cells.i.length
  const provinces = [] as TProvinces;

  TIME && console.timeEnd("generateProvinces");
  return {provinceIds, provinces};
}

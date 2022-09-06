import {gauss} from "utils/probabilityUtils";

export function expandProvinces(percentage: number, cells: Pick<IPack["cells"], "i">) {
  const provinceIds = new Uint16Array(cells.i.length);

  const maxGrowth = percentage === 100 ? 1000 : gauss(20, 5, 5, 100) * percentage ** 0.5;

  return provinceIds;
}

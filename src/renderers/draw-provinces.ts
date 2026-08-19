import { ensureEl, getIsolines } from "@/utils";
import { buildFillPaths } from "./isoline-fills";

export function drawProvinces(): void {
  TIME && console.time("drawProvinces");
  const { cells, provinces } = pack;

  const isolines = getIsolines(pack, cellId => cells.province[cellId], { fill: true, waterGap: true });
  const bodyPaths = buildFillPaths("province", isolines, index => provinces[index].color!);
  ensureEl("provs").innerHTML = /* html */ `<g id="provincesBody">${bodyPaths}</g>`;

  TIME && console.timeEnd("drawProvinces");
}

import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { getIsolines } from "@/utils/path-utils";
import { buildFillPaths } from "./isoline-fills";

export function drawProvinces(): void {
  log.time("drawProvinces");
  const { cells, provinces } = pack;

  const isolines = getIsolines(pack, cellId => cells.province[cellId], { fill: true, waterGap: true });
  const bodyPaths = buildFillPaths("province", isolines, index => provinces[index].color!);
  ensureEl("provs").innerHTML = /* html */ `<g id="provincesBody">${bodyPaths}</g>`;

  log.timeEnd("drawProvinces");
}

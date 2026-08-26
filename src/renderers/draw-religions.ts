import { ensureEl, getIsolines, timeEnd, timeStart } from "@/utils";
import { buildFillPaths } from "./isoline-fills";

export function drawReligions(): void {
  TIME && timeStart("drawReligions");
  const { cells, religions } = pack;

  const isolines = getIsolines(pack, cellId => cells.religion[cellId], { fill: true, waterGap: true });
  ensureEl("relig").innerHTML = buildFillPaths("religion", isolines, index => religions[index].color!);

  TIME && timeEnd("drawReligions");
}

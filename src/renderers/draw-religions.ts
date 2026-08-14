import { ensureEl, getIsolines } from "@/utils";
import { buildFillPaths } from "./isoline-fills";

export function drawReligions(): void {
  TIME && console.time("drawReligions");
  const { cells, religions } = pack;

  const isolines = getIsolines(pack, cellId => cells.religion[cellId], { fill: true, waterGap: true });
  ensureEl("relig").innerHTML = buildFillPaths("religion", isolines, index => religions[index].color!);

  TIME && console.timeEnd("drawReligions");
}

import { ensureEl, getIsolines, timeEnd, timeStart } from "@/utils";
import { buildFillPaths } from "./isoline-fills";

export function drawBiomes(): void {
  TIME && timeStart("drawBiomes");

  const isolines = getIsolines(pack, cellId => pack.cells.biome[cellId], { fill: true, waterGap: true });
  ensureEl("biomes").innerHTML = buildFillPaths("biome", isolines, index => pack.biomes[index].color);

  TIME && timeEnd("drawBiomes");
}

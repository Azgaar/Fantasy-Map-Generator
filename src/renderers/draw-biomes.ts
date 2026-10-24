import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { getIsolines } from "@/utils/path-utils";
import { buildFillPaths } from "./isoline-fills";

export function drawBiomes(): void {
  log.time("drawBiomes");

  const isolines = getIsolines(pack, cellId => pack.cells.biome[cellId], { fill: true, waterGap: true });
  ensureEl("biomes").innerHTML = buildFillPaths("biome", isolines, index => pack.biomes[index].color);

  log.timeEnd("drawBiomes");
}

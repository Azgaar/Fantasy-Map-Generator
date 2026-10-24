import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { getIsolines } from "@/utils/path-utils";
import { buildFillPaths } from "./isoline-fills";

export function drawReligions(): void {
  log.time("drawReligions");
  const { cells, religions } = pack;

  const isolines = getIsolines(pack, cellId => cells.religion[cellId], { fill: true, waterGap: true });
  ensureEl("relig").innerHTML = buildFillPaths("religion", isolines, index => religions[index].color!);

  log.timeEnd("drawReligions");
}

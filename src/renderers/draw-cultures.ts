import { log } from "@/utils/logger";
import { ensureEl } from "@/utils/node-utils";
import { getIsolines } from "@/utils/path-utils";
import { buildFillPaths } from "./isoline-fills";

export function drawCultures(): void {
  log.time("drawCultures");
  const { cells, cultures } = pack;

  const isolines = getIsolines(pack, cellId => cells.culture[cellId], { fill: true, waterGap: true });
  ensureEl("cults").innerHTML = buildFillPaths("culture", isolines, index => cultures[index].color!);

  log.timeEnd("drawCultures");
}

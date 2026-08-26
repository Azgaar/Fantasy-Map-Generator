import { ensureEl, getIsolines, timeEnd, timeStart } from "@/utils";
import { buildFillPaths } from "./isoline-fills";

export function drawCultures(): void {
  TIME && timeStart("drawCultures");
  const { cells, cultures } = pack;

  const isolines = getIsolines(pack, cellId => cells.culture[cellId], { fill: true, waterGap: true });
  ensureEl("cults").innerHTML = buildFillPaths("culture", isolines, index => cultures[index].color!);

  TIME && timeEnd("drawCultures");
}

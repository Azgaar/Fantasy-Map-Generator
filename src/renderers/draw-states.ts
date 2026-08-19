import { color as d3Color } from "d3";
import { ensureEl, getIsolines } from "@/utils";
import { buildFillPaths } from "./isoline-fills";

export function drawStates(): void {
  TIME && console.time("drawStates");
  const { cells, states } = pack;

  const renderHalo = ensureEl<HTMLSelectElement>("shapeRendering").value === "geometricPrecision";
  const isolines = getIsolines(pack, cellId => cells.state[cellId], { fill: true, waterGap: true, halo: renderHalo });

  const clipPaths: string[] = [];
  const haloPaths: string[] = [];
  if (renderHalo) {
    for (const [index, { halo }] of Object.entries(isolines)) {
      const haloColor = d3Color(states[+index].color!)?.darker().hex() || "#666666";
      clipPaths.push(/* html */ `<clipPath id="state-clip${index}"><use href="#state${index}"/></clipPath>`);
      haloPaths.push(
        /* html */ `<path id="state-border${index}" d="${halo}" clip-path="url(#state-clip${index})" stroke="${haloColor}"/>`
      );
    }
  }

  ensureEl("statesBody").innerHTML = buildFillPaths("state", isolines, index => states[index].color!);
  ensureEl("statePaths").innerHTML = clipPaths.join("");
  ensureEl("statesHalo").innerHTML = haloPaths.join("");

  TIME && console.timeEnd("drawStates");
}

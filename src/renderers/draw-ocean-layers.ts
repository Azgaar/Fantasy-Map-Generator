import { curveBasisClosed, line } from "d3";
import { generateOceanOutlines, getOceanLimits } from "@/generators/ocean-layers-generator";
import { ensureEl, rn, round } from "@/utils";

const lineGen = line().curve(curveBasisClosed);

/** the ocean outline rings, stacked from the coast outwards so the overlap deepens the shade */
export function drawOceanLayers(): void {
  const oceanLayers = ensureEl<SVGGElement>("oceanLayers");
  removeOceanLayers();

  const limits = getOceanLimits(oceanLayers.getAttribute("layers") ?? "");
  if (!limits.length) return;

  TIME && console.time("drawOceanLayers");

  const opacity = rn(0.4 / limits.length, 2);
  const paths = generateOceanOutlines(limits)
    .map(({ rings }) => rings.map(ring => round(lineGen(ring) || "")).join(""))
    .filter(Boolean)
    .map(path => /* html */ `<path d="${path}" fill="#ecf2f9" fill-opacity="${opacity}"></path>`);

  oceanLayers.insertAdjacentHTML("beforeend", paths.join(""));

  TIME && console.timeEnd("drawOceanLayers");
}

/** drop the rings, keeping #oceanBase: the base rect is created once, at startup */
export function removeOceanLayers(): void {
  for (const path of Array.from(document.querySelectorAll("#oceanLayers path"))) path.remove();
}

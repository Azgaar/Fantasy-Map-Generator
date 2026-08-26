import { curveBasisClosed, line } from "d3";
import { Ocean } from "@/generators/ocean-generator";
import { ensureEl, rn, round } from "@/utils";

/** the ocean outline rings, stacked from the coast outwards so the overlap deepens the shade */
export function drawOcean(): void {
  applyOceanPattern();
  const oceanLayers = ensureEl<SVGGElement>("oceanLayers");
  removeOcean();

  const limits = Ocean.getLimits(styles.ocean.oceanLayers.options.outline);
  if (!limits.length) return;

  TIME && console.time("drawOcean");

  const opacity = rn(0.4 / limits.length, 2);
  const lineGen = line().curve(curveBasisClosed);
  const paths = Ocean.generate(limits)
    .map(({ rings }) => rings.map(ring => round(lineGen(ring) || "")).join(""))
    .filter(Boolean)
    .map(path => /* html */ `<path d="${path}" fill="#ecf2f9" fill-opacity="${opacity}"></path>`);

  oceanLayers.insertAdjacentHTML("beforeend", paths.join(""));

  TIME && console.timeEnd("drawOcean");
}

/** drop the rings, keeping #oceanBase: the base rect is created once, at startup */
export function removeOcean(): void {
  for (const path of Array.from(document.querySelectorAll("#oceanLayers path"))) path.remove();
}

/** the pattern image in defs is a renderer-owned resource shaped by the store */
export function applyOceanPattern(): void {
  const pattern = document.getElementById("oceanicPattern");
  if (!pattern) return;
  pattern.setAttribute("href", styles.ocean.options.pattern);
  pattern.setAttribute("opacity", String(styles.ocean.options.patternOpacity));
}

window.applyOceanPattern = applyOceanPattern;

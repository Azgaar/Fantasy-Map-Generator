import { curveBasisClosed, line } from "d3";
import { Ocean } from "@/generators/ocean-generator";
import { rn, round } from "@/utils";
import { ensureEl } from "@/utils/nodeUtils";

/**
 * The two full-graph rects the rings are drawn over: the textured pattern fill and the flat base
 * colour. The ocean layer is permanent, so both are in place from the first draw onwards; each
 * draw re-sizes them, which is what keeps them covering the graph after a canvas resize
 */
function drawOceanBase(): void {
  const pattern = ensureEl("oceanPattern");
  const patternRect =
    pattern.querySelector<SVGRectElement>(":scope > rect") ??
    prepend(pattern, createSvgRect({ fill: "url(#oceanic)" }));
  sizeToGraph(patternRect);

  const layers = ensureEl("oceanLayers");
  const baseRect =
    layers.querySelector<SVGRectElement>("#oceanBase") ??
    prepend(layers, createSvgRect({ id: "oceanBase", "data-group": "base" })); // the style store addresses it by group
  sizeToGraph(baseRect);

  // the rect is born after the startup Styles.write, so it has to take its own fill from the store
  const { fill } = styles.ocean.base.attrs;
  if (fill === null) baseRect.removeAttribute("fill");
  else baseRect.setAttribute("fill", fill);
}

/** a rect with its attributes in the given order: the saved svg is compared attribute by attribute */
function createSvgRect(attrs: Record<string, string>): SVGRectElement {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  for (const [name, value] of Object.entries(attrs)) rect.setAttribute(name, value);
  return rect;
}

/** keep the rect below whatever else the group holds */
function prepend(parent: Element, rect: SVGRectElement): SVGRectElement {
  parent.prepend(rect);
  return rect;
}

function sizeToGraph(rect: SVGRectElement): void {
  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", String(options.graph.width));
  rect.setAttribute("height", String(options.graph.height));
}

/** the ocean outline rings, stacked from the coast outwards so the overlap deepens the shade */
export function drawOcean(): void {
  applyOceanPattern();
  drawOceanBase();
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

/** drop the rings, keeping the two full-graph rects drawOceanBase owns */
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

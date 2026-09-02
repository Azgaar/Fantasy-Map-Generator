import { curveBasisClosed, line } from "d3";
import { Ocean } from "@/generators/ocean-generator";
import { rn, round } from "@/utils";
import { createEl, ensureEl } from "@/utils/nodeUtils";

/**
 * The two full-graph rects the rings are drawn over: the textured pattern fill and the flat base
 * colour. Created on first draw and resized on every one, so the map can be generated without them
 */
function drawOceanBase(): void {
  const patternRect = ensureFullGraphRect(ensureEl("oceanPattern"), "oceanPatternRect");
  patternRect.setAttribute("fill", "url(#oceanic)");

  const baseRect = ensureFullGraphRect(ensureEl("oceanLayers"), "oceanBase");
  baseRect.dataset.group = "base"; // the style store addresses it by group
  // the rect is born after the startup Styles.write, so it has to take its own fill from the store
  const { fill } = styles.ocean.base.attrs;
  if (fill === null) baseRect.removeAttribute("fill");
  else baseRect.setAttribute("fill", fill);
}

/** find or create a rect covering the whole graph, kept below whatever else the group holds */
function ensureFullGraphRect(parent: HTMLElement, id: string): SVGRectElement {
  const existing = parent.querySelector<SVGRectElement>(`#${id}`);
  const rect = existing ?? createEl<SVGRectElement>("rect", id);
  if (!existing) parent.prepend(rect);

  rect.setAttribute("x", "0");
  rect.setAttribute("y", "0");
  rect.setAttribute("width", String(options.graph.width));
  rect.setAttribute("height", String(options.graph.height));
  return rect;
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

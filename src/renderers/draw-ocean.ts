import { curveBasisClosed, line } from "d3";
import { Coastline } from "@/generators/coastline-generator";
import { Ocean } from "@/generators/ocean-generator";
import { rn, round } from "@/utils";
import { ensureEl } from "@/utils/nodeUtils";
import { getCoastalWaves } from "./coastal-waves";

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
  rect.setAttribute("width", String(options.map.graph.width));
  rect.setAttribute("height", String(options.map.graph.height));
}

/** the ocean outline rings, stacked from the coast outwards so the overlap deepens the shade */
export function drawOcean(): void {
  applyOceanPattern();
  drawOceanBase();
  drawCoastalWaves();
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

/** wave-dashes fading out from every sea shore, kept off the land and a halo along the coast by a mask of their own */
function drawCoastalWaves(): void {
  const group = ensureEl<SVGGElement>("oceanWaves");
  const { options: waveOptions } = styles.ocean.oceanWaves;
  if (!waveOptions.render) return void group.replaceChildren();

  TIME && console.time("drawCoastalWaves");
  const { width, height } = options.map.graph;
  const { spacing, cellsX, cellsY, cells, features } = grid;
  const distanceAt = (x: number, y: number): number => {
    const column = Math.max(0, Math.min(cellsX - 1, Math.floor(x / spacing)));
    const row = Math.max(0, Math.min(cellsY - 1, Math.floor(y / spacing)));
    const cell = row * cellsX + column;
    if (cells.h[cell] >= 20 || features[cells.f[cell]]?.type === "lake") return 0;
    return -cells.t[cell] || 1;
  };

  const path = getCoastalWaves({
    width,
    height,
    spacing,
    distanceAt,
    density: waveOptions.density,
    length: waveOptions.length,
    reach: waveOptions.reach,
    seed: options.map.seed
  });

  // the land, widened by the halo, masks the dashes: the shore stays a clean white line
  const halo = rn(waveOptions.halo * spacing * 2, 2);
  const land = pack.features
    .filter(feature => feature && feature.type !== "ocean")
    .map(
      feature =>
        `<use href="#feature_${feature.i}" fill="${feature.type === "lake" ? "white" : "black"}" stroke="black" stroke-width="${halo}"></use>`
    );
  ensureEl("deftemp").insertAdjacentHTML(
    "beforeend",
    /* html */ `<mask id="waves-mask"><rect x="0" y="0" width="100%" height="100%" fill="white"></rect>${land.join("")}</mask>`
  );
  for (const stale of Array.from(document.querySelectorAll("#deftemp > #waves-mask")).slice(0, -1)) stale.remove();

  group.innerHTML = path ? /* html */ `<path d="${path}" fill="none" mask="url(#waves-mask)"></path>` : "";
  TIME && console.timeEnd("drawCoastalWaves");
}

/** the pattern image in defs is a renderer-owned resource shaped by the store */
export function applyOceanPattern(): void {
  const pattern = document.getElementById("oceanicPattern");
  if (!pattern) return;
  pattern.setAttribute("href", styles.ocean.options.pattern);
  pattern.setAttribute("opacity", String(styles.ocean.options.patternOpacity));
}
window.applyOceanPattern = applyOceanPattern;

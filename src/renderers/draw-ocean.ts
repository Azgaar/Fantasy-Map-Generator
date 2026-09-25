import { curveBasisClosed, line } from "d3";
import { Ocean } from "@/generators/ocean-generator";
import { rn, round } from "@/utils";
import { ensureEl } from "@/utils/nodeUtils";
import { getCoastalDistances, getCoastalWaves } from "./coastal-waves";
import { drawCoastalBands, getCoastalBandReach, removeCoastalBands } from "./draw-coastal-bands";

/**
 * The two full-graph rects the rings are drawn over: the textured pattern fill and the flat base
 * colour. The ocean layer is permanent, so both are in place from the first draw onwards; each
 * draw re-sizes them, which is what keeps them covering the graph after a canvas resize.
 * They are born after the startup Styles.write, so they take their own attrs from the store
 */
function drawOceanBase(): void {
  const pattern = ensureEl("oceanPattern");
  if (!pattern.querySelector(":scope > pattern")) {
    const tile = createSvgEl("pattern", { id: "oceanic", width: "100", height: "100", patternUnits: "userSpaceOnUse" });
    const image = createSvgEl("image", { id: "oceanicPattern", "data-group": "pattern", width: "100", height: "100" });
    for (const [name, value] of Object.entries(styles.ocean.groups.pattern.attrs)) {
      if (value !== null) image.setAttribute(name, String(value));
    }
    tile.append(image);
    pattern.prepend(tile);
  }
  const patternRect =
    pattern.querySelector<SVGRectElement>(":scope > rect") ??
    prepend(pattern, createSvgEl("rect", { fill: "url(#oceanic)" }));
  sizeToGraph(patternRect);

  const layers = ensureEl("oceanLayers");
  const baseRect =
    layers.querySelector<SVGRectElement>("#oceanBase") ??
    prepend(layers, createSvgEl("rect", { id: "oceanBase", "data-group": "base" })); // the style store addresses it by group
  sizeToGraph(baseRect);

  const { fill } = styles.ocean.groups.base.attrs;
  if (fill === null) baseRect.removeAttribute("fill");
  else baseRect.setAttribute("fill", fill);
}

/** an element with its attributes in the given order: the saved svg is compared attribute by attribute */
function createSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
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
  removeOcean();
  drawOceanBase();
  drawCoastalWaves();
  drawCoastalBands();
  const oceanLayers = ensureEl<SVGGElement>("oceanLayers");

  const limits = Ocean.getLimits(styles.ocean.groups.oceanLayers.options.outline);
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

/** drop the rings, waves and bands, keeping the two full-graph rects drawOceanBase owns */
export function removeOcean(): void {
  for (const path of Array.from(document.querySelectorAll("#oceanLayers path"))) path.remove();
  removeCoastalWaves();
  removeCoastalBands();
}

function removeCoastalWaves(): void {
  ensureEl("oceanWaves").replaceChildren();
  document.getElementById("waves-mask")?.remove();
}

/** sparse wave dashes clipped to the sea, with a clear gap along the coast */
function drawCoastalWaves(): void {
  removeCoastalWaves();
  const { options: waveOptions, attrs } = styles.ocean.groups.oceanWaves;
  if (!waveOptions.render) return;
  const group = ensureEl<SVGGElement>("oceanWaves");

  TIME && console.time("drawCoastalWaves");
  const { width, height } = options.map.graph;
  const { spacing, cellsX, cellsY, cells, features } = grid;
  const bandReach = getCoastalBandReach(styles.ocean.options.bands);
  const bandCells = bandReach / spacing;
  const distances = getCoastalDistances(cells.h, cells.c, waveOptions.reach * 2 + bandCells);
  const distanceAt = (x: number, y: number): number => {
    const column = Math.max(0, Math.min(cellsX - 1, Math.floor(x / spacing)));
    const row = Math.max(0, Math.min(cellsY - 1, Math.floor(y / spacing)));
    const cell = row * cellsX + column;
    if (cells.h[cell] >= 20 || features[cells.f[cell]]?.type === "lake") return 0;
    return distances[cell] ? Math.max(1, distances[cell] - bandCells) : Infinity;
  };

  const path = getCoastalWaves({
    width,
    height,
    spacing,
    distanceAt,
    type: waveOptions.type,
    density: waveOptions.density,
    length: waveOptions.length,
    reach: waveOptions.reach,
    seed: options.map.seed
  });
  const halo = rn((bandReach + waveOptions.halo * spacing) * 2, 2);
  const land = pack.features
    .filter(feature => feature?.land)
    .map(feature => `<use href="#feature_${feature.i}" fill="black" stroke="black" stroke-width="${halo}"></use>`)
    .join("");
  ensureEl("deftemp").insertAdjacentHTML(
    "beforeend",
    /* html */ `<mask id="waves-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="white"></rect>
      <g stroke-linejoin="round">${land}</g>
    </mask>`
  );
  group.innerHTML = path
    ? /* html */ `<path d="${path}" fill="none" stroke="${attrs.stroke ?? "none"}" stroke-width="${attrs["stroke-width"] ?? 0.5}"${
        attrs["stroke-dasharray"] ? ` stroke-dasharray="${attrs["stroke-dasharray"]}"` : ""
      } opacity="${attrs.opacity ?? 1}" stroke-linecap="round" mask="url(#waves-mask)"></path>`
    : "";
  TIME && console.timeEnd("drawCoastalWaves");
}

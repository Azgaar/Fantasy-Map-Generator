import type { Burg } from "@/generators/burgs-generator";
import { getGridPolygon, getPackPolygon } from "@/utils";
import { reconcileSvgMarkupElements, type SvgMarkupItem } from "./svg-markup-reconciler";
import { SpatialIndex, ViewportLayers, type ViewportRenderContext } from "./viewport-renderer";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const populationIndex = new SpatialIndex<number>();
const cellsIndex = new SpatialIndex<number>();
let cellsAreGrid = false;
let maximumPopulationHeight = 0;

const populationLayer = ViewportLayers.register({
  id: "population",
  render: reconcilePopulation,
  clear: clearPopulation
});
const cellsLayer = ViewportLayers.register({ id: "cells", render: reconcileCells, clear: clearCells });

function drawCells(): void {
  cellsAreGrid = customization === 1;
  const indexes = cellsAreGrid ? grid.cells.i : pack.cells.i;
  const points = cellsAreGrid ? grid.points : pack.cells.p;
  cellsIndex.replace(indexes, cellId => points[cellId]);
  cellsLayer.render();
}

function reconcileCells(context: ViewportRenderContext): void {
  const cells = context.root.querySelector<SVGGElement>("#cells");
  if (!cells || !cellsIndex.valid || !layerIsOn("toggleCells")) return;

  const { x0, y0, x1, y1 } = context.bounds;
  const paths: string[] = [];
  for (const cellId of cellsIndex.values(context.bounds)) {
    const [x, y] = cellsAreGrid ? grid.points[cellId] : pack.cells.p[cellId];
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    paths.push(`M${cellsAreGrid ? getGridPolygon(cellId, grid) : getPackPolygon(cellId, pack)}`);
  }
  reconcilePath(cells, paths.join(""));
}

function clearCells(): void {
  cellsIndex.clear();
  document.querySelector("#cells")?.replaceChildren();
}

function drawPopulation(): void {
  const { cells, burgs } = pack;
  maximumPopulationHeight = 0;
  populationIndex.replace(populationIds(cells.i, burgs), itemId => {
    if (itemId >= 0) {
      const population = cells.pop[itemId];
      if (!population) return null;
      maximumPopulationHeight = Math.max(maximumPopulationHeight, population / 5);
      return cells.p[itemId];
    }

    const burg = burgs[-itemId - 1];
    if (!burg?.i || burg.removed) return null;
    maximumPopulationHeight = Math.max(maximumPopulationHeight, ((burg.population || 0) / 5) * urbanization);
    return [burg.x, burg.y];
  });
  populationLayer.render();
}

function reconcilePopulation(context: ViewportRenderContext): void {
  const rural = context.root.querySelector<SVGGElement>("#rural");
  const urban = context.root.querySelector<SVGGElement>("#urban");
  if (!rural || !urban || !populationIndex.valid) return;
  if (!layerIsOn("togglePopulation")) {
    rural.replaceChildren();
    urban.replaceChildren();
    return;
  }

  const { x0, y0, x1, y1 } = context.bounds;
  const queryBounds = { ...context.bounds, y1: context.bounds.y1 + maximumPopulationHeight };
  const ruralItems: SvgMarkupItem[] = [];
  const urbanItems: SvgMarkupItem[] = [];
  for (const itemId of populationIndex.values(queryBounds)) {
    const isRural = itemId >= 0;
    let x: number;
    let baseY: number;
    let topY: number;
    if (isRural) {
      [x, baseY] = pack.cells.p[itemId];
      topY = baseY - pack.cells.pop[itemId] / 5;
    } else {
      const burg = pack.burgs[-itemId - 1];
      x = burg.x;
      baseY = burg.y;
      topY = baseY - ((burg.population || 0) / 5) * urbanization;
    }
    if (x < x0 || x > x1 || Math.max(baseY, topY) < y0 || Math.min(baseY, topY) > y1) continue;
    const key = `${x}|${baseY}|${topY}`;
    const item = { id: String(itemId), key, markup: `<line x1="${x}" y1="${baseY}" x2="${x}" y2="${topY}"/>` };
    if (isRural) ruralItems.push(item);
    else urbanItems.push(item);
  }
  reconcileSvgMarkupElements(rural, ruralItems);
  reconcileSvgMarkupElements(urban, urbanItems);
}

function clearPopulation(): void {
  populationIndex.clear();
  maximumPopulationHeight = 0;
  document.querySelector("#rural")?.replaceChildren();
  document.querySelector("#urban")?.replaceChildren();
}

function* populationIds(cellIds: Iterable<number>, burgs: Burg[]): IterableIterator<number> {
  yield* cellIds;
  for (const burg of burgs) yield -burg.i - 1;
}

function reconcilePath(group: SVGGElement, data: string): void {
  let path = group.firstElementChild;
  if (!path || path.tagName.toLowerCase() !== "path" || path.nextElementSibling) {
    path = group.ownerDocument.createElementNS(SVG_NAMESPACE, "path");
    group.replaceChildren(path);
  }
  if (path.getAttribute("d") !== data) path.setAttribute("d", data);
}

window.ViewportPopulation = { draw: drawPopulation, clear: clearPopulation };
window.ViewportCells = { draw: drawCells, clear: clearCells };

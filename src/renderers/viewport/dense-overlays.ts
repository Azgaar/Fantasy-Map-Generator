import { getGridPolygon, getPackPolygon } from "@/utils";
import { SpatialIndex, ViewportLayers, type ViewportRenderContext } from "./viewport-renderer";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const cellsIndex = new SpatialIndex<number>();
let cellsAreGrid = false;
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

function reconcilePath(group: SVGGElement, data: string): void {
  let path = group.firstElementChild;
  if (!path || path.tagName.toLowerCase() !== "path" || path.nextElementSibling) {
    path = group.ownerDocument.createElementNS(SVG_NAMESPACE, "path");
    group.replaceChildren(path);
  }
  if (path.getAttribute("d") !== data) path.setAttribute("d", data);
}

window.ViewportCells = { draw: drawCells, clear: clearCells };

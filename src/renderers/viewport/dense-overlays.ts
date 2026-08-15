import { Scene, ViewportLayers, type ViewportRenderContext } from "./viewport-renderer";
import { getGridPolygon, getPackPolygon, rn } from "@/utils";

interface PrecipitationPoint {
  id: string;
  x: number;
  y: number;
  radius: number;
}

interface PopulationLine {
  id: string;
  x: number;
  y1: number;
  y2: number;
}

interface CellSceneItem {
  id: string;
  cellId: number;
  isGrid: boolean;
}

const precipitationScene = new Scene<PrecipitationPoint>();
const populationScene = new Scene<PopulationLine>();
const cellsScene = new Scene<CellSceneItem>();
const precipitationLayer = ViewportLayers.register({ id: "precipitation", render: reconcilePrecipitation });
const populationLayer = ViewportLayers.register({ id: "population", render: reconcilePopulation });
const cellsLayer = ViewportLayers.register({ id: "cells", render: reconcileCells });

function drawCells(): void {
  const isGrid = customization === 1;
  const indexes = isGrid ? grid.cells.i : pack.cells.i;
  cellsScene.replace(
    Array.from<number, CellSceneItem>(indexes as ArrayLike<number>, cellId => ({
      id: `cell-${cellId}`,
      cellId,
      isGrid
    }))
  );
  cellsLayer.render();
}

function reconcileCells(context: ViewportRenderContext): void {
  const cells = context.root.querySelector<SVGGElement>("#cells");
  if (!cells || !cellsScene.valid || !layerIsOn("toggleCells")) return;

  const { x0, y0, x1, y1 } = context.bounds;
  const paths: string[] = [];
  for (const { cellId, isGrid } of cellsScene.values()) {
    const [x, y] = isGrid ? grid.points[cellId] : pack.cells.p[cellId];
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    paths.push(`M${isGrid ? getGridPolygon(cellId, grid) : getPackPolygon(cellId, pack)}`);
  }
  cells.innerHTML = `<path d="${paths.join("")}"/>`;
}

function drawPrecipitation(): void {
  const { cells, points } = grid;
  const cellsNumberModifier = (Number(pointsInput.dataset.cells) / 10000) ** 0.25;
  const pointsToRender: PrecipitationPoint[] = [];
  for (const cellId of cells.i) {
    const precipitation = cells.prec[cellId];
    if (cells.h[cellId] < 20 || !precipitation) continue;
    const [x, y] = points[cellId];
    pointsToRender.push({
      id: `precipitation-${cellId}`,
      x,
      y,
      radius: rn(Math.sqrt(precipitation / 4) / cellsNumberModifier, 2)
    });
  }
  precipitationScene.replace(pointsToRender);
  precipitationLayer.render();
}

function reconcilePrecipitation(context: ViewportRenderContext): void {
  const layer = context.root.querySelector<SVGGElement>("#prec");
  if (!layer) return;
  if (!precipitationScene.valid) return;
  if (!layerIsOn("togglePrecipitation")) return void layer.replaceChildren();

  const { x0, y0, x1, y1 } = context.bounds;
  const markup: string[] = [];
  for (const point of precipitationScene.values()) {
    if (point.x + point.radius < x0 || point.x - point.radius > x1 || point.y + point.radius < y0 || point.y - point.radius > y1)
      continue;
    markup.push(`<circle cx="${point.x}" cy="${point.y}" r="${point.radius}"/>`);
  }
  layer.innerHTML = markup.join("");
  layer.style.display = "block";
}

function drawPopulation(): void {
  const { cells, burgs } = pack;
  const lines: PopulationLine[] = [];
  for (const cellId of cells.i) {
    const population = cells.pop[cellId];
    if (!population) continue;
    const [x, y] = cells.p[cellId];
    lines.push({ id: `rural-${cellId}`, x, y1: y, y2: y - population / 5 });
  }
  for (const burg of burgs) {
    if (!burg.i || burg.removed) continue;
    lines.push({ id: `urban-${burg.i}`, x: burg.x, y1: burg.y, y2: burg.y - ((burg.population || 0) / 5) * urbanization });
  }
  populationScene.replace(lines);
  populationLayer.render();
}

function reconcilePopulation(context: ViewportRenderContext): void {
  const rural = context.root.querySelector<SVGGElement>("#rural");
  const urban = context.root.querySelector<SVGGElement>("#urban");
  if (!rural || !urban) return;
  if (!populationScene.valid) return;
  if (!layerIsOn("togglePopulation")) {
    rural.replaceChildren();
    urban.replaceChildren();
    return;
  }

  const { x0, y0, x1, y1 } = context.bounds;
  const ruralMarkup: string[] = [];
  const urbanMarkup: string[] = [];
  for (const line of populationScene.values()) {
    if (line.x < x0 || line.x > x1 || Math.max(line.y1, line.y2) < y0 || Math.min(line.y1, line.y2) > y1) continue;
    const markup = `<line x1="${line.x}" y1="${line.y1}" x2="${line.x}" y2="${line.y2}"/>`;
    if (line.id.startsWith("rural-")) ruralMarkup.push(markup);
    else urbanMarkup.push(markup);
  }
  rural.innerHTML = ruralMarkup.join("");
  urban.innerHTML = urbanMarkup.join("");
}

window.ViewportPopulation = { draw: drawPopulation };
window.ViewportPrecipitation = { draw: drawPrecipitation };
window.ViewportCells = { draw: drawCells };

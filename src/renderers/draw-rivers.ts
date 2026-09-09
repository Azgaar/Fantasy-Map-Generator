import { Layers } from "@/components/layers";
import type { River } from "@/generators/river-generator";
import {
  boundsIntersect,
  Scene,
  ViewportLayers,
  type ViewportRenderContext
} from "@/renderers/viewport/viewport-renderer";
import type { Point } from "@/types/global";

interface RiverShape {
  id: string;
  path: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const scene = new Scene<RiverShape>();
const layer = ViewportLayers.register({ id: "rivers", render: reconcileRivers });
const rendered = new WeakMap<Element, { shape: RiverShape; fill: string | null }>();

let editedRiverId: string | null = null; // edited river is rendered even when off-screen
let basinColors: Map<string, string> | null = null;

export function drawRivers(): void {
  TIME && console.time("drawRivers");
  const shapes: RiverShape[] = [];
  for (const river of pack.rivers) {
    const shape = buildShape(river);
    if (shape) shapes.push(shape);
  }
  scene.replace(shapes);
  if (basinColors) basinColors = getBasinColors();
  layer.render();
  TIME && console.timeEnd("drawRivers");
}

/** Re-render a single edited river, keeping its element (and its editor handlers) in place */
export function redrawRiver(river: River): void {
  const shape = buildShape(river);
  if (!shape || !scene.valid) return;
  scene.set(shape);
  layer.render();
}

export function setEditedRiver(riverId: number | null): void {
  editedRiverId = riverId === null ? null : `river${riverId}`;
  layer.render();
}

/** Bounding box of the rendered river, available whether or not the river is currently materialized */
export function getRiverBox(riverId: number): DOMRect | null {
  const shape = scene.get(`river${riverId}`);
  return shape ? new DOMRect(shape.x0, shape.y0, shape.x1 - shape.x0, shape.y1 - shape.y0) : null;
}

export function toggleBasinHighlight(): boolean {
  basinColors = basinColors ? null : getBasinColors();
  layer.render();
  return basinColors !== null;
}

const BASIN_COLORS = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf"
];

function getBasinColors(): Map<string, string> {
  const basins = [...new Set(pack.rivers.map(river => river.basin))];
  const colorByBasin = new Map(basins.map((basin, index) => [basin, BASIN_COLORS[index % BASIN_COLORS.length]]));
  return new Map(pack.rivers.map(river => [`river${river.i}`, colorByBasin.get(river.basin)!]));
}

function buildShape(river: River): RiverShape | null {
  const { i, cells, widthFactor, sourceWidth } = river;
  if (!cells || cells.length < 2) return null;

  let points: Point[] | undefined = river.points;
  if (points && points.length !== cells.length) {
    ERROR &&
      console.error(`River ${i} has ${cells.length} cells, but only ${points.length} points. Resetting points data`);
    points = undefined;
  }

  const meanderedPoints = Rivers.addMeandering(cells, points);
  const path = Rivers.getRiverPath(meanderedPoints, widthFactor, sourceWidth);

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let maxFlux = 0;
  for (const [x, y, flux] of meanderedPoints) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
    if (flux > maxFlux) maxFlux = flux;
  }

  // the polygon is the course inflated by its width, which peaks at the mouth
  const halfWidth = Rivers.getOffset({
    flux: maxFlux,
    pointIndex: meanderedPoints.length - 1,
    widthFactor,
    startingWidth: sourceWidth
  });

  return { id: `river${i}`, path, x0: x0 - halfWidth, y0: y0 - halfWidth, x1: x1 + halfWidth, y1: y1 + halfWidth };
}

function reconcileRivers({ root, bounds }: ViewportRenderContext): void {
  if (!scene.valid || !Layers.isOn("rivers")) return;
  const container = root.querySelector<SVGGElement>("#rivers");
  if (!container) return;

  const visible: RiverShape[] = [];
  for (const shape of scene.values()) {
    if (shape.id === editedRiverId || boundsIntersect(shape, bounds)) visible.push(shape);
  }
  const visibleIds = new Set(visible.map(shape => shape.id));

  const elements = new Map<string, Element>();
  for (const child of Array.from(container.children)) {
    if (visibleIds.has(child.id)) elements.set(child.id, child);
    else child.remove();
  }

  for (const shape of visible) {
    let element = elements.get(shape.id);
    if (!element) {
      element = container.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
      element.id = shape.id;
      container.appendChild(element);
    }

    const fill = basinColors?.get(shape.id) ?? null;
    const previous = rendered.get(element);
    if (previous?.shape !== shape) element.setAttribute("d", shape.path);
    if (!previous || previous.fill !== fill) {
      if (fill) element.setAttribute("fill", fill);
      else element.removeAttribute("fill");
    }
    rendered.set(element, { shape, fill });
  }
}

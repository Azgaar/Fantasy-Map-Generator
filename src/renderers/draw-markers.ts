import { select } from "d3";
import { reconcileSvgMarkupElements, type SvgMarkupItem } from "@/renderers/viewport/svg-markup-reconciler";
import {
  Scene,
  SpatialIndex,
  type ViewportBounds,
  ViewportLayers,
  type ViewportRenderContext
} from "@/renderers/viewport/viewport-renderer";
import { rn } from "../utils";

interface Marker {
  i: number;
  icon: string;
  x: number;
  y: number;
  name?: string;
  type?: string;
  dx?: number;
  dy?: number;
  px?: number;
  size?: number;
  pin?: string;
  fill?: string;
  stroke?: string;
  pinned?: boolean;
  hidden?: boolean;
}

declare global {
  var drawMarkers: () => void;
  var drawMarker: (marker: Marker, rescale?: number) => string;
}

type PinShapeFunction = (fill: string, stroke: string) => string;
type PinShapes = { [key: string]: PinShapeFunction };

interface MarkerSceneItem {
  id: string;
  marker: Marker;
  rescale: number;
}

const scene = new Scene<MarkerSceneItem>();
const index = new SpatialIndex<MarkerSceneItem>();
const layer = ViewportLayers.register({ id: "markers", render: reconcileMarkers, clear: clearMarkers });
let maximumMarkerSize = 0;

// prettier-ignore
const pinShapes: PinShapes = {
  bubble: (fill: string, stroke: string) =>
    `<path d="M6,19 l9,10 L24,19" fill="${stroke}" stroke="none" /><circle cx="15" cy="15" r="10" fill="${fill}" stroke="${stroke}"/>`,
  pin: (fill: string, stroke: string) =>
    `<path d="m 15,3 c -5.5,0 -9.7,4.09 -9.7,9.3 0,6.8 9.7,17 9.7,17 0,0 9.7,-10.2 9.7,-17 C 24.7,7.09 20.5,3 15,3 Z" fill="${fill}" stroke="${stroke}"/>`,
  square: (fill: string, stroke: string) =>
    `<path d="m 20,25 -5,4 -5,-4 z" fill="${stroke}"/><path d="M 5,5 H 25 V 25 H 5 Z" fill="${fill}" stroke="${stroke}"/>`,
  squarish: (fill: string, stroke: string) =>
    `<path d="m 5,5 h 20 v 20 h -6 l -4,4 -4,-4 H 5 Z" fill="${fill}" stroke="${stroke}" />`,
  diamond: (fill: string, stroke: string) => `<path d="M 2,15 15,1 28,15 15,29 Z" fill="${fill}" stroke="${stroke}" />`,
  hex: (fill: string, stroke: string) =>
    `<path d="M 15,29 4.61,21 V 9 L 15,3 25.4,9 v 12 z" fill="${fill}" stroke="${stroke}" />`,
  hexy: (fill: string, stroke: string) =>
    `<path d="M 15,29 6,21 5,8 15,4 25,8 24,21 Z" fill="${fill}" stroke="${stroke}" />`,
  shieldy: (fill: string, stroke: string) =>
    `<path d="M 15,29 6,21 5,7 c 0,0 5,-3 10,-3 5,0 10,3 10,3 l -1,14 z" fill="${fill}" stroke="${stroke}" />`,
  shield: (fill: string, stroke: string) =>
    `<path d="M 4.6,5.2 H 25 v 6.7 A 20.3,20.4 0 0 1 15,29 20.3,20.4 0 0 1 4.6,11.9 Z" fill="${fill}" stroke="${stroke}" />`,
  pentagon: (fill: string, stroke: string) =>
    `<path d="M 4,16 9,4 h 12 l 5,12 -11,13 z" fill="${fill}" stroke="${stroke}" />`,
  heptagon: (fill: string, stroke: string) =>
    `<path d="M 15,29 6,22 4,12 10,4 h 10 l 6,8 -2,10 z" fill="${fill}" stroke="${stroke}" />`,
  circle: (fill: string, stroke: string) => `<circle cx="15" cy="15" r="11" fill="${fill}" stroke="${stroke}" />`,
  no: () => ""
};

const getPinForShape = (shape = "bubble", fill = "#fff", stroke = "#000"): string => {
  const shapeFunction = pinShapes[shape] || pinShapes.bubble;
  return shapeFunction(fill, stroke);
};

function markerRenderer(marker: Marker, rescale = 1): string {
  const { i, icon, dx = 50, dy = 50, px = 12, pin, fill, stroke } = marker;
  const id = `marker${i}`;
  const { zoomSize, viewX, viewY } = getMarkerGeometry(marker, rescale);

  const isExternal = icon.startsWith("http") || icon.startsWith("data:image");

  return /* html */ `
    <svg id="${id}" data-id="${i}" viewbox="0 0 30 30" width="${zoomSize}" height="${zoomSize}" x="${viewX}" y="${viewY}">
      <g>${getPinForShape(pin, fill, stroke)}</g>
      <text x="${dx}%" y="${dy}%" font-size="${px}px" >${isExternal ? "" : icon}</text>
      <image x="${dx / 2}%" y="${dy / 2}%" width="${px}px" height="${px}px" href="${isExternal ? icon : ""}" />
    </svg>`;
}

// transient set of marker ids the map should render, driven by the Markers Overview filter.
// null = no filter (render everything). Not persisted — never touches pack data or the .map file.
let visibleMarkerIds: Set<number> | null = null;

const setMarkersFilter = (ids: number[] | null): void => {
  visibleMarkerIds = ids ? new Set(ids) : null;
};

const markersRenderer = (): void => {
  TIME && console.time("drawMarkers");

  const rescale = +select("#markers").attr("rescale");
  const pinned = +select("#markers").attr("pinned");

  let markersData: Marker[] = pinned
    ? (pack.markers || []).filter((marker: Marker) => marker.pinned)
    : pack.markers || [];
  if (visibleMarkerIds) markersData = markersData.filter((marker: Marker) => visibleMarkerIds!.has(marker.i));
  const items = markersData.map(marker => ({ id: `marker${marker.i}`, marker, rescale }));
  scene.replace(items);
  index.replace(items, ({ marker }) => [marker.x, marker.y]);
  maximumMarkerSize = markersData.reduce((maximum, marker) => Math.max(maximum, getMaximumMarkerSize(marker)), 0);
  layer.render();

  TIME && console.timeEnd("drawMarkers");
};

function reconcileMarkers(context: ViewportRenderContext): void {
  const markers = context.root.querySelector<SVGGElement>("#markers");
  if (!markers) return;
  if (!scene.valid || !index.valid) return;
  if (!layerIsOn("toggleMarkers")) {
    scene.invalidate();
    index.clear();
    maximumMarkerSize = 0;
    markers.replaceChildren();
    return;
  }

  const { x0, y0, x1, y1 } = context.bounds;
  const visible: MarkerSceneItem[] = [];
  const items: SvgMarkupItem[] = [];
  for (const item of index.values(expandBounds(context.bounds, maximumMarkerSize))) {
    const { marker, rescale } = item;
    const { zoomSize } = getMarkerGeometry(marker, rescale);
    const half = zoomSize / 2;
    if (marker.x + half < x0 || marker.x - half > x1 || marker.y < y0 || marker.y - zoomSize > y1) continue;
    visible.push(item);
    items.push({ id: item.id, key: getMarkerContentKey(marker), markup: markerRenderer(marker, rescale) });
  }

  const elements = reconcileSvgMarkupElements(markers, items);
  for (const { id, marker, rescale } of visible) {
    const element = elements.get(id);
    if (element?.tagName.toLowerCase() === "svg") updateMarkerGeometry(element as SVGSVGElement, marker, rescale);
  }
}

function clearMarkers(): void {
  scene.invalidate();
  index.clear();
  maximumMarkerSize = 0;
  document.querySelector("#markers")?.replaceChildren();
}

export function rescaleVisibleMarkers(): void {
  const markers = document.querySelector<SVGGElement>("#markers");
  if (!markers || !Number(markers.getAttribute("rescale"))) return;

  for (const child of Array.from(markers.children)) {
    const item = scene.get(child.id);
    if (item && child.tagName.toLowerCase() === "svg")
      updateMarkerGeometry(child as SVGSVGElement, item.marker, item.rescale);
  }
}

function getMarkerGeometry(marker: Marker, rescale: number): { zoomSize: number; viewX: number; viewY: number } {
  const { x, y, size = 30 } = marker;
  const zoomSize = rescale ? Math.max(rn(size / 5 + 24 / scale, 2), 1) : size;
  return { zoomSize, viewX: rn(x - zoomSize / 2, 1), viewY: rn(y - zoomSize, 1) };
}

function updateMarkerGeometry(element: SVGSVGElement, marker: Marker, rescale: number): void {
  const { zoomSize, viewX, viewY } = getMarkerGeometry(marker, rescale);
  setAttribute(element, "width", zoomSize);
  setAttribute(element, "height", zoomSize);
  setAttribute(element, "x", viewX);
  setAttribute(element, "y", viewY);
}

function setAttribute(element: SVGElement, name: string, value: string | number): void {
  const next = String(value);
  if (element.getAttribute(name) !== next) element.setAttribute(name, next);
}

function getMarkerContentKey({ icon, dx = 50, dy = 50, px = 12, pin, fill, stroke }: Marker): string {
  return JSON.stringify([icon, dx, dy, px, pin, fill, stroke]);
}

function getMaximumMarkerSize({ size = 30 }: Marker): number {
  return Math.max(size, size / 5 + 24);
}

function expandBounds(bounds: ViewportBounds, padding: number): ViewportBounds {
  return {
    ...bounds,
    x0: bounds.x0 - padding,
    y0: bounds.y0 - padding,
    x1: bounds.x1 + padding,
    y1: bounds.y1 + padding
  };
}

window.drawMarkers = markersRenderer;
window.drawMarker = markerRenderer;

export { getPinForShape as getPin, markerRenderer as drawMarker, markersRenderer as drawMarkers, setMarkersFilter };

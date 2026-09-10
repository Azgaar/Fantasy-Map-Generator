import { Layers } from "@/components/layers";
import type { Marker } from "@/generators/markers-generator";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import { isImageIcon } from "@/utils/fileUtils";
import { rn } from "@/utils/numberUtils";
import { escapeHtml } from "@/utils/stringUtils";

const layer = ViewportLayers.register({ id: "markers", render: reconcileMarkers });
let editedMarker: Marker | null = null;
let visibleMarkerIds: Set<number> | null = null;

const pinShapes: { [key: string]: (fill: string, stroke: string) => string } = {
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

const getPin = (shape = "bubble", fill = "#fff", stroke = "#000"): string => {
  const shapeFunction = pinShapes[shape] || pinShapes.bubble;
  return shapeFunction(fill, stroke);
};

export function setEditedMarker(marker: Marker | null): void {
  editedMarker = marker;
  layer.render();
}

export const setMarkersFilter = (ids: number[] | null): void => {
  visibleMarkerIds = ids ? new Set(ids) : null;
};

export const drawMarkers = (): void => {
  TIME && console.time("drawMarkers");
  layer.render();
  TIME && console.timeEnd("drawMarkers");
};

function reconcileMarkers({ root, bounds }: ViewportRenderContext): void {
  const container = root.querySelector<SVGGElement>("#markers");
  if (!container || !Layers.isOn("markers")) return;

  const rescale = styles.markers.options.rescale;
  const anyPinned = pack.markers.some(marker => marker.pinned);
  const selected = root === document && editedMarker ? container.querySelector(`#marker${editedMarker.i}`) : null;
  const markup: string[] = [];
  let selectedMarkup = "";

  for (const marker of pack.markers) {
    const edited = root === document && marker === editedMarker;
    if (marker.hidden) continue;
    if (!edited && ((anyPinned && !marker.pinned) || (visibleMarkerIds && !visibleMarkerIds.has(marker.i)))) continue;
    const { x, y, size } = getMarkerGeometry(marker, rescale, bounds.scale);
    if (!edited && (x > bounds.x1 || y > bounds.y1 || x + size < bounds.x0 || y + size < bounds.y0)) continue;
    const html = /*html*/ `<svg id="marker${marker.i}" viewBox="0 0 30 30" width="${size}" height="${size}" x="${x}" y="${y}">${getMarkerContent(marker)}</svg>`;
    if (edited) selectedMarkup = html;
    else markup.push(html);
  }

  markup.push(selectedMarkup);
  container.innerHTML = markup.join("");

  // Preserve the edited SVG's drag handlers while replacing its rendered content.
  if (selected && selectedMarkup) {
    const rendered = container.lastElementChild!;
    for (const { name, value } of Array.from(rendered.attributes)) selected.setAttribute(name, value);
    selected.replaceChildren(...rendered.childNodes);
    rendered.replaceWith(selected);
  }
}

function getMarkerGeometry({ x, y, size = 30 }: Marker, rescale: number, scale: number) {
  const zoomSize = rescale ? Math.max(rn(size / 5 + 24 / scale, 2), 1) : size;
  return { x: rn(x - zoomSize / 2, 1), y: rn(y - zoomSize, 1), size: zoomSize };
}

function getMarkerContent({ icon, dx = 50, dy = 50, px = 12, pin, fill, stroke }: Marker): string {
  const isExternal = isImageIcon(icon);
  return /* html */ `
      <g>${getPin(pin, fill, stroke)}</g>
      <text x="${dx}%" y="${dy}%" font-size="${px}px" >${isExternal ? "" : escapeHtml(icon)}</text>
      <image x="${dx / 2}%" y="${dy / 2}%" width="${px}px" height="${px}px" href="${isExternal ? escapeHtml(icon) : ""}" />`;
}

import type { PackedGraph } from "@/types/PackedGraph";

export interface PaintOverlayValue {
  id: number;
  color: string;
}

export interface PaintOverlayCell {
  cell: number;
  values: readonly PaintOverlayValue[];
}

interface RenderedCell {
  polygons: SVGPolygonElement[];
  points: string;
}

const overlayId = "paintEditorOverlay";
const renderedCells = new Map<number, RenderedCell>();
let overlay: SVGGElement | null = null;

export function openPaintOverlay(): void {
  removePaintOverlay();

  const debug = document.getElementById("debug");
  if (!debug) return;

  overlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
  overlay.id = overlayId;
  overlay.style.fillOpacity = "0.7";
  overlay.style.pointerEvents = "none";
  debug.appendChild(overlay);
}

export function updatePaintOverlay(graph: PackedGraph, cells: readonly PaintOverlayCell[]): void {
  if (!overlay) return;

  const newPolygons = document.createDocumentFragment();
  for (const { cell, values } of cells) {
    const rendered = renderedCells.get(cell);
    const points = rendered?.points ?? Pack.getPolygon(cell, graph).join(" ");
    if (rendered) {
      for (const polygon of rendered.polygons) polygon.remove();
    }

    const polygons: SVGPolygonElement[] = [];
    if (values.length) {
      for (const value of values) polygons.push(createPolygon(cell, points, value));
    } else {
      polygons.push(createPolygon(cell, points, null));
    }
    for (const polygon of polygons) newPolygons.appendChild(polygon);
    renderedCells.set(cell, { polygons, points });
  }

  overlay.appendChild(newPolygons);
}

export function removePaintOverlayCells(cells: Iterable<number>): void {
  for (const cell of cells) {
    const rendered = renderedCells.get(cell);
    if (rendered) {
      for (const polygon of rendered.polygons) polygon.remove();
    }
    renderedCells.delete(cell);
  }
}

export function removePaintOverlay(): void {
  overlay?.remove();
  overlay = null;
  renderedCells.clear();
}

function createPolygon(cell: number, points: string, value: PaintOverlayValue | null): SVGPolygonElement {
  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.dataset.cell = String(cell);
  polygon.dataset.value = value ? String(value.id) : "";
  polygon.setAttribute("points", points);
  polygon.setAttribute("fill", value?.color ?? "#ffffff");
  polygon.setAttribute("stroke", value?.color ?? "#555555");
  return polygon;
}

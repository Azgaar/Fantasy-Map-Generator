import { select } from "d3";
import type { LayerId } from "@/components/layers";
import { Layers } from "@/components/layers";
import { type EntityRef, MapEntities } from "@/components/map-entities";
import { viewport } from "@/components/viewport";
import { zoomTo } from "@/components/zoom";
import { highlightArea, highlightElement } from "@/renderers/overlays/highlight";
import type { Point } from "@/types/global";
import { findEl } from "@/utils";
import { type Box, getBounds } from "@/utils/pathUtils";

// Showing things on the map: zoom to fit, show their layers, outline or ring them

interface RevealOptions {
  layers: LayerId[];
  maxScale: number;
  zoom?: { min?: number | null; max?: number | null };
  element: () => Element | null;
  cover?: DOMRect; // a panel over the map: the view centres in the part it leaves visible
}

/** The map's visible columns beside a panel: its wider side, or the whole width when the panel leaves too little */
function visibleColumns(cover?: DOMRect): [left: number, right: number] {
  const { width } = viewport;
  const [start, end] = cover ? [Math.max(0, cover.left), Math.min(width, cover.right)] : [0, 0];
  if (end <= start) return [0, width];
  const [left, right] = start >= width - end ? [0, start] : [end, width];
  return right - left < width * 0.3 ? [0, width] : [left, right];
}

function zoomToFit([x0, y0, x1, y1]: Box, maxScale: number, zoom: RevealOptions["zoom"] = {}, cover?: DOMRect): number {
  const [left, right] = visibleColumns(cover);
  const fit = Math.min(
    maxScale,
    ((right - left) * 0.65) / Math.max(1, x1 - x0),
    (viewport.height * 0.65) / Math.max(1, y1 - y0)
  );
  const scale = Math.max(zoom.min ?? 1, Math.min(zoom.max ?? 20, Math.max(1, fit)));
  const shift = (viewport.width / 2 - (left + right) / 2) / scale; // zoomTo centres on the whole width
  zoomTo((x0 + x1) / 2 + shift, (y0 + y1) / 2, scale, 1500);
  return scale;
}

/** Zoom to the points and outline the element; false when there is nothing to show */
export function reveal(points: Point[], { layers, maxScale, zoom, element, cover }: RevealOptions): boolean {
  if (!points.length) return false;
  Layers.show(...layers);
  const box = getBounds(points);
  zoomToFit(box, maxScale, zoom, cover);
  // the outline animates in while the view is still moving; a culled element (a river, a label) is not drawn yet,
  // so its own geometry stands in for it
  setTimeout(() => {
    const found = element();
    if (found) highlightElement(found);
    else highlightArea({ x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] });
  }, 750);
  return true;
}

export function revealEntity(ref: EntityRef, cover?: DOMRect): boolean {
  const display = MapEntities.getDisplay(ref);
  const elementId = MapEntities.getElementId(ref);
  return reveal(MapEntities.getPoints(ref), {
    layers: display.layers,
    maxScale: display.scale,
    element: () =>
      (display.highlight && document.querySelector(display.highlight)) || (elementId ? findEl(elementId) : null),
    cover
  });
}

const MARKS = "entityMarks";

/** Ring every located entity until cleared; false when none has a place on the map */
export function markEntities(refs: EntityRef[], cover?: DOMRect): boolean {
  clearEntityMarks();
  const located = refs.flatMap(ref => {
    const position = MapEntities.getAnchor(ref);
    return position ? [{ ref, position }] : [];
  });
  if (!located.length) return false;
  const maxScale = Math.min(...located.map(({ ref }) => MapEntities.getDisplay(ref).scale));
  const scale = zoomToFit(getBounds(located.map(({ position }) => position)), maxScale, {}, cover);
  select("#debug")
    .append("g")
    .attr("id", MARKS)
    .attr("fill", "none")
    .attr("stroke", "#d0240f")
    .selectAll("circle")
    .data(located)
    .enter()
    .append("circle")
    .attr("cx", ({ position }) => position[0])
    .attr("cy", ({ position }) => position[1])
    .attr("r", 9 / scale)
    .attr("stroke-width", 2 / scale);
  return true;
}

export function clearEntityMarks(): void {
  document.getElementById(MARKS)?.remove();
}

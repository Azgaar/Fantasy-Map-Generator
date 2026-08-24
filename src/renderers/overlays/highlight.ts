import { easeBounceOut, easeLinear, select, transition } from "d3";
import { parseTransform } from "@/utils";
import type { MapInteractionGeometry } from "../interaction/map-interaction-overlay";
import { updateMapInteractionOverlay } from "../pixi/pixi-renderer-controller";

const debugLayer = () => select<SVGGElement, unknown>("#debug");

function getBBox(element: Element): DOMRect {
  const attr = (name: string) => Number(element.getAttribute(name));
  return new DOMRect(attr("x"), attr("y"), attr("width"), attr("height"));
}

/** Draw a temporary outline around an element, optionally zooming to it */
export function highlightElement(target: Element | null, zoom?: number): void {
  const element = target as SVGGraphicsElement | null;
  if (!element) return;
  const layer = debugLayer();
  if (layer.select(".highlighted").size()) return; // allow only 1 highlighted element simultaneously

  const box = element.tagName === "svg" ? getBBox(element) : element.getBBox();
  const transformAttr = element.getAttribute("transform");
  const enter = transition().duration(1000).ease(easeBounceOut);

  layer
    .append("rect")
    .attr("x", box.x)
    .attr("y", box.y)
    .attr("width", box.width)
    .attr("height", box.height)
    .classed("highlighted", true)
    .attr("transform", transformAttr)
    .transition(enter)
    .style("outline-offset", "0px")
    .transition()
    .duration(500)
    .ease(easeLinear)
    .style("outline-color", "transparent")
    .delay(1000)
    .remove();

  if (!zoom) return;

  const [shiftX, shiftY] = parseTransform(transformAttr || "");
  const x = box.x + box.width / 2 + (Number(shiftX) || 0);
  const y = box.y + box.height / 2 + (Number(shiftY) || 0);
  zoomTo(x, y, scale > 2 ? scale : zoom, 1600);
}

/** Animate the area or place an emblem belongs to */
export function highlightEmblemElement(type: string, element: { i: number; [key: string]: any }) {
  const { cells } = pack;

  if (type === "burg") {
    showMapHighlight([{ center: { x: element.x, y: element.y }, kind: "circle", radius: 20 }]);
    return;
  }

  const [x, y] = element.pole || cells.p[element.center];
  const owner = type === "state" ? cells.state : cells.province;
  const borderCells = cells.i.filter(id => owner[id] === element.i && cells.c[id].some(n => owner[n] !== element.i));
  const rays: MapInteractionGeometry[] = borderCells
    .filter((_cellId, index) => !(index % 2))
    .map(cellId => cells.p[cellId])
    .map(([px, py]) => ({
      kind: "polyline",
      points: [
        { x, y },
        { x: px, y: py }
      ]
    }));
  showMapHighlight(rays);
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null;

function showMapHighlight(highlight: readonly MapInteractionGeometry[]): void {
  if (highlightTimer) clearTimeout(highlightTimer);
  updateMapInteractionOverlay({ highlight });
  highlightTimer = setTimeout(() => {
    highlightTimer = null;
    updateMapInteractionOverlay({ highlight: null });
  }, 2500);
}

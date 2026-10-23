// The legend boxes of pack.legends: titled, multi-column lists of color swatches, one group per box.
// A box is keyed by its title; where it sits is the viewer's own (legend-positions)

import { type D3DragEvent, select } from "d3";
import { viewport } from "@/renderers/viewport/viewport";
import type { LegendItem } from "@/types/Legend";
import { findEl, minmax, parseTransform, rn } from "@/utils";
import { type LegendPosition, legendPositions } from "./legend-positions";

const STACK_GAP = 10; // px kept between the boxes when a new one is placed automatically

const getLayer = () => select<SVGGElement, unknown>("#legend");
const getBoxes = () => Array.from(document.querySelectorAll<SVGGElement>("#legend > g[data-legend]"));
const getBox = (name: string) => getBoxes().find(node => node.dataset.legend === name);
const getBBox = (node: SVGGElement) => node.getBBox();

/** Draw every legend box of the map with the current style settings, dropping the boxes it no longer has */
export function redrawLegend(): void {
  const names = new Set(pack.legends.map(legend => legend.name));
  for (const node of Array.from(findEl("legend")?.children ?? []) as SVGGElement[]) {
    if (!names.has(node.dataset.legend ?? "")) node.remove();
  }
  for (const { name, items } of pack.legends) drawBox(name, items);
}

function drawBox(name: string, items: LegendItem[]): void {
  const layer = getLayer();

  // the store owns the box styling and the column count; the box is redrawn from it every time
  const itemsInCol = styles.legend.options.columns;
  const backColor = styles.legend.groups.box.attrs.fill;
  const opacity = Number(styles.legend.groups.box.attrs["fill-opacity"]);
  const fontSize = Number.parseFloat(styles.legend.attrs["font-size"]); // the texts size by inheritance
  layer.attr("fill", styles.legend.attrs.fill || "#000000");

  const node = getBox(name) ?? (layer.append("g").attr("data-legend", name).node() as SVGGElement);
  const box = select(node);
  box.selectAll("*").remove(); // fully redraw every time

  const lineHeight = Math.round(fontSize * 1.7);
  const colorBoxSize = Math.round(fontSize / 1.7);
  const colOffset = fontSize;
  const vOffset = fontSize / 2;

  const boxes = box.append("g").attr("stroke-width", 0.5).attr("stroke", "#111111").attr("stroke-dasharray", "none");
  const labels = box.append("g").attr("stroke", "none");

  const columns = Math.ceil(items.length / itemsInCol);
  const linesInColumn = Math.ceil(items.length / columns);

  for (let column = 0, i = 0; column < columns; column++) {
    const offset = column ? colOffset * 2 + getBBox(node).width : colOffset;

    for (let line = 0; line < linesInColumn && items[i]; line++, i++) {
      boxes
        .append("rect")
        .attr("fill", items[i][1])
        .attr("x", offset)
        .attr("y", lineHeight + line * lineHeight + vOffset)
        .attr("width", colorBoxSize)
        .attr("height", colorBoxSize);

      labels
        .append("text")
        .attr("text-rendering", "optimizeSpeed")
        .text(items[i][2])
        .attr("x", offset + colorBoxSize * 1.6)
        .attr("y", fontSize / 1.6 + lineHeight + line * lineHeight + vOffset);
    }
  }

  // measured before the title is in, so it centres over the wider of itself and the items
  const itemsWidth = items.length ? getBBox(node).width : 0;
  const title = labels
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .attr("font-size", "1.2em")
    .attr("class", "legendLabel")
    .text(name);
  const titleWidth = (title.node() as SVGTextElement).getComputedTextLength();
  title.attr("x", colOffset + Math.max(itemsWidth, titleWidth) / 2).attr("y", fontSize * 1.1 + vOffset / 2);

  const bbox = getBBox(node);
  box
    .insert("rect", ":first-child")
    .attr("class", "legendBox")
    .attr("data-columns", itemsInCol)
    .attr("data-group", "box")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", bbox.width + colOffset * 2)
    .attr("height", bbox.height + colOffset / 2 + vOffset)
    .attr("fill", backColor)
    .attr("fill-opacity", opacity);

  // a box keeps the spot it is given until dragged, so a redraw never reshuffles the shown ones
  if (!legendPositions.get(name)) legendPositions.set(name, placeNewBox(node));

  fitLegendBox();
}

/** Keep every legend box within the canvas, at its stored relative position */
export function fitLegendBox(): void {
  for (const node of getBoxes()) {
    const { x: px, y: py } = positionOf(node.dataset.legend ?? "");
    const bbox = getBBox(node);
    const x = rn(viewport.width * (px / 100) - bbox.width);
    const y = rn(viewport.height * (py / 100) - bbox.height);
    node.setAttribute("transform", `translate(${x},${y})`);
  }
}

/** Drag handler moving the legend box under the cursor and storing its relative position */
export function dragLegendBox(event: D3DragEvent<SVGGElement, unknown, unknown>): void {
  const node = legendBoxFromEvent(event.sourceEvent);
  if (!node) return;

  const name = node.dataset.legend ?? "";
  const transform = parseTransform(node.getAttribute("transform") || "");
  const x = Number(transform[0]) - event.x;
  const y = Number(transform[1]) - event.y;
  const bbox = getBBox(node);

  event.on("drag", dragEvent => {
    const px = rn(((x + dragEvent.x + bbox.width) / viewport.width) * 100, 2);
    const py = rn(((y + dragEvent.y + bbox.height) / viewport.height) * 100, 2);
    node.setAttribute("transform", `translate(${x + dragEvent.x},${y + dragEvent.y})`);
    legendPositions.set(name, { x: px, y: py, dragged: true });
  });
}

// where a new box goes: its bottom-right corner, in % of the canvas
const ANCHOR = { x: 99, y: 93 };

// the remembered spot of a box, falling back to the anchor
const positionOf = (name: string): { x: number; y: number } => legendPositions.get(name) ?? ANCHOR;

// the anchor places a new box by its bottom-right corner alone. It is tried against the shown boxes on
// all four sides - a legend dragged into a corner leaves room on only some of them - and aligned with
// the box it is placed against. Only boxes whose spot is already settled count: during a redraw the DOM still holds the previous
// pass's transforms, so the rectangles are derived from the remembered positions, never read back
function placeNewBox(node: SVGGElement): LegendPosition {
  const { x: anchorX, y: anchorY } = ANCHOR;
  const boxes = getBoxes().flatMap(other => {
    if (other === node) return [];
    const position = legendPositions.get(other.dataset.legend ?? "");
    if (!position) return [];
    const bbox = getBBox(other);
    const right = viewport.width * (position.x / 100);
    const bottom = viewport.height * (position.y / 100);
    return [{ left: right - bbox.width, top: bottom - bbox.height, right, bottom }];
  });
  const { width, height } = getBBox(node);
  const rect = (right: number, bottom: number) => ({ left: right - width, top: bottom - height, right, bottom });
  const free = (spot: ReturnType<typeof rect>) =>
    boxes.every(
      box => spot.left >= box.right || box.left >= spot.right || spot.top >= box.bottom || box.top >= spot.bottom
    );

  // the anchor comes first, so a box that leaves the stack gives its slot back to the next one
  const anchor = rect(viewport.width * (anchorX / 100), viewport.height * (anchorY / 100));
  if (!boxes.length || free(anchor)) return { x: anchorX, y: anchorY };

  const furthest = (side: "top" | "bottom" | "left" | "right") =>
    boxes.reduce((a, b) =>
      side === "bottom" || side === "right" ? (b[side] > a[side] ? b : a) : b[side] < a[side] ? b : a
    );

  // each corner is clamped so an auto-placed box never lands partly outside the canvas
  const clamped = (right: number, bottom: number) =>
    rect(minmax(right, width, viewport.width), minmax(bottom, height, viewport.height));

  const above = furthest("top");
  const below = furthest("bottom");
  const leftOf = furthest("left");
  const rightOf = furthest("right");
  const candidates = [
    clamped(above.right, above.top - STACK_GAP),
    clamped(below.right, below.bottom + STACK_GAP + height),
    clamped(leftOf.left - STACK_GAP, leftOf.bottom),
    clamped(rightOf.right + STACK_GAP + width, rightOf.bottom)
  ];

  for (const spot of candidates) {
    if (free(spot))
      return { x: rn((spot.right / viewport.width) * 100, 2), y: rn((spot.bottom / viewport.height) * 100, 2) };
  }

  return { x: anchorX, y: anchorY }; // canvas is full: overlap and let the user drag it away
}

/** The legend box an event happened on */
export function legendBoxFromEvent(event: Event | undefined): SVGGElement | null {
  const target = event?.target;
  if (!(target instanceof Element)) return null;
  return target.closest<SVGGElement>("#legend > g[data-legend]");
}

window.fitLegendBox = fitLegendBox;

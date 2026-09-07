// The legend boxes: titled, multi-column lists of color swatches drawn over the map.
// Several boxes can be shown at once - one per source (States, Zones, ...). Each lives in its own
// group inside the #legend layer, is keyed by its title and carries its own position in the store

import { type D3DragEvent, select } from "d3";
import { minmax, parseTransform, rn } from "@/utils";

// [id, color, label] as stored in the legend `data` attribute
export type LegendItem = (string | number | undefined)[];

const STACK_GAP = 10; // px kept between the boxes when a new one is placed automatically

const getLayer = () => select<SVGGElement, unknown>("#legend");
const getBoxes = () => Array.from(document.querySelectorAll<SVGGElement>("#legend > g[data-legend]"));
const getBox = (name: string) => getBoxes().find(node => node.dataset.legend === name);
const getBBox = (node: SVGGElement) => node.getBBox();

/** Whether the named legend box is currently shown on the map */
export const hasLegend = (name: string): boolean => Boolean(getBox(name));

/** Draw the named legend box with the given items, replacing that box alone if it is already shown */
export function drawLegend(name: string, data: LegendItem[]): void {
  const layer = getLayer();

  // the store owns the box styling and the column count; the box is redrawn from it every time
  const itemsInCol = styles.legend.options.columns;
  const backColor = styles.legend.box.attrs.fill;
  const opacity = Number(styles.legend.box.attrs["fill-opacity"]);
  const fontSize = styles.legend.options.fontSize;

  layer.attr("font-size", fontSize); // the drawn texts size by inheritance

  const node = getBox(name) ?? (layer.append("g").attr("data-legend", name).node() as SVGGElement);
  const box = select(node);
  box.selectAll("*").remove(); // fully redraw every time
  box.attr("data", data.join("|")); // store data to redraw on style change

  const lineHeight = Math.round(fontSize * 1.7);
  const colorBoxSize = Math.round(fontSize / 1.7);
  const colOffset = fontSize;
  const vOffset = fontSize / 2;

  const boxes = box.append("g").attr("stroke-width", 0.5).attr("stroke", "#111111").attr("stroke-dasharray", "none");
  const labels = box.append("g").attr("fill", "#000000").attr("stroke", "none");

  const columns = Math.ceil(data.length / itemsInCol);
  const linesInColumn = Math.ceil(data.length / columns);

  for (let column = 0, i = 0; column < columns; column++) {
    const offset = column ? colOffset * 2 + getBBox(node).width : colOffset;

    for (let line = 0; line < linesInColumn && data[i]; line++, i++) {
      boxes
        .append("rect")
        .attr("fill", String(data[i][1]))
        .attr("x", offset)
        .attr("y", lineHeight + line * lineHeight + vOffset)
        .attr("width", colorBoxSize)
        .attr("height", colorBoxSize);

      labels
        .append("text")
        .attr("text-rendering", "optimizeSpeed")
        .text(String(data[i][2]))
        .attr("x", offset + colorBoxSize * 1.6)
        .attr("y", fontSize / 1.6 + lineHeight + line * lineHeight + vOffset);
    }
  }

  labels
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .attr("font-size", "1.2em")
    .attr("class", "legendLabel")
    .text(name)
    .attr("x", colOffset + getBBox(node).width / 2)
    .attr("y", fontSize * 1.1 + vOffset / 2);

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
  if (!styles.legend.options.positions[name]) styles.legend.options.positions[name] = placeNewBox(node);

  fitLegendBox();
}

/** Redraw every shown legend box with the same data but current style settings */
export function redrawLegend(): void {
  adoptLegacyLegend();

  for (const node of getBoxes()) {
    const name = node.dataset.legend ?? "";
    const data: LegendItem[] = (node.getAttribute("data") || "").split("|").map(line => line.split(","));
    drawLegend(name, data);
  }
}

/** Keep every legend box within the canvas, at its stored relative position */
export function fitLegendBox(): void {
  for (const node of getBoxes()) {
    const { x: px, y: py } = positionOf(node.dataset.legend ?? "");
    const bbox = getBBox(node);
    const x = rn(svgWidth * (px / 100) - bbox.width);
    const y = rn(svgHeight * (py / 100) - bbox.height);
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
    const px = rn(((x + dragEvent.x + bbox.width) / svgWidth) * 100, 2);
    const py = rn(((y + dragEvent.y + bbox.height) / svgHeight) * 100, 2);
    node.setAttribute("transform", `translate(${x + dragEvent.x},${y + dragEvent.y})`);
    styles.legend.options.positions[name] = { x: px, y: py };
  });
}

/** Click handler hiding the clicked legend box alone */
export function onLegendClick(event: Event): void {
  const name = legendBoxFromEvent(event)?.dataset.legend;
  if (name) clearLegend(name);
}

/** Remove the named legend box, or every box when no name is given */
export function clearLegend(name?: string): void {
  if (name === undefined) {
    getLayer().html("").attr("data", null); // pre-multi-box maps kept the items on the layer itself
    return;
  }

  getBox(name)?.remove();
}

// the stored spot of a box, falling back to the anchor the style preset defines
function positionOf(name: string): { x: number; y: number } {
  const { x, y, positions } = styles.legend.options;
  return positions[name] ?? { x, y };
}

// options.x/y anchors the bottom-right corner of a box in % of the canvas, so a new box is placed by
// that corner alone. It is tried against the shown boxes on all four sides - a legend dragged into a
// corner leaves room on only some of them - and aligned with the box it is placed against
function placeNewBox(node: SVGGElement): { x: number; y: number } {
  const { x: anchorX, y: anchorY } = styles.legend.options;
  const shown = getBoxes().filter(other => other !== node);
  if (!shown.length) return { x: anchorX, y: anchorY };

  const { width, height } = getBBox(node);
  const boxes = shown.map(other => {
    const [left, top] = parseTransform(other.getAttribute("transform") || "");
    const bbox = getBBox(other);
    return { left, top, right: left + bbox.width, bottom: top + bbox.height };
  });
  const furthest = (side: "top" | "bottom" | "left" | "right") =>
    boxes.reduce((a, b) =>
      side === "bottom" || side === "right" ? (b[side] > a[side] ? b : a) : b[side] < a[side] ? b : a
    );

  // the corner is clamped so an auto-placed box never lands partly outside the canvas
  const spot = (right: number, bottom: number) => ({
    x: rn((minmax(right, width, svgWidth) / svgWidth) * 100, 2),
    y: rn((minmax(bottom, height, svgHeight) / svgHeight) * 100, 2)
  });

  const above = furthest("top");
  if (above.top - STACK_GAP - height >= 0) return spot(above.right, above.top - STACK_GAP);

  const below = furthest("bottom");
  if (below.bottom + STACK_GAP + height <= svgHeight) return spot(below.right, below.bottom + STACK_GAP + height);

  const leftOf = furthest("left");
  if (leftOf.left - STACK_GAP - width >= 0) return spot(leftOf.left - STACK_GAP, leftOf.bottom);

  const rightOf = furthest("right");
  if (rightOf.right + STACK_GAP + width <= svgWidth) return spot(rightOf.right + STACK_GAP + width, rightOf.bottom);

  return { x: anchorX, y: anchorY }; // canvas is full: overlap and let the user drag it away
}

// maps saved before the legend could hold several boxes keep their single box in the layer group itself
function adoptLegacyLegend(): void {
  const layer = document.getElementById("legend");
  if (!layer?.hasAttribute("data")) return;

  const name = layer.querySelector("#legendLabel")?.textContent || "Legend";
  const data = layer.getAttribute("data") || "";
  layer.removeAttribute("data");
  layer.removeAttribute("transform");

  getLayer().html("").append("g").attr("data-legend", name).attr("data", data);
}

function legendBoxFromEvent(event: Event | undefined): SVGGElement | null {
  const target = event?.target;
  if (!(target instanceof Element)) return null;
  return target.closest<SVGGElement>("#legend > g[data-legend]");
}

export const Legend = { draw: drawLegend, redraw: redrawLegend, fit: fitLegendBox, clear: clearLegend, has: hasLegend };

window.fitLegendBox = fitLegendBox;
window.clearLegend = clearLegend;
window.onLegendClick = onLegendClick;

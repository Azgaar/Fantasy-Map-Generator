// The legend box: a titled, multi-column list of color swatches drawn over the map

import { type D3DragEvent, select } from "d3";
import { ensureEl, parseTransform, rn } from "@/utils";

// [id, color, label] as stored in the legend `data` attribute
export type LegendItem = (string | number | undefined)[];

const getLegend = () => select<SVGGElement, unknown>("#legend");

/** Draw the legend box with the given title and items, replacing whatever is there */
export function drawLegend(name: string, data: LegendItem[]): void {
  const legend = getLegend();
  legend.selectAll("*").remove(); // fully redraw every time
  legend.attr("data", data.join("|")); // store data to redraw on style change

  const itemsInCol = Number(ensureEl<HTMLInputElement>("styleLegendColItems").value);
  const fontSize = Number(legend.attr("font-size"));
  const backColor = ensureEl<HTMLInputElement>("styleLegendBack").value;
  const opacity = Number(ensureEl<HTMLInputElement>("styleLegendOpacity").value);

  const lineHeight = Math.round(fontSize * 1.7);
  const colorBoxSize = Math.round(fontSize / 1.7);
  const colOffset = fontSize;
  const vOffset = fontSize / 2;

  const boxes = legend.append("g").attr("stroke-width", 0.5).attr("stroke", "#111111").attr("stroke-dasharray", "none");
  const labels = legend.append("g").attr("fill", "#000000").attr("stroke", "none");

  const columns = Math.ceil(data.length / itemsInCol);
  const linesInColumn = Math.ceil(data.length / columns);

  for (let column = 0, i = 0; column < columns; column++) {
    const offset = column ? colOffset * 2 + getBBox(legend).width : colOffset;

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
    .attr("id", "legendLabel")
    .text(name)
    .attr("x", colOffset + getBBox(legend).width / 2)
    .attr("y", fontSize * 1.1 + vOffset / 2);

  const bbox = getBBox(legend);
  legend
    .insert("rect", ":first-child")
    .attr("id", "legendBox")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", bbox.width + colOffset * 2)
    .attr("height", bbox.height + colOffset / 2 + vOffset)
    .attr("fill", backColor)
    .attr("fill-opacity", opacity);

  fitLegendBox();
}

/** Redraw the legend with the same data but current style settings */
export function redrawLegend(): void {
  const legend = getLegend();
  if (!legend.select("rect").size()) return;

  const name = legend.select("#legendLabel").text();
  const data: LegendItem[] = (legend.attr("data") || "").split("|").map(line => line.split(","));
  drawLegend(name, data);
}

/** Keep the legend box within the canvas, at its stored relative position */
export function fitLegendBox(): void {
  const legend = getLegend();
  if (!legend.selectAll("*").size()) return;

  const px = Number.isNaN(Number(legend.attr("data-x"))) ? 0.99 : Number(legend.attr("data-x")) / 100;
  const py = Number.isNaN(Number(legend.attr("data-y"))) ? 0.93 : Number(legend.attr("data-y")) / 100;

  const bbox = getBBox(legend);
  const x = rn(svgWidth * px - bbox.width);
  const y = rn(svgHeight * py - bbox.height);
  legend.attr("transform", `translate(${x},${y})`);
}

/** Drag handler moving the legend box and storing its relative position */
export function dragLegendBox(event: D3DragEvent<SVGGElement, unknown, unknown>): void {
  const legend = getLegend();
  const transform = parseTransform(legend.attr("transform"));
  const x = Number(transform[0]) - event.x;
  const y = Number(transform[1]) - event.y;
  const bbox = getBBox(legend);

  event.on("drag", dragEvent => {
    const px = rn(((x + dragEvent.x + bbox.width) / svgWidth) * 100, 2);
    const py = rn(((y + dragEvent.y + bbox.height) / svgHeight) * 100, 2);
    legend
      .attr("transform", `translate(${x + dragEvent.x},${y + dragEvent.y})`)
      .attr("data-x", px)
      .attr("data-y", py);
  });
}

export function clearLegend(): void {
  const legend = getLegend();
  legend.selectAll("*").remove();
  legend.attr("data", null);
}

const getBBox = (legend: ReturnType<typeof getLegend>) => (legend.node() as SVGGElement).getBBox();

export const Legend = { draw: drawLegend, redraw: redrawLegend, fit: fitLegendBox, clear: clearLegend };

window.redrawLegend = redrawLegend;
window.fitLegendBox = fitLegendBox;
window.clearLegend = clearLegend;

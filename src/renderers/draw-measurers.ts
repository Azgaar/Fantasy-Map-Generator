import { curveCatmullRom, curveCatmullRomClosed, line, polygonArea, select } from "d3";
import polylabel from "polylabel";
import type { Measurer, MeasurerType } from "@/model/annotations/measurers-generator";
import type { Point } from "@/model/graph/voronoi";
import { getArea, getAreaUnit, getDistance } from "@/model/units";
import { last } from "@/utils/array-utils";
import { rn, si } from "@/utils/number-utils";
import { round } from "@/utils/string-utils";

const openCurveGen = line<Point>().curve(curveCatmullRom.alpha(0.5));
const closedCurveGen = line<Point>().curve(curveCatmullRomClosed.alpha(0.5));

// the layer's stroke, baked into each measurer's parts; the font sizes by inheritance.
// Widths and labels in screen pixels, dashes in map units so the stripes zoom with the map
type MeasurerStyle = { strokeWidth: string; dasharray: string };

const toScreen = (value: number) => `calc(${value} * var(--px))`;

function getMeasurerStyle(): MeasurerStyle {
  const { attrs } = styles.rulers;
  return { strokeWidth: toScreen(attrs["stroke-width"] ?? 1), dasharray: attrs["stroke-dasharray"] ?? "none" };
}

export function drawMeasurers(): void {
  const fontSize = parseFloat(styles.rulers.attrs["font-size"] ?? "") || 20;
  select("#ruler").style("font-size", toScreen(fontSize)).selectAll("*").remove();
  if (!pack.measurers) return;
  const style = getMeasurerStyle();
  for (const measurer of pack.measurers) RENDERERS[measurer.type](measurer, style);
}

const RENDERERS: Record<MeasurerType, (measurer: Measurer, style: MeasurerStyle) => void> = {
  Ruler: renderRuler,
  Opisometer: renderPathMeasurer,
  RouteOpisometer: renderPathMeasurer,
  Planimeter: renderPlanimeter
};

function renderRuler(measurer: Measurer, { strokeWidth, dasharray }: MeasurerStyle): void {
  const points = measurer.points.join(" ");

  const el = select("#ruler").append<SVGGElement>("g").attr("class", "ruler");
  el.append("polyline")
    .attr("points", points)
    .attr("class", "white")
    .style("stroke-width", strokeWidth)
    .attr("stroke-dasharray", "none");
  el.append("polyline")
    .attr("points", points)
    .attr("class", "gray")
    .style("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dasharray);

  const circles = el.append("g").attr("class", "rulerPoints").attr("stroke-dasharray", "none");
  for (let i = 0; i < measurer.points.length; i++) {
    const [x, y] = measurer.points[i];
    const isEdge = i === 0 || i === measurer.points.length - 1;
    circles
      .append("circle")
      .attr("r", "1em")
      .attr("cx", x)
      .attr("cy", y)
      .attr("class", isEdge ? "edge" : "control");
  }

  let length = 0;
  for (let i = 0; i < measurer.points.length - 1; i++) {
    const [x1, y1] = measurer.points[i];
    const [x2, y2] = measurer.points[i + 1];
    length += Math.hypot(x1 - x2, y1 - y2);
  }
  const [x, y] = last(measurer.points);
  el.append("text").attr("dx", ".35em").attr("dy", "-.45em").attr("x", x).attr("y", y).text(getDistance(length));
}

function renderPathMeasurer(measurer: Measurer, { strokeWidth, dasharray }: MeasurerStyle): void {
  const path = round(openCurveGen(measurer.points) || "");

  const el = select("#ruler").append<SVGGElement>("g").attr("class", "opisometer");
  const white = el
    .append<SVGPathElement>("path")
    .attr("d", path)
    .attr("class", "white")
    .style("stroke-width", strokeWidth)
    .attr("stroke-dasharray", "none");
  el.append("path")
    .attr("d", path)
    .attr("class", "gray")
    .style("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dasharray);

  const [x1, y1] = measurer.points[0];
  const [x2, y2] = last(measurer.points);
  const circles = el.append("g").attr("class", "rulerPoints").attr("stroke-dasharray", "none");
  circles.append("circle").attr("r", "1em").attr("cx", x1).attr("cy", y1);
  circles.append("circle").attr("r", "1em").attr("cx", x2).attr("cy", y2);

  const length = white.node()?.getTotalLength() || 0;
  el.append("text").attr("dx", ".35em").attr("dy", "-.45em").attr("x", x2).attr("y", y2).text(getDistance(length));
}

function renderPlanimeter(measurer: Measurer, { strokeWidth, dasharray }: MeasurerStyle): void {
  const path = round(closedCurveGen(measurer.points) || "");

  const el = select("#ruler").append<SVGGElement>("g").attr("class", "planimeter");
  el.append("path")
    .attr("d", path)
    .attr("class", "planimeter")
    .style("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dasharray);

  const text = el.append("text");
  if (measurer.points.length < 3) return;
  const area = rn(Math.abs(polygonArea(measurer.points)));
  const [x, y] = polylabel([measurer.points], 1.0);
  text
    .attr("x", x)
    .attr("y", y)
    .text(`${si(getArea(area))} ${getAreaUnit()}`);
}

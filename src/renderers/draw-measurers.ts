import { curveCatmullRom, curveCatmullRomClosed, line, polygonArea, select } from "d3";
import polylabel from "polylabel";
import type { Measurer, MeasurerType } from "@/generators/measurers-generator";
import type { Point } from "@/generators/voronoi";
import { last, rn, round, si } from "@/utils";

const openCurveGen = line<Point>().curve(curveCatmullRom.alpha(0.5));
const closedCurveGen = line<Point>().curve(curveCatmullRomClosed.alpha(0.5));

// style defaults, overridable via attributes on the #ruler group (Style tab)
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_DASHARRAY = "10";

type MeasurerStyle = { strokeWidth: number; dasharray: string; fontSize: number };

function getMeasurerStyle(): MeasurerStyle {
  const ruler = document.getElementById("ruler");
  const strokeWidth = Number(ruler?.getAttribute("stroke-width")) || DEFAULT_STROKE_WIDTH;
  const fontSize = Number(ruler?.getAttribute("font-size")) || DEFAULT_FONT_SIZE;
  // an empty attribute means "no dashes"; only a missing one falls back to the default
  const dasharray = ruler?.getAttribute("stroke-dasharray") ?? DEFAULT_DASHARRAY;
  return { strokeWidth, dasharray, fontSize };
}

const getDistance = (length: number): string => `${rn(length * distanceScale)} ${distanceUnitInput.value}`;

export function drawMeasurers(): void {
  select("#ruler").selectAll("*").remove();
  if (!pack.measurers) return;
  const style = getMeasurerStyle();
  for (const measurer of pack.measurers) RENDERERS[measurer.type](measurer, style);
}

export function undrawMeasurers(): void {
  select("#ruler").selectAll("*").remove();
}

const RENDERERS: Record<MeasurerType, (measurer: Measurer, style: MeasurerStyle) => void> = {
  Ruler: renderRuler,
  Opisometer: renderPathMeasurer,
  RouteOpisometer: renderPathMeasurer,
  Planimeter: renderPlanimeter
};

function renderRuler(measurer: Measurer, { strokeWidth, dasharray, fontSize }: MeasurerStyle): void {
  const points = measurer.points.join(" ");

  const el = select("#ruler").append<SVGGElement>("g").attr("class", "ruler").attr("font-size", fontSize);
  el.append("polyline")
    .attr("points", points)
    .attr("class", "white")
    .attr("stroke-width", strokeWidth)
    .attr("stroke-dasharray", "none");
  el.append("polyline")
    .attr("points", points)
    .attr("class", "gray")
    .attr("stroke-width", rn(strokeWidth * 1.2, 2))
    .attr("stroke-dasharray", dasharray);

  const circles = el
    .append("g")
    .attr("class", "rulerPoints")
    .attr("stroke-width", 0.5 * strokeWidth)
    .attr("stroke-dasharray", "none")
    .attr("font-size", 2 * strokeWidth);
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

function renderPathMeasurer(measurer: Measurer, { strokeWidth, dasharray, fontSize }: MeasurerStyle): void {
  const path = round(openCurveGen(measurer.points) || "");

  const el = select("#ruler").append<SVGGElement>("g").attr("class", "opisometer").attr("font-size", fontSize);
  const white = el
    .append<SVGPathElement>("path")
    .attr("d", path)
    .attr("class", "white")
    .attr("stroke-width", strokeWidth)
    .attr("stroke-dasharray", "none");
  el.append("path")
    .attr("d", path)
    .attr("class", "gray")
    .attr("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dasharray);

  const [x1, y1] = measurer.points[0];
  const [x2, y2] = last(measurer.points);
  const circles = el
    .append("g")
    .attr("class", "rulerPoints")
    .attr("stroke-width", 0.5 * strokeWidth)
    .attr("stroke-dasharray", "none")
    .attr("font-size", 2 * strokeWidth);
  circles.append("circle").attr("r", "1em").attr("cx", x1).attr("cy", y1);
  circles.append("circle").attr("r", "1em").attr("cx", x2).attr("cy", y2);

  const length = white.node()?.getTotalLength() || 0;
  el.append("text").attr("dx", ".35em").attr("dy", "-.45em").attr("x", x2).attr("y", y2).text(getDistance(length));
}

function renderPlanimeter(measurer: Measurer, { strokeWidth, dasharray, fontSize }: MeasurerStyle): void {
  const path = round(closedCurveGen(measurer.points) || "");

  const el = select("#ruler").append<SVGGElement>("g").attr("class", "planimeter").attr("font-size", fontSize);
  el.append("path")
    .attr("d", path)
    .attr("class", "planimeter")
    .attr("stroke-width", strokeWidth)
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

// Legacy seam — classic layers.js draws the layer via a global
declare global {
  // biome-ignore lint/suspicious/noRedeclare: exposed on window for legacy JS
  var drawMeasurers: () => void;
}
window.drawMeasurers = drawMeasurers;

// utils to be used for debugging (not in PROD)

import {getColorScheme, TColorScheme} from "./colorUtils";
import {getNormal} from "./lineUtils";

export function drawPoint([x, y]: TPoint, {radius = 1, color = "red"} = {}) {
  debug.append("circle").attr("cx", x).attr("cy", y).attr("r", radius).attr("fill", color);
}

export function drawPolygon(
  points: TPoints,
  {fill = "lighblue", fillOpacity = 0.3, stroke = "#222", strokeWidth = 0.2} = {}
) {
  debug
    .append("polyline")
    .attr("points", [...points, points[0]].join(" "))
    .attr("fill", fill)
    .attr("fill-opacity", fillOpacity)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);
}

export function drawLine([x1, y1]: TPoint, [x2, y2]: TPoint, {stroke = "#444", strokeWidth = 0.2} = {}) {
  debug
    .append("line")
    .attr("x1", x1)
    .attr("y1", y1)
    .attr("x2", x2)
    .attr("y2", y2)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);
}

export function drawPolyline(points: TPoints, {fill = "none", stroke = "#444", strokeWidth = 0.2} = {}) {
  debug
    .append("polyline")
    .attr("points", points.join(" "))
    .attr("fill", fill)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);
}

export function drawPath(d: string, {fill = "none", stroke = "#444", strokeWidth = 0.2} = {}) {
  debug.append("path").attr("d", d).attr("fill", fill).attr("stroke", stroke).attr("stroke-width", strokeWidth);
}

export function drawArrow([x1, y1]: TPoint, [x2, y2]: TPoint, {width = 1, color = "#444"} = {}) {
  const normal = getNormal([x1, y1], [x2, y2]);
  const [xMid, yMid] = [(x1 + x2) / 2, (y1 + y2) / 2];

  const [xLeft, yLeft] = [xMid + width * Math.cos(normal), yMid + width * Math.sin(normal)];
  const [xRight, yRight] = [xMid - width * Math.cos(normal), yMid - width * Math.sin(normal)];

  debug
    .append("path")
    .attr("d", `M${x1},${y1} L${xMid},${yMid} ${xLeft},${yLeft} ${x2},${y2} ${xRight},${yRight} ${xMid},${yMid} Z`)
    .attr("fill", color)
    .attr("stroke", color)
    .attr("stroke-width", width / 2);
}

export function drawText(text: string | number, [x, y]: TPoint, {size = 6, color = "black"} = {}) {
  debug
    .append("text")
    .attr("x", x)
    .attr("y", y)
    .attr("font-size", size)
    .attr("fill", color)
    .attr("stroke", "none")
    .text(text);
}

export function drawPolygons(
  values: TypedArray | number[],
  cellVertices: number[][],
  vertexPoints: TPoints,
  {
    fillOpacity = 0.3,
    stroke = "#222",
    strokeWidth = 0.2,
    colorScheme = "default",
    excludeZeroes = false
  }: {
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    colorScheme?: TColorScheme;
    excludeZeroes?: boolean;
  } = {}
) {
  const cellIds = [...Array(values.length).keys()];
  const data = excludeZeroes ? cellIds.filter(id => values[id] !== 0) : cellIds;

  const getPolygon = (id: number) => {
    const vertices = cellVertices[id];
    const points = vertices.map(id => vertexPoints[id]);
    return `${points.join(" ")} ${points[0].join(",")}`;
  };

  // get fill from normalizing and interpolating values to color scheme
  const min = Math.min(...values);
  const max = Math.max(...values);
  const normalized = Array.from(values).map(value => (value - min) / (max - min));
  const scheme = getColorScheme(colorScheme);
  const getFill = (id: number) => scheme(normalized[id])!;

  debug
    .selectAll("polyline")
    .data(data)
    .enter()
    .append("polyline")
    .attr("points", getPolygon)
    .attr("fill", getFill)
    .attr("fill-opacity", fillOpacity)
    .attr("stroke", stroke)
    .attr("stroke-width", strokeWidth);
}

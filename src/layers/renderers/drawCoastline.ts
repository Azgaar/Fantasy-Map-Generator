import * as d3 from "d3";

import {simplify} from "scripts/simplify";
import {filterOutOfCanvasPoints} from "utils/lineUtils";
import {round} from "utils/stringUtils";

export function drawCoastline(vertices: IGraphVertices, features: TPackFeatures) {
  const landMask = defs.select("#land");
  const waterMask = defs.select("#water");

  const lineGen = d3.line().curve(d3.curveBasisClosed);
  const SIMPLIFICATION_TOLERANCE = 0.5; // px

  // map edge rectangle
  debug
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", graphWidth)
    .attr("height", graphHeight)
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 0.1);

  for (const feature of features) {
    if (!feature) continue;
    if (feature.type === "ocean") continue;

    const points = feature.vertices.map(vertex => vertices.p[vertex]);
    const filteredPoints = filterOutOfCanvasPoints(points);
    const simplifiedPoints = simplify(filteredPoints, SIMPLIFICATION_TOLERANCE);
    const path = round(lineGen(simplifiedPoints)!);

    points.forEach(([x, y]) => {
      debug.append("circle").attr("cx", x).attr("cy", y).attr("r", 0.3).attr("fill", "red");
    });

    filteredPoints.forEach(([x, y]) => {
      debug.append("circle").attr("cx", x).attr("cy", y).attr("r", 0.3).attr("fill", "blue");
    });

    simplifiedPoints.forEach(([x, y]) => {
      debug.append("circle").attr("cx", x).attr("cy", y).attr("r", 0.3).attr("fill", "green");
    });

    if (feature.type === "lake") {
      landMask
        .append("path")
        .attr("d", path)
        .attr("fill", "black")
        .attr("id", "land_" + feature.i);

      lakes
        .select("#freshwater")
        .append("path")
        .attr("d", path)
        .attr("id", "lake_" + feature.i)
        .attr("data-f", feature.i);
    } else {
      landMask
        .append("path")
        .attr("d", path)
        .attr("fill", "white")
        .attr("id", "land_" + feature.i);

      waterMask
        .append("path")
        .attr("d", path)
        .attr("fill", "black")
        .attr("id", "water_" + feature.i);

      const group = feature.group === "lake_island" ? "lake_island" : "sea_island";
      coastline
        .select("#" + group)
        .append("path")
        .attr("d", path)
        .attr("id", "island_" + feature.i)
        .attr("data-f", feature.i);
    }
  }
}

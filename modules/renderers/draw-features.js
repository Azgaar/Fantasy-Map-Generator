"use strict";

function drawFeatures() {
  TIME && console.time("drawFeatures");
  const {vertices, features} = pack;

  const featurePaths = defs.select("#featurePaths");
  const landMask = defs.select("#land");
  const waterMask = defs.select("#water");
  const lineGen = d3.line().curve(d3.curveBasisClosed);

  for (const feature of features) {
    if (!feature || feature.type === "ocean") continue;

    const points = feature.vertices.map(vertex => vertices.p[vertex]);
    const simplifiedPoints = simplify(points, 0.3);
    const clippedPoints = clipPoly(simplifiedPoints, 1);
    const path = round(lineGen(clippedPoints));

    featurePaths
      .append("path")
      .attr("d", path)
      .attr("id", "feature_" + feature.i)
      .attr("data-f", feature.i);

    if (feature.type === "lake") {
      landMask
        .append("use")
        .attr("href", "#feature_" + feature.i)
        .attr("data-f", feature.i)
        .attr("fill", "black");
      lakes
        .select(`#${feature.group}`)
        .append("use")
        .attr("href", "#feature_" + feature.i)
        .attr("data-f", feature.i);
    } else {
      landMask
        .append("use")
        .attr("href", "#feature_" + feature.i)
        .attr("data-f", feature.i)
        .attr("fill", "white");
      waterMask
        .append("use")
        .attr("href", "#feature_" + feature.i)
        .attr("data-f", feature.i)
        .attr("fill", "black");
      const coastlineGroup = feature.group === "lake_island" ? "#lake_island" : "#sea_island";
      coastline
        .select(coastlineGroup)
        .append("use")
        .attr("href", "#feature_" + feature.i)
        .attr("data-f", feature.i);
    }
  }

  TIME && console.timeEnd("drawFeatures");
}

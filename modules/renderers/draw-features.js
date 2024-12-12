"use strict";

function drawFeatures() {
  TIME && console.time("drawFeatures");
  const featurePaths = defs.select("#featurePaths");
  const landMask = defs.select("#land");
  const waterMask = defs.select("#water");

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean") continue;

    featurePaths
      .append("path")
      .attr("d", getFeaturePath(feature))
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

function getFeaturePath(feature) {
  const points = feature.vertices.map(vertex => pack.vertices.p[vertex]);
  const simplifiedPoints = simplify(points, 0.3);
  const clippedPoints = clipPoly(simplifiedPoints, 1);

  const lineGen = d3.line().curve(d3.curveBasisClosed);
  const path = round(lineGen(clippedPoints)) + "Z";

  return path;
}

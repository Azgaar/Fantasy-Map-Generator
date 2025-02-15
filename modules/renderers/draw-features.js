"use strict";

function drawFeatures() {
  TIME && console.time("drawFeatures");

  const html = {
    paths: [],
    landMask: [],
    waterMask: ['<rect x="0" y="0" width="100%" height="100%" fill="white" />'],
    coastline: {},
    lakes: {}
  };

  for (const feature of pack.features) {
    if (!feature || feature.type === "ocean") continue;

    html.paths.push(`<path d="${getFeaturePath(feature)}" id="feature_${feature.i}" data-f="${feature.i}"></path>`);

    if (feature.type === "lake") {
      html.landMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`);

      const lakeGroup = feature.group || "freshwater";
      if (!html.lakes[lakeGroup]) html.lakes[lakeGroup] = [];
      html.lakes[lakeGroup].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
    } else {
      html.landMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="white"></use>`);
      html.waterMask.push(`<use href="#feature_${feature.i}" data-f="${feature.i}" fill="black"></use>`);

      const coastlineGroup = feature.group === "lake_island" ? "lake_island" : "sea_island";
      if (!html.coastline[coastlineGroup]) html.coastline[coastlineGroup] = [];
      html.coastline[coastlineGroup].push(`<use href="#feature_${feature.i}" data-f="${feature.i}"></use>`);
    }
  }

  defs.select("#featurePaths").html(html.paths.join(""));
  defs.select("#land").html(html.landMask.join(""));
  defs.select("#water").html(html.waterMask.join(""));

  Object.entries(html.coastline).forEach(([group, paths]) => {
    coastline.select("#" + group).html(paths.join(""));
  });

  Object.entries(html.lakes).forEach(([group, paths]) => {
    lakes.select("#" + group).html(paths.join(""));
  });

  TIME && console.timeEnd("drawFeatures");
}

function getFeaturePath(feature) {
  const points = feature.vertices.map(vertex => pack.vertices.p[vertex]);
  if (points.some(point => point === undefined)) {
    ERROR && console.error("Undefined point in getFeaturePath");
    return "";
  }

  const simplifiedPoints = simplify(points, 0.3);
  const clippedPoints = clipPoly(simplifiedPoints, 1);

  const lineGen = d3.line().curve(d3.curveBasisClosed);
  const path = round(lineGen(clippedPoints)) + "Z";

  return path;
}

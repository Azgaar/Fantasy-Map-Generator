"use strict";

function drawCoastline() {
  TIME && console.time("drawCoastline");

  const {cells, vertices, features} = pack;
  const n = cells.i.length;

  const used = new Uint8Array(features.length); // store connected features

  const landMask = defs.select("#land");
  const waterMask = defs.select("#water");
  lineGen.curve(d3.curveBasisClosed);

  for (const i of cells.i) {
    const startFromEdge = !i && cells.h[i] >= 20;
    if (!startFromEdge && cells.t[i] !== -1 && cells.t[i] !== 1) continue; // non-edge cell

    const f = cells.f[i];
    if (used[f]) continue; // already connected
    if (features[f].type === "ocean") continue; // ocean cell

    const type = features[f].type === "lake" ? 1 : -1; // type value to search for
    const ofSameType = cellId => cells.t[cellId] === type || cellId >= n;

    const startingVertex = findStart(i, type);
    if (startingVertex === -1) continue; // cannot start here

    let vchain = connectVertices({vertices, startingVertex, ofSameType});
    if (features[f].type === "lake") relax(vchain, 1.2);
    used[f] = 1;

    let points = clipPoly(
      vchain.map(v => vertices.p[v]),
      1
    );

    const area = d3.polygonArea(points); // area with lakes/islands
    if (area > 0 && features[f].type === "lake") {
      points = points.reverse();
      vchain = vchain.reverse();
    }

    features[f].area = Math.abs(area);
    features[f].vertices = vchain;

    const path = round(lineGen(points));

    if (features[f].type === "lake") {
      landMask
        .append("path")
        .attr("d", path)
        .attr("fill", "black")
        .attr("id", "land_" + f);
      lakes
        .select("#freshwater")
        .append("path")
        .attr("d", path)
        .attr("id", "lake_" + f)
        .attr("data-f", f); // draw the lake
    } else {
      landMask
        .append("path")
        .attr("d", path)
        .attr("fill", "white")
        .attr("id", "land_" + f);
      waterMask
        .append("path")
        .attr("d", path)
        .attr("fill", "black")
        .attr("id", "water_" + f);
      const g = features[f].group === "lake_island" ? "lake_island" : "sea_island";
      coastline
        .select("#" + g)
        .append("path")
        .attr("d", path)
        .attr("id", "island_" + f)
        .attr("data-f", f); // draw the coastline
    }
  }

  // find cell vertex to start path detection
  function findStart(i, t) {
    if (t === -1 && cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= n)); // map border cell
    const filtered = cells.c[i].filter(c => cells.t[c] === t);
    const index = cells.c[i].indexOf(d3.min(filtered));
    return index === -1 ? index : cells.v[i][index];
  }

  // move vertices that are too close to already added ones
  function relax(vchain, r) {
    const p = vertices.p,
      tree = d3.quadtree();

    for (let i = 0; i < vchain.length; i++) {
      const v = vchain[i];
      let [x, y] = [p[v][0], p[v][1]];
      if (i && vchain[i + 1] && tree.find(x, y, r) !== undefined) {
        const v1 = vchain[i - 1],
          v2 = vchain[i + 1];
        const [x1, y1] = [p[v1][0], p[v1][1]];
        const [x2, y2] = [p[v2][0], p[v2][1]];
        [x, y] = [(x1 + x2) / 2, (y1 + y2) / 2];
        p[v] = [x, y];
      }
      tree.add([x, y]);
    }
  }

  TIME && console.timeEnd("drawCoastline");
}

function drawFeatures() {
  TIME && console.time("drawFeatures");
  const {vertices, features} = pack;

  const landMask = defs.select("#land");
  const waterMask = defs.select("#water");
  const lineGen = d3.line().curve(d3.curveBasisClosed);

  for (const feature of features) {
    if (!feature || feature.type === "ocean") continue;

    const points = feature.vertices.map(vertex => vertices.p[vertex]);
    const simplifiedPoints = simplify(points, 0.3);
    const clippedPoints = clipPoly(simplifiedPoints, 1);
    const path = round(lineGen(clippedPoints));

    if (feature.type === "lake") {
      landMask
        .append("path")
        .attr("d", path)
        .attr("fill", "black")
        .attr("id", "land_" + feature.i);

      lakes
        .select(`#${feature.group}`)
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

      coastline
        .select(`#${feature.group}`)
        .append("path")
        .attr("d", path)
        .attr("id", "island_" + feature.i)
        .attr("data-f", feature.i);
    }
  }

  TIME && console.timeEnd("drawFeatures");
}

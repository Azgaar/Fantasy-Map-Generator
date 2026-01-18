"use strict";

function drawTemperature() {
  TIME && console.time("drawTemperature");

  temperature.selectAll("*").remove();
  lineGen.curve(d3.curveBasisClosed);
  const scheme = d3.scaleSequential(d3.interpolateSpectral);

  const tMax = +byId("temperatureEquatorOutput").max;
  const tMin = +byId("temperatureEquatorOutput").min;
  const delta = tMax - tMin;

  const {cells, vertices} = grid;
  const n = cells.i.length;

  const checkedCells = new Uint8Array(n);
  const addToChecked = cellId => (checkedCells[cellId] = 1);

  const min = d3.min(cells.temp);
  const max = d3.max(cells.temp);
  const step = Math.max(Math.round(Math.abs(min - max) / 5), 1);

  const isolines = d3.range(min + step, max, step);
  const chains = [];
  const labels = []; // store label coordinates

  for (const cellId of cells.i) {
    const t = cells.temp[cellId];
    if (checkedCells[cellId] || !isolines.includes(t)) continue;

    const startingVertex = findStart(cellId, t);
    if (!startingVertex) continue;
    checkedCells[cellId] = 1;

    const ofSameType = cellId => cells.temp[cellId] >= t;
    const chain = connectVertices({vertices, startingVertex, ofSameType, addToChecked});
    const relaxed = chain.filter((v, i) => i % 4 === 0 || vertices.c[v].some(c => c >= n));
    if (relaxed.length < 6) continue;

    const points = relaxed.map(v => vertices.p[v]);
    chains.push([t, points]);
    addLabel(points, t);
  }

  // min temp isoline covers all graph
  temperature
    .append("path")
    .attr("d", `M0,0 h${graphWidth} v${graphHeight} h${-graphWidth} Z`)
    .attr("fill", scheme(1 - (min - tMin) / delta))
    .attr("stroke", "none");

  for (const t of isolines) {
    const path = chains
      .filter(c => c[0] === t)
      .map(c => round(lineGen(c[1])))
      .join("");
    if (!path) continue;
    const fill = scheme(1 - (t - tMin) / delta),
      stroke = d3.color(fill).darker(0.2);
    temperature.append("path").attr("d", path).attr("fill", fill).attr("stroke", stroke);
  }

  const tempLabels = temperature.append("g").attr("id", "tempLabels").attr("fill-opacity", 1);
  tempLabels
    .selectAll("text")
    .data(labels)
    .enter()
    .append("text")
    .attr("x", d => d[0])
    .attr("y", d => d[1])
    .text(d => convertTemperature(d[2]));

  // find cell with temp < isotherm and find vertex to start path detection
  function findStart(i, t) {
    if (cells.b[i]) return cells.v[i].find(v => vertices.c[v].some(c => c >= n)); // map border cell
    return cells.v[i][cells.c[i].findIndex(c => cells.temp[c] < t || !cells.temp[c])];
  }

  function addLabel(points, t) {
    const xCenter = svgWidth / 2;

    // add label on isoline top center
    const tc =
      points[d3.scan(points, (a, b) => a[1] - b[1] + (Math.abs(a[0] - xCenter) - Math.abs(b[0] - xCenter)) / 2)];
    pushLabel(tc[0], tc[1], t);

    // add label on isoline bottom center
    if (points.length > 20) {
      const bc =
        points[d3.scan(points, (a, b) => b[1] - a[1] + (Math.abs(a[0] - xCenter) - Math.abs(b[0] - xCenter)) / 2)];
      const dist2 = (tc[1] - bc[1]) ** 2 + (tc[0] - bc[0]) ** 2; // square distance between this and top point
      if (dist2 > 100) pushLabel(bc[0], bc[1], t);
    }
  }

  function pushLabel(x, y, t) {
    if (x < 20 || x > svgWidth - 20) return;
    if (y < 20 || y > svgHeight - 20) return;
    labels.push([x, y, t]);
  }

  TIME && console.timeEnd("drawTemperature");
}

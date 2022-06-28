import {convertTemperature} from "/src/utils/unitUtils";

export function drawTemperature() {
  temperature.selectAll("*").remove();

  const lineGen = d3.line().curve(d3.curveBasisClosed);
  const scheme = d3.scaleSequential(d3.interpolateSpectral);
  const tMax = +temperatureEquatorOutput.max,
    tMin = +temperatureEquatorOutput.min,
    delta = tMax - tMin;

  const cells = grid.cells,
    vertices = grid.vertices,
    n = cells.i.length;
  const used = new Uint8Array(n); // to detect already passed cells
  const min = d3.min(cells.temp),
    max = d3.max(cells.temp);
  const step = Math.max(Math.round(Math.abs(min - max) / 5), 1);
  const isolines = d3.range(min + step, max, step);
  const chains = [],
    labels = []; // store label coordinates

  for (const i of cells.i) {
    const t = cells.temp[i];
    if (used[i] || !isolines.includes(t)) continue;
    const start = findStart(i, t);
    if (!start) continue;
    used[i] = 1;
    //debug.append("circle").attr("r", 3).attr("cx", vertices.p[start][0]).attr("cy", vertices.p[start][1]).attr("fill", "red").attr("stroke", "black").attr("stroke-width", .3);

    const chain = connectVertices(start, t); // vertices chain to form a path
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
    const c = svgWidth / 2; // map center x coordinate
    // add label on isoline top center
    const tc = points[d3.scan(points, (a, b) => a[1] - b[1] + (Math.abs(a[0] - c) - Math.abs(b[0] - c)) / 2)];
    pushLabel(tc[0], tc[1], t);

    // add label on isoline bottom center
    if (points.length > 20) {
      const bc = points[d3.scan(points, (a, b) => b[1] - a[1] + (Math.abs(a[0] - c) - Math.abs(b[0] - c)) / 2)];
      const dist2 = (tc[1] - bc[1]) ** 2 + (tc[0] - bc[0]) ** 2; // square distance between this and top point
      if (dist2 > 100) pushLabel(bc[0], bc[1], t);
    }
  }

  function pushLabel(x, y, t) {
    if (x < 20 || x > svgWidth - 20) return;
    if (y < 20 || y > svgHeight - 20) return;
    labels.push([x, y, t]);
  }

  // connect vertices to chain
  function connectVertices(start, t) {
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < 20000); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.temp[c] === t).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.temp[c[0]] < t;
      const c1 = c[1] >= n || cells.temp[c[1]] < t;
      const c2 = c[2] >= n || cells.temp[c[2]] < t;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    chain.push(start);
    return chain;
  }
}

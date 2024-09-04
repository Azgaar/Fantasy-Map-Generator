"use strict";

function drawHeightmap() {
  TIME && console.time("drawHeightmap");

  const ocean = terrs.select("#oceanHeights");
  const land = terrs.select("#landHeights");

  ocean.selectAll("*").remove();
  land.selectAll("*").remove();

  const paths = new Array(101);
  const {cells, vertices} = grid;
  const used = new Uint8Array(cells.i.length);
  const heights = Array.from(cells.i).sort((a, b) => cells.h[a] - cells.h[b]);

  // ocean cells
  const renderOceanCells = Boolean(+ocean.attr("data-render"));
  if (renderOceanCells) {
    const skip = +ocean.attr("skip") + 1 || 1;
    const relax = +ocean.attr("relax") || 0;
    lineGen.curve(d3[ocean.attr("curve") || "curveBasisClosed"]);

    let currentLayer = 0;
    for (const i of heights) {
      const h = cells.h[i];
      if (h > currentLayer) currentLayer += skip;
      if (h < currentLayer) continue;
      if (currentLayer >= 20) break;
      if (used[i]) continue; // already marked
      const onborder = cells.c[i].some(n => cells.h[n] < h);
      if (!onborder) continue;
      const vertex = cells.v[i].find(v => vertices.c[v].some(i => cells.h[i] < h));
      const chain = connectVertices(cells, vertices, vertex, h, used);
      if (chain.length < 3) continue;
      const points = simplifyLine(chain, relax).map(v => vertices.p[v]);
      if (!paths[h]) paths[h] = "";
      paths[h] += round(lineGen(points));
    }
  }

  // land cells
  {
    const skip = +land.attr("skip") + 1 || 1;
    const relax = +land.attr("relax") || 0;
    lineGen.curve(d3[land.attr("curve") || "curveBasisClosed"]);

    let currentLayer = 20;
    for (const i of heights) {
      const h = cells.h[i];
      if (h > currentLayer) currentLayer += skip;
      if (h < currentLayer) continue;
      if (currentLayer > 100) break; // no layers possible with height > 100
      if (used[i]) continue; // already marked
      const onborder = cells.c[i].some(n => cells.h[n] < h);
      if (!onborder) continue;

      const startVertex = cells.v[i].find(v => vertices.c[v].some(i => cells.h[i] < h));
      const chain = connectVertices(cells, vertices, startVertex, h, used);
      if (chain.length < 3) continue;

      const points = simplifyLine(chain, relax).map(v => vertices.p[v]);
      if (!paths[h]) paths[h] = "";
      paths[h] += round(lineGen(points));
    }
  }

  // render paths
  for (const height of d3.range(0, 101)) {
    const group = height < 20 ? ocean : land;
    const scheme = getColorScheme(group.attr("scheme"));

    if (height === 0 && renderOceanCells) {
      // draw base ocean layer
      group
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", graphWidth)
        .attr("height", graphHeight)
        .attr("fill", scheme(1));
    }

    if (height === 20) {
      // draw base land layer
      group
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", graphWidth)
        .attr("height", graphHeight)
        .attr("fill", scheme(0.8));
    }

    if (paths[height] && paths[height].length >= 10) {
      const terracing = group.attr("terracing") / 10 || 0;
      const color = getColor(height, scheme);

      if (terracing) {
        group
          .append("path")
          .attr("d", paths[height])
          .attr("transform", "translate(.7,1.4)")
          .attr("fill", d3.color(color).darker(terracing))
          .attr("data-height", height);
      }
      group.append("path").attr("d", paths[height]).attr("fill", color).attr("data-height", height);
    }
  }

  // connect vertices to chain: specific case for heightmap
  function connectVertices(cells, vertices, start, h, used) {
    const MAX_ITERATIONS = vertices.c.length;

    const n = cells.i.length;
    const chain = []; // vertices chain to form a path
    for (let i = 0, current = start; i === 0 || (current !== start && i < MAX_ITERATIONS); i++) {
      const prev = chain[chain.length - 1]; // previous vertex in chain
      chain.push(current); // add current vertex to sequence
      const c = vertices.c[current]; // cells adjacent to vertex
      c.filter(c => cells.h[c] === h).forEach(c => (used[c] = 1));
      const c0 = c[0] >= n || cells.h[c[0]] < h;
      const c1 = c[1] >= n || cells.h[c[1]] < h;
      const c2 = c[2] >= n || cells.h[c[2]] < h;
      const v = vertices.v[current]; // neighboring vertices
      if (v[0] !== prev && c0 !== c1) current = v[0];
      else if (v[1] !== prev && c1 !== c2) current = v[1];
      else if (v[2] !== prev && c0 !== c2) current = v[2];
      if (current === chain[chain.length - 1]) {
        ERROR && console.error("Next vertex is not found");
        break;
      }
    }
    return chain;
  }

  function simplifyLine(chain, simplification) {
    if (!simplification) return chain;
    const n = simplification + 1; // filter each nth element
    return chain.filter((d, i) => i % n === 0);
  }

  function getColor(value, scheme = getColorScheme("bright")) {
    return scheme(1 - (value < 20 ? value - 5 : value) / 100);
  }

  TIME && console.timeEnd("drawHeightmap");
}

"use strict";
// FMG utils used for debugging

function drawCellsValue(data) {
  debug.selectAll("text").remove();
  debug
    .selectAll("text")
    .data(data)
    .enter()
    .append("text")
    .attr("x", (d, i) => pack.cells.p[i][0])
    .attr("y", (d, i) => pack.cells.p[i][1])
    .text(d => d);
}

function drawPolygons(data) {
  const max = d3.max(data);
  const min = d3.min(data);
  const scheme = getColorScheme(terrs.select("#landHeights").attr("scheme"));

  data = data.map(d => 1 - normalize(d, min, max));

  debug.selectAll("polygon").remove();
  debug
    .selectAll("polygon")
    .data(data)
    .enter()
    .append("polygon")
    .attr("points", (d, i) => getGridPolygon(i))
    .attr("fill", d => scheme(d))
    .attr("stroke", d => scheme(d));
}

function drawRouteConnections() {
  debug.select("#connections").remove();
  const routes = debug.append("g").attr("id", "connections").attr("stroke-width", 0.8);

  const points = pack.cells.p;
  const links = pack.cells.routes;

  for (const from in links) {
    for (const to in links[from]) {
      const [x1, y1] = points[from];
      const [x3, y3] = points[to];
      const [x2, y2] = [(x1 + x3) / 2, (y1 + y3) / 2];
      const routeId = links[from][to];

      routes
        .append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("data-id", routeId)
        .attr("stroke", C_12[routeId % 12]);
    }
  }
}

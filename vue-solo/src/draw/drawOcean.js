export function drawOcean(cells,
                          rn,
                          diagram,
                          lineGen,
                          getContinuousLine,
                          oceanLayers) {
  console.time("drawOcean");
  let limits = [];
  let odd = 0.8; // initial odd for ocean layer is 80%
  // Define type of ocean cells based on cell distance form land
  let frontier = $.grep(cells, function(e) {return e.ctype === -1;});
  if (Math.random() < odd) {limits.push(-1); odd = 0.2;}
  for (let c = -2; frontier.length > 0 && c > -10; c--) {
    if (Math.random() < odd) {limits.unshift(c); odd = 0.2;} else {odd += 0.2;}
    frontier.map(function(i) {
      i.neighbors.forEach(function(e) {
        if (!cells[e].ctype) cells[e].ctype = c;
      });
    });
    frontier = $.grep(cells, function(e) {return e.ctype === c;});
  }
  if (outlineLayersInput.value === "none") return;
  if (outlineLayersInput.value !== "random") limits = outlineLayersInput.value.split(",");
  // Define area edges
  const opacity = rn(0.4 / limits.length, 2);
  for (let l=0; l < limits.length; l++) {
    const edges = [];
    const lim = +limits[l];
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].ctype < lim || cells[i].ctype === undefined) continue;
      if (cells[i].ctype > lim && cells[i].type !== "border") continue;
      const cell = diagram.cells[i];
      cell.halfedges.forEach(function(e) {
        const edge = diagram.edges[e];
        const start = edge[0].join(" ");
        const end = edge[1].join(" ");
        if (edge.left && edge.right) {
          const ea = edge.left.index === i ? edge.right.index : edge.left.index;
          if (cells[ea].ctype < lim) edges.push({start, end});
        } else {
          edges.push({start, end});
        }
      });
    }
    lineGen.curve(d3.curveBasis);
    let relax = 0.8 - l / 10;
    if (relax < 0.2) relax = 0.2;
    const line = getContinuousLine(edges, 0, relax);
    oceanLayers.append("path").attr("d", line).attr("fill", "#ecf2f9").style("opacity", opacity);
  }
  console.timeEnd("drawOcean");
}

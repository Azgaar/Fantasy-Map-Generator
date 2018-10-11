// Detect and draw the coasline
export function drawCoastline(cells,
                              rn,
                              features,
                              lineGen,
                              seed,
                              defs,
                              graphWidth,
                              land,
                              diagram,
                              getContinuousLine,
                              coastline,
                              lakes,
                              landmass,
                              graphHeight,
                              drawDefaultRuler) {
  console.time('drawCoastline');
  Math.seedrandom(seed); // reset seed to get the same result on heightmap edit
  const shape = defs.append("mask").attr("id", "shape").attr("fill", "black").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
  $("#landmass").empty();
  let minX = graphWidth, maxX = 0; // extreme points
  let minXedge, maxXedge; // extreme edges
  const oceanEdges = [],lakeEdges = [];
  for (let i=0; i < land.length; i++) {
    const id = land[i].index, cell = diagram.cells[id];
    const f = land[i].fn;
    land[i].height = Math.trunc(land[i].height);
    if (!oceanEdges[f]) {oceanEdges[f] = []; lakeEdges[f] = [];}
    cell.halfedges.forEach(function(e) {
      const edge = diagram.edges[e];
      const start = edge[0].join(" ");
      const end = edge[1].join(" ");
      if (edge.left && edge.right) {
        const ea = edge.left.index === id ? edge.right.index : edge.left.index;
        cells[ea].height = Math.trunc(cells[ea].height);
        if (cells[ea].height < 20) {
          cells[ea].ctype = -1;
          if (land[i].ctype !== 1) {
            land[i].ctype = 1; // mark coastal land cells
            // move cell point closer to coast
            const x = (land[i].data[0] + cells[ea].data[0]) / 2;
            const y = (land[i].data[1] + cells[ea].data[1]) / 2;
            land[i].haven = ea; // harbor haven (oposite water cell)
            land[i].coastX = rn(x + (land[i].data[0] - x) * 0.1, 1);
            land[i].coastY = rn(y + (land[i].data[1] - y) * 0.1, 1);
            land[i].data[0] = rn(x + (land[i].data[0] - x) * 0.5, 1);
            land[i].data[1] = rn(y + (land[i].data[1] - y) * 0.5, 1);
          }
          if (features[cells[ea].fn].border) {
            oceanEdges[f].push({start, end});
            // island extreme points
            if (edge[0][0] < minX) {minX = edge[0][0]; minXedge = edge[0]}
            if (edge[1][0] < minX) {minX = edge[1][0]; minXedge = edge[1]}
            if (edge[0][0] > maxX) {maxX = edge[0][0]; maxXedge = edge[0]}
            if (edge[1][0] > maxX) {maxX = edge[1][0]; maxXedge = edge[1]}
          } else {
            const l = cells[ea].fn;
            if (!lakeEdges[f][l]) lakeEdges[f][l] = [];
            lakeEdges[f][l].push({start, end});
          }
        }
      } else {
        oceanEdges[f].push({start, end});
      }
    });
  }

  for (let f = 0; f < features.length; f++) {
    if (!oceanEdges[f]) continue;
    if (!oceanEdges[f].length && lakeEdges[f].length) {
      const m = lakeEdges[f].indexOf(d3.max(lakeEdges[f]));
      oceanEdges[f] = lakeEdges[f][m];
      lakeEdges[f][m] = [];
    }
    lineGen.curve(d3.curveCatmullRomClosed.alpha(0.1));
    const oceanCoastline = getContinuousLine(oceanEdges[f],3, 0);
    if (oceanCoastline) {
      shape.append("path").attr("d", oceanCoastline).attr("fill", "white"); // draw the mask
      coastline.append("path").attr("d", oceanCoastline); // draw the coastline
    }
    lineGen.curve(d3.curveBasisClosed);
    lakeEdges[f].forEach(function(l) {
      const lakeCoastline = getContinuousLine(l, 3, 0);
      if (lakeCoastline) {
        shape.append("path").attr("d", lakeCoastline).attr("fill", "black"); // draw the mask
        lakes.append("path").attr("d", lakeCoastline); // draw the lakes
      }
    });
  }
  landmass.append("rect").attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight); // draw the landmass
  drawDefaultRuler(minXedge, maxXedge);
  console.timeEnd('drawCoastline');
}

// Heighmap Template: Volcano
function templateVolcano(mod) {
  addMountain();
  modifyHeights("all", 10, 1);
  addHill(5, 0.35);
  addRange(3);
  addRange(-4);
}

// Heighmap Template: High Island
  function templateHighIsland(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addRange(6);
    addHill(12, 0.25);
    addRange(-3);
    modifyHeights("land", 0, 0.75);
    addPit(1);
    addHill(3, 0.15);
  }

// Heighmap Template: Low Island
  function templateLowIsland(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    smoothHeights(2);
    addRange(2);
    addHill(4, 0.4);
    addHill(12, 0.2);
    addRange(-8);
    modifyHeights("land", 0, 0.35);
  }

  // Heighmap Template: Continents
  function templateContinents(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(30, 0.25);
    const count = Math.ceil(Math.random() * 4 + 4);
    addStrait(count);
    addPit(10);
    addRange(-10);
    modifyHeights("land", 0, 0.6);
    smoothHeights(2);
    addRange(3);
  }

  // Heighmap Template: Archipelago
  function templateArchipelago(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(12, 0.15);
    addRange(8);
    const count = Math.ceil(Math.random() * 2 + 2);
    addStrait(count);
    addRange(-15);
    addPit(10);
    modifyHeights("land", -5, 0.7);
    smoothHeights(3);
  }

  // Heighmap Template: Atoll
  function templateAtoll(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(2, 0.35);
    addRange(2);
    smoothHeights(1);
    modifyHeights("27-100", 0, 0.1);
  }

  // Heighmap Template: Mainland
  function templateMainland(mod) {
    addMountain();
    modifyHeights("all", 10, 1);
    addHill(30, 0.2);
    addRange(10);
    addPit(20);
    addHill(10, 0.15);
    addRange(-10);
    modifyHeights("land", 0, 0.4);
    addRange(10);
    smoothHeights(3);
  }

  // Heighmap Template: Peninsulas
  function templatePeninsulas(mod) {
    addMountain();
    modifyHeights("all", 15, 1);
    addHill(30, 0);
    addRange(5);
    addPit(15);
    const count = Math.ceil(Math.random() * 5 + 15);
    addStrait(count);
  }

  function addMountain() {
    const x = Math.floor(Math.random() * graphWidth / 3 + graphWidth / 3);
    const y = Math.floor(Math.random() * graphHeight * 0.2 + graphHeight * 0.4);
    const cell = diagram.find(x, y).index;
    const height = Math.random() * 10 + 90; // 90-99
    add(cell, "mountain", height);
  }

  // place with shift 0-0.5
  function addHill(count, shift) {
    for (let c = 0; c < count; c++) {
      let limit = 0, cell, height;
      do {
        height = Math.random() * 40 + 10; // 10-50
        const x = Math.floor(Math.random() * graphWidth * (1 - shift * 2) + graphWidth * shift);
        const y = Math.floor(Math.random() * graphHeight * (1 - shift * 2) + graphHeight * shift);
        cell = diagram.find(x, y).index;
        limit++;
      } while (heights[cell] + height > 90 && limit < 100);
      add(cell, "hill", height);
    }
  }

  function add(start, type, height) {
    const session = Math.ceil(Math.random() * 1e5);
    let radius;
    let hRadius;
    let mRadius;
    switch (+graphSize) {
      case 1: hRadius = 0.991; mRadius = 0.91; break;
      case 2: hRadius = 0.9967; mRadius = 0.951; break;
      case 3: hRadius = 0.999; mRadius = 0.975; break;
      case 4: hRadius = 0.9994; mRadius = 0.98; break;
    }
    radius = type === "mountain" ? mRadius : hRadius;
    const queue = [start];
    if (type === "mountain") heights[start] = height;
    for (let i=0; i < queue.length && height >= 1; i++) {
      if (type === "mountain") {height = heights[queue[i]] * radius - height / 100;}
      else {height *= radius;}
      cells[queue[i]].neighbors.forEach(function(e) {
        if (cells[e].used === session) return;
        const mod = Math.random() * 0.2 + 0.9; // 0.9-1.1 random factor
        heights[e] += height * mod;
        if (heights[e] > 100) heights[e] = 100;
        cells[e].used = session;
        queue.push(e);
      });
    }
  }

  function addRange(mod, height, from, to) {
    const session = Math.ceil(Math.random() * 100000);
    const count = Math.abs(mod);
    let range = [];
    for (let c = 0; c < count; c++) {
      range = [];
      let diff = 0, start = from, end = to;
      if (!start || !end) {
        do {
          const xf = Math.floor(Math.random() * (graphWidth * 0.7)) + graphWidth * 0.15;
          const yf = Math.floor(Math.random() * (graphHeight * 0.6)) + graphHeight * 0.2;
          start = diagram.find(xf, yf).index;
          const xt = Math.floor(Math.random() * (graphWidth * 0.7)) + graphWidth * 0.15;
          const yt = Math.floor(Math.random() * (graphHeight * 0.6)) + graphHeight * 0.2;
          end = diagram.find(xt, yt).index;
          diff = Math.hypot(xt - xf, yt - yf);
        } while (diff < 150 / graphSize || diff > 300  / graphSize)
      }
      if (start && end) {
        for (let l = 0; start != end && l < 10000; l++) {
          let min = 10000;
          cells[start].neighbors.forEach(function(e) {
            diff = Math.hypot(cells[end].data[0] - cells[e].data[0],cells[end].data[1] - cells[e].data[1]);
            if (Math.random() > 0.8) diff = diff / 2;
            if (diff < min) {min = diff, start = e;}
          });
          range.push(start);
        }
      }
      const change = height ? height : Math.random() * 10 + 10;
      range.map(function(r) {
        let rnd = Math.random() * 0.4 + 0.8;
        if (mod > 0) heights[r] += change * rnd;
        else if (heights[r] >= 10) {heights[r] -= change * rnd;}
        cells[r].neighbors.forEach(function(e) {
          if (cells[e].used === session) return;
          cells[e].used = session;
          rnd = Math.random() * 0.4 + 0.8;
          const ch = change / 2 * rnd;
          if (mod > 0) {heights[e] += ch;} else if (heights[e] >= 10) {heights[e] -= ch;}
          if (heights[e] > 100) heights[e] = mod > 0 ? 100 : 5;
        });
        if (heights[r] > 100) heights[r] = mod > 0 ? 100 : 5;
      });
    }
    return range;
  }

  function addStrait(width) {
    const session = Math.ceil(Math.random() * 100000);
    const top = Math.floor(Math.random() * graphWidth * 0.35 + graphWidth * 0.3);
    const bottom = Math.floor((graphWidth - top) - (graphWidth * 0.1) + (Math.random() * graphWidth * 0.2));
    let start = diagram.find(top, graphHeight * 0.1).index;
    const end = diagram.find(bottom, graphHeight * 0.9).index;
    let range = [];
    for (let l = 0; start !== end && l < 1000; l++) {
      let min = 10000; // dummy value
      cells[start].neighbors.forEach(function(e) {
        let diff = Math.hypot(cells[end].data[0] - cells[e].data[0], cells[end].data[1] - cells[e].data[1]);
        if (Math.random() > 0.8) {diff = diff / 2}
        if (diff < min) {min = diff; start = e;}
      });
      range.push(start);
    }
    const query = [];
    for (; width > 0; width--) {
      range.map(function(r) {
        cells[r].neighbors.forEach(function(e) {
          if (cells[e].used === session) {return;}
          cells[e].used = session;
          query.push(e);
          heights[e] *= 0.23;
          if (heights[e] > 100 || heights[e] < 5) heights[e] = 5;
        });
        range = query.slice();
      });
    }
  }

  function addPit(count, height, cell) {
    const session = Math.ceil(Math.random() * 1e5);
    for (let c = 0; c < count; c++) {
      let change = height ? height + 10 : Math.random() * 10 + 20;
      let start = cell;
      if (!start) {
        const lowlands = $.grep(cells, function(e) {return (heights[e.index] >= 20);});
        if (!lowlands.length) return;
        const rnd = Math.floor(Math.random() * lowlands.length);
        start = lowlands[rnd].index;
      }
      let query = [start],newQuery= [];
      // depress pit center
      heights[start] -= change;
      if (heights[start] < 5 || heights[start] > 100) heights[start] = 5;
      cells[start].used = session;
      for (let i = 1; i < 10000; i++) {
        const rnd = Math.random() * 0.4 + 0.8;
        change -= i / 0.6 * rnd;
        if (change < 1) break;
        query.map(function(p) {
          cells[p].neighbors.forEach(function(e) {
            if (cells[e].used === session) return;
            cells[e].used = session;
            if (Math.random() > 0.8) return;
            newQuery.push(e);
            heights[e] -= change;
            if (heights[e] < 5 || heights[e] > 100) heights[e] = 5;
          });
        });
        query = newQuery.slice();
        newQuery = [];
      }
    }
  }

  // Modify heights adding or multiplying by value
  function modifyHeights(range, add, mult) {
    function modify(v) {
      if (add) v += add;
      if (mult !== 1) {
        if (mult === "^2") mult = (v - 20) / 100;
        if (mult === "^3") mult = ((v - 20) * (v - 20)) / 100;
        if (range === "land") {v = 20 + (v - 20) * mult;}
        else {v *=  mult;}
      }
      if (v < 0) v = 0;
      if (v > 100) v = 100;
      return v;
    }
    const limMin = range === "land" ? 20 : range === "all" ? 0 : +range.split("-")[0];
    const limMax = range === "land" || range === "all" ? 100 : +range.split("-")[1];

    for (let i=0; i < heights.length; i++) {
      if (heights[i] < limMin || heights[i] > limMax) continue;
      heights[i] = modify(heights[i]);
    }
  }

  // Smooth heights using mean of neighbors
  function smoothHeights(fraction) {
    const fr = fraction || 2;
    for (let i=0; i < heights.length; i++) {
      const nHeights = [heights[i]];
      cells[i].neighbors.forEach(function(e) {nHeights.push(heights[e]);});
      heights[i] = (heights[i] * (fr - 1) + d3.mean(nHeights)) / fr;
    }
  }

  // Randomize heights a bit
  function disruptHeights() {
    for (let i=0; i < heights.length; i++) {
      if (heights[i] < 18) continue;
      if (Math.random() < 0.5) continue;
      heights[i] += 2 - Math.random() * 4;
    }
  }

  // Mark features (ocean, lakes, islands)
  function markFeatures() {
    console.time("markFeatures");
    Math.seedrandom(seed); // reset seed to get the same result on heightmap edit
    for (let i=0, queue=[0]; queue.length > 0; i++) {
      const cell = cells[queue[0]];
      cell.fn = i; // feature number
      const land = heights[queue[0]] >= 20;
      let border = cell.type === "border";
      if (border && land) cell.ctype = 2;

      while (queue.length) {
        const q = queue.pop();
        if (cells[q].type === "border") {
          border = true;
          if (land) cells[q].ctype = 2;
        }

        cells[q].neighbors.forEach(function(e) {
          const eLand = heights[e] >= 20;
          if (land === eLand && cells[e].fn === undefined) {
            cells[e].fn = i;
            queue.push(e);
          }
          if (land && !eLand) {
            cells[q].ctype = 2;
            cells[e].ctype = -1;
            cells[q].harbor = cells[q].harbor ? cells[q].harbor + 1 : 1;
          }
        });
      }
      features.push({i, land, border});

      // find unmarked cell
      for (let c=0; c < cells.length; c++) {
        if (cells[c].fn === undefined) {
          queue[0] = c;
          break;
        }
      }
    }
    console.timeEnd("markFeatures");
  }

  // remove closed lakes near ocean
  function reduceClosedLakes() {
    console.time("reduceClosedLakes");
    const fs = JSON.parse(JSON.stringify(features));
    let lakesInit = lakesNow = features.reduce(function(s, f) {
      return !f.land && !f.border ? s + 1 : s;
    }, 0);

    for (let c=0; c < cells.length && lakesNow > 0; c++) {
      if (heights[c] < 20) continue; // not land
      if (cells[c].ctype !== 2) continue; // not near water
      let ocean = null, lake = null;
      // find land cells with lake and ocean nearby
      cells[c].neighbors.forEach(function(n) {
        if (heights[n] >= 20) return;
        const fn = cells[n].fn;
        if (features[fn].border !== false) ocean = fn;
        if (fs[fn].border === false) lake = fn;
      });
      // if found, make it water and turn lake to ocean
      if (ocean !== null && lake !== null) {
        //debug.append("circle").attr("cx", cells[c].data[0]).attr("cy", cells[c].data[1]).attr("r", 2).attr("fill", "red");
        lakesNow --;
        fs[lake].border = ocean;
        heights[c] = 19;
        cells[c].fn = ocean;
        cells[c].ctype = -1;
        cells[c].neighbors.forEach(function(e) {if (heights[e] >= 20) cells[e].ctype = 2;});
      }
    }

    if (lakesInit === lakesNow) return; // nothing was changed
    for (let i=0; i < cells.length; i++) {
      if (heights[i] >= 20) continue; // not water
      const fn = cells[i].fn;
      if (fs[fn].border !== features[fn].border) {
        cells[i].fn = fs[fn].border;
        //debug.append("circle").attr("cx", cells[i].data[0]).attr("cy", cells[i].data[1]).attr("r", 1).attr("fill", "blue");
      }
    }
    console.timeEnd("reduceClosedLakes");
  }

  function drawOcean() {
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

  // recalculate Voronoi Graph to pack cells
  function reGraph() {
    console.time("reGraph");
    const tempCells = [], newPoints = []; // to store new data
    // get average precipitation based on graph size
    const avPrec = precInput.value / 5000;
    const smallLakesMax = 500;
    let smallLakes = 0;
    const evaporation = 2;
    cells.map(function(i, d) {
      let height = i.height || heights[d];
      if (height > 100) height = 100;
      const pit = i.pit;
      const ctype = i.ctype;
      if (ctype !== -1 && ctype !== -2 && height < 20) return; // exclude all deep ocean points
      const x = rn(i.data[0],1), y = rn(i.data[1],1);
      const fn = i.fn;
      const harbor = i.harbor;
      let lake = i.lake;
      // mark potential cells for small lakes to add additional point there
      if (smallLakes < smallLakesMax && !lake && pit > evaporation && ctype !== 2) {
        lake = 2;
        smallLakes++;
      }
      const region = i.region; // handle value for edit heightmap mode only
      const culture = i.culture; // handle value for edit heightmap mode only
      let copy = $.grep(newPoints, function(e) {return (e[0] == x && e[1] == y);});
      if (!copy.length) {
        newPoints.push([x, y]);
        tempCells.push({index:tempCells.length, data:[x, y],height, pit, ctype, fn, harbor, lake, region, culture});
      }
      // add additional points for cells along coast
      if (ctype === 2 || ctype === -1) {
        if (i.type === "border") return;
        if (!features[fn].land && !features[fn].border) return;
        i.neighbors.forEach(function(e) {
          if (cells[e].ctype === ctype) {
            let x1 = (x * 2 + cells[e].data[0]) / 3;
            let y1 = (y * 2 + cells[e].data[1]) / 3;
            x1 = rn(x1, 1), y1 = rn(y1, 1);
            copy = $.grep(newPoints, function(e) {return e[0] === x1 && e[1] === y1;});
            if (copy.length) return;
            newPoints.push([x1, y1]);
            tempCells.push({index:tempCells.length, data:[x1, y1],height, pit, ctype, fn, harbor, lake, region, culture});
          }
        });
      }
      if (lake === 2) { // add potential small lakes
        polygons[i.index].forEach(function(e) {
          if (Math.random() > 0.8) return;
          let rnd = Math.random() * 0.6 + 0.8;
          const x1 = rn((e[0] * rnd + i.data[0]) / (1 + rnd), 2);
          rnd = Math.random() * 0.6 + 0.8;
          const y1 = rn((e[1] * rnd + i.data[1]) / (1 + rnd), 2);
          copy = $.grep(newPoints, function(c) {return x1 === c[0] && y1 === c[1];});
          if (copy.length) return;
          newPoints.push([x1, y1]);
          tempCells.push({index:tempCells.length, data:[x1, y1],height, pit, ctype, fn, region, culture});
        });
      }
    });
    console.log( "small lakes candidates: " + smallLakes);
    cells = tempCells; // use tempCells as the only cells array
    calculateVoronoi(newPoints); // recalculate Voronoi diagram using new points
    let gridPath = ""; // store grid as huge single path string
    cells.map(function(i, d) {
      if (i.height >= 20) {
        // calc cell area
        i.area = rn(Math.abs(d3.polygonArea(polygons[d])), 2);
        const prec = rn(avPrec * i.area, 2);
        i.flux = i.lake ? prec * 10 : prec;
      }
      const neighbors = []; // re-detect neighbors
      diagram.cells[d].halfedges.forEach(function(e) {
        const edge = diagram.edges[e];
        if (edge.left === undefined || edge.right === undefined) {
          if (i.height >= 20) i.ctype = 99; // border cell
          return;
        }
        const ea = edge.left.index === d ? edge.right.index : edge.left.index;
        neighbors.push(ea);
        if (d < ea && i.height >= 20 && i.lake !== 1 && cells[ea].height >= 20 && cells[ea].lake !== 1) {
          gridPath += "M" + edge[0][0] + "," + edge[0][1] + "L" + edge[1][0] + "," + edge[1][1];
        }
      });
      i.neighbors = neighbors;
      if (i.region === undefined) delete i.region;
      if (i.culture === undefined) delete i.culture;
    });
    grid.append("path").attr("d", gridPath);
    console.timeEnd("reGraph");
  }

  // redraw all cells for Customization 1 mode
  function mockHeightmap() {
    let landCells = 0;
    $("#landmass").empty();
    const limit = renderOcean.checked ? 1 : 20;
    for (let i=0; i < heights.length; i++) {
      if (heights[i] < limit) continue;
      if (heights[i] > 100) heights[i] = 100;
      const clr = color(1 - heights[i] / 100);
      landmass.append("path").attr("id", "cell"+i)
        .attr("d", "M" + polygons[i].join("L") + "Z")
        .attr("fill", clr).attr("stroke", clr);
    }
  }

  $("#renderOcean").click(mockHeightmap);

  // draw or update all cells
  function updateHeightmap() {
    const limit = renderOcean.checked ? 1 : 20;
    for (let i=0; i < heights.length; i++) {
      if (heights[i] > 100) heights[i] = 100;
      let cell = landmass.select("#cell"+i);
      const clr = color(1 - heights[i] / 100);
      if (cell.size()) {
        if (heights[i] < limit) {cell.remove();}
        else {cell.attr("fill", clr).attr("stroke", clr);}
      } else if (heights[i] >= limit) {
        cell = landmass.append("path").attr("id", "cell"+i)
          .attr("d", "M" + polygons[i].join("L") + "Z")
          .attr("fill", clr).attr("stroke", clr);
      }
    }
  }

  // draw or update cells from the selection
  function updateHeightmapSelection(selection) {
    if (selection === undefined) return;
    const limit = renderOcean.checked ? 1 : 20;
    selection.map(function(s) {
      if (heights[s] > 100) heights[s] = 100;
      let cell = landmass.select("#cell"+s);
      const clr = color(1 - heights[s] / 100);
      if (cell.size()) {
        if (heights[s] < limit) {cell.remove();}
        else {cell.attr("fill", clr).attr("stroke", clr);}
      } else if (heights[s] >= limit) {
        cell = landmass.append("path").attr("id", "cell"+s)
          .attr("d", "M" + polygons[s].join("L") + "Z")
          .attr("fill", clr).attr("stroke", clr);
      }
    });
  }

  function updateHistory() {
    let landCells = 0; // count number of land cells
    if (renderOcean.checked) {
      landCells = heights.reduce(function(s, v) {if (v >= 20) {return s + 1;} else {return s;}}, 0);
    } else {
      landCells = landmass.selectAll("*").size();
    }
    history = history.slice(0, historyStage);
    history[historyStage] = heights.slice();
    historyStage++;
    undo.disabled = templateUndo.disabled = historyStage <= 1;
    redo.disabled = templateRedo.disabled = true;
    const landMean = Math.trunc(d3.mean(heights));
    const landRatio = rn(landCells / heights.length * 100);
    landmassCounter.innerHTML = landCells;
    landmassRatio.innerHTML = landRatio;
    landmassAverage.innerHTML = landMean;
    // if perspective view dialog is opened, update it
    if ($("#perspectivePanel").is(":visible")) drawPerspective();
  }

  // restoreHistory
  function restoreHistory(step) {
    historyStage = step;
    redo.disabled = templateRedo.disabled = historyStage >= history.length;
    undo.disabled = templateUndo.disabled = historyStage <= 1;
    if (history[historyStage - 1] === undefined) return;
    heights = history[historyStage - 1].slice();
    updateHeightmap();
  }

  // restart history from 1st step
  function restartHistory() {
    history = [];
    historyStage = 0;
    redo.disabled = templateRedo.disabled = true;
    undo.disabled = templateUndo.disabled = true;
    updateHistory();
  }

  // Detect and draw the coasline
  function drawCoastline() {
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

  // draw default scale bar
  function drawScaleBar() {
    if ($("#scaleBar").hasClass("hidden")) return; // no need to re-draw hidden element
    svg.select("#scaleBar").remove(); // fully redraw every time
    // get size
    const size = +barSize.value;
    const dScale = distanceScale.value;
    const unit = distanceUnit.value;
    const scaleBar = svg.append("g").attr("id", "scaleBar")
      .on("click", editScale)
      .on("mousemove", function () {
        tip("Click to open Scale Editor, drag to move");
      })
      .call(d3.drag().on("start", elementDrag));
    const init = 100; // actual length in pixels if scale, dScale and size = 1;
    let val = init * size * dScale / scale; // bar length in distance unit
    if (val > 900) {val = rn(val, -3);} // round to 1000
    else if (val > 90) {val = rn(val, -2);} // round to 100
    else if (val > 9) {val = rn(val, -1);} // round to 10
    else {val = rn(val)} // round to 1
    const l = val * scale / dScale; // actual length in pixels on this scale
    const x = 0, y = 0; // initial position
    scaleBar.append("line").attr("x1", x+0.5).attr("y1", y).attr("x2", x+l+size-0.5).attr("y2", y).attr("stroke-width", size).attr("stroke", "white");
    scaleBar.append("line").attr("x1", x).attr("y1", y + size).attr("x2", x+l+size).attr("y2", y + size).attr("stroke-width", size).attr("stroke", "#3d3d3d");
    const dash = size + " " + rn(l / 5 - size, 2);
    scaleBar.append("line").attr("x1", x).attr("y1", y).attr("x2", x+l+size).attr("y2", y)
      .attr("stroke-width", rn(size * 3, 2)).attr("stroke-dasharray", dash).attr("stroke", "#3d3d3d");
    // big scale
    for (let b = 0; b < 6; b++) {
      const value = rn(b * l / 5, 2);
      const label = rn(value * dScale / scale);
      if (b === 5) {
        scaleBar.append("text").attr("x", x + value).attr("y", y - 2 * size).attr("font-size", rn(5 * size, 1)).text(label + " " + unit);
      } else {
        scaleBar.append("text").attr("x", x + value).attr("y", y - 2 * size).attr("font-size", rn(5 * size, 1)).text(label);
      }
    }
    if (barLabel.value !== "") {
      scaleBar.append("text").attr("x", x + (l+1) / 2).attr("y", y + 2 * size)
        .attr("dominant-baseline", "text-before-edge")
        .attr("font-size", rn(5 * size, 1)).text(barLabel.value);
    }
    const bbox = scaleBar.node().getBBox();
    // append backbround rectangle
    scaleBar.insert("rect", ":first-child").attr("x", -10).attr("y", -20).attr("width", bbox.width + 10).attr("height", bbox.height + 15)
      .attr("stroke-width", size).attr("stroke", "none").attr("filter", "url(#blur5)")
      .attr("fill", barBackColor.value).attr("opacity", +barBackOpacity.value);
    fitScaleBar();
  }

  // draw default ruler measiring land x-axis edges
  function drawDefaultRuler(minXedge, maxXedge) {
    const rulerNew = ruler.append("g").attr("class", "linear").call(d3.drag().on("start", elementDrag));
    if (!minXedge) minXedge = [0, 0];
    if (!maxXedge) maxXedge = [svgWidth, svgHeight];
    const x1 = rn(minXedge[0],2), y1 = rn(minXedge[1],2), x2 = rn(maxXedge[0],2), y2 = rn(maxXedge[1],2);
    rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "white");
    rulerNew.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2).attr("class", "gray").attr("stroke-dasharray", 10);
    rulerNew.append("circle").attr("r", 2).attr("cx", x1).attr("cy", y1).attr("stroke-width", 0.5).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
    rulerNew.append("circle").attr("r", 2).attr("cx", x2).attr("cy", y2).attr("stroke-width", 0.5).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
    const x0 = rn((x1 + x2) / 2, 2), y0 = rn((y1 + y2) / 2, 2);
    rulerNew.append("circle").attr("r", 1.2).attr("cx", x0).attr("cy", y0).attr("stroke-width", 0.3).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    const tr = "rotate(" + angle + " " + x0 + " " + y0 +")";
    const dist = rn(Math.hypot(x1 - x2, y1 - y2));
    const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
    rulerNew.append("text").attr("x", x0).attr("y", y0).attr("dy", -1).attr("transform", tr).attr("data-dist", dist).text(label).on("click", removeParent).attr("font-size", 10);
  }

  // drag any element changing transform
  function elementDrag() {
    const el = d3.select(this);
    const tr = parseTransform(el.attr("transform"));
    const dx = +tr[0] - d3.event.x, dy = +tr[1] - d3.event.y;

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      const transform = `translate(${(dx+x)},${(dy+y)}) rotate(${tr[2]} ${tr[3]} ${tr[4]})`;
      el.attr("transform", transform);
      const pp = this.parentNode.parentNode.id;
      if (pp === "burgIcons" || pp === "burgLabels") {
        tip('Use dragging for fine-tuning only, to move burg to a different cell use "Relocate" button');
      }
      if (pp === "labels") {
        // also transform curve control circle
        debug.select("circle").attr("transform", transform);
      }
    });

    d3.event.on("end", function() {
      // remember scaleBar bottom-right position
      if (el.attr("id") === "scaleBar") {
        const xEnd = d3.event.x, yEnd = d3.event.y;
        const diff = Math.abs(dx - xEnd) + Math.abs(dy - yEnd);
        if (diff > 5) {
          const bbox = el.node().getBoundingClientRect();
          sessionStorage.setItem("scaleBar", [bbox.right, bbox.bottom]);
        }
      }
    });
  }

  // draw ruler circles and update label
  function rulerEdgeDrag() {
    const group = d3.select(this.parentNode);
    const edge = d3.select(this).attr("data-edge");
    const x = d3.event.x, y = d3.event.y;
    let x0, y0;
    d3.select(this).attr("cx", x).attr("cy", y);
    const line = group.selectAll("line");
    if (edge === "left") {
      line.attr("x1", x).attr("y1", y);
      x0 = +line.attr("x2"), y0 = +line.attr("y2");
    } else {
      line.attr("x2", x).attr("y2", y);
      x0 = +line.attr("x1"), y0 = +line.attr("y1");
    }
    const xc = rn((x + x0) / 2, 2), yc = rn((y + y0) / 2, 2);
    group.select(".center").attr("cx", xc).attr("cy", yc);
    const dist = rn(Math.hypot(x0 - x, y0 - y));
    const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
    const atan = x0 > x ? Math.atan2(y0 - y, x0 - x) : Math.atan2(y - y0, x - x0);
    const angle = rn(atan * 180 / Math.PI, 3);
    const tr = "rotate(" + angle + " " + xc + " " + yc + ")";
    group.select("text").attr("x", xc).attr("y", yc).attr("transform", tr).attr("data-dist", dist).text(label);
  }

  // draw ruler center point to split ruler into 2 parts
  function rulerCenterDrag() {
    let xc1, yc1, xc2, yc2;
    const group = d3.select(this.parentNode); // current ruler group
    let x = d3.event.x, y = d3.event.y; // current coords
    const line = group.selectAll("line"); // current lines
    const x1 = +line.attr("x1"), y1 = +line.attr("y1"), x2 = +line.attr("x2"), y2 = +line.attr("y2"); // initial line edge points
    const rulerNew = ruler.insert("g", ":first-child");
    rulerNew.attr("transform", group.attr("transform")).call(d3.drag().on("start", elementDrag));
    const factor = rn(1 / Math.pow(scale, 0.3), 1);
    rulerNew.append("line").attr("class", "white").attr("stroke-width", factor);
    const dash = +group.select(".gray").attr("stroke-dasharray");
    rulerNew.append("line").attr("class", "gray").attr("stroke-dasharray", dash).attr("stroke-width", factor);
    rulerNew.append("text").attr("dy", -1).on("click", removeParent).attr("font-size", 10 * factor).attr("stroke-width", factor);

    d3.event.on("drag", function() {
      x = d3.event.x, y = d3.event.y;
      d3.select(this).attr("cx", x).attr("cy", y);
      // change first part
      line.attr("x1", x1).attr("y1", y1).attr("x2", x).attr("y2", y);
      let dist = rn(Math.hypot(x1 - x, y1 - y));
      let label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      let atan = x1 > x ? Math.atan2(y1 - y, x1 - x) : Math.atan2(y - y1, x - x1);
      xc1 = rn((x + x1) / 2, 2), yc1 = rn((y + y1) / 2, 2);
      let tr = "rotate(" + rn(atan * 180 / Math.PI, 3) + " " + xc1 + " " + yc1 + ")";
      group.select("text").attr("x", xc1).attr("y", yc1).attr("transform", tr).attr("data-dist", dist).text(label);
      // change second (new) part
      dist = rn(Math.hypot(x2 - x, y2 - y));
      label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      atan = x2 > x ? Math.atan2(y2 - y, x2 - x) : Math.atan2(y - y2, x - x2);
      xc2 = rn((x + x2) / 2, 2), yc2 = rn((y + y2) / 2, 2);
      tr = "rotate(" + rn(atan * 180 / Math.PI, 3) + " " + xc2 + " " + yc2 +")";
      rulerNew.selectAll("line").attr("x1", x).attr("y1", y).attr("x2", x2).attr("y2", y2);
      rulerNew.select("text").attr("x", xc2).attr("y", yc2).attr("transform", tr).attr("data-dist", dist).text(label);
    });

    d3.event.on("end", function() {
      // circles for 1st part
      group.selectAll("circle").remove();
      group.append("circle").attr("cx", x1).attr("cy", y1).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
      group.append("circle").attr("cx", x).attr("cy", y).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
      group.append("circle").attr("cx", xc1).attr("cy", yc1).attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
      // circles for 2nd part
      rulerNew.append("circle").attr("cx", x).attr("cy", y).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "left").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("cx", x2).attr("cy", y2).attr("r", 2 * factor).attr("stroke-width", 0.5 * factor).attr("data-edge", "rigth").call(d3.drag().on("drag", rulerEdgeDrag));
      rulerNew.append("circle").attr("cx", xc2).attr("cy", yc2).attr("r", 1.2 * factor).attr("stroke-width", 0.3 * factor).attr("class", "center").call(d3.drag().on("start", rulerCenterDrag));
    });
  }

  function opisometerEdgeDrag() {
    const el = d3.select(this);
    const x0 = +el.attr("cx"), y0 = +el.attr("cy");
    const group = d3.select(this.parentNode);
    const curve = group.select(".white");
    const curveGray = group.select(".gray");
    const text = group.select("text");
    const points = JSON.parse(text.attr("data-points"));
    if (x0 === points[0].scX && y0 === points[0].scY) {points.reverse();}

    d3.event.on("drag", function() {
      const x = d3.event.x, y = d3.event.y;
      el.attr("cx", x).attr("cy", y);
      const l = points[points.length - 1];
      const diff = Math.hypot(l.scX - x, l.scY - y);
      if (diff > 5) {points.push({scX: x, scY: y});} else {return;}
      lineGen.curve(d3.curveBasis);
      const d = round(lineGen(points));
      curve.attr("d", d);
      curveGray.attr("d", d);
      const dist = rn(curve.node().getTotalLength());
      const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      text.attr("x", x).attr("y", y).text(label);
    });

    d3.event.on("end", function() {
      const dist = rn(curve.node().getTotalLength());
      const c = curve.node().getPointAtLength(dist / 2);
      const p = curve.node().getPointAtLength((dist / 2) - 1);
      const label = rn(dist * distanceScale.value) + " " + distanceUnit.value;
      const atan = p.x > c.x ? Math.atan2(p.y - c.y, p.x - c.x) : Math.atan2(c.y - p.y, c.x - p.x);
      const angle = rn(atan * 180 / Math.PI, 3);
      const tr = "rotate(" + angle + " " + c.x + " " + c.y + ")";
      text.attr("data-points", JSON.stringify(points)).attr("data-dist", dist).attr("x", c.x).attr("y", c.y).attr("transform", tr).text(label);
    });
  }

  function getContinuousLine(edges, indention, relax) {
    let line = "";
    if (edges.length < 3) return "";
    while (edges.length > 2) {
      let edgesOrdered = []; // to store points in a correct order
      let start = edges[0].start;
      let end = edges[0].end;
      edges.shift();
      let spl = start.split(" ");
      edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
      spl = end.split(" ");
      edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
      let x0 = +spl[0],y0 = +spl[1];
      for (let i = 0; end !== start && i < 100000; i++) {
        let next = null, index = null;
        for (let e = 0; e < edges.length; e++) {
          const edge = edges[e];
          if (edge.start == end || edge.end == end) {
            next = edge;
            end = next.start == end ? next.end : next.start;
            index = e;
            break;
          }
        }
        if (!next) {
          console.error("Next edge is not found");
          return "";
        }
        spl = end.split(" ");
        if (indention || relax) {
          const dist = Math.hypot(+spl[0] - x0, +spl[1] - y0);
          if (dist >= indention && Math.random() > relax) {
            edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
            x0 = +spl[0],y0 = +spl[1];
          }
        } else {
          edgesOrdered.push({scX: +spl[0],scY: +spl[1]});
        }
        edges.splice(index, 1);
        if (i === 100000-1) {
          console.error("Line not ended, limit reached");
          break;
        }
      }
      line += lineGen(edgesOrdered);
    }
    return round(line, 1);
  }

  // temporary elevate lakes to min neighbors heights to correctly flux the water
  function elevateLakes() {
    console.time('elevateLakes');
    const lakes = $.grep(cells, function(e, d) {return heights[d] < 20 && !features[e.fn].border;});
    lakes.sort(function(a, b) {return heights[b.index] - heights[a.index];});
    for (let i=0; i < lakes.length; i++) {
      const hs = [],id = lakes[i].index;
      cells[id].height = heights[id]; // use height on object level
      lakes[i].neighbors.forEach(function(n) {
        const nHeight = cells[n].height || heights[n];
        if (nHeight >= 20) hs.push(nHeight);
      });
      if (hs.length) cells[id].height = d3.min(hs) - 1;
      if (cells[id].height < 20) cells[id].height = 20;
      lakes[i].lake = 1;
    }
    console.timeEnd('elevateLakes');
  }

  // Depression filling algorithm (for a correct water flux modeling; phase1)
  function resolveDepressionsPrimary() {
    console.time('resolveDepressionsPrimary');
    land = $.grep(cells, function(e, d) {
      if (!e.height) e.height = heights[d]; // use height on object level
      return e.height >= 20;
    });
    land.sort(function(a, b) {return b.height - a.height;});
    const limit = 10;
    for (let l = 0, depression = 1; depression > 0 && l < limit; l++) {
      depression = 0;
      for (let i = 0; i < land.length; i++) {
        const id = land[i].index;
        if (land[i].type === "border") continue;
        const hs = land[i].neighbors.map(function(n) {return cells[n].height;});
        const minHigh = d3.min(hs);
        if (cells[id].height <= minHigh) {
          depression++;
          land[i].pit = land[i].pit ? land[i].pit + 1 : 1;
          cells[id].height = minHigh + 2;
        }
      }
      if (l === 0) console.log(" depressions init: " + depression);
    }
    console.timeEnd('resolveDepressionsPrimary');
  }

  // Depression filling algorithm (for a correct water flux modeling; phase2)
  function resolveDepressionsSecondary() {
    console.time('resolveDepressionsSecondary');
    land = $.grep(cells, function(e) {return e.height >= 20;});
    land.sort(function(a, b) {return b.height - a.height;});
    const limit = 100;
    for (let l = 0, depression = 1; depression > 0 && l < limit; l++) {
      depression = 0;
      for (let i = 0; i < land.length; i++) {
        if (land[i].ctype === 99) continue;
        const nHeights = land[i].neighbors.map(function(n) {return cells[n].height});
        const minHigh = d3.min(nHeights);
        if (land[i].height <= minHigh) {
          depression++;
          land[i].pit = land[i].pit ? land[i].pit + 1 : 1;
          land[i].height = Math.trunc(minHigh + 2);
        }
      }
      if (l === 0) console.log(" depressions reGraphed: " + depression);
      if (l === limit - 1) console.error("Error: resolveDepressions iteration limit");
    }
    console.timeEnd('resolveDepressionsSecondary');
  }

  // restore initial heights if user don't want system to change heightmap
  function restoreCustomHeights() {
    land.forEach(function(l) {
      if (!l.pit) return;
      l.height = Math.trunc(l.height - l.pit * 2);
      if (l.height < 20) l.height = 20;
    });
  }

  function flux() {
    console.time('flux');
    riversData = [];
    let riverNext = 0;
    land.sort(function(a, b) {return b.height - a.height;});
    for (let i = 0; i < land.length; i++) {
      const id = land[i].index;
      const sx = land[i].data[0];
      const sy = land[i].data[1];
      let fn = land[i].fn;
      if (land[i].ctype === 99) {
        if (land[i].river !== undefined) {
          let x, y;
          const min = Math.min(sy, graphHeight - sy, sx, graphWidth - sx);
          if (min === sy) {x = sx; y = 0;}
          if (min === graphHeight - sy) {x = sx; y = graphHeight;}
          if (min === sx) {x = 0; y = sy;}
          if (min === graphWidth - sx) {x = graphWidth; y = sy;}
          riversData.push({river: land[i].river, cell: id, x, y});
        }
        continue;
      }
      if (features[fn].river !== undefined) {
        if (land[i].river !== features[fn].river) {
          land[i].river = undefined;
          land[i].flux = 0;
        }
      }
      let minHeight = 1000, min;
      land[i].neighbors.forEach(function(e) {
        if (cells[e].height < minHeight) {
          minHeight = cells[e].height;
          min = e;
        }
      });
      // Define river number
      if (min !== undefined && land[i].flux > 1) {
        if (land[i].river === undefined) {
          // State new River
          land[i].river = riverNext;
          riversData.push({river: riverNext, cell: id, x: sx, y: sy});
          riverNext += 1;
        }
        // Assing existing River to the downhill cell
        if (cells[min].river == undefined) {
          cells[min].river = land[i].river;
        } else {
          const riverTo = cells[min].river;
          const iRiver = $.grep(riversData, function (e) {
            return (e.river == land[i].river);
          });
          const minRiver = $.grep(riversData, function (e) {
            return (e.river == riverTo);
          });
          let iRiverL = iRiver.length;
          let minRiverL = minRiver.length;
          // re-assing river nunber if new part is greater
          if (iRiverL >= minRiverL) {
            cells[min].river = land[i].river;
            iRiverL += 1;
            minRiverL -= 1;
          }
          // mark confluences
          if (cells[min].height >= 20 && iRiverL > 1 && minRiverL > 1) {
            if (!cells[min].confluence) {
              cells[min].confluence = minRiverL-1;
            } else {
              cells[min].confluence += minRiverL-1;
            }
          }
        }
      }
      if (cells[min].flux) cells[min].flux += land[i].flux;
      if (land[i].river !== undefined) {
        const px = cells[min].data[0];
        const py = cells[min].data[1];
        if (cells[min].height < 20) {
          // pour water to the sea
          const x = (px + sx) / 2 + (px - sx) / 10;
          const y = (py + sy) / 2 + (py - sy) / 10;
          riversData.push({river: land[i].river, cell: id, x, y});
        } else {
          if (cells[min].lake === 1) {
            fn = cells[min].fn;
            if (features[fn].river === undefined) features[fn].river = land[i].river;
          }
          // add next River segment
          riversData.push({river: land[i].river, cell: min, x: px, y: py});
        }
      }
    }
    console.timeEnd('flux');
    drawRiverLines(riverNext);
  }

  function drawRiverLines(riverNext) {
    console.time('drawRiverLines');
    for (let i = 0; i < riverNext; i++) {
      const dataRiver = $.grep(riversData, function (e) {
        return e.river === i;
      });
      if (dataRiver.length > 1) {
        const riverAmended = amendRiver(dataRiver, 1);
        const width = rn(0.8 + Math.random() * 0.4, 1);
        const increment = rn(0.8 + Math.random() * 0.4, 1);
        const d = drawRiver(riverAmended, width, increment);
        rivers.append("path").attr("d", d).attr("id", "river"+i).attr("data-width", width).attr("data-increment", increment);
      }
    }
    rivers.selectAll("path").on("click", editRiver);
    console.timeEnd('drawRiverLines');
  }

  // add more river points on 1/3 and 2/3 of length
  function amendRiver(dataRiver, rndFactor) {
    const riverAmended = [];
    let side = 1;
    for (let r = 0; r < dataRiver.length; r++) {
      const dX = dataRiver[r].x;
      const dY = dataRiver[r].y;
      const cell = dataRiver[r].cell;
      const c = cells[cell].confluence || 0;
      riverAmended.push([dX, dY, c]);
      if (r+1 < dataRiver.length) {
        const eX = dataRiver[r + 1].x;
        const eY = dataRiver[r + 1].y;
        const angle = Math.atan2(eY - dY, eX - dX);
        const serpentine = 1 / (r + 1);
        const meandr = serpentine + 0.3 + Math.random() * 0.3 * rndFactor;
        if (Math.random() > 0.5) {
          side *= -1
        }
        const dist = Math.hypot(eX - dX, eY - dY);
        // if dist is big or river is small add 2 extra points
        if (dist > 8 || (dist > 4 && dataRiver.length < 6)) {
          let stX = (dX * 2 + eX) / 3;
          let stY = (dY * 2 + eY) / 3;
          let enX = (dX + eX * 2) / 3;
          let enY = (dY + eY * 2) / 3;
          stX += -Math.sin(angle) * meandr * side;
          stY += Math.cos(angle) * meandr * side;
          if (Math.random() > 0.8) {
            side *= -1
          }
          enX += Math.sin(angle) * meandr * side;
          enY += -Math.cos(angle) * meandr * side;
          riverAmended.push([stX, stY],[enX, enY]);
        // if dist is medium or river is small add 1 extra point
        } else if (dist > 4 || dataRiver.length < 6) {
          let scX = (dX + eX) / 2;
          let scY = (dY + eY) / 2;
          scX += -Math.sin(angle) * meandr * side;
          scY += Math.cos(angle) * meandr * side;
          riverAmended.push([scX, scY]);
        }
      }
    }
    return riverAmended;
  }

  // draw river polygon using arrpoximation
  function drawRiver(points, width, increment) {
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    let extraOffset = 0.03; // start offset to make river source visible
      width = width || 1; // river width modifier
      increment = increment || 1; // river bed widening modifier
    let riverLength = 0;
    points.map(function(p, i) {
        if (i === 0) {return 0;}
        riverLength += Math.hypot(p[0] - points[i-1][0],p[1] - points[i-1][1]);
      });
    const widening = rn((1000 + (riverLength * 30)) * increment);
    const riverPointsLeft = [], riverPointsRight = [];
    const last = points.length - 1;
    const factor = riverLength / points.length;

    // first point
    let x = points[0][0], y = points[0][1], c;
    let angle = Math.atan2(y - points[1][1], x - points[1][0]);
    let xLeft = x + -Math.sin(angle) * extraOffset, yLeft = y + Math.cos(angle) * extraOffset;
    riverPointsLeft.push({scX:xLeft, scY:yLeft});
    let xRight = x + Math.sin(angle) * extraOffset, yRight = y + -Math.cos(angle) * extraOffset;
    riverPointsRight.unshift({scX:xRight, scY:yRight});

      // middle points
      for (let p = 1; p < last; p ++) {
        x = points[p][0],y = points[p][1],c = points[p][2];
        if (c) {extraOffset += Math.atan(c * 10 / widening);} // confluence
        const xPrev = points[p - 1][0], yPrev = points[p - 1][1];
        const xNext = points[p + 1][0], yNext = points[p + 1][1];
        angle = Math.atan2(yPrev - yNext, xPrev - xNext);
        var offset = (Math.atan(Math.pow(p * factor, 2) / widening) / 2 * width) + extraOffset;
        xLeft = x + -Math.sin(angle) * offset, yLeft = y + Math.cos(angle) * offset;
        riverPointsLeft.push({scX:xLeft, scY:yLeft});
        xRight = x + Math.sin(angle) * offset, yRight = y + -Math.cos(angle) * offset;
        riverPointsRight.unshift({scX:xRight, scY:yRight});
      }

      // end point
      x = points[last][0],y = points[last][1],c = points[last][2];
      if (c) {extraOffset += Math.atan(c * 10 / widening);} // confluence
      angle = Math.atan2(points[last-1][1] - y, points[last-1][0] - x);
      xLeft = x + -Math.sin(angle) * offset, yLeft = y + Math.cos(angle) * offset;
      riverPointsLeft.push({scX:xLeft, scY:yLeft});
      xRight = x + Math.sin(angle) * offset, yRight = y + -Math.cos(angle) * offset;
      riverPointsRight.unshift({scX:xRight, scY:yRight});

      // generate path and return
    const right = lineGen(riverPointsRight);
    let left = lineGen(riverPointsLeft);
    left = left.substring(left.indexOf("C"));
      return round(right + left, 2);
  }

  // draw river polygon with best quality
  function drawRiverSlow(points, width, increment) {
      lineGen.curve(d3.curveCatmullRom.alpha(0.1));
      width = width || 1;
    const extraOffset = 0.02 * width;
    increment = increment || 1;
    const riverPoints = points.map(function (p) {
      return {scX: p[0], scY: p[1]};
    });
    const river = defs.append("path").attr("d", lineGen(riverPoints));
    const riverLength = river.node().getTotalLength();
    const widening = rn((1000 + (riverLength * 30)) * increment);
    const riverPointsLeft = [], riverPointsRight = [];

    for (let l = 0; l < riverLength; l++) {
        var point = river.node().getPointAtLength(l);
        var from = river.node().getPointAtLength(l - 0.1);
        const to = river.node().getPointAtLength(l + 0.1);
        var angle = Math.atan2(from.y - to.y, from.x - to.x);
        var offset = (Math.atan(Math.pow(l, 2) / widening) / 2 * width) + extraOffset;
        var xLeft = point.x + -Math.sin(angle) * offset;
        var yLeft = point.y + Math.cos(angle) * offset;
        riverPointsLeft.push({scX:xLeft, scY:yLeft});
        var xRight = point.x + Math.sin(angle) * offset;
        var yRight = point.y + -Math.cos(angle) * offset;
        riverPointsRight.unshift({scX:xRight, scY:yRight});
      }

      var point = river.node().getPointAtLength(riverLength);
      var from = river.node().getPointAtLength(riverLength - 0.1);
      var angle = Math.atan2(from.y - point.y, from.x - point.x);
      var offset = (Math.atan(Math.pow(riverLength, 2) / widening) / 2 * width) + extraOffset;
      var xLeft = point.x + -Math.sin(angle) * offset;
      var yLeft = point.y + Math.cos(angle) * offset;
      riverPointsLeft.push({scX:xLeft, scY:yLeft});
      var xRight = point.x + Math.sin(angle) * offset;
      var yRight = point.y + -Math.cos(angle) * offset;
      riverPointsRight.unshift({scX:xRight, scY:yRight});

      river.remove();
      // generate path and return
    const right = lineGen(riverPointsRight);
    let left = lineGen(riverPointsLeft);
    left = left.substring(left.indexOf("C"));
      return round(right + left, 2);
  }

  // add lakes on depressed points on river course
  function addLakes() {
    console.time('addLakes');
    let smallLakes = 0;
    for (let i=0; i < land.length; i++) {
      // elavate all big lakes
      if (land[i].lake === 1) {
        land[i].height = 19;
        land[i].ctype = -1;
      }
      // define eligible small lakes
      if (land[i].lake === 2 && smallLakes < 100) {
        if (land[i].river !== undefined) {
          land[i].height = 19;
          land[i].ctype = -1;
          land[i].fn = -1;
          smallLakes++;
        } else {
          land[i].lake = undefined;
          land[i].neighbors.forEach(function(n) {
            if (cells[n].lake !== 1 && cells[n].river !== undefined) {
              cells[n].lake = 2;
              cells[n].height = 19;
              cells[n].ctype = -1;
              cells[n].fn = -1;
              smallLakes++;
            } else if (cells[n].lake === 2) {
              cells[n].lake = undefined;
            }
          });
        }
      }
    }
    console.log( "small lakes: " + smallLakes);

    // mark small lakes
    let unmarked = $.grep(land, function(e) {return e.fn === -1});
    while (unmarked.length) {
      let fn = -1, queue = [unmarked[0].index],lakeCells = [];
      unmarked[0].session = "addLakes";
      while (queue.length) {
        const q = queue.pop();
        lakeCells.push(q);
        if (cells[q].fn !== -1) fn = cells[q].fn;
        cells[q].neighbors.forEach(function(e) {
          if (cells[e].lake && cells[e].session !== "addLakes") {
            cells[e].session = "addLakes";
            queue.push(e);
          }
        });
      }
      if (fn === -1) {
        fn = features.length;
        features.push({i: fn, land: false, border: false});
      }
      lakeCells.forEach(function(c) {cells[c].fn = fn;});
      unmarked = $.grep(land, function(e) {return e.fn === -1});
    }

    land = $.grep(cells, function(e) {return e.height >= 20;});
    console.timeEnd('addLakes');
  }

  function editLabel() {
    if (customization) return;

    unselect();
    closeDialogs("#labelEditor, .stable");
    elSelected = d3.select(this).call(d3.drag().on("start", elementDrag)).classed("draggable", true);

    // update group parameters
    let group = d3.select(this.parentNode);
    updateGroupOptions();
    labelGroupSelect.value = group.attr("id");
    labelFontSelect.value = fonts.indexOf(group.attr("data-font"));
    labelSize.value = group.attr("data-size");
    labelColor.value = toHEX(group.attr("fill"));
    labelOpacity.value = group.attr("opacity");
    labelText.value = elSelected.text();
    const tr = parseTransform(elSelected.attr("transform"));
    labelAngle.value = tr[2];
    labelAngleValue.innerHTML = Math.abs(+tr[2]) + "°";

    $("#labelEditor").dialog({
      title: "Edit Label: " + labelText.value,
      minHeight: 30, width: "auto", maxWidth: 275, resizable: false,
      position: {my: "center top+10", at: "bottom", of: this},
      close: unselect
    });

    if (modules.editLabel) return;
    modules.editLabel = true;

    loadDefaultFonts();

    function updateGroupOptions() {
      labelGroupSelect.innerHTML = "";
      labels.selectAll("g:not(#burgLabels)").each(function(d) {
        if (this.parentNode.id === "burgLabels") return;
        let id = d3.select(this).attr("id");
        let opt = document.createElement("option");
        opt.value = opt.innerHTML = id;
        labelGroupSelect.add(opt);
      });
    }

    $("#labelGroupButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelGroupButtons").toggle();
    });

    // on group change
    document.getElementById("labelGroupSelect").addEventListener("change", function() {
      document.getElementById(this.value).appendChild(elSelected.remove().node());
    });

    // toggle inputs to declare a new group
    document.getElementById("labelGroupNew").addEventListener("click", function() {
      if ($("#labelGroupInput").css("display") === "none") {
        $("#labelGroupInput").css("display", "inline-block");
        $("#labelGroupSelect").css("display", "none");
        labelGroupInput.focus();
      } else {
        $("#labelGroupSelect").css("display", "inline-block");
        $("#labelGroupInput").css("display", "none");
      }
    });

    // toggle inputs to select a group
    document.getElementById("labelExternalFont").addEventListener("click", function() {
      if ($("#labelFontInput").css("display") === "none") {
        $("#labelFontInput").css("display", "inline-block");
        $("#labelFontSelect").css("display", "none");
        labelFontInput.focus();
      } else {
        $("#labelFontSelect").css("display", "inline-block");
        $("#labelFontInput").css("display", "none");
      }
    });

    // on new group creation
    document.getElementById("labelGroupInput").addEventListener("change", function() {
      if (!this.value) {
        tip("Please provide a valid group name");
        return;
      }
      let group = this.value.toLowerCase().replace(/ /g, "_").replace(/[^\w\s]/gi, "");
      if (Number.isFinite(+group.charAt(0))) group = "g" + group;
      // if el with this id exists, add size to id
      while (labels.selectAll("#"+group).size()) {group += "_new";}
      createNewLabelGroup(group);
    });

    function createNewLabelGroup(g) {
      let group = elSelected.node().parentNode.cloneNode(false);
      let groupNew = labels.append(f => group).attr("id", g);
      groupNew.append(f => elSelected.remove().node());
      updateGroupOptions();
      $("#labelGroupSelect, #labelGroupInput").toggle();
      labelGroupInput.value = "";
      labelGroupSelect.value = g;
      updateLabelGroups();
    }

    // remove label group on click
    document.getElementById("labelGroupRemove").addEventListener("click", function() {
      let group = d3.select(elSelected.node().parentNode);
      let id = group.attr("id");
      let count = group.selectAll("text").size();
      // remove group with < 2 label without ask
      if (count < 2) {
        removeAllLabelsInGroup(id);
        $("#labelEditor").dialog("close");
        return;
      }
      alertMessage.innerHTML = "Are you sure you want to remove all labels (" + count + ") of that group?";
      $("#alert").dialog({resizable: false, title: "Remove label group",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            removeAllLabelsInGroup(id);
            $("#labelEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });

    $("#labelTextButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelTextButtons").toggle();
    });

    // on label text change
    document.getElementById("labelText").addEventListener("input", function() {
      if (!this.value) {
        tip("Name should not be blank, set opacity to 0 to hide label or click remove button to delete");
        return;
      }
      // change Label text
      if (elSelected.select("textPath").size()) elSelected.select("textPath").text(this.value);
      else elSelected.text(this.value);
      $("div[aria-describedby='labelEditor'] .ui-dialog-title").text("Edit Label: " + this.value);
      // check if label is a country name
      let id = elSelected.attr("id") || "";
      if (id.includes("regionLabel")) {
        let state = +elSelected.attr("id").slice(11);
        states[state].name = this.value;
      }
    });

    // generate a random country name
    document.getElementById("labelTextRandom").addEventListener("click", function() {
      let name = elSelected.text();
      let id = elSelected.attr("id") || "";
      if (id.includes("regionLabel")) {
        // label is a country name
        let state = +elSelected.attr("id").slice(11);
        name = generateStateName(state.i);
        states[state].name = name;
      } else {
        // label is not a country name, use random culture
        let c = elSelected.node().getBBox();
        let closest = cultureTree.find((c.x + c.width / 2), (c.y + c.height / 2));
        let culture = Math.floor(Math.random() * cultures.length);
        name = generateName(culture);
      }
      labelText.value = name;
      $("div[aria-describedby='labelEditor'] .ui-dialog-title").text("Edit Label: " + name);
      // change Label text
      if (elSelected.select("textPath").size()) elSelected.select("textPath").text(name);
      else elSelected.text(name);
    });

    $("#labelFontButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelFontButtons").toggle();
    });

    // on label font change
    document.getElementById("labelFontSelect").addEventListener("change", function() {
      let group = elSelected.node().parentNode;
      let font = fonts[this.value].split(':')[0].replace(/\+/g, " ");
      group.setAttribute("font-family", font);
      group.setAttribute("data-font", fonts[this.value]);
    });

    // on adding custom font
    document.getElementById("labelFontInput").addEventListener("change", function() {
      fetchFonts(this.value).then(fetched => {
        if (!fetched) return;
        labelExternalFont.click();
        labelFontInput.value = "";
        if (fetched === 1) $("#labelFontSelect").val(fonts.length - 1).change();
      });
    });

    // on label size input
    document.getElementById("labelSize").addEventListener("input", function() {
      let group = elSelected.node().parentNode;
      let size = +this.value;
      group.setAttribute("data-size", size);
      group.setAttribute("font-size", rn((size + (size / scale)) / 2, 2))
    });

    $("#labelStyleButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelStyleButtons").toggle();
    });

    // on label fill color input
    document.getElementById("labelColor").addEventListener("input", function() {
      let group = elSelected.node().parentNode;
      group.setAttribute("fill", this.value);
    });

    // on label opacity input
    document.getElementById("labelOpacity").addEventListener("input", function() {
      let group = elSelected.node().parentNode;
      group.setAttribute("opacity", this.value);
    });

    $("#labelAngleButton").click(function() {
      $("#labelEditor > button").not(this).toggle();
      $("#labelAngleButtons").toggle();
    });

    // on label angle input
    document.getElementById("labelAngle").addEventListener("input", function() {
      const tr = parseTransform(elSelected.attr("transform"));
      labelAngleValue.innerHTML = Math.abs(+this.value) + "°";
      const c = elSelected.node().getBBox();
      const angle = +this.value;
      const transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)} ${(c.y+c.height/2)})`;
      elSelected.attr("transform", transform);
    });

    // display control points to curve label (place on path)
    document.getElementById("labelCurve").addEventListener("click", function() {
      let c = elSelected.node().getBBox();
      let cx = c.x + c.width / 2, cy = c.y + c.height / 2;

      if (!elSelected.select("textPath").size()) {
        let id = elSelected.attr("id");
        let pathId = "#textPath_" + id;
        let path = `M${cx-c.width},${cy} q${c.width},0 ${c.width * 2},0`;
        let text = elSelected.text(), x = elSelected.attr("x"), y = elSelected.attr("y");
        elSelected.text(null).attr("data-x", x).attr("data-y", y).attr("x", null).attr("y", null);
        defs.append("path").attr("id", "textPath_" + id).attr("d", path);
        elSelected.append("textPath").attr("href", pathId).attr("startOffset", "50%").text(text);
      }

      if (!debug.select("circle").size()) {
        debug.append("circle").attr("id", "textPathControl").attr("r", 1.6)
          .attr("cx", cx).attr("cy", cy).attr("transform", elSelected.attr("transform") || null)
          .call(d3.drag().on("start", textPathControlDrag));
      }
    });

    // drag textPath controle point to curve the label
    function textPathControlDrag() {
      let textPath = defs.select("#textPath_" + elSelected.attr("id"));
      let path = textPath.attr("d").split(" ");
      let M = path[0].split(",");
      let q = path[1].split(","); // +q[1] to get qy - the only changeble value
      let y = d3.event.y;

      d3.event.on("drag", function() {
        let dy = d3.event.y - y;
        let total = +q[1] + dy * 8;
        d3.select(this).attr("cy", d3.event.y);
        textPath.attr("d", `${M[0]},${+M[1] - dy} ${q[0]},${total} ${path[2]}`);
      });
    }

    // cancel label curvature
    document.getElementById("labelCurveCancel").addEventListener("click", function() {
      if (!elSelected.select("textPath").size()) return;
      let text = elSelected.text(), x = elSelected.attr("data-x"), y = elSelected.attr("data-y");
      elSelected.text();
      elSelected.attr("x", x).attr("y", y).attr("data-x", null).attr("data-y", null).text(text);
      defs.select("#textPath_" + elSelected.attr("id")).remove();
      debug.select("circle").remove();
    });

    // open legendsEditor
    document.getElementById("labelLegend").addEventListener("click", function() {
      let id = elSelected.attr("id");
      let name = elSelected.text();
      editLegends(id, name);
    });

    // copy label on click
    document.getElementById("labelCopy").addEventListener("click", function() {
      let group = d3.select(elSelected.node().parentNode);
      copy = group.append(f => elSelected.node().cloneNode(true));
      let id = "label" + Date.now().toString().slice(7);
      copy.attr("id", id).attr("class", null).on("click", editLabel);
      let shift = +group.attr("font-size") + 1;
      if (copy.select("textPath").size()) {
        let path = defs.select("#textPath_" + elSelected.attr("id")).attr("d");
        let textPath = defs.append("path").attr("id", "textPath_" + id);
        copy.select("textPath").attr("href", "#textPath_" + id);
        let pathArray = path.split(" ");
        let x = +pathArray[0].split(",")[0].slice(1);
        let y = +pathArray[0].split(",")[1];
        textPath.attr("d", `M${x-shift},${y-shift} ${pathArray[1]} ${pathArray[2]}`);shift
      } else {
        let x = +elSelected.attr("x") - shift;
        let y = +elSelected.attr("y") - shift;
        while (group.selectAll("text[x='" + x + "']").size()) {x -= shift; y -= shift;}
        copy.attr("x", x).attr("y", y);
      }
    });

    // remove label on click
    document.getElementById("labelRemoveSingle").addEventListener("click", function() {
      alertMessage.innerHTML = "Are you sure you want to remove the label?";
      $("#alert").dialog({resizable: false, title: "Remove label",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            elSelected.remove();
            defs.select("#textPath_" + elSelected.attr("id")).remove();
            $("#labelEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      });
    });
  }

  function editRiver() {
    if (customization) return;
    if (elSelected) {
      const self = d3.select(this).attr("id") === elSelected.attr("id");
      const point = d3.mouse(this);
      if (elSelected.attr("data-river") === "new") {
        addRiverPoint([point[0],point[1]]);
        completeNewRiver();
        return;
      } else if (self) {
        riverAddControlPoint(point);
        return;
      }
    }

    unselect();
    closeDialogs("#riverEditor, .stable");
    elSelected = d3.select(this);
    elSelected.call(d3.drag().on("start", riverDrag));

    const tr = parseTransform(elSelected.attr("transform"));
    riverAngle.value = tr[2];
    riverAngleValue.innerHTML = Math.abs(+tr[2]) + "°";
    riverScale.value = tr[5];
    riverWidthInput.value = +elSelected.attr("data-width");
    riverIncrement.value = +elSelected.attr("data-increment");

    $("#riverEditor").dialog({
      title: "Edit River",
      minHeight: 30, width: "auto", resizable: false,
      position: {my: "center top+20", at: "top", of: d3.event},
      close: function() {
        if ($("#riverNew").hasClass('pressed')) completeNewRiver();
        unselect();
      }
    });

    if (!debug.select(".controlPoints").size()) debug.append("g").attr("class", "controlPoints");
    riverDrawPoints();

    if (modules.editRiver) {return;}
    modules.editRiver = true;

    function riverAddControlPoint(point) {
      let dists = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const x = +d3.select(this).attr("cx");
        const y = +d3.select(this).attr("cy");
        dists.push(Math.hypot(point[0] - x, point[1] - y));
      });
      let index = dists.length;
      if (dists.length > 1) {
        const sorted = dists.slice(0).sort(function(a, b) {return a-b;});
        const closest = dists.indexOf(sorted[0]);
        const next = dists.indexOf(sorted[1]);
        if (closest <= next) {index = closest+1;} else {index = next+1;}
      }
      const before = ":nth-child(" + (index + 1) + ")";
      debug.select(".controlPoints").insert("circle", before)
        .attr("cx", point[0]).attr("cy", point[1]).attr("r", 0.35)
        .call(d3.drag().on("drag", riverPointDrag))
        .on("click", function(d) {
          $(this).remove();
          redrawRiver();
        });
      redrawRiver();
    }

    function riverDrawPoints() {
      const node = elSelected.node();
      // river is a polygon, so divide length by 2 to get course length
      const l = node.getTotalLength() / 2;
      const parts = (l / 5) >> 0; // number of points
      let inc = l / parts; // increment
      if (inc === Infinity) {inc = l;} // 2 control points for short rivers
      // draw control points
      for (let i = l, c = l; i > 0; i -= inc, c += inc) {
        const p1 = node.getPointAtLength(i);
        const p2 = node.getPointAtLength(c);
        const p = [(p1.x + p2.x) / 2, (p1.y + p2.y) / 2];
        addRiverPoint(p);
      }
      // last point should be accurate
      const lp1 = node.getPointAtLength(0);
      const lp2 = node.getPointAtLength(l * 2);
      const p = [(lp1.x + lp2.x) / 2, (lp1.y + lp2.y) / 2];
      addRiverPoint(p);
    }

    function addRiverPoint(point) {
      debug.select(".controlPoints").append("circle")
        .attr("cx", point[0]).attr("cy", point[1]).attr("r", 0.35)
        .call(d3.drag().on("drag", riverPointDrag))
        .on("click", function(d) {
          $(this).remove();
          redrawRiver();
        });
    }

    function riverPointDrag() {
      d3.select(this).attr("cx", d3.event.x).attr("cy", d3.event.y);
      redrawRiver();
    }

    function riverDrag() {
      const x = d3.event.x, y = d3.event.y;
      const tr = parseTransform(elSelected.attr("transform"));
      d3.event.on("drag", function() {
        let xc = d3.event.x, yc = d3.event.y;
        let transform = `translate(${(+tr[0]+xc-x)},${(+tr[1]+yc-y)}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
        elSelected.attr("transform", transform);
        debug.select(".controlPoints").attr("transform", transform);
      });
    }

    function redrawRiver() {
      let points = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const el = d3.select(this);
        points.push([+el.attr("cx"), +el.attr("cy")]);
      });
      const width = +riverWidthInput.value;
      const increment = +riverIncrement.value;
      const d = drawRiverSlow(points, width, increment);
      elSelected.attr("d", d);
    }

    $("#riverWidthInput, #riverIncrement").change(function() {
      const width = +riverWidthInput.value;
      const increment = +riverIncrement.value;
      elSelected.attr("data-width", width).attr("data-increment", increment);
      redrawRiver();
    });

    $("#riverRegenerate").click(function() {
      let points = [],amended = [],x, y, p1, p2;
      const node = elSelected.node();
      const l = node.getTotalLength() / 2;
      const parts = (l / 8) >> 0; // number of points
      let inc = l / parts; // increment
      if (inc === Infinity) {inc = l;} // 2 control points for short rivers
      for (let i = l, e = l; i > 0; i -= inc, e += inc) {
        p1 = node.getPointAtLength(i);
        p2 = node.getPointAtLength(e);
        x = (p1.x + p2.x) / 2, y = (p1.y + p2.y) / 2;
        points.push([x, y]);
      }
      // last point should be accurate
      p1 = node.getPointAtLength(0);
      p2 = node.getPointAtLength(l * 2);
      x = (p1.x + p2.x) / 2, y = (p1.y + p2.y) / 2;
      points.push([x, y]);
      // amend points
      const rndFactor = 0.3 + Math.random() * 1.4; // random factor in range 0.2-1.8
      for (let i = 0; i < points.length; i++) {
        x = points[i][0],y = points[i][1];
        amended.push([x, y]);
        // add additional semi-random point
        if (i + 1 < points.length) {
          const x2 = points[i+1][0],y2 = points[i+1][1];
          let side = Math.random() > 0.5 ? 1 : -1;
          const angle = Math.atan2(y2 - y, x2 - x);
          const serpentine = 2 / (i+1);
          const meandr = serpentine + 0.3 + Math.random() * rndFactor;
          x = (x + x2) / 2, y = (y + y2) / 2;
          x += -Math.sin(angle) * meandr * side;
          y += Math.cos(angle) * meandr * side;
          amended.push([x, y]);
        }
      }
      const width = +riverWidthInput.value * 0.6 + Math.random();
      const increment = +riverIncrement.value * 0.9 + Math.random() * 0.2;
      riverWidthInput.value = width;
      riverIncrement.value = increment;
      elSelected.attr("data-width", width).attr("data-increment", increment);
      const d = drawRiverSlow(amended, width, increment);
      elSelected.attr("d", d).attr("data-width", width).attr("data-increment", increment);
      debug.select(".controlPoints").selectAll("*").remove();
      amended.map(function(p) {addRiverPoint(p);});
    });

    $("#riverAngle").on("input", function() {
      const tr = parseTransform(elSelected.attr("transform"));
      riverAngleValue.innerHTML = Math.abs(+this.value) + "°";
      const c = elSelected.node().getBBox();
      const angle = +this.value, scale = +tr[5];
      const transform = `translate(${tr[0]},${tr[1]}) rotate(${angle} ${(c.x+c.width/2)*scale} ${(c.y+c.height/2)*scale}) scale(${scale})`;
      elSelected.attr("transform", transform);
      debug.select(".controlPoints").attr("transform", transform);
    });

    $("#riverReset").click(function() {
      elSelected.attr("transform", "");
      debug.select(".controlPoints").attr("transform", "");
      riverAngle.value = 0;
      riverAngleValue.innerHTML = "0°";
      riverScale.value = 1;
    });

    $("#riverScale").change(function() {
      const tr = parseTransform(elSelected.attr("transform"));
      const scaleOld = +tr[5],scale = +this.value;
      const c = elSelected.node().getBBox();
      const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
      const trX = +tr[0] + cx * (scaleOld - scale);
      const trY = +tr[1] + cy * (scaleOld - scale);
      const scX = +tr[3] * scale/scaleOld;
      const scY = +tr[4] * scale/scaleOld;
      const transform = `translate(${trX},${trY}) rotate(${tr[2]} ${scX} ${scY}) scale(${scale})`;
      elSelected.attr("transform", transform);
      debug.select(".controlPoints").attr("transform", transform);
    });

    $("#riverNew").click(function() {
      if ($(this).hasClass('pressed')) {
        completeNewRiver();
      } else {
        // enter creation mode
        $(".pressed").removeClass('pressed');
        $(this).addClass('pressed');
        if (elSelected) elSelected.call(d3.drag().on("drag", null));
        debug.select(".controlPoints").selectAll("*").remove();
        viewbox.style("cursor", "crosshair").on("click", newRiverAddPoint);
      }
    });

    function newRiverAddPoint() {
      const point = d3.mouse(this);
      addRiverPoint([point[0],point[1]]);
      if (!elSelected || elSelected.attr("data-river") !== "new") {
        const id = +$("#rivers > path").last().attr("id").slice(5) + 1;
        elSelected = rivers.append("path").attr("data-river", "new").attr("id", "river"+id)
          .attr("data-width", 2).attr("data-increment", 1).on("click", completeNewRiver);
      } else {
        redrawRiver();
        let cell = diagram.find(point[0],point[1]).index;
        let f = cells[cell].fn;
        let ocean = !features[f].land && features[f].border;
        if (ocean && debug.select(".controlPoints").selectAll("circle").size() > 5) completeNewRiver();
      }
    }

    function completeNewRiver() {
      $("#riverNew").removeClass('pressed');
      restoreDefaultEvents();
      if (!elSelected || elSelected.attr("data-river") !== "new") return;
      redrawRiver();
      elSelected.attr("data-river", "");
      elSelected.call(d3.drag().on("start", riverDrag)).on("click", editRiver);
      const r = +elSelected.attr("id").slice(5);
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const x = +d3.select(this).attr("cx");
        const y = +d3.select(this).attr("cy");
        const cell = diagram.find(x, y, 3);
        if (!cell) return;
        if (cells[cell.index].river === undefined) cells[cell.index].river = r;
      });
      unselect();
      debug.append("g").attr("class", "controlPoints");
    }

    $("#riverCopy").click(function() {
      const tr = parseTransform(elSelected.attr("transform"));
      const d = elSelected.attr("d");
      let x = 2, y = 2;
      let transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      while (rivers.selectAll("[transform='" + transform + "'][d='" + d + "']").size() > 0) {
        x += 2; y += 2;
        transform = `translate(${tr[0]-x},${tr[1]-y}) rotate(${tr[2]} ${tr[3]} ${tr[4]}) scale(${tr[5]})`;
      }
      const river = +$("#rivers > path").last().attr("id").slice(5) + 1;
      rivers.append("path").attr("d", d)
        .attr("transform", transform)
        .attr("id", "river"+river).on("click", editRiver)
        .attr("data-width", elSelected.attr("data-width"))
        .attr("data-increment", elSelected.attr("data-increment"));
      unselect();
    });

    // open legendsEditor
    document.getElementById("riverLegend").addEventListener("click", function() {
      let id = elSelected.attr("id");
      editLegends(id, id);
    });

    $("#riverRemove").click(function() {
      alertMessage.innerHTML = `Are you sure you want to remove the river?`;
      $("#alert").dialog({resizable: false, title: "Remove river",
        buttons: {
          Remove: function() {
            $(this).dialog("close");
            const river = +elSelected.attr("id").slice(5);
            const avPrec = rn(precInput.value / Math.sqrt(cells.length), 2);
            land.map(function(l) {
              if (l.river === river) {
                l.river = undefined;
                l.flux = avPrec;
              }
            });
            elSelected.remove();
            unselect();
            $("#riverEditor").dialog("close");
          },
          Cancel: function() {$(this).dialog("close");}
        }
      })
    });

  }

  function editRoute() {
    if (customization) {return;}
    if (elSelected) {
      const self = d3.select(this).attr("id") === elSelected.attr("id");
      const point = d3.mouse(this);
      if (elSelected.attr("data-route") === "new") {
        addRoutePoint({x:point[0],y:point[1]});
        completeNewRoute();
        return;
      } else if (self) {
        routeAddControlPoint(point);
        return;
      }
    }

    unselect();
    closeDialogs("#routeEditor, .stable");

    if (this && this !== window) {
      elSelected = d3.select(this);
      if (!debug.select(".controlPoints").size()) debug.append("g").attr("class", "controlPoints");
      routeDrawPoints();
      routeUpdateGroups();
      let routeType = d3.select(this.parentNode).attr("id");
      routeGroup.value = routeType;

      $("#routeEditor").dialog({
        title: "Edit Route",
        minHeight: 30, width: "auto", resizable: false,
        position: {my: "center top+20", at: "top", of: d3.event},
        close: function() {
          if ($("#addRoute").hasClass('pressed')) completeNewRoute();
          if ($("#routeSplit").hasClass('pressed')) $("#routeSplit").removeClass('pressed');
          unselect();
        }
      });
    } else {elSelected = null;}

    if (modules.editRoute) {return;}
    modules.editRoute = true;

    function routeAddControlPoint(point) {
      let dists = [];
      debug.select(".controlPoints").selectAll("circle").each(function() {
        const x = +d3.select(this).attr("cx");
        const y = +d3.select(this).attr("cy");
        dists.push(Math.hypot(point[0] - x, point[1] - y));
      });
      let index = dists.length;
      if (dists.length > 1) {
        const sorted = dists.slice(0).sort(function(a, b) {return a-b;});
        const closest = dists.indexOf(sorted[0]);
        const next = dists.indexOf(sorted[1]);
        if (closest <= next) {index = closest+1;} else {index = next+1;}
      }
      const before = ":nth-child(" + (index + 1) + ")";
      debug.select(".controlPoints").insert("circle", before)
        .attr("cx", point[0]).attr("cy", point[1]).attr("r", 0.35)
        .call(d3.drag().on("drag", routePointDrag))
        .on("click", function(d) {
          $(this).remove();
          routeRedraw();
        });
      routeRedraw();
    }

    function routeDrawPoints() {
      if (!elSelected.size()) return;
      const node = elSelected.node();
      const l = node.getTotalLength();
      const parts = (l / 5) >> 0; // number of points
      let inc = l / parts; // increment
      if (inc === Infinity) inc = l; // 2 control points for short routes
      // draw control points
      for (let i = 0; i <= l; i += inc) {
        const p = node.getPointAtLength(i);
        addRoutePoint(p);
      }
      // convert length to distance
      routeLength.innerHTML = rn(l * distanceScale.value) + " " + distanceUnit.value;
    }

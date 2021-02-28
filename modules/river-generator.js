(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Rivers = factory());
}(this, (function () {'use strict';

const generate = function(changeHeights = true) {
  TIME && console.time('generateRivers');
  Math.random = aleaPRNG(seed);
  const cells = pack.cells, p = cells.p, features = pack.features;

  const riversData = []; // rivers data
  cells.fl = new Uint16Array(cells.i.length); // water flux array
  cells.r = new Uint16Array(cells.i.length); // rivers array
  cells.conf = new Uint8Array(cells.i.length); // confluences array
  let riverNext = 1; // first river id is 1

  markupLand();
  const h = alterHeights();
  removeStoredLakeData();
  resolveDepressions(h);
  drainWater();
  defineRivers();
  cleanupLakeData();

  if (changeHeights) cells.h = Uint8Array.from(h); // apply changed heights as basic one

  TIME && console.timeEnd('generateRivers');

  // build distance field in cells from water (cells.t)
  function markupLand() {
    const q = t => cells.i.filter(i => cells.t[i] === t);
    for (let t = 2, queue = q(t); queue.length; t++, queue = q(t)) {
      queue.forEach(i => cells.c[i].forEach(c => {
        if (!cells.t[c]) cells.t[c] = t+1;
      }));
    }
  }

  // height with added t value to make map less depressed
  function alterHeights() {
    const h = Array.from(cells.h)
      .map((h, i) => h < 20 || cells.t[i] < 1 ? h : h + cells.t[i] / 100)
      .map((h, i) => h < 20 || cells.t[i] < 1 ? h : h + d3.mean(cells.c[i].map(c => cells.t[c])) / 10000);
    return h;
  }

  function removeStoredLakeData() {
    features.forEach(f => {
      delete f.flux;
      delete f.inlets;
      delete f.outlet;
      delete f.height;
    });
  }

  function drainWater() {
    const MIN_FLUX_TO_FORM_RIVER = 30;
    const land = cells.i.filter(i => h[i] >= 20).sort((a,b) => h[b] - h[a]);

    const lakeOutCells = new Uint16Array(cells.i.length); // to enumerate lake outlet positions
    features.forEach(f => {
      if (f.type !== "lake") return;
      const gridCell = cells.g[f.firstCell];

      // lake possible outlet: cell around with min height
      f.outCell = f.shoreline[d3.scan(f.shoreline, (a,b) => h[a] - h[b])];
      lakeOutCells[f.outCell] = f.i;

      // default flux: sum of precipition around lake first cell
      f.flux = rn(d3.sum(f.shoreline.map(c => grid.cells.prec[cells.g[c]])) / 2);

      // temperature and evaporation to detect closed lakes
      f.temp = f.cells < 6 ? grid.cells.temp[gridCell] : rn(d3.mean(f.shoreline.map(c => grid.cells.temp[cells.g[c]])), 1);
      const height = (f.height - 18) ** heightExponentInput.value; // height in meters
      const evaporation = (700 * (f.temp + .006 * height) / 50 + 75) / (80 - f.temp); // based on Penman formula, [1-11]
      f.evaporation = rn(evaporation * f.cells);
    });

    land.forEach(function(i) {
      cells.fl[i] += grid.cells.prec[cells.g[i]]; // flux from precipitation
      const x = p[i][0], y = p[i][1];

      // create lake outlet if flux > evaporation
      const lakes = !lakeOutCells[i] ? [] : features.filter(feature => i === feature.outCell && feature.flux > feature.evaporation);
      for (const lake of lakes) {
        const lakeCell = cells.c[i].find(c => h[c] < 20 && cells.f[c] === lake.i);

        // allow chain lakes to retain identity
        if (cells.r[lakeCell] !== lake.river) {
          const sameRiver = cells.c[lakeCell].some(c => cells.r[c] === lake.river);
          if (sameRiver) {
            cells.r[lakeCell] = lake.river;
            riversData.push({river: lake.river, cell: lakeCell, x: p[lakeCell][0], y: p[lakeCell][1]});
          } else {
            cells.r[lakeCell] = riverNext;
            riversData.push({river: riverNext, cell: lakeCell, x: p[lakeCell][0], y: p[lakeCell][1]});
            riverNext++;
          }
        }

        lake.outlet = cells.r[lakeCell];
        cells.fl[lakeCell] += Math.max(lake.flux - lake.evaporation, 0); // not evaporated lake water drains to outlet
        flowDown(i, cells.fl[i], cells.fl[lakeCell], lake.outlet);
      }

      // assign all tributary rivers to outlet basin
      for (let outlet = lakes[0]?.outlet, l = 0; l < lakes.length; l++) {
        lakes[l].inlets?.forEach(fork => riversData.find(r => r.river === fork).parent = outlet);
      }

      // near-border cell: pour water out of the screen
      if (cells.b[i] && cells.r[i]) {
        const to = [];
        const min = Math.min(y, graphHeight - y, x, graphWidth - x);
        if (min === y) {to[0] = x; to[1] = 0;} else
        if (min === graphHeight - y) {to[0] = x; to[1] = graphHeight;} else
        if (min === x) {to[0] = 0; to[1] = y;} else
        if (min === graphWidth - x) {to[0] = graphWidth; to[1] = y;}
        riversData.push({river: cells.r[i], cell: i, x: to[0], y: to[1]});
        return;
      }

      // downhill cell (make sure it's not in the source lake)
      const min = lakeOutCells[i]
        ? cells.c[i].filter(c => !lakes.map(lake => lake.i).includes(cells.f[c])).sort((a, b) => h[a] - h[b])[0]
        : cells.c[i].sort((a, b) => h[a] - h[b])[0];

      if (cells.fl[i] < MIN_FLUX_TO_FORM_RIVER) {
        if (h[min] >= 20) cells.fl[min] += cells.fl[i];
        return; // flux is too small to operate as river
      }

      // proclaim a new river
      if (!cells.r[i]) {
        cells.r[i] = riverNext;
        riversData.push({river: riverNext, cell: i, x, y});
        riverNext++;
      }

      flowDown(min, cells.fl[min], cells.fl[i], cells.r[i], i);
    });
  }

  function flowDown(toCell, toFlux, fromFlux, river, fromCell = 0) {
    if (cells.r[toCell]) {
      // downhill cell already has river assigned
      if (toFlux < fromFlux) {
        cells.conf[toCell] = cells.fl[toCell]; // mark confluence
        if (h[toCell] >= 20) riversData.find(r => r.river === cells.r[toCell]).parent = river; // min river is a tributary of current river
        cells.r[toCell] = river; // re-assign river if downhill part has less flux
      } else {
        cells.conf[toCell] += fromFlux; // mark confluence
        if (h[toCell] >= 20) riversData.find(r => r.river === river).parent = cells.r[toCell]; // current river is a tributary of min river
      }
    } else cells.r[toCell] = river; // assign the river to the downhill cell

    if (h[toCell] < 20) {
      // pour water to the water body
      const haven = fromCell ? cells.haven[fromCell] : toCell;
      riversData.push({river, cell: haven, x: p[toCell][0], y: p[toCell][1]});

      const waterBody = features[cells.f[toCell]];
      if (waterBody.type === "lake") {
        if (!waterBody.river || fromFlux > waterBody.enteringFlux) {
          waterBody.river = river;
          waterBody.enteringFlux = fromFlux;
        }
        waterBody.flux = waterBody.flux + fromFlux;
        waterBody.inlets ? waterBody.inlets.push(river) : waterBody.inlets = [river];
      }
    } else {
      // propagate flux and add next river segment
      cells.fl[toCell] += fromFlux;
      riversData.push({river, cell: toCell, x: p[toCell][0], y: p[toCell][1]});
    }
  }

  function defineRivers() {
    pack.rivers = []; // rivers data
    const riverPaths = []; // temporary data for all rivers

    for (let r = 1; r <= riverNext; r++) {
      const riverSegments = riversData.filter(d => d.river === r);

      if (riverSegments.length > 2) {
        const source = riverSegments[0], mouth = riverSegments[riverSegments.length-2];
        const riverEnhanced = addMeandring(riverSegments);
        let width = rn(.8 + Math.random() * .4, 1); // river width modifier [.2, 10]
        let increment = rn(.8 + Math.random() * .6, 1); // river bed widening modifier [.01, 3]
        const [path, length] = getPath(riverEnhanced, width, increment, cells.h[source.cell] >= 20 ? .1 : .6);
        riverPaths.push([r, path, width, increment]);
        const parent = source.parent || 0;
        pack.rivers.push({i:r, parent, length, source:source.cell, mouth:mouth.cell});
      } else {
        // remove too short rivers
        riverSegments.filter(s => cells.r[s.cell] === r).forEach(s => cells.r[s.cell] = 0);
      }
    }

    // drawRivers
    rivers.selectAll("path").remove();
    rivers.selectAll("path").data(riverPaths).enter()
      .append("path").attr("d", d => d[1]).attr("id", d => "river"+d[0])
      .attr("data-width", d => d[2]).attr("data-increment", d => d[3]);
  }

  function cleanupLakeData() {
    for (const feature of features) {
      if (feature.type !== "lake") continue;
      delete feature.river;
      delete feature.enteringFlux;
      delete feature.shoreline;
      delete feature.outCell;
      feature.height = rn(feature.height);

      const inlets = feature.inlets?.filter(r => pack.rivers.find(river => river.i === r));
      if (!inlets || !inlets.length) delete feature.inlets;
      else feature.inlets = inlets;

      const outlet = feature.outlet && pack.rivers.find(river => river.i === feature.outlet);
      if (!outlet) delete feature.outlet;
    }
  }
}

// depression filling algorithm (for a correct water flux modeling)
const resolveDepressions = function(h) {
  const {cells, features} = pack;

  const lakes = features.filter(f => f.type === "lake");
  lakes.forEach(l => {
    const uniqueCells = new Set();
    l.vertices.forEach(v => pack.vertices.c[v].forEach(c => cells.h[c] >= 20 && uniqueCells.add(c)));
    l.shoreline = [...uniqueCells];
    l.height = 21;
  });

  const land = cells.i.filter(i => h[i] >= 20 && h[i] < 100 && !cells.b[i]); // exclude near-border cells
  land.sort((a,b) => h[b] - h[a]); // highest cells go first

  let depressions = Infinity;
  for (let l = 0; depressions && l < 100; l++) {
    depressions = 0;

    for (const l of lakes) {
      const minHeight = d3.min(l.shoreline.map(s => h[s]));
      if (minHeight >= 100 || l.height > minHeight) continue;
      l.height = minHeight + 1;
      depressions++;
    }

    for (const i of land) {
      const minHeight = d3.min(cells.c[i].map(c => cells.t[c] > 0 ? h[c] : pack.features[cells.f[c]].height || h[c]));
      if (minHeight >= 100 || h[i] > minHeight) continue;
      h[i] = minHeight + 1;
      depressions++;
    }
  }

  depressions && ERROR && console.error("Heightmap is depressed. Issues with rivers expected. Remove depressed areas to resolve");
}

// add more river points on 1/3 and 2/3 of length
const addMeandring = function(segments, rndFactor = 0.3) {
  const riverEnhanced = []; // to store enhanced segments
  let side = 1; // to control meandring direction

  for (let s = 0; s < segments.length; s++) {
    const sX = segments[s].x, sY = segments[s].y; // segment start coordinates
    const c = pack.cells.conf[segments[s].cell] || 0; // if segment is river confluence
    riverEnhanced.push([sX, sY, c]);

    if (s+1 === segments.length) break; // do not enhance last segment

    const eX = segments[s+1].x, eY = segments[s+1].y; // segment end coordinates
    const angle = Math.atan2(eY - sY, eX - sX);
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const serpentine = 1 / (s + 1) + 0.3;
    const meandr = serpentine + Math.random() * rndFactor;
    if (P(.5)) side *= -1; // change meandring direction in 50%
    const dist2 = (eX - sX) ** 2 + (eY - sY) ** 2;
    // if dist2 is big or river is small add extra points at 1/3 and 2/3 of segment
    if (dist2 > 64 || (dist2 > 16 && segments.length < 6)) {
      const p1x = (sX * 2 + eX) / 3 + side * -sin * meandr;
      const p1y = (sY * 2 + eY) / 3 + side * cos * meandr;
      if (P(.2)) side *= -1; // change 2nd extra point meandring direction in 20%
      const p2x = (sX + eX * 2) / 3 + side * sin * meandr;
      const p2y = (sY + eY * 2) / 3 + side * cos * meandr;
      riverEnhanced.push([p1x, p1y], [p2x, p2y]);
    // if dist is medium or river is small add 1 extra middlepoint
    } else if (dist2 > 16 || segments.length < 6) {
      const p1x = (sX + eX) / 2 + side * -sin * meandr;
      const p1y = (sY + eY) / 2 + side * cos * meandr;
      riverEnhanced.push([p1x, p1y]);
    }

  }
  return riverEnhanced;
}

const getPath = function(points, width = 1, increment = 1, starting = .1) {
  let offset, extraOffset = starting; // starting river width (to make river source visible)
  const riverLength = points.reduce((s, v, i, p) => s + (i ? Math.hypot(v[0] - p[i-1][0], v[1] - p[i-1][1]) : 0), 0); // summ of segments length
  const widening = rn((1000 + (riverLength * 30)) * increment);
  const riverPointsLeft = [], riverPointsRight = []; // store points on both sides to build a valid polygon
  const last = points.length - 1;
  const factor = riverLength / points.length;

  // first point
  let x = points[0][0], y = points[0][1], c;
  let angle = Math.atan2(y - points[1][1], x - points[1][0]);
  let sin = Math.sin(angle), cos = Math.cos(angle);
  let xLeft = x + -sin * extraOffset, yLeft = y + cos * extraOffset;
  riverPointsLeft.push([xLeft, yLeft]);
  let xRight = x + sin * extraOffset, yRight = y + -cos * extraOffset;
  riverPointsRight.unshift([xRight, yRight]);

  // middle points
  for (let p = 1; p < last; p++) {
    x = points[p][0], y = points[p][1], c = points[p][2] || 0;
    const xPrev = points[p-1][0], yPrev = points[p - 1][1];
    const xNext = points[p+1][0], yNext = points[p + 1][1];
    angle = Math.atan2(yPrev - yNext, xPrev - xNext);
    sin = Math.sin(angle), cos = Math.cos(angle);
    offset = (Math.atan(Math.pow(p * factor, 2) / widening) / 2 * width) + extraOffset;
    const confOffset = Math.atan(c * 5 / widening);
    extraOffset += confOffset;
    xLeft = x + -sin * offset, yLeft = y + cos * (offset + confOffset);
    riverPointsLeft.push([xLeft, yLeft]);
    xRight = x + sin * offset, yRight = y + -cos * offset;
    riverPointsRight.unshift([xRight, yRight]);
  }

  // end point
  x = points[last][0], y = points[last][1], c = points[last][2];
  if (c) extraOffset += Math.atan(c * 10 / widening); // add extra width on river confluence
  angle = Math.atan2(points[last-1][1] - y, points[last-1][0] - x);
  sin = Math.sin(angle), cos = Math.cos(angle);
  xLeft = x + -sin * offset, yLeft = y + cos * offset;
  riverPointsLeft.push([xLeft, yLeft]);
  xRight = x + sin * offset, yRight = y + -cos * offset;
  riverPointsRight.unshift([xRight, yRight]);

  // generate polygon path and return
  lineGen.curve(d3.curveCatmullRom.alpha(0.1));
  const right = lineGen(riverPointsRight);
  let left = lineGen(riverPointsLeft);
  left = left.substring(left.indexOf("C"));
  return [round(right + left, 2), rn(riverLength, 2)];
}

const specify = function() {
  const rivers = pack.rivers;
  if (!rivers.length) return;
  Math.random = aleaPRNG(seed);
  const tresholdElement = Math.ceil(rivers.length * .15);
  const smallLength = rivers.map(r => r.length || 0).sort((a, b) => a-b)[tresholdElement];
  const smallType = {"Creek":9, "River":3, "Brook":3, "Stream":1}; // weighted small river types

  for (const r of rivers) {
    r.basin = getBasin(r.i, r.parent);
    r.name = getName(r.mouth);
    const small = r.length < smallLength;
    r.type = r.parent && !(r.i%6) ? small ? "Branch" : "Fork" : small ? rw(smallType) : "River";
  }
}

const getName = function(cell) {
  return Names.getCulture(pack.cells.culture[cell]);
}

// remove river and all its tributaries
const remove = function(id) {
  const cells = pack.cells;
  const riversToRemove = pack.rivers.filter(r => r.i === id || getBasin(r.i, r.parent, id) === id).map(r => r.i);
  riversToRemove.forEach(r => rivers.select("#river"+r).remove());
  cells.r.forEach((r, i) => {
    if (!r || !riversToRemove.includes(r)) return;
    cells.r[i] = 0;
    cells.fl[i] = grid.cells.prec[cells.g[i]];
    cells.conf[i] = 0;
  });
  pack.rivers = pack.rivers.filter(r => !riversToRemove.includes(r.i));
}

const getBasin = function(r, p, e) {
  while (p && r !== p && r !== e) {
    const parent = pack.rivers.find(r => r.i === p);
    if (!parent) return r;
    r = parent.i;
    p = parent.parent;
  }
  return r;
}

return {generate, resolveDepressions, addMeandring, getPath, specify, getName, getBasin, remove};

})));
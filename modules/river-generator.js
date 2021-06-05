(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? (module.exports = factory()) : typeof define === "function" && define.amd ? define(factory) : (global.Rivers = factory());
})(this, function () {
  "use strict";

  const generate = function (changeHeights = true) {
    TIME && console.time("generateRivers");
    Math.random = aleaPRNG(seed);
    const cells = pack.cells,
      p = cells.p,
      features = pack.features;

    const riversData = []; // rivers data
    cells.fl = new Uint16Array(cells.i.length); // water flux array
    cells.r = new Uint16Array(cells.i.length); // rivers array
    cells.conf = new Uint8Array(cells.i.length); // confluences array
    let riverNext = 1; // first river id is 1

    const h = alterHeights();
    prepareLakeData();
    resolveDepressions(h, 200);
    drainWater();
    defineRivers();
    Lakes.cleanupLakeData();

    if (changeHeights) cells.h = Uint8Array.from(h); // apply changed heights as basic one

    TIME && console.timeEnd("generateRivers");

    function prepareLakeData() {
      features.forEach(f => {
        if (f.type !== "lake") return;
        delete f.flux;
        delete f.inlets;
        delete f.outlet;
        delete f.height;
        !f.shoreline && Lakes.getShoreline(f);
      });
    }

    function drainWater() {
      const MIN_FLUX_TO_FORM_RIVER = 30;
      const land = cells.i.filter(i => h[i] >= 20).sort((a, b) => h[b] - h[a]);
      const lakeOutCells = Lakes.setClimateData(h);

      land.forEach(function (i) {
        cells.fl[i] += grid.cells.prec[cells.g[i]]; // flux from precipitation
        const [x, y] = p[i];

        // create lake outlet if lake is not in deep depression and flux > evaporation
        const lakes = lakeOutCells[i] ? features.filter(feature => i === feature.outCell && feature.flux > feature.evaporation) : [];
        for (const lake of lakes) {
          const lakeCell = cells.c[i].find(c => h[c] < 20 && cells.f[c] === lake.i);

          cells.fl[lakeCell] += Math.max(lake.flux - lake.evaporation, 0); // not evaporated lake water drains to outlet

          // allow chain lakes to retain identity
          if (cells.r[lakeCell] !== lake.river) {
            const sameRiver = cells.c[lakeCell].some(c => cells.r[c] === lake.river);
            if (sameRiver) {
              cells.r[lakeCell] = lake.river;
              riversData.push({river: lake.river, cell: lakeCell, x: p[lakeCell][0], y: p[lakeCell][1], flux: cells.fl[lakeCell]});
            } else {
              cells.r[lakeCell] = riverNext;
              riversData.push({river: riverNext, cell: lakeCell, x: p[lakeCell][0], y: p[lakeCell][1], flux: cells.fl[lakeCell]});
              riverNext++;
            }
          }

          lake.outlet = cells.r[lakeCell];
          flowDown(i, cells.fl[i], cells.fl[lakeCell], lake.outlet);
        }

        // assign all tributary rivers to outlet basin
        for (let outlet = lakes[0]?.outlet, l = 0; l < lakes.length; l++) {
          lakes[l].inlets?.forEach(fork => (riversData.find(r => r.river === fork).parent = outlet));
        }

        // near-border cell: pour water out of the screen
        if (cells.b[i] && cells.r[i]) {
          let to = [];
          const min = Math.min(y, graphHeight - y, x, graphWidth - x);
          if (min === y) to = [x, 0];
          else if (min === graphHeight - y) to = [x, graphHeight];
          else if (min === x) to = [0, y];
          else if (min === graphWidth - x) to = [graphWidth, y];
          riversData.push({river: cells.r[i], cell: i, x: to[0], y: to[1], flux: cells.fl[i]});
          return;
        }

        // downhill cell (make sure it's not in the source lake)
        const min = lakeOutCells[i] ? cells.c[i].filter(c => !lakes.map(lake => lake.i).includes(cells.f[c])).sort((a, b) => h[a] - h[b])[0] : cells.c[i].sort((a, b) => h[a] - h[b])[0];

        if (cells.fl[i] < MIN_FLUX_TO_FORM_RIVER) {
          if (h[min] >= 20) cells.fl[min] += cells.fl[i];
          return; // flux is too small to operate as river
        }

        // proclaim a new river
        if (!cells.r[i]) {
          cells.r[i] = riverNext;
          riversData.push({river: riverNext, cell: i, x, y, flux: cells.fl[i]});
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
        riversData.push({river, cell: haven, x: p[toCell][0], y: p[toCell][1], flux: fromFlux});

        const waterBody = features[cells.f[toCell]];
        if (waterBody.type === "lake") {
          if (!waterBody.river || fromFlux > waterBody.enteringFlux) {
            waterBody.river = river;
            waterBody.enteringFlux = fromFlux;
          }
          waterBody.flux = waterBody.flux + fromFlux;
          waterBody.inlets ? waterBody.inlets.push(river) : (waterBody.inlets = [river]);
        }
      } else {
        // propagate flux and add next river segment
        cells.fl[toCell] += fromFlux;
        riversData.push({river, cell: toCell, x: p[toCell][0], y: p[toCell][1], flux: fromFlux});
      }
    }

    function defineRivers() {
      cells.r = new Uint16Array(cells.i.length); // re-initiate rivers array
      pack.rivers = []; // rivers data
      const riverPaths = [];

      for (let r = 1; r <= riverNext; r++) {
        const riverSegments = riversData.filter(d => d.river === r);
        if (riverSegments.length < 3) continue;

        for (const segment of riverSegments) {
          const i = segment.cell;
          if (cells.r[i]) continue;
          if (cells.h[i] < 20) continue;
          cells.r[i] = r;
        }

        const source = riverSegments[0].cell;
        const mouth = riverSegments[riverSegments.length - 2].cell;

        const widthFactor = rn(0.8 + Math.random() * 0.4, 1); // river width modifier [.8, 1.2]
        const sourceWidth = cells.h[source] >= 20 ? 0.1 : rn(Math.min(Math.max((cells.fl[source] / 500) ** 0.4, 0.5), 1.7), 2);

        const riverMeandered = addMeandering(riverSegments, sourceWidth * 10, 0.5);
        const [path, length, offset] = getPath(riverMeandered, widthFactor, sourceWidth);
        riverPaths.push([path, r]);

        const parent = riverSegments[0].parent || 0;
        const width = rn(offset ** 2, 2); // mounth width in km
        const discharge = last(riverSegments).flux; // in m3/s
        pack.rivers.push({i: r, source, mouth, discharge, length, width, widthFactor, sourceWidth, parent});
      }

      // draw rivers
      rivers.html(riverPaths.map(d => `<path id="river${d[1]}" d="${d[0]}"/>`).join(""));
    }
  };

  // add distance to water value to land cells to make map less depressed
  function alterHeights() {
    const cells = pack.cells;
    return Array.from(cells.h).map((h, i) => {
      if (h < 20 || cells.t[i] < 1) return h;
      return h + cells.t[i] / 100 + d3.mean(cells.c[i].map(c => cells.t[c])) / 10000;
    });
  }

  // depression filling algorithm (for a correct water flux modeling)
  const resolveDepressions = function (h, maxIterations) {
    const {cells, features} = pack;
    const height = i => features[cells.f[i]].height || h[i]; // height of lake or specific cell

    const lakes = features.filter(f => f.type === "lake");
    const land = cells.i.filter(i => h[i] >= 20 && !cells.b[i]); // exclude near-border cells
    land.sort((a, b) => h[b] - h[a]); // highest cells go first

    const progress = [];
    let depressions = Infinity;
    let prevDepressions = null;
    for (let iteration = 0; depressions && iteration < maxIterations; iteration++) {
      if (progress.length > 5 && d3.sum(progress) > 0) {
        // bad progress, abort and set heights back
        h = alterHeights();
        depressions = progress[0];
        break;
      }

      depressions = 0;

      if (iteration < 180) {
        for (const l of lakes) {
          if (l.closed) continue;
          const minHeight = d3.min(l.shoreline.map(s => h[s]));
          if (minHeight >= 100 || l.height > minHeight) continue;

          if (iteration > 150) {
            l.shoreline.forEach(i => (h[i] = cells.h[i]));
            l.height = d3.min(l.shoreline.map(s => h[s])) - 1;
            l.closed = true;
            continue;
          }

          depressions++;
          l.height = minHeight + 0.2;
        }
      }

      for (const i of land) {
        const minHeight = d3.min(cells.c[i].map(c => height(c)));
        if (minHeight >= 100 || h[i] > minHeight) continue;

        depressions++;
        h[i] = minHeight + 0.1;
      }

      prevDepressions !== null && progress.push(depressions - prevDepressions);
      prevDepressions = depressions;
    }

    if (!depressions) return;
    WARN && console.warn(`Unresolved depressions: ${depressions}. Edit heightmap to fix`);
    //const flow = cells.i.length < 65535 ? new Uint16Array(cells.i.length) : new Uint32Array(cells.i.length);
    //flow[i] = min;
    //debug.append("path").attr("class", "arrow").attr("d", `M${cells.p[i][0]},${cells.p[i][1]}L${cells.p[min][0]},${cells.p[min][1]}`);
  };

  // add more river points on 1/3 and 2/3 of length
  const addMeandering = function (segments, width = 1, meandering = 0.5) {
    const riverMeandered = []; // to store enhanced segments

    for (let s = 0; s < segments.length; s++, width++) {
      const sX = segments[s].x,
        sY = segments[s].y; // segment start coordinates
      const c = pack.cells.conf[segments[s].cell] || 0; // if segment is river confluence
      riverMeandered.push([sX, sY, c]);

      if (s + 1 === segments.length) break; // do not meander last segment

      const eX = segments[s + 1].x,
        eY = segments[s + 1].y; // segment end coordinates
      const angle = Math.atan2(eY - sY, eX - sX);
      const sin = Math.sin(angle),
        cos = Math.cos(angle);

      const meander = meandering + 1 / width + Math.random() * Math.max(meandering - width / 100, 0);
      const dist2 = (eX - sX) ** 2 + (eY - sY) ** 2; // square distance between segment start and end

      if (width < 10 && (dist2 > 64 || (dist2 > 36 && segments.length < 6))) {
        // if dist2 is big or river is small add extra points at 1/3 and 2/3 of segment
        const p1x = (sX * 2 + eX) / 3 + -sin * meander;
        const p1y = (sY * 2 + eY) / 3 + cos * meander;
        const p2x = (sX + eX * 2) / 3 + sin * meander;
        const p2y = (sY + eY * 2) / 3 + cos * meander;
        riverMeandered.push([p1x, p1y], [p2x, p2y]);
      } else if (dist2 > 25 || segments.length < 6) {
        // if dist is medium or river is small add 1 extra middlepoint
        const p1x = (sX + eX) / 2 + -sin * meander;
        const p1y = (sY + eY) / 2 + cos * meander;
        riverMeandered.push([p1x, p1y]);
      }
    }

    return riverMeandered;
  };

  const getPath = function (points, widthFactor = 1, sourceWidth = 0.1) {
    let offset,
      extraOffset = sourceWidth; // starting river width (to make river source visible)
    const riverLength = points.reduce((s, v, i, p) => s + (i ? Math.hypot(v[0] - p[i - 1][0], v[1] - p[i - 1][1]) : 0), 0); // summ of segments length
    const widening = 1000 + riverLength * 30;
    const riverPointsLeft = [],
      riverPointsRight = []; // store points on both sides to build a valid polygon
    const last = points.length - 1;
    const factor = riverLength / points.length;

    // first point
    let x = points[0][0],
      y = points[0][1],
      c;
    let angle = Math.atan2(y - points[1][1], x - points[1][0]);
    let sin = Math.sin(angle),
      cos = Math.cos(angle);
    let xLeft = x + -sin * extraOffset,
      yLeft = y + cos * extraOffset;
    riverPointsLeft.push([xLeft, yLeft]);
    let xRight = x + sin * extraOffset,
      yRight = y + -cos * extraOffset;
    riverPointsRight.unshift([xRight, yRight]);

    // middle points
    for (let p = 1; p < last; p++) {
      (x = points[p][0]), (y = points[p][1]), (c = points[p][2] || 0);
      const xPrev = points[p - 1][0],
        yPrev = points[p - 1][1];
      const xNext = points[p + 1][0],
        yNext = points[p + 1][1];
      angle = Math.atan2(yPrev - yNext, xPrev - xNext);
      (sin = Math.sin(angle)), (cos = Math.cos(angle));
      offset = (Math.atan(Math.pow(p * factor, 2) / widening) / 2) * widthFactor + extraOffset;
      const confOffset = Math.atan((c * 5) / widening);
      extraOffset += confOffset;
      (xLeft = x + -sin * offset), (yLeft = y + cos * (offset + confOffset));
      riverPointsLeft.push([xLeft, yLeft]);
      (xRight = x + sin * offset), (yRight = y + -cos * offset);
      riverPointsRight.unshift([xRight, yRight]);
    }

    // end point
    (x = points[last][0]), (y = points[last][1]), (c = points[last][2]);
    if (c) extraOffset += Math.atan((c * 10) / widening); // add extra width on river confluence
    angle = Math.atan2(points[last - 1][1] - y, points[last - 1][0] - x);
    (sin = Math.sin(angle)), (cos = Math.cos(angle));
    (xLeft = x + -sin * offset), (yLeft = y + cos * offset);
    riverPointsLeft.push([xLeft, yLeft]);
    (xRight = x + sin * offset), (yRight = y + -cos * offset);
    riverPointsRight.unshift([xRight, yRight]);

    // generate polygon path and return
    lineGen.curve(d3.curveCatmullRom.alpha(0.1));
    const right = lineGen(riverPointsRight);
    let left = lineGen(riverPointsLeft);
    left = left.substring(left.indexOf("C"));
    return [round(right + left, 2), rn(riverLength, 2), offset];
  };

  const specify = function () {
    const rivers = pack.rivers;
    if (!rivers.length) return;
    Math.random = aleaPRNG(seed);
    const tresholdElement = Math.ceil(rivers.length * 0.15);
    const smallLength = rivers.map(r => r.length || 0).sort((a, b) => a - b)[tresholdElement];
    const smallType = {Creek: 9, River: 3, Brook: 3, Stream: 1}; // weighted small river types

    for (const r of rivers) {
      r.basin = getBasin(r.i);
      r.name = getName(r.mouth);
      const small = r.length < smallLength;
      r.type = r.parent && !(r.i % 6) ? (small ? "Branch" : "Fork") : small ? rw(smallType) : "River";
    }
  };

  const getName = function (cell) {
    return Names.getCulture(pack.cells.culture[cell]);
  };

  // remove river and all its tributaries
  const remove = function (id) {
    const cells = pack.cells;
    const riversToRemove = pack.rivers.filter(r => r.i === id || r.parent === id || r.basin === id).map(r => r.i);
    riversToRemove.forEach(r => rivers.select("#river" + r).remove());
    cells.r.forEach((r, i) => {
      if (!r || !riversToRemove.includes(r)) return;
      cells.r[i] = 0;
      cells.fl[i] = grid.cells.prec[cells.g[i]];
      cells.conf[i] = 0;
    });
    pack.rivers = pack.rivers.filter(r => !riversToRemove.includes(r.i));
  };

  const getBasin = function (r) {
    const parent = pack.rivers.find(river => river.i === r)?.parent;
    if (!parent || r === parent) return r;
    return getBasin(parent);
  };

  return {generate, resolveDepressions, addMeandering, getPath, specify, getName, getBasin, remove};
});

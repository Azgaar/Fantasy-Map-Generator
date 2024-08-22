"use strict";

window.Rivers = (function () {
  const generate = function (allowErosion = true) {
    TIME && console.time("generateRivers");
    Math.random = aleaPRNG(seed);
    const {cells, features} = pack;

    const riversData = {}; // rivers data
    const riverParents = {};
    const addCellToRiver = function (cell, river) {
      if (!riversData[river]) riversData[river] = [cell];
      else riversData[river].push(cell);
    };

    cells.fl = new Uint16Array(cells.i.length); // water flux array
    cells.r = new Uint16Array(cells.i.length); // rivers array
    cells.conf = new Uint8Array(cells.i.length); // confluences array
    let riverNext = 1; // first river id is 1

    const h = alterHeights();
    Lakes.prepareLakeData(h);
    resolveDepressions(h);
    drainWater();
    defineRivers();

    calculateConfluenceFlux();
    Lakes.cleanupLakeData();

    if (allowErosion) {
      cells.h = Uint8Array.from(h); // apply gradient
      downcutRivers(); // downcut river beds
    }

    TIME && console.timeEnd("generateRivers");

    function drainWater() {
      const MIN_FLUX_TO_FORM_RIVER = 30;
      const cellsNumberModifier = (pointsInput.dataset.cells / 10000) ** 0.25;

      const prec = grid.cells.prec;
      const area = pack.cells.area;
      const land = cells.i.filter(i => h[i] >= 20).sort((a, b) => h[b] - h[a]);
      const lakeOutCells = Lakes.setClimateData(h);

      land.forEach(function (i) {
        cells.fl[i] += prec[cells.g[i]] / cellsNumberModifier; // add flux from precipitation

        // create lake outlet if lake is not in deep depression and flux > evaporation
        const lakes = lakeOutCells[i]
          ? features.filter(feature => i === feature.outCell && feature.flux > feature.evaporation)
          : [];
        for (const lake of lakes) {
          const lakeCell = cells.c[i].find(c => h[c] < 20 && cells.f[c] === lake.i);
          cells.fl[lakeCell] += Math.max(lake.flux - lake.evaporation, 0); // not evaporated lake water drains to outlet

          // allow chain lakes to retain identity
          if (cells.r[lakeCell] !== lake.river) {
            const sameRiver = cells.c[lakeCell].some(c => cells.r[c] === lake.river);

            if (sameRiver) {
              cells.r[lakeCell] = lake.river;
              addCellToRiver(lakeCell, lake.river);
            } else {
              cells.r[lakeCell] = riverNext;
              addCellToRiver(lakeCell, riverNext);
              riverNext++;
            }
          }

          lake.outlet = cells.r[lakeCell];
          flowDown(i, cells.fl[lakeCell], lake.outlet);
        }

        // assign all tributary rivers to outlet basin
        const outlet = lakes[0]?.outlet;
        for (const lake of lakes) {
          if (!Array.isArray(lake.inlets)) continue;
          for (const inlet of lake.inlets) {
            riverParents[inlet] = outlet;
          }
        }

        // near-border cell: pour water out of the screen
        if (cells.b[i] && cells.r[i]) return addCellToRiver(-1, cells.r[i]);

        // downhill cell (make sure it's not in the source lake)
        let min = null;
        if (lakeOutCells[i]) {
          const filtered = cells.c[i].filter(c => !lakes.map(lake => lake.i).includes(cells.f[c]));
          min = filtered.sort((a, b) => h[a] - h[b])[0];
        } else if (cells.haven[i]) {
          min = cells.haven[i];
        } else {
          min = cells.c[i].sort((a, b) => h[a] - h[b])[0];
        }

        // cells is depressed
        if (h[i] <= h[min]) return;

        // debug
        //   .append("line")
        //   .attr("x1", pack.cells.p[i][0])
        //   .attr("y1", pack.cells.p[i][1])
        //   .attr("x2", pack.cells.p[min][0])
        //   .attr("y2", pack.cells.p[min][1])
        //   .attr("stroke", "#333")
        //   .attr("stroke-width", 0.2);

        if (cells.fl[i] < MIN_FLUX_TO_FORM_RIVER) {
          // flux is too small to operate as a river
          if (h[min] >= 20) cells.fl[min] += cells.fl[i];
          return;
        }

        // proclaim a new river
        if (!cells.r[i]) {
          cells.r[i] = riverNext;
          addCellToRiver(i, riverNext);
          riverNext++;
        }

        flowDown(min, cells.fl[i], cells.r[i]);
      });
    }

    function flowDown(toCell, fromFlux, river) {
      const toFlux = cells.fl[toCell] - cells.conf[toCell];
      const toRiver = cells.r[toCell];

      if (toRiver) {
        // downhill cell already has river assigned
        if (fromFlux > toFlux) {
          cells.conf[toCell] += cells.fl[toCell]; // mark confluence
          if (h[toCell] >= 20) riverParents[toRiver] = river; // min river is a tributary of current river
          cells.r[toCell] = river; // re-assign river if downhill part has less flux
        } else {
          cells.conf[toCell] += fromFlux; // mark confluence
          if (h[toCell] >= 20) riverParents[river] = toRiver; // current river is a tributary of min river
        }
      } else cells.r[toCell] = river; // assign the river to the downhill cell

      if (h[toCell] < 20) {
        // pour water to the water body
        const waterBody = features[cells.f[toCell]];
        if (waterBody.type === "lake") {
          if (!waterBody.river || fromFlux > waterBody.enteringFlux) {
            waterBody.river = river;
            waterBody.enteringFlux = fromFlux;
          }
          waterBody.flux = waterBody.flux + fromFlux;
          if (!waterBody.inlets) waterBody.inlets = [river];
          else waterBody.inlets.push(river);
        }
      } else {
        // propagate flux and add next river segment
        cells.fl[toCell] += fromFlux;
      }

      addCellToRiver(toCell, river);
    }

    function defineRivers() {
      // re-initialize rivers and confluence arrays
      cells.r = new Uint16Array(cells.i.length);
      cells.conf = new Uint16Array(cells.i.length);
      pack.rivers = [];

      const defaultWidthFactor = rn(1 / (pointsInput.dataset.cells / 10000) ** 0.25, 2);
      const mainStemWidthFactor = defaultWidthFactor * 1.2;

      for (const key in riversData) {
        const riverCells = riversData[key];
        if (riverCells.length < 3) continue; // exclude tiny rivers

        const riverId = +key;
        for (const cell of riverCells) {
          if (cell < 0 || cells.h[cell] < 20) continue;

          // mark real confluences and assign river to cells
          if (cells.r[cell]) cells.conf[cell] = 1;
          else cells.r[cell] = riverId;
        }

        const source = riverCells[0];
        const mouth = riverCells[riverCells.length - 2];
        const parent = riverParents[key] || 0;

        const widthFactor = !parent || parent === riverId ? mainStemWidthFactor : defaultWidthFactor;
        const meanderedPoints = addMeandering(riverCells);
        const discharge = cells.fl[mouth]; // m3 in second
        const length = getApproximateLength(meanderedPoints);
        const width = getWidth(getOffset(discharge, meanderedPoints.length, widthFactor, 0));

        pack.rivers.push({
          i: riverId,
          source,
          mouth,
          discharge,
          length,
          width,
          widthFactor,
          sourceWidth: 0,
          parent,
          cells: riverCells
        });
      }
    }

    function downcutRivers() {
      const MAX_DOWNCUT = 5;

      for (const i of pack.cells.i) {
        if (cells.h[i] < 35) continue; // don't donwcut lowlands
        if (!cells.fl[i]) continue;

        const higherCells = cells.c[i].filter(c => cells.h[c] > cells.h[i]);
        const higherFlux = higherCells.reduce((acc, c) => acc + cells.fl[c], 0) / higherCells.length;
        if (!higherFlux) continue;

        const downcut = Math.floor(cells.fl[i] / higherFlux);
        if (downcut) cells.h[i] -= Math.min(downcut, MAX_DOWNCUT);
      }
    }

    function calculateConfluenceFlux() {
      for (const i of cells.i) {
        if (!cells.conf[i]) continue;

        const sortedInflux = cells.c[i]
          .filter(c => cells.r[c] && h[c] > h[i])
          .map(c => cells.fl[c])
          .sort((a, b) => b - a);
        cells.conf[i] = sortedInflux.reduce((acc, flux, index) => (index ? acc + flux : acc), 0);
      }
    }
  };

  // add distance to water value to land cells to make map less depressed
  const alterHeights = () => {
    const {h, c, t} = pack.cells;
    return Array.from(h).map((h, i) => {
      if (h < 20 || t[i] < 1) return h;
      return h + t[i] / 100 + d3.mean(c[i].map(c => t[c])) / 10000;
    });
  };

  // depression filling algorithm (for a correct water flux modeling)
  const resolveDepressions = function (h) {
    const {cells, features} = pack;
    const maxIterations = +document.getElementById("resolveDepressionsStepsOutput").value;
    const checkLakeMaxIteration = maxIterations * 0.85;
    const elevateLakeMaxIteration = maxIterations * 0.75;

    const height = i => features[cells.f[i]].height || h[i]; // height of lake or specific cell

    const lakes = features.filter(f => f.type === "lake");
    const land = cells.i.filter(i => h[i] >= 20 && !cells.b[i]); // exclude near-border cells
    land.sort((a, b) => h[a] - h[b]); // lowest cells go first

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

      if (iteration < checkLakeMaxIteration) {
        for (const l of lakes) {
          if (l.closed) continue;
          const minHeight = d3.min(l.shoreline.map(s => h[s]));
          if (minHeight >= 100 || l.height > minHeight) continue;

          if (iteration > elevateLakeMaxIteration) {
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

    depressions && WARN && console.warn(`Unresolved depressions: ${depressions}. Edit heightmap to fix`);
  };

  // add points at 1/3 and 2/3 of a line between adjacents river cells
  const addMeandering = function (riverCells, riverPoints = null, meandering = 0.5) {
    const {fl, conf, h} = pack.cells;
    const meandered = [];
    const lastStep = riverCells.length - 1;
    const points = getRiverPoints(riverCells, riverPoints);
    let step = h[riverCells[0]] < 20 ? 1 : 10;

    let fluxPrev = 0;
    const getFlux = (step, flux) => (step === lastStep ? fluxPrev : flux);

    for (let i = 0; i <= lastStep; i++, step++) {
      const cell = riverCells[i];
      const isLastCell = i === lastStep;

      const [x1, y1] = points[i];
      const flux1 = getFlux(i, fl[cell]);
      fluxPrev = flux1;

      meandered.push([x1, y1, flux1]);
      if (isLastCell) break;

      const nextCell = riverCells[i + 1];
      const [x2, y2] = points[i + 1];

      if (nextCell === -1) {
        meandered.push([x2, y2, fluxPrev]);
        break;
      }

      const dist2 = (x2 - x1) ** 2 + (y2 - y1) ** 2; // square distance between cells
      if (dist2 <= 25 && riverCells.length >= 6) continue;

      const flux2 = getFlux(i + 1, fl[nextCell]);
      const keepInitialFlux = conf[nextCell] || flux1 === flux2;

      const meander = meandering + 1 / step + Math.max(meandering - step / 100, 0);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const sinMeander = Math.sin(angle) * meander;
      const cosMeander = Math.cos(angle) * meander;

      if (step < 10 && (dist2 > 64 || (dist2 > 36 && riverCells.length < 5))) {
        // if dist2 is big or river is small add extra points at 1/3 and 2/3 of segment
        const p1x = (x1 * 2 + x2) / 3 + -sinMeander;
        const p1y = (y1 * 2 + y2) / 3 + cosMeander;
        const p2x = (x1 + x2 * 2) / 3 + sinMeander / 2;
        const p2y = (y1 + y2 * 2) / 3 - cosMeander / 2;
        const [p1fl, p2fl] = keepInitialFlux ? [flux1, flux1] : [(flux1 * 2 + flux2) / 3, (flux1 + flux2 * 2) / 3];
        meandered.push([p1x, p1y, p1fl], [p2x, p2y, p2fl]);
      } else if (dist2 > 25 || riverCells.length < 6) {
        // if dist is medium or river is small add 1 extra middlepoint
        const p1x = (x1 + x2) / 2 + -sinMeander;
        const p1y = (y1 + y2) / 2 + cosMeander;
        const p1fl = keepInitialFlux ? flux1 : (flux1 + flux2) / 2;
        meandered.push([p1x, p1y, p1fl]);
      }
    }

    return meandered;
  };

  const getRiverPoints = (riverCells, riverPoints) => {
    if (riverPoints) return riverPoints;

    const {p} = pack.cells;
    return riverCells.map((cell, i) => {
      if (cell === -1) return getBorderPoint(riverCells[i - 1]);
      return p[cell];
    });
  };

  const getBorderPoint = i => {
    const [x, y] = pack.cells.p[i];
    const min = Math.min(y, graphHeight - y, x, graphWidth - x);
    if (min === y) return [x, 0];
    else if (min === graphHeight - y) return [x, graphHeight];
    else if (min === x) return [0, y];
    return [graphWidth, y];
  };

  const FLUX_FACTOR = 500;
  const MAX_FLUX_WIDTH = 2;
  const LENGTH_FACTOR = 200;
  const STEP_WIDTH = 1 / LENGTH_FACTOR;
  const LENGTH_PROGRESSION = [1, 1, 2, 3, 5, 8, 13, 21, 34].map(n => n / LENGTH_FACTOR);
  const MAX_PROGRESSION = last(LENGTH_PROGRESSION);

  const getOffset = (flux, pointNumber, widthFactor, startingWidth = 0) => {
    const fluxWidth = Math.min(flux ** 0.9 / FLUX_FACTOR, MAX_FLUX_WIDTH);
    const lengthWidth = pointNumber * STEP_WIDTH + (LENGTH_PROGRESSION[pointNumber] || MAX_PROGRESSION);
    return widthFactor * (lengthWidth + fluxWidth) + startingWidth;
  };

  // build polygon from a list of points and calculated offset (width)
  const getRiverPath = function (points, widthFactor, startingWidth = 0) {
    const riverPointsLeft = [];
    const riverPointsRight = [];

    for (let p = 0; p < points.length; p++) {
      const [x0, y0] = points[p - 1] || points[p];
      const [x1, y1, flux] = points[p];
      const [x2, y2] = points[p + 1] || points[p];

      const offset = getOffset(flux, p, widthFactor, startingWidth);
      const angle = Math.atan2(y0 - y2, x0 - x2);
      const sinOffset = Math.sin(angle) * offset;
      const cosOffset = Math.cos(angle) * offset;

      riverPointsLeft.push([x1 - sinOffset, y1 + cosOffset]);
      riverPointsRight.push([x1 + sinOffset, y1 - cosOffset]);
    }

    const right = lineGen(riverPointsRight.reverse());
    let left = lineGen(riverPointsLeft);
    left = left.substring(left.indexOf("C"));

    return round(right + left, 1);
  };

  const specify = function () {
    const rivers = pack.rivers;
    if (!rivers.length) return;

    for (const river of rivers) {
      river.basin = getBasin(river.i);
      river.name = getName(river.mouth);
      river.type = getType(river);
    }
  };

  const getName = function (cell) {
    return Names.getCulture(pack.cells.culture[cell]);
  };

  // weighted arrays of river type names
  const riverTypes = {
    main: {
      big: {River: 1},
      small: {Creek: 9, River: 3, Brook: 3, Stream: 1}
    },
    fork: {
      big: {Fork: 1},
      small: {Branch: 1}
    }
  };

  let smallLength = null;
  const getType = function ({i, length, parent}) {
    if (smallLength === null) {
      const threshold = Math.ceil(pack.rivers.length * 0.15);
      smallLength = pack.rivers.map(r => r.length || 0).sort((a, b) => a - b)[threshold];
    }

    const isSmall = length < smallLength;
    const isFork = each(3)(i) && parent && parent !== i;
    return rw(riverTypes[isFork ? "fork" : "main"][isSmall ? "small" : "big"]);
  };

  const getApproximateLength = points => {
    const length = points.reduce((s, v, i, p) => s + (i ? Math.hypot(v[0] - p[i - 1][0], v[1] - p[i - 1][1]) : 0), 0);
    return rn(length, 2);
  };

  // Real mouth width examples: Amazon 6000m, Volga 6000m, Dniepr 3000m, Mississippi 1300m, Themes 900m,
  // Danube 800m, Daugava 600m, Neva 500m, Nile 450m, Don 400m, Wisla 300m, Pripyat 150m, Bug 140m, Muchavets 40m
  const getWidth = offset => rn((offset / 1.5) ** 1.8, 2); // mouth width in km

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

  const getNextId = function (rivers) {
    return rivers.length ? Math.max(...rivers.map(r => r.i)) + 1 : 1;
  };

  return {
    generate,
    alterHeights,
    resolveDepressions,
    addMeandering,
    getRiverPath,
    specify,
    getName,
    getType,
    getBasin,
    getWidth,
    getOffset,
    getApproximateLength,
    getRiverPoints,
    remove,
    getNextId
  };
})();

import * as d3 from "d3";

import {last} from "utils/arrayUtils";
import {rn} from "utils/numberUtils";
import {round} from "utils/stringUtils";
import {rw, each} from "utils/probabilityUtils";
import {MIN_LAND_HEIGHT} from "config/generation";

window.Rivers = (function () {
  // add points at 1/3 and 2/3 of a line between adjacents river cells
  const addMeandering = ({fl, conf, h, p}, riverCells, riverPoints = null, meandering = 0.5) => {
    const meandered = [];
    const lastStep = riverCells.length - 1;
    const points = getRiverPoints(p, riverCells, riverPoints);
    let step = h[riverCells[0]] < MIN_LAND_HEIGHT ? 1 : 10;

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

  const getRiverPoints = (points, riverCells, riverPoints) => {
    if (riverPoints) return riverPoints;

    return riverCells.map((cell, i) => {
      if (cell === -1) return getBorderPoint(points, riverCells[i - 1]);
      return points[cell];
    });
  };

  const getBorderPoint = (points, i) => {
    const [x, y] = points[i];
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

  const lineGen = d3.line().curve(d3.curveBasis);

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

  const getBasin = function (riverId) {
    const parent = pack.rivers.find(river => river.i === riverId)?.parent;
    if (!parent || riverId === parent) return riverId;
    return getBasin(parent);
  };

  return {
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
    remove
  };
})();

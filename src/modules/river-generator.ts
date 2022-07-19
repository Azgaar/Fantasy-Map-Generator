import * as d3 from "d3";

import {TIME, WARN} from "config/logging";
import {last} from "utils/arrayUtils";
import {rn} from "utils/numberUtils";
import {round} from "utils/stringUtils";
import {rw, each} from "utils/probabilityUtils";
import {aleaPRNG} from "scripts/aleaPRNG";
import {DISTANCE_FIELD, MAX_HEIGHT, MIN_LAND_HEIGHT} from "config/generation";
import {getInputNumber} from "utils/nodeUtils";
import {pick} from "utils/functionUtils";
import {byId} from "utils/shorthands";

const {Lakes} = window;
const {LAND_COAST} = DISTANCE_FIELD;

window.Rivers = (function () {
  const generate = function (
    precipitation: IGrid["cells"]["prec"],
    temperature: IGrid["cells"]["temp"],
    cells: Pick<IPack["cells"], "i" | "c" | "b" | "g" | "t" | "h" | "f" | "haven">,
    features: TPackFeatures,
    allowErosion = true
  ) {
    TIME && console.time("generateRivers");

    Math.random = aleaPRNG(seed);

    const riversData = {}; // rivers data
    const riverParents = {};

    const cellsNumber = cells.i.length;
    const riverIds = new Uint16Array(cellsNumber);
    const confluence = new Uint8Array(cellsNumber);

    let nextRiverId = 1; // starts with 1

    const gradientHeights = alterHeights({h: cells.h, c: cells.c, t: cells.t});
    const [currentCellHeights, currentLakeHeights] = resolveDepressions(
      pick(cells, "i", "c", "b", "f"),
      features,
      gradientHeights
    );

    const flux = drainWater();
    defineRivers();

    calculateConfluenceFlux();
    Lakes.cleanupLakeData(pack);

    if (allowErosion) {
      cells.h = Uint8Array.from(currentCellHeights); // mutate heightmap
      downcutRivers(); // downcut river beds
    }

    TIME && console.timeEnd("generateRivers");

    function drainWater() {
      const MIN_FLUX_TO_FORM_RIVER = 30;
      const points = Number(byId("pointsInput")?.dataset.cells);
      const cellsNumberModifier = (points / 10000) ** 0.25;

      const land = cells.i.filter(i => currentCellHeights[i] >= MIN_LAND_HEIGHT);
      land.sort((a, b) => currentCellHeights[b] - currentCellHeights[a]);

      const flux = new Uint16Array(cellsNumber);

      const lakes = features.filter(feature => feature && feature.type === "lake") as IPackFeatureLake[];
      const lakeOutCells = Lakes.setClimateData(currentCellHeights, lakes, cells.g, precipitation, temperature);

      land.forEach(cellId => {
        flux[cellId] += precipitation[cells.g[cellId]] / cellsNumberModifier;

        // create lake outlet if lake is not in deep depression and flux > evaporation
        const openLakes = lakeOutCells[cellId]
          ? lakes.filter(({outCell, flux = 0, evaporation = 0}) => cellId === outCell && flux > evaporation)
          : [];

        for (const lake of openLakes) {
          const lakeCell = cells.c[cellId].find(c => currentCellHeights[c] < MIN_LAND_HEIGHT && cells.f[c] === lake.i);
          flux[lakeCell] += Math.max(lake.flux - lake.evaporation, 0); // not evaporated lake water drains to outlet

          // allow chain lakes to retain identity
          if (riverIds[lakeCell] !== lake.river) {
            const sameRiver = cells.c[lakeCell].some(c => riverIds[c] === lake.river);

            if (sameRiver) {
              riverIds[lakeCell] = lake.river;
              addCellToRiver(lakeCell, lake.river);
            } else {
              riverIds[lakeCell] = nextRiverId;
              addCellToRiver(lakeCell, nextRiverId);
              nextRiverId++;
            }
          }

          lake.outlet = riverIds[lakeCell];
          flowDown(cellId, flux[lakeCell], lake.outlet);
        }

        // assign all tributary rivers to outlet basin
        const outlet = openLakes[0]?.outlet;
        for (const lake of openLakes) {
          if (!Array.isArray(lake.inlets)) continue;
          for (const inlet of lake.inlets) {
            riverParents[inlet] = outlet;
          }
        }

        // near-border cell: pour water out of the screen
        if (cells.b[cellId] && riverIds[cellId]) return addCellToRiver(-1, riverIds[cellId]);

        // downhill cell (make sure it's not in the source lake)
        let min = null;
        if (lakeOutCells[cellId]) {
          const filtered = cells.c[cellId].filter(c => !openLakes.map(lake => lake.i).includes(cells.f[c]));
          min = filtered.sort((a, b) => alteredHeights[a] - alteredHeights[b])[0];
        } else if (cells.haven[cellId]) {
          min = cells.haven[cellId];
        } else {
          min = cells.c[cellId].sort((a, b) => alteredHeights[a] - alteredHeights[b])[0];
        }

        // cells is depressed
        if (alteredHeights[cellId] <= alteredHeights[min]) return;

        // debug
        //   .append("line")
        //   .attr("x1", pack.cells.p[i][0])
        //   .attr("y1", pack.cells.p[i][1])
        //   .attr("x2", pack.cells.p[min][0])
        //   .attr("y2", pack.cells.p[min][1])
        //   .attr("stroke", "#333")
        //   .attr("stroke-width", 0.2);

        if (flux[cellId] < MIN_FLUX_TO_FORM_RIVER) {
          // flux is too small to operate as a river
          if (alteredHeights[min] >= 20) flux[min] += flux[cellId];
          return;
        }

        // proclaim a new river
        if (!riverIds[cellId]) {
          riverIds[cellId] = nextRiverId;
          addCellToRiver(cellId, nextRiverId);
          nextRiverId++;
        }

        flowDown(min, flux[cellId], riverIds[cellId]);
      });

      return flux;
    }

    function addCellToRiver(cellId: number, riverId: number) {
      if (!riversData[riverId]) riversData[riverId] = [cellId];
      else riversData[riverId].push(cellId);
    }

    function flowDown(toCell, fromFlux, river) {
      const toFlux = flux[toCell] - confluence[toCell];
      const toRiver = riverIds[toCell];

      if (toRiver) {
        // downhill cell already has river assigned
        if (fromFlux > toFlux) {
          confluence[toCell] += flux[toCell]; // mark confluence
          if (alteredHeights[toCell] >= 20) riverParents[toRiver] = river; // min river is a tributary of current river
          riverIds[toCell] = river; // re-assign river if downhill part has less flux
        } else {
          confluence[toCell] += fromFlux; // mark confluence
          if (alteredHeights[toCell] >= 20) riverParents[river] = toRiver; // current river is a tributary of min river
        }
      } else riverIds[toCell] = river; // assign the river to the downhill cell

      if (alteredHeights[toCell] < 20) {
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
        flux[toCell] += fromFlux;
      }

      addCellToRiver(toCell, river);
    }

    function defineRivers() {
      // re-initialize rivers and confluence arrays
      riverIds = new Uint16Array(cellsNumber);
      confluence = new Uint16Array(cellsNumber);
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
          if (riverIds[cell]) confluence[cell] = 1;
          else riverIds[cell] = riverId;
        }

        const source = riverCells[0];
        const mouth = riverCells[riverCells.length - 2];
        const parent = riverParents[key] || 0;

        const widthFactor = !parent || parent === riverId ? mainStemWidthFactor : defaultWidthFactor;
        const meanderedPoints = addMeandering(pack, riverCells);
        const discharge = flux[mouth]; // m3 in second
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
        if (!flux[i]) continue;

        const higherCells = cells.c[i].filter(c => cells.h[c] > cells.h[i]);
        const higherFlux = higherCells.reduce((acc, c) => acc + flux[c], 0) / higherCells.length;
        if (!higherFlux) continue;

        const downcut = Math.floor(flux[i] / higherFlux);
        if (downcut) cells.h[i] -= Math.min(downcut, MAX_DOWNCUT);
      }
    }

    function calculateConfluenceFlux() {
      for (const i of cells.i) {
        if (!confluence[i]) continue;

        const sortedInflux = cells.c[i]
          .filter(c => riverIds[c] && alteredHeights[c] > alteredHeights[i])
          .map(c => flux[c])
          .sort((a, b) => b - a);
        confluence[i] = sortedInflux.reduce((acc, flux, index) => (index ? acc + flux : acc), 0);
      }
    }
  };

  // add distance to water value to land cells to make map less depressed
  const alterHeights = ({h, c, t}: Pick<IPack["cells"], "h" | "c" | "t">) => {
    return Array.from(h).map((height, index) => {
      if (height < MIN_LAND_HEIGHT || t[index] < LAND_COAST) return height;
      const mean = d3.mean(c[index].map(c => t[c])) || 0;
      return height + t[index] / 100 + mean / 10000;
    });
  };

  // depression filling algorithm (for a correct water flux modeling)
  const resolveDepressions = function (
    cells: Pick<IPack["cells"], "i" | "c" | "b" | "f">,
    features: TPackFeatures,
    heights: number[]
  ): [number[], Dict<number>] {
    const MAX_INTERATIONS = getInputNumber("resolveDepressionsStepsOutput");
    const checkLakeMaxIteration = MAX_INTERATIONS * 0.85;
    const elevateLakeMaxIteration = MAX_INTERATIONS * 0.75;

    const ELEVATION_LIMIT = getInputNumber("lakeElevationLimitOutput");

    const LAND_ELEVATION_INCREMENT = 0.1;
    const LAKE_ELEVATION_INCREMENT = 0.2;

    const lakes = features.filter(feature => feature && feature.type === "lake") as IPackFeatureLake[];
    lakes.sort((a, b) => a.height - b.height); // lowest lakes go first

    const currentCellHeights = Array.from(heights);
    const currentLakeHeights = Object.fromEntries(lakes.map(({i, height}) => [i, height]));

    const getHeight = (i: number) => currentLakeHeights[cells.f[i]] || currentCellHeights[i];
    const getMinHeight = (cellsIds: number[]) => Math.min(...cellsIds.map(getHeight));

    const drainableLakes = checkLakesDrainability();

    const landCells = cells.i.filter(i => heights[i] >= MIN_LAND_HEIGHT && !cells.b[i]);
    landCells.sort((a, b) => heights[a] - heights[b]); // lowest cells go first

    const depressions: number[] = [];

    for (let iteration = 0; iteration && depressions.at(-1) && iteration < MAX_INTERATIONS; iteration++) {
      let depressionsLeft = 0;

      // elevate potentially drainable lakes
      if (iteration < checkLakeMaxIteration) {
        for (const lake of lakes) {
          if (drainableLakes[lake.i] !== true) continue;

          const minShoreHeight = getMinHeight(lake.shoreline);
          if (minShoreHeight >= MAX_HEIGHT || lake.height > minShoreHeight) continue;

          if (iteration > elevateLakeMaxIteration) {
            for (const shoreCellId of lake.shoreline) {
              // reset heights
              currentCellHeights[shoreCellId] = heights[shoreCellId];
              currentLakeHeights[lake.i] = lake.height;
            }

            drainableLakes[lake.i] = false;
            continue;
          }

          currentLakeHeights[lake.i] = minShoreHeight + LAKE_ELEVATION_INCREMENT;
          depressionsLeft++;
        }
      }

      for (const cellId of landCells) {
        const minHeight = getMinHeight(cells.c[cellId]);
        if (minHeight >= MAX_HEIGHT || currentCellHeights[cellId] > minHeight) continue;

        currentCellHeights[cellId] = minHeight + LAND_ELEVATION_INCREMENT;
        depressionsLeft++;
      }

      depressions.push(depressionsLeft);

      // check depression resolving progress
      if (depressions.length > 5) {
        const depressionsInitial = depressions.at(0) || 0;
        const depressiosRecently = depressions.at(-6) || 0;

        const isProgressingOverall = depressionsInitial < depressionsLeft;
        if (!isProgressingOverall) return [heights, Object.fromEntries(lakes.map(({i, height}) => [i, height]))];

        const isProgressingRecently = depressiosRecently < depressionsLeft;
        if (!isProgressingRecently) return [currentCellHeights, currentLakeHeights];
      }
    }

    // define lakes that potentially can be open (drained into another water body)
    function checkLakesDrainability() {
      const canBeDrained: Dict<boolean> = {}; // all false by default
      const drainAllLakes = ELEVATION_LIMIT === MAX_HEIGHT - MIN_LAND_HEIGHT;

      for (const lake of lakes) {
        if (drainAllLakes) {
          canBeDrained[lake.i] = true;
          continue;
        }

        canBeDrained[lake.i] = false;
        const minShoreHeight = getMinHeight(lake.shoreline);
        const minHeightShoreCell =
          lake.shoreline.find(cellId => heights[cellId] === minShoreHeight) || lake.shoreline[0];

        const queue = [minHeightShoreCell];
        const checked = [];
        checked[minHeightShoreCell] = true;
        const breakableHeight = lake.height + ELEVATION_LIMIT;

        loopCellsAroundLake: while (queue.length) {
          const cellId = queue.pop()!;

          for (const neibCellId of cells.c[cellId]) {
            if (checked[neibCellId]) continue;
            if (heights[neibCellId] >= breakableHeight) continue;

            if (heights[neibCellId] < MIN_LAND_HEIGHT) {
              const waterFeatureMet = features[cells.f[neibCellId]];
              const isOceanMet = waterFeatureMet && waterFeatureMet.type === "ocean";
              const isLakeMet = waterFeatureMet && waterFeatureMet.type === "lake";

              if (isOceanMet || (isLakeMet && lake.height > waterFeatureMet.height)) {
                canBeDrained[lake.i] = true;
                break loopCellsAroundLake;
              }
            }

            checked[neibCellId] = true;
            queue.push(neibCellId);
          }
        }
      }

      return canBeDrained;
    }

    depressions && WARN && console.warn(`Unresolved depressions: ${depressions}. Edit heightmap to fix`);

    return [currentCellHeights, currentLakeHeights];
  };

  // add points at 1/3 and 2/3 of a line between adjacents river cells
  const addMeandering = (pack, riverCells, riverPoints = null, meandering = 0.5) => {
    const {fl, conf, h} = pack.cells;
    const meandered = [];
    const lastStep = riverCells.length - 1;
    const points = getRiverPoints(pack, riverCells, riverPoints);
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

  const getRiverPoints = (pack, riverCells, riverPoints) => {
    if (riverPoints) return riverPoints;

    const {p} = pack.cells;
    return riverCells.map((cell, i) => {
      if (cell === -1) return getBorderPoint(pack, riverCells[i - 1]);
      return p[cell];
    });
  };

  const getBorderPoint = (pack, i) => {
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
  const getWidth = (offset: number) => rn((offset / 1.5) ** 1.8, 2); // mouth width in km

  // remove river and all its tributaries
  const remove = function (id: number) {
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

  const getBasin = function (riverId: number) {
    const parent = pack.rivers.find(river => river.i === riverId)?.parent;
    if (!parent || riverId === parent) return riverId;
    return getBasin(parent);
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
    remove
  };
})();

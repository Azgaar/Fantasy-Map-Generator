import * as d3 from "d3";

import {INFO, TIME, WARN} from "config/logging";
import {rn} from "utils/numberUtils";
import {aleaPRNG} from "scripts/aleaPRNG";
import {DISTANCE_FIELD, MAX_HEIGHT, MIN_LAND_HEIGHT} from "config/generation";
import {getInputNumber} from "utils/nodeUtils";
import {pick} from "utils/functionUtils";
import {byId} from "utils/shorthands";
import {mergeLakeData, getClimateData, ILakeClimateData} from "./lakes";

const {Rivers} = window;
const {LAND_COAST} = DISTANCE_FIELD;

export function generateRivers(
  precipitation: IGrid["cells"]["prec"],
  temperature: IGrid["cells"]["temp"],
  cells: Pick<IPack["cells"], "i" | "c" | "p" | "b" | "g" | "t" | "h" | "f" | "haven">,
  features: TPackFeatures
) {
  TIME && console.time("generateRivers");

  Math.random = aleaPRNG(seed);

  const riversData: {[river: string]: number[]} = {};
  const riverParents: {[river: string]: number} = {};

  const cellsNumber = cells.i.length;

  let nextRiverId = 1; // starts with 1

  const gradientHeights = applyDistanceField({h: cells.h, c: cells.c, t: cells.t});
  const [currentCellHeights, drainableLakes] = resolveDepressions(
    pick(cells, "i", "c", "b", "f"),
    features,
    gradientHeights
  );

  const points = Number(byId("pointsInput")?.dataset.cells);
  const cellsNumberModifier = (points / 10000) ** 0.25;

  const {flux, lakeData} = drainWater();
  const {r, conf, rivers} = defineRivers();
  const heights = downcutRivers(currentCellHeights);

  const mergedFeatures = mergeLakeData(features, lakeData, rivers);

  TIME && console.timeEnd("generateRivers");

  return {heights, flux, r, conf, rivers, mergedFeatures};

  function drainWater() {
    const MIN_FLUX_TO_FORM_RIVER = 30;

    const riverIds = new Uint16Array(cellsNumber);
    const confluence = new Uint8Array(cellsNumber);
    const flux = new Uint16Array(cellsNumber);

    const lakes = features.filter(feature => feature && feature.type === "lake") as IPackFeatureLake[];

    const lakeData: ILakeClimateData[] = getClimateData(
      lakes,
      currentCellHeights,
      drainableLakes,
      cells.g,
      precipitation,
      temperature
    );
    const openLakes = lakeData.filter(lake => lake.outCell !== undefined);

    const land = cells.i.filter(i => currentCellHeights[i] >= MIN_LAND_HEIGHT);
    land.sort((a, b) => currentCellHeights[b] - currentCellHeights[a]);

    land.forEach(cellId => {
      flux[cellId] += precipitation[cells.g[cellId]] / cellsNumberModifier;

      const lakesDrainingToCell = openLakes.filter(lake => lake.outCell === cellId);
      for (const lake of lakesDrainingToCell) {
        const lakeCell = cells.c[cellId].find(c => currentCellHeights[c] < MIN_LAND_HEIGHT && cells.f[c] === lake.i);
        if (!lakeCell) continue;

        flux[lakeCell] += Math.max(lake.flux - lake.evaporation, 0); // not evaporated lake water drains to outlet

        // allow to chain lakes to keep river identity
        if (riverIds[lakeCell] !== lake.river) {
          const sameRiver = cells.c[lakeCell].some(c => riverIds[c] === lake.river);

          if (lake.river && sameRiver) {
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

      if (lakesDrainingToCell.length && lakesDrainingToCell[0].outlet) {
        // assign all tributary rivers to outlet basin
        const outlet = lakesDrainingToCell[0].outlet;
        for (const lakeDrainingToCell of lakesDrainingToCell) {
          if (!Array.isArray(lakeDrainingToCell.inlets)) continue;
          for (const inlet of lakeDrainingToCell.inlets) {
            riverParents[inlet] = outlet;
          }
        }
      }

      // near-border cell: pour water out of the screen
      if (cells.b[cellId] && riverIds[cellId]) return addCellToRiver(-1, riverIds[cellId]);

      // downhill cell (make sure it's not in the source lake)
      let min = null;
      if (lakesDrainingToCell.length) {
        const filtered = cells.c[cellId].filter(c => !lakesDrainingToCell.map(lake => lake.i).includes(cells.f[c]));
        min = filtered.sort((a, b) => currentCellHeights[a] - currentCellHeights[b])[0];
      } else if (cells.haven[cellId]) {
        min = cells.haven[cellId];
      } else {
        min = cells.c[cellId].sort((a, b) => currentCellHeights[a] - currentCellHeights[b])[0];
      }

      // drawArrow(cells.p[fromCell], cells.p[toCell]);

      // cells is depressed
      if (currentCellHeights[cellId] <= currentCellHeights[min]) return;

      if (flux[cellId] < MIN_FLUX_TO_FORM_RIVER) {
        // flux is too small to operate as a river
        if (currentCellHeights[min] >= MIN_LAND_HEIGHT) flux[min] += flux[cellId];
        return;
      }

      // create a new river
      if (!riverIds[cellId]) {
        riverIds[cellId] = nextRiverId;
        addCellToRiver(cellId, nextRiverId);
        nextRiverId++;
      }

      flowDown(min, flux[cellId], riverIds[cellId]);
    });

    return {flux, lakeData};

    function flowDown(toCell: number, fromFlux: number, riverId: number) {
      const toFlux = flux[toCell] - confluence[toCell];
      const toRiver = riverIds[toCell];

      if (toRiver) {
        // downhill cell already has river assigned
        if (fromFlux > toFlux) {
          confluence[toCell] += flux[toCell]; // mark confluence
          if (currentCellHeights[toCell] >= MIN_LAND_HEIGHT) {
            // min river is a tributary of current river
            riverParents[toRiver] = riverId;
          }
          riverIds[toCell] = riverId; // re-assign river if downhill part has less flux
        } else {
          confluence[toCell] += fromFlux; // mark confluence
          if (currentCellHeights[toCell] >= MIN_LAND_HEIGHT) {
            // current river is a tributary of min river
            riverParents[riverId] = toRiver;
          }
        }
      } else riverIds[toCell] = riverId; // assign the river to the downhill cell

      if (currentCellHeights[toCell] < MIN_LAND_HEIGHT) {
        // pour water to the water body
        const lake = lakeData.find(lake => lake.i === cells.f[toCell]);

        if (lake) {
          if (!lake.river || fromFlux > (lake.enteringFlux || 0)) {
            lake.river = riverId;
            lake.enteringFlux = fromFlux;
          }
          lake.flux = lake.flux + fromFlux;
          if (lake.inlets) lake.inlets.push(riverId);
          else lake.inlets = [riverId];
        }
      } else {
        // propagate flux and add next river segment
        flux[toCell] += fromFlux;
      }

      addCellToRiver(toCell, riverId);
    }

    function addCellToRiver(cellId: number, riverId: number) {
      if (riversData[riverId]) riversData[riverId].push(cellId);
      else riversData[riverId] = [cellId];
    }
  }

  function defineRivers() {
    const r = new Uint16Array(cellsNumber);
    const conf = new Uint16Array(cellsNumber);
    const rivers: Omit<IRiver, "name" | "basin" | "type">[] = [];

    const defaultWidthFactor = rn(1 / cellsNumberModifier, 2);
    const mainStemWidthFactor = defaultWidthFactor * 1.2;

    for (const key in riversData) {
      const riverId = +key;
      const riverCells = riversData[key];
      if (riverCells.length < 3) continue; // exclude tiny rivers

      for (const cell of riverCells) {
        if (cell < 0 || cells.h[cell] < MIN_LAND_HEIGHT) continue;

        // mark confluences and assign river to cells
        if (r[cell]) conf[cell] = 1;
        else r[cell] = riverId;
      }

      const source = riverCells[0];
      const mouth = riverCells.at(-2) || 0;
      const parent = riverParents[key] || 0;

      const widthFactor = !parent || parent === riverId ? mainStemWidthFactor : defaultWidthFactor;
      const meanderedPoints: number[] = Rivers.addMeandering({fl: flux, conf, h: cells.h, p: cells.p}, riverCells);
      const discharge = flux[mouth]; // m3 in second
      const length: number = Rivers.getApproximateLength(meanderedPoints);
      const width: number = Rivers.getWidth(Rivers.getOffset(discharge, meanderedPoints.length, widthFactor, 0));

      rivers.push({
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

    // calculate confluence flux
    for (const i of cells.i) {
      if (!conf[i]) continue;

      const sortedInflux = cells.c[i]
        .filter(c => r[c] && currentCellHeights[c] > currentCellHeights[i])
        .map(c => flux[c])
        .sort((a, b) => b - a);
      conf[i] = sortedInflux.reduce((acc, flux, index) => (index ? acc + flux : acc), 0);
    }

    return {r, conf, rivers};
  }

  function downcutRivers(heights: Float32Array) {
    const MAX_DOWNCUT = 5;
    const MIN_HEIGHT_TO_DOWNCUT = 35;

    for (const i of cells.i) {
      if (heights[i] < MIN_HEIGHT_TO_DOWNCUT) continue; // don't downcut lowlands
      if (!flux[i]) continue;

      const higherCells = cells.c[i].filter(c => heights[c] > heights[i]);
      const higherFlux = higherCells.reduce((acc, c) => acc + flux[c], 0) / higherCells.length;
      if (!higherFlux) continue;

      const downcut = Math.floor(flux[i] / higherFlux);
      if (downcut) heights[i] -= Math.min(downcut, MAX_DOWNCUT);
    }

    return heights;
  }
}

// add distance to water value to land cells to make map less depressed
const applyDistanceField = ({h, c, t}: Pick<IPack["cells"], "h" | "c" | "t">) => {
  return new Float32Array(h.length).map((_, index) => {
    if (h[index] < MIN_LAND_HEIGHT || t[index] < LAND_COAST) return h[index];
    const mean = d3.mean(c[index].map(c => t[c])) || 0;
    return h[index] + t[index] / 100 + mean / 10000;
  });
};

// depression filling algorithm (for a correct water flux modeling)
const resolveDepressions = function (
  cells: Pick<IPack["cells"], "i" | "c" | "b" | "f">,
  features: TPackFeatures,
  initialCellHeights: Float32Array
): [Float32Array, Dict<boolean>] {
  TIME && console.time("resolveDepressions");

  const MAX_INTERATIONS = getInputNumber("resolveDepressionsStepsOutput");
  const checkLakeMaxIteration = MAX_INTERATIONS * 0.85;
  const elevateLakeMaxIteration = MAX_INTERATIONS * 0.75;

  const LAND_ELEVATION_INCREMENT = 0.1;
  const LAKE_ELEVATION_INCREMENT = 0.2;

  const lakes = features.filter(feature => feature && feature.type === "lake") as IPackFeatureLake[];
  lakes.sort((a, b) => a.height - b.height); // lowest lakes go first

  const getHeight = (i: number) => currentLakeHeights[cells.f[i]] || currentCellHeights[i];
  const getMinHeight = (cellsIds: number[]) => Math.min(...cellsIds.map(getHeight));
  const getMinLandHeight = (cellsIds: number[]) => Math.min(...cellsIds.map(i => currentCellHeights[i]));

  const landCells = cells.i.filter(i => initialCellHeights[i] >= MIN_LAND_HEIGHT && !cells.b[i]);
  landCells.sort((a, b) => initialCellHeights[a] - initialCellHeights[b]); // lowest cells go first

  const currentCellHeights = Float32Array.from(initialCellHeights);
  const currentLakeHeights = Object.fromEntries(lakes.map(({i, height}) => [i, height]));
  const currentDrainableLakes = checkLakesDrainability();
  const depressions: number[] = [];

  let bestDepressions = Infinity;
  let bestCellHeights: typeof currentCellHeights | null = null;
  let bestDrainableLakes: typeof currentDrainableLakes | null = null;

  for (let iteration = 0; depressions.at(-1) !== 0 && iteration < MAX_INTERATIONS; iteration++) {
    let depressionsLeft = 0;

    // elevate potentially drainable lakes
    if (iteration < checkLakeMaxIteration) {
      for (const lake of lakes) {
        if (currentDrainableLakes[lake.i] !== true) continue;

        const minShoreHeight = getMinLandHeight(lake.shoreline);
        if (minShoreHeight >= MAX_HEIGHT || currentLakeHeights[lake.i] > minShoreHeight) continue;

        if (iteration > elevateLakeMaxIteration) {
          // reset heights
          for (const shoreCellId of lake.shoreline) {
            currentCellHeights[shoreCellId] = initialCellHeights[shoreCellId];
          }
          currentLakeHeights[lake.i] = lake.height;

          currentDrainableLakes[lake.i] = false;
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
    if (depressionsLeft < bestDepressions) {
      bestDepressions = depressionsLeft;
      bestCellHeights = Float32Array.from(currentCellHeights);
      bestDrainableLakes = structuredClone(currentDrainableLakes);
    }
  }

  TIME && console.timeEnd("resolveDepressions");

  const depressionsLeft = depressions.at(-1);
  if (depressionsLeft) {
    if (bestCellHeights && bestDrainableLakes) {
      WARN &&
        console.warn(`Cannot resolve all depressions. Depressions: ${depressions[0]}. Best result: ${bestDepressions}`);
      return [bestCellHeights, bestDrainableLakes];
    }

    WARN && console.warn(`Cannot resolve depressions. Depressions: ${depressionsLeft}`);
    return [initialCellHeights, {}];
  }

  INFO && console.info(`ⓘ Resolved all depressions. Depressions: ${depressions[0]}. Iterations: ${depressions.length}`);
  return [currentCellHeights, currentDrainableLakes];

  // define lakes that potentially can be open (drained into another water body)
  function checkLakesDrainability() {
    const canBeDrained: Dict<boolean> = {}; // all false by default

    const ELEVATION_LIMIT = getInputNumber("lakeElevationLimitOutput");
    const drainAllLakes = ELEVATION_LIMIT === MAX_HEIGHT - MIN_LAND_HEIGHT;

    for (const lake of lakes) {
      if (drainAllLakes) {
        canBeDrained[lake.i] = true;
        continue;
      }

      canBeDrained[lake.i] = false;
      const minShoreHeight = getMinHeight(lake.shoreline);
      const minHeightShoreCell =
        lake.shoreline.find(cellId => initialCellHeights[cellId] === minShoreHeight) || lake.shoreline[0];

      const queue = [minHeightShoreCell];
      const checked = [];
      checked[minHeightShoreCell] = true;
      const breakableHeight = lake.height + ELEVATION_LIMIT;

      loopCellsAroundLake: while (queue.length) {
        const cellId = queue.pop()!;

        for (const neibCellId of cells.c[cellId]) {
          if (checked[neibCellId]) continue;
          if (initialCellHeights[neibCellId] >= breakableHeight) continue;

          if (initialCellHeights[neibCellId] < MIN_LAND_HEIGHT) {
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
};

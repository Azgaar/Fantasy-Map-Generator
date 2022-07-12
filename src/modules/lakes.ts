import * as d3 from "d3";

import {TIME} from "config/logging";
import {rn} from "utils/numberUtils";
// @ts-expect-error js module
import {aleaPRNG} from "scripts/aleaPRNG";
import {getInputNumber, getInputValue} from "utils/nodeUtils";
import {DISTANCE_FIELD, MIN_LAND_HEIGHT} from "config/generation";
import {byId} from "utils/shorthands";

window.Lakes = (function () {
  const setClimateData = function (h: Uint8Array, pack: IPack, grid: IGrid) {
    const cells = pack.cells;
    const lakeOutCells = new Uint16Array(cells.i.length);

    pack.features.forEach(f => {
      if (f.type !== "lake") return;

      // default flux: sum of precipitation around lake
      f.flux = f.shoreline.reduce((acc, c) => acc + grid.cells.prec[cells.g[c]], 0);

      // temperature and evaporation to detect closed lakes
      f.temp =
        f.cells < 6
          ? grid.cells.temp[cells.g[f.firstCell]]
          : rn(d3.mean(f.shoreline.map(c => grid.cells.temp[cells.g[c]])), 1);
      const height = (f.height - 18) ** heightExponentInput.value; // height in meters
      const evaporation = ((700 * (f.temp + 0.006 * height)) / 50 + 75) / (80 - f.temp); // based on Penman formula, [1-11]
      f.evaporation = rn(evaporation * f.cells);

      // no outlet for lakes in depressed areas
      if (f.closed) return;

      // lake outlet cell
      f.outCell = f.shoreline[d3.scan(f.shoreline, (a, b) => h[a] - h[b])];
      lakeOutCells[f.outCell] = f.i;
    });

    return lakeOutCells;
  };

  // get array of land cells aroound lake
  const getShoreline = function (lake: IPackFeatureLake, pack: IPack) {
    const uniqueCells = new Set();
    lake.vertices.forEach(v =>
      pack.vertices.c[v].forEach(c => pack.cells.h[c] >= MIN_LAND_HEIGHT && uniqueCells.add(c))
    );
    lake.shoreline = [...uniqueCells];
  };

  const prepareLakeData = (h: Uint8Array, pack: IPack) => {
    const cells = pack.cells;
    const ELEVATION_LIMIT = getInputNumber("lakeElevationLimitOutput");

    pack.features.forEach(feature => {
      if (!feature || feature.type !== "lake") return;
      delete feature.flux;
      delete feature.inlets;
      delete feature.outlet;
      delete feature.height;
      delete feature.closed;
      !feature.shoreline && getShoreline(feature, pack);

      // lake surface height is as lowest land cells around
      const min = feature.shoreline.sort((a, b) => h[a] - h[b])[0];
      feature.height = h[min] - 0.1;

      // check if lake can be open (not in deep depression)
      if (ELEVATION_LIMIT === 80) {
        feature.closed = false;
        return;
      }

      let deep = true;
      const threshold = feature.height + ELEVATION_LIMIT;
      const queue = [min];
      const checked = [];
      checked[min] = true;

      // check if elevated lake can potentially pour to another water body
      while (deep && queue.length) {
        const q = queue.pop();

        for (const n of cells.c[q]) {
          if (checked[n]) continue;
          if (h[n] >= threshold) continue;

          if (h[n] < 20) {
            const nFeature = pack.features[cells.f[n]];
            if ((nFeature && nFeature.type === "ocean") || feature.height > nFeature.height) {
              deep = false;
              break;
            }
          }

          checked[n] = true;
          queue.push(n);
        }
      }

      feature.closed = deep;
    });
  };

  const cleanupLakeData = function (pack: IPack) {
    for (const feature of pack.features) {
      if (feature.type !== "lake") continue;
      delete feature.river;
      delete feature.enteringFlux;
      delete feature.outCell;
      delete feature.closed;
      feature.height = rn(feature.height, 3);

      const inlets = feature.inlets?.filter(r => pack.rivers.find(river => river.i === r));
      if (!inlets || !inlets.length) delete feature.inlets;
      else feature.inlets = inlets;

      const outlet = feature.outlet && pack.rivers.find(river => river.i === feature.outlet);
      if (!outlet) delete feature.outlet;
    }
  };

  const defineGroup = function (pack: IPack) {
    for (const feature of pack.features) {
      if (feature && feature.type === "lake") {
        const lakeEl = lakes.select(`[data-f="${feature.i}"]`).node();
        if (!lakeEl) continue;

        feature.group = getGroup(feature);
        byId(feature.group)?.appendChild(lakeEl);
      }
    }
  };

  const generateName = function () {
    Math.random = aleaPRNG(seed);
    for (const feature of pack.features) {
      if (feature.type !== "lake") continue;
      feature.name = getName(feature);
    }
  };

  const getName = function (feature) {
    const landCell = pack.cells.c[feature.firstCell].find(c => pack.cells.h[c] >= 20);
    const culture = pack.cells.culture[landCell];
    return Names.getCulture(culture);
  };

  function getGroup(feature) {
    if (feature.temp < -3) return "frozen";
    if (feature.height > 60 && feature.cells < 10 && feature.firstCell % 10 === 0) return "lava";

    if (!feature.inlets && !feature.outlet) {
      if (feature.evaporation > feature.flux * 4) return "dry";
      if (feature.cells < 3 && feature.firstCell % 10 === 0) return "sinkhole";
    }

    if (!feature.outlet && feature.evaporation > feature.flux) return "salt";

    return "freshwater";
  }

  const {LAND_COAST, WATER_COAST} = DISTANCE_FIELD;

  function addLakesInDeepDepressions(grid: IGraph & Partial<IGrid>) {
    const ELEVATION_LIMIT = getInputNumber("lakeElevationLimitOutput");
    if (ELEVATION_LIMIT === 80) return;

    TIME && console.time("addLakesInDeepDepressions");
    const {cells, features} = grid;
    if (!features) throw new Error("addLakesInDeepDepressions: features are not defined");
    const {c, h, b} = cells;

    for (const i of cells.i) {
      if (b[i] || h[i] < MIN_LAND_HEIGHT) continue;

      const minHeight = d3.min(c[i].map(c => h[c])) || 0;
      if (h[i] > minHeight) continue;

      let deep = true;
      const threshold = h[i] + ELEVATION_LIMIT;
      const queue = [i];
      const checked = [];
      checked[i] = true;

      // check if elevated cell can potentially pour to water
      while (deep && queue.length) {
        const q = queue.pop()!;

        for (const n of c[q]) {
          if (checked[n]) continue;
          if (h[n] >= threshold) continue;
          if (h[n] < MIN_LAND_HEIGHT) {
            deep = false;
            break;
          }

          checked[n] = true;
          queue.push(n);
        }
      }

      // if not, add a lake
      if (deep) {
        const lakeCells = [i].concat(c[i].filter(n => h[n] === h[i]));
        addLake(lakeCells);
      }
    }

    function addLake(lakeCells: number[]) {
      const featureId = features!.length;

      for (const lakeCellId of lakeCells) {
        cells.h[lakeCellId] = MIN_LAND_HEIGHT - 1;
        cells.t[lakeCellId] = WATER_COAST;
        cells.f[lakeCellId] = featureId;

        for (const neibCellId of c[lakeCellId]) {
          if (!lakeCells.includes(neibCellId)) cells.t[neibCellId] = LAND_COAST;
        }
      }

      features!.push({i: featureId, land: false, border: false, type: "lake"});
    }

    TIME && console.timeEnd("addLakesInDeepDepressions");
  }

  // near sea lakes usually get a lot of water inflow, most of them should brake threshold and flow out to sea (see Ancylus Lake)
  function openNearSeaLakes(grid: IGraph & Partial<IGrid>) {
    if (getInputValue("templateInput") === "Atoll") return; // no need for Atolls

    const {cells, features} = grid;
    if (!features?.find(f => f && f.type === "lake")) return; // no lakes

    TIME && console.time("openLakes");
    const LIMIT = 22; // max height that can be breached by water

    const isLake = (featureId: number) => featureId && (features[featureId] as IGridFeature).type === "lake";
    const isOcean = (featureId: number) => featureId && (features[featureId] as IGridFeature).type === "ocean";

    for (const cellId of cells.i) {
      const featureId = cells.f[cellId];
      if (!isLake(featureId)) continue; // not a lake cell

      check_neighbours: for (const neibCellId of cells.c[cellId]) {
        // water cannot brake the barrier
        if (cells.t[neibCellId] !== WATER_COAST || cells.h[neibCellId] > LIMIT) continue;

        for (const neibOfNeibCellId of cells.c[neibCellId]) {
          const neibOfNeibFeatureId = cells.f[neibOfNeibCellId];
          if (!isOcean(neibOfNeibFeatureId)) continue; // not an ocean
          removeLake(neibCellId, featureId, neibOfNeibFeatureId);
          break check_neighbours;
        }
      }
    }

    function removeLake(barrierCellId: number, lakeFeatureId: number, oceanFeatureId: number) {
      cells.h[barrierCellId] = MIN_LAND_HEIGHT - 1;
      cells.t[barrierCellId] = WATER_COAST;
      cells.f[barrierCellId] = oceanFeatureId;

      for (const neibCellId of cells.c[barrierCellId]) {
        if (cells.h[neibCellId] >= MIN_LAND_HEIGHT) cells.t[neibCellId] = LAND_COAST;
      }

      if (features && lakeFeatureId) {
        // mark former lake as ocean
        (features[lakeFeatureId] as IGridFeature).type = "ocean";
      }
    }

    TIME && console.timeEnd("openLakes");
  }

  return {
    setClimateData,
    cleanupLakeData,
    prepareLakeData,
    defineGroup,
    generateName,
    getName,
    getShoreline,
    addLakesInDeepDepressions,
    openNearSeaLakes
  };
})();

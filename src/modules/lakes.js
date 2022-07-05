import * as d3 from "d3";

import {TIME} from "config/logging";
import {rn} from "utils/numberUtils";
import {aleaPRNG} from "scripts/aleaPRNG";
import {byId} from "utils/shorthands";

window.Lakes = (function () {
  const setClimateData = function (h) {
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
  const getShoreline = function (lake) {
    const uniqueCells = new Set();
    lake.vertices.forEach(v => pack.vertices.c[v].forEach(c => pack.cells.h[c] >= 20 && uniqueCells.add(c)));
    lake.shoreline = [...uniqueCells];
  };

  const prepareLakeData = h => {
    const cells = pack.cells;
    const ELEVATION_LIMIT = +document.getElementById("lakeElevationLimitOutput").value;

    pack.features.forEach(f => {
      if (f.type !== "lake") return;
      delete f.flux;
      delete f.inlets;
      delete f.outlet;
      delete f.height;
      delete f.closed;
      !f.shoreline && Lakes.getShoreline(f);

      // lake surface height is as lowest land cells around
      const min = f.shoreline.sort((a, b) => h[a] - h[b])[0];
      f.height = h[min] - 0.1;

      // check if lake can be open (not in deep depression)
      if (ELEVATION_LIMIT === 80) {
        f.closed = false;
        return;
      }

      let deep = true;
      const threshold = f.height + ELEVATION_LIMIT;
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
            if (nFeature.type === "ocean" || f.height > nFeature.height) {
              deep = false;
              break;
            }
          }

          checked[n] = true;
          queue.push(n);
        }
      }

      f.closed = deep;
    });
  };

  const cleanupLakeData = function () {
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

  const defineGroup = function () {
    for (const feature of pack.features) {
      if (feature.type !== "lake") continue;
      const lakeEl = lakes.select(`[data-f="${feature.i}"]`).node();
      if (!lakeEl) continue;

      feature.group = getGroup(feature);
      document.getElementById(feature.group).appendChild(lakeEl);
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

  function addLakesInDeepDepressions() {
    TIME && console.time("addLakesInDeepDepressions");
    const {cells, features} = grid;
    const {c, h, b} = cells;
    const ELEVATION_LIMIT = +byId("lakeElevationLimitOutput").value;
    if (ELEVATION_LIMIT === 80) return;

    for (const i of cells.i) {
      if (b[i] || h[i] < 20) continue;

      const minHeight = d3.min(c[i].map(c => h[c]));
      if (h[i] > minHeight) continue;

      let deep = true;
      const threshold = h[i] + ELEVATION_LIMIT;
      const queue = [i];
      const checked = [];
      checked[i] = true;

      // check if elevated cell can potentially pour to water
      while (deep && queue.length) {
        const q = queue.pop();

        for (const n of c[q]) {
          if (checked[n]) continue;
          if (h[n] >= threshold) continue;
          if (h[n] < 20) {
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

    function addLake(lakeCells) {
      const f = features.length;

      lakeCells.forEach(i => {
        cells.h[i] = 19;
        cells.t[i] = -1;
        cells.f[i] = f;
        c[i].forEach(n => !lakeCells.includes(n) && (cells.t[c] = 1));
      });

      features.push({i: f, land: false, border: false, type: "lake"});
    }

    TIME && console.timeEnd("addLakesInDeepDepressions");
  }

  // near sea lakes usually get a lot of water inflow, most of them should brake threshold and flow out to sea (see Ancylus Lake)
  function openNearSeaLakes() {
    if (byId("templateInput").value === "Atoll") return; // no need for Atolls

    const cells = grid.cells;
    const features = grid.features;
    if (!features.find(f => f.type === "lake")) return; // no lakes
    TIME && console.time("openLakes");
    const LIMIT = 22; // max height that can be breached by water

    for (const i of cells.i) {
      const lake = cells.f[i];
      if (features[lake].type !== "lake") continue; // not a lake cell

      check_neighbours: for (const c of cells.c[i]) {
        if (cells.t[c] !== 1 || cells.h[c] > LIMIT) continue; // water cannot brake this

        for (const n of cells.c[c]) {
          const ocean = cells.f[n];
          if (features[ocean].type !== "ocean") continue; // not an ocean
          removeLake(c, lake, ocean);
          break check_neighbours;
        }
      }
    }

    function removeLake(threshold, lake, ocean) {
      cells.h[threshold] = 19;
      cells.t[threshold] = -1;
      cells.f[threshold] = ocean;
      cells.c[threshold].forEach(function (c) {
        if (cells.h[c] >= 20) cells.t[c] = 1; // mark as coastline
      });
      features[lake].type = "ocean"; // mark former lake as ocean
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

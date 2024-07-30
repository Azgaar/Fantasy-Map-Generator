"use strict";

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
    if (!lake.vertices) lake.vertices = [];
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

  return {setClimateData, cleanupLakeData, prepareLakeData, defineGroup, generateName, getName, getShoreline};
})();

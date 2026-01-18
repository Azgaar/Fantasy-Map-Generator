"use strict";

window.Lakes = (function () {
  const LAKE_ELEVATION_DELTA = 0.1;

  // check if lake can be potentially open (not in deep depression)
  const detectCloseLakes = h => {
    const {cells} = pack;
    const ELEVATION_LIMIT = +byId("lakeElevationLimitOutput").value;

    pack.features.forEach(feature => {
      if (feature.type !== "lake") return;
      delete feature.closed;

      const MAX_ELEVATION = feature.height + ELEVATION_LIMIT;
      if (MAX_ELEVATION > 99) {
        feature.closed = false;
        return;
      }

      let isDeep = true;
      const lowestShorelineCell = feature.shoreline.sort((a, b) => h[a] - h[b])[0];
      const queue = [lowestShorelineCell];
      const checked = [];
      checked[lowestShorelineCell] = true;

      while (queue.length && isDeep) {
        const cellId = queue.pop();

        for (const neibCellId of cells.c[cellId]) {
          if (checked[neibCellId]) continue;
          if (h[neibCellId] >= MAX_ELEVATION) continue;

          if (h[neibCellId] < 20) {
            const nFeature = pack.features[cells.f[neibCellId]];
            if (nFeature.type === "ocean" || feature.height > nFeature.height) isDeep = false;
          }

          checked[neibCellId] = true;
          queue.push(neibCellId);
        }
      }

      feature.closed = isDeep;
    });
  };

  const defineClimateData = function (heights) {
    const {cells, features} = pack;
    const lakeOutCells = new Uint16Array(cells.i.length);

    features.forEach(feature => {
      if (feature.type !== "lake") return;
      feature.flux = getFlux(feature);
      feature.temp = getLakeTemp(feature);
      feature.evaporation = getLakeEvaporation(feature);
      if (feature.closed) return; // no outlet for lakes in depressed areas

      feature.outCell = getLowestShoreCell(feature);
      lakeOutCells[feature.outCell] = feature.i;
    });

    return lakeOutCells;

    function getFlux(lake) {
      return lake.shoreline.reduce((acc, c) => acc + grid.cells.prec[cells.g[c]], 0);
    }

    function getLakeTemp(lake) {
      if (lake.cells < 6) return grid.cells.temp[cells.g[lake.firstCell]];
      return rn(d3.mean(lake.shoreline.map(c => grid.cells.temp[cells.g[c]])), 1);
    }

    function getLakeEvaporation(lake) {
      const height = (lake.height - 18) ** heightExponentInput.value; // height in meters
      const evaporation = ((700 * (lake.temp + 0.006 * height)) / 50 + 75) / (80 - lake.temp); // based on Penman formula, [1-11]
      return rn(evaporation * lake.cells);
    }

    function getLowestShoreCell(lake) {
      return lake.shoreline.sort((a, b) => heights[a] - heights[b])[0];
    }
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

  const getHeight = function (feature) {
    const heights = pack.cells.h;
    const minShoreHeight = d3.min(feature.shoreline.map(cellId => heights[cellId])) || 20;
    return rn(minShoreHeight - LAKE_ELEVATION_DELTA, 2);
  };

  const defineNames = function () {
    pack.features.forEach(feature => {
      if (feature.type !== "lake") return;
      feature.name = getName(feature);
    });
  };

  const getName = function (feature) {
    const landCell = feature.shoreline[0];
    const culture = pack.cells.culture[landCell];
    return Names.getCulture(culture);
  };

  return {defineClimateData, cleanupLakeData, detectCloseLakes, getHeight, defineNames, getName};
})();

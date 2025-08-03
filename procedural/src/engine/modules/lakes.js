"use strict";

const LAKE_ELEVATION_DELTA = 0.1;

// check if lake can be potentially open (not in deep depression)
export function detectCloseLakes(pack, grid, heights, config) {
  const {cells, features} = pack;
  const ELEVATION_LIMIT = config.lakeElevationLimit;

  const updatedFeatures = features.map(feature => {
    if (feature.type !== "lake") return feature;
    
    const updatedFeature = {...feature};
    delete updatedFeature.closed;

    const MAX_ELEVATION = feature.height + ELEVATION_LIMIT;
    if (MAX_ELEVATION > 99) {
      updatedFeature.closed = false;
      return updatedFeature;
    }

    let isDeep = true;
    const lowestShorelineCell = feature.shoreline.sort((a, b) => heights[a] - heights[b])[0];
    const queue = [lowestShorelineCell];
    const checked = [];
    checked[lowestShorelineCell] = true;

    while (queue.length && isDeep) {
      const cellId = queue.pop();

      for (const neibCellId of cells.c[cellId]) {
        if (checked[neibCellId]) continue;
        if (heights[neibCellId] >= MAX_ELEVATION) continue;

        if (heights[neibCellId] < 20) {
          const nFeature = features[cells.f[neibCellId]];
          if (nFeature.type === "ocean" || feature.height > nFeature.height) isDeep = false;
        }

        checked[neibCellId] = true;
        queue.push(neibCellId);
      }
    }

    updatedFeature.closed = isDeep;
    return updatedFeature;
  });

  return {
    ...pack,
    features: updatedFeatures
  };
}

export function defineClimateData(pack, grid, heights, config, utils) {
  const {d3, rn} = utils;
  const {cells, features} = pack;
  const lakeOutCells = new Uint16Array(cells.i.length);

  const updatedFeatures = features.map(feature => {
    if (feature.type !== "lake") return feature;
    
    const updatedFeature = {...feature};
    updatedFeature.flux = getFlux(feature);
    updatedFeature.temp = getLakeTemp(feature);
    updatedFeature.evaporation = getLakeEvaporation(feature);
    
    if (feature.closed) return updatedFeature; // no outlet for lakes in depressed areas

    updatedFeature.outCell = getLowestShoreCell(feature);
    lakeOutCells[updatedFeature.outCell] = feature.i;
    
    return updatedFeature;
  });

  function getFlux(lake) {
    return lake.shoreline.reduce((acc, c) => acc + grid.cells.prec[cells.g[c]], 0);
  }

  function getLakeTemp(lake) {
    if (lake.cells < 6) return grid.cells.temp[cells.g[lake.firstCell]];
    return rn(d3.mean(lake.shoreline.map(c => grid.cells.temp[cells.g[c]])), 1);
  }

  function getLakeEvaporation(lake) {
    const height = (lake.height - 18) ** config.heightExponent; // height in meters
    const evaporation = ((700 * (lake.temp + 0.006 * height)) / 50 + 75) / (80 - lake.temp); // based on Penman formula, [1-11]
    return rn(evaporation * lake.cells);
  }

  function getLowestShoreCell(lake) {
    return lake.shoreline.sort((a, b) => heights[a] - heights[b])[0];
  }

  return {
    pack: {
      ...pack,
      features: updatedFeatures
    },
    lakeOutCells
  };
}

export function cleanupLakeData(pack) {
  const updatedFeatures = pack.features.map(feature => {
    if (feature.type !== "lake") return feature;
    
    const updatedFeature = {...feature};
    delete updatedFeature.river;
    delete updatedFeature.enteringFlux;
    delete updatedFeature.outCell;
    delete updatedFeature.closed;
    updatedFeature.height = Math.round(feature.height * 1000) / 1000; // rn(feature.height, 3)

    const inlets = feature.inlets?.filter(r => pack.rivers.find(river => river.i === r));
    if (!inlets || !inlets.length) delete updatedFeature.inlets;
    else updatedFeature.inlets = inlets;

    const outlet = feature.outlet && pack.rivers.find(river => river.i === feature.outlet);
    if (!outlet) delete updatedFeature.outlet;
    
    return updatedFeature;
  });

  return {
    ...pack,
    features: updatedFeatures
  };
}

export function getHeight(feature, pack, utils) {
  const {d3, rn} = utils;
  const heights = pack.cells.h;
  const minShoreHeight = d3.min(feature.shoreline.map(cellId => heights[cellId])) || 20;
  return rn(minShoreHeight - LAKE_ELEVATION_DELTA, 2);
}

export function getName(feature, pack, Names) {
  const landCell = pack.cells.c[feature.firstCell].find(c => pack.cells.h[c] >= 20);
  const culture = pack.cells.culture[landCell];
  return Names.getCulture(culture);
}
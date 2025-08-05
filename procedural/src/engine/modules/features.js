"use strict";

const DEEPER_LAND = 3;
const LANDLOCKED = 2;
const LAND_COAST = 1;
const UNMARKED = 0;
const WATER_COAST = -1;
const DEEP_WATER = -2;

// calculate distance to coast for every cell
function markup({distanceField, neighbors, start, increment, limit = 127}) {
  for (let distance = start, marked = Infinity; marked > 0 && distance !== limit; distance += increment) {
    marked = 0;
    const prevDistance = distance - increment;
    for (let cellId = 0; cellId < neighbors.length; cellId++) {
      if (distanceField[cellId] !== prevDistance) continue;

      for (const neighborId of neighbors[cellId]) {
        if (distanceField[neighborId] !== UNMARKED) continue;
        distanceField[neighborId] = distance;
        marked++;
      }
    }
  }
}

/**
 * Mark Grid features (ocean, lakes, islands) and calculate distance field
 *
 * REQUIRES:
 *   - grid.cells.h (heights from heightmap generation)
 *   - grid.cells.c (cell neighbors from grid generation)
 *   - config.debug (debug configuration)
 *
 * PROVIDES:
 *   - grid.cells.f (feature assignments)
 *   - grid.cells.t (distance field)
 *   - grid.features (features array)
 */
export function markupGrid(grid, config, utils) {
  // Check required properties exist
  if (!grid.cells.h) {
    throw new Error("Features module requires grid.cells.h (heights) from heightmap generation");
  }
  if (!grid.cells.c) {
    throw new Error("Features module requires grid.cells.c (neighbors) from grid generation");
  }
  if (!config.debug) {
    throw new Error("Features module requires config.debug section");
  }

  const {rn} = utils;
  const { TIME } = config.debug;

  TIME && console.time("markupGrid");

  const {h: heights, c: neighbors, b: borderCells, i} = grid.cells;
  const cellsNumber = i.length;
  const distanceField = new Int8Array(cellsNumber); // gird.cells.t
  const featureIds = new Uint16Array(cellsNumber); // gird.cells.f
  const features = [0];

  const queue = [0];
  for (let featureId = 1; queue[0] !== -1; featureId++) {
    const firstCell = queue[0];
    featureIds[firstCell] = featureId;

    const land = heights[firstCell] >= 20;
    let border = false; // set true if feature touches map edge

    while (queue.length) {
      const cellId = queue.pop();
      if (!border && borderCells[cellId]) border = true;

      for (const neighborId of neighbors[cellId]) {
        const isNeibLand = heights[neighborId] >= 20;

        if (land === isNeibLand && featureIds[neighborId] === UNMARKED) {
          featureIds[neighborId] = featureId;
          queue.push(neighborId);
        } else if (land && !isNeibLand) {
          distanceField[cellId] = LAND_COAST;
          distanceField[neighborId] = WATER_COAST;
        }
      }
    }

    const type = land ? "island" : border ? "ocean" : "lake";
    features.push({i: featureId, land, border, type});

    queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
  }

  // markup deep ocean cells
  markup({distanceField, neighbors, start: DEEP_WATER, increment: -1, limit: -10});

  const updatedGrid = {
    ...grid,
    cells: {
      ...grid.cells,
      t: distanceField,
      f: featureIds
    },
    features
  };

  TIME && console.timeEnd("markupGrid");

  return updatedGrid;
}

/**
 * Mark Pack features (ocean, lakes, islands), calculate distance field and add properties
 *
 * REQUIRES:
 *   - pack.cells.h (heights from pack generation)
 *   - pack.cells.c (cell neighbors from pack generation)
 *   - grid.features (features from grid markup)
 *
 * PROVIDES:
 *   - pack.cells.f (feature assignments)
 *   - pack.cells.t (distance field)
 *   - pack.features (features array)
 */
export function markupPack(pack, grid, config, utils, modules) {
  // Check required properties exist
  if (!pack.cells.h) {
    throw new Error("Features markupPack requires pack.cells.h (heights) from pack generation");
  }
  if (!pack.cells.c) {
    throw new Error("Features markupPack requires pack.cells.c (neighbors) from pack generation");
  }
  if (!grid.features) {
    throw new Error("Features markupPack requires grid.features from grid markup");
  }

  const {TIME} = config;
  const {isLand, isWater, dist2, rn, clipPoly, unique, createTypedArray, connectVertices} = utils;
  const {Lakes} = modules;
  const {d3} = utils;

  TIME && console.time("markupPack");

  const {cells, vertices} = pack;
  const {c: neighbors, b: borderCells, i} = cells;
  const packCellsNumber = i.length;
  if (!packCellsNumber) return pack; // no cells -> there is nothing to do

  const distanceField = new Int8Array(packCellsNumber); // pack.cells.t
  const featureIds = new Uint16Array(packCellsNumber); // pack.cells.f
  const haven = createTypedArray({maxValue: packCellsNumber, length: packCellsNumber}); // haven: opposite water cell
  const harbor = new Uint8Array(packCellsNumber); // harbor: number of adjacent water cells
  const features = [0];

  const queue = [0];
  for (let featureId = 1; queue[0] !== -1; featureId++) {
    const firstCell = queue[0];
    featureIds[firstCell] = featureId;

    const land = isLand(firstCell, pack);
    let border = Boolean(borderCells[firstCell]); // true if feature touches map border
    let totalCells = 1; // count cells in a feature

    while (queue.length) {
      const cellId = queue.pop();
      if (borderCells[cellId]) border = true;
      if (!border && borderCells[cellId]) border = true;

      for (const neighborId of neighbors[cellId]) {
        const isNeibLand = isLand(neighborId, pack);

        if (land && !isNeibLand) {
          distanceField[cellId] = LAND_COAST;
          distanceField[neighborId] = WATER_COAST;
          if (!haven[cellId]) defineHaven(cellId);
        } else if (land && isNeibLand) {
          if (distanceField[neighborId] === UNMARKED && distanceField[cellId] === LAND_COAST)
            distanceField[neighborId] = LANDLOCKED;
          else if (distanceField[cellId] === UNMARKED && distanceField[neighborId] === LAND_COAST)
            distanceField[cellId] = LANDLOCKED;
        }

        if (!featureIds[neighborId] && land === isNeibLand) {
          queue.push(neighborId);
          featureIds[neighborId] = featureId;
          totalCells++;
        }
      }
    }

    features.push(addFeature({firstCell, land, border, featureId, totalCells}));
    queue[0] = featureIds.findIndex(f => f === UNMARKED); // find unmarked cell
  }

  markup({distanceField, neighbors, start: DEEPER_LAND, increment: 1}); // markup pack land
  markup({distanceField, neighbors, start: DEEP_WATER, increment: -1, limit: -10}); // markup pack water

  const updatedPack = {
    ...pack,
    cells: {
      ...pack.cells,
      t: distanceField,
      f: featureIds,
      haven,
      harbor
    },
    features
  };

  TIME && console.timeEnd("markupPack");

  return updatedPack;

  function defineHaven(cellId) {
    const waterCells = neighbors[cellId].filter(i => isWater(i, pack));
    const distances = waterCells.map(neibCellId => dist2(cells.p[cellId], cells.p[neibCellId]));
    const closest = distances.indexOf(Math.min.apply(Math, distances));

    haven[cellId] = waterCells[closest];
    harbor[cellId] = waterCells.length;
  }

  function addFeature({firstCell, land, border, featureId, totalCells}) {
    const type = land ? "island" : border ? "ocean" : "lake";
    const [startCell, featureVertices] = getCellsData(type, firstCell);
    const points = clipPoly(featureVertices.map(vertex => vertices.p[vertex]), config);
    const area = d3.polygonArea(points); // feature perimiter area
    const absArea = Math.abs(rn(area));

    const feature = {
      i: featureId,
      type,
      land,
      border,
      cells: totalCells,
      firstCell: startCell,
      vertices: featureVertices,
      area: absArea
    };

    if (type === "lake") {
      if (area > 0) feature.vertices = feature.vertices.reverse();
      feature.shoreline = unique(feature.vertices.map(vertex => vertices.c[vertex].filter(i => isLand(i, pack))).flat());
      feature.height = Lakes.getHeight(feature, pack, utils);
    }

    return feature;

    function getCellsData(featureType, firstCell) {
      if (featureType === "ocean") return [firstCell, []];

      const getType = cellId => featureIds[cellId];
      const type = getType(firstCell);
      const ofSameType = cellId => getType(cellId) === type;
      const ofDifferentType = cellId => getType(cellId) !== type;

      const startCell = findOnBorderCell(firstCell);
      const featureVertices = getFeatureVertices(startCell);
      return [startCell, featureVertices];

      function findOnBorderCell(firstCell) {
        const isOnBorder = cellId => borderCells[cellId] || neighbors[cellId].some(ofDifferentType);
        if (isOnBorder(firstCell)) return firstCell;

        const startCell = cells.i.filter(ofSameType).find(isOnBorder);
        if (startCell === undefined)
          throw new Error(`Markup: firstCell ${firstCell} is not on the feature or map border`);

        return startCell;
      }

      function getFeatureVertices(startCell) {
        const startingVertex = cells.v[startCell].find(v => vertices.c[v].some(ofDifferentType));
        if (startingVertex === undefined)
          throw new Error(`Markup: startingVertex for cell ${startCell} is not found`);

        return connectVertices({vertices, startingVertex, ofSameType, closeRing: false});
      }
    }
  }
}

// add properties to pack features
export function specify(pack, grid, modules) {
  const {Lakes} = modules;
  const gridCellsNumber = grid.cells.i.length;
  const OCEAN_MIN_SIZE = gridCellsNumber / 25;
  const SEA_MIN_SIZE = gridCellsNumber / 1000;
  const CONTINENT_MIN_SIZE = gridCellsNumber / 10;
  const ISLAND_MIN_SIZE = gridCellsNumber / 1000;

  const updatedFeatures = pack.features.map(feature => {
    if (!feature || feature.type === "ocean") return feature;

    const updatedFeature = {
      ...feature,
      group: defineGroup(feature)
    };

    if (feature.type === "lake") {
      updatedFeature.height = Lakes.getHeight(feature);
      updatedFeature.name = Lakes.getName(feature);
    }

    return updatedFeature;
  });

  return {
    ...pack,
    features: updatedFeatures
  };

  function defineGroup(feature) {
    if (feature.type === "island") return defineIslandGroup(feature);
    if (feature.type === "ocean") return defineOceanGroup(feature);
    if (feature.type === "lake") return defineLakeGroup(feature);
    throw new Error(`Markup: unknown feature type ${feature.type}`);
  }

  function defineOceanGroup(feature) {
    if (feature.cells > OCEAN_MIN_SIZE) return "ocean";
    if (feature.cells > SEA_MIN_SIZE) return "sea";
    return "gulf";
  }

  function defineIslandGroup(feature) {
    const prevFeature = pack.features[pack.cells.f[feature.firstCell - 1]];
    if (prevFeature && prevFeature.type === "lake") return "lake_island";
    if (feature.cells > CONTINENT_MIN_SIZE) return "continent";
    if (feature.cells > ISLAND_MIN_SIZE) return "island";
    return "isle";
  }

  function defineLakeGroup(feature) {
    if (feature.temp < -3) return "frozen";
    if (feature.height > 60 && feature.cells < 10 && feature.firstCell % 10 === 0) return "lava";

    if (!feature.inlets && !feature.outlet) {
      if (feature.evaporation > feature.flux * 4) return "dry";
      if (feature.cells < 3 && feature.firstCell % 10 === 0) return "sinkhole";
    }

    if (!feature.outlet && feature.evaporation > feature.flux) return "salt";

    return "freshwater";
  }
}

"use strict";

const MIN_LAND_HEIGHT = 20;

export const getDefault = () => {
  const name = [
    "Marine",
    "Hot desert",
    "Cold desert",
    "Savanna",
    "Grassland",
    "Tropical seasonal forest",
    "Temperate deciduous forest",
    "Tropical rainforest",
    "Temperate rainforest",
    "Taiga",
    "Tundra",
    "Glacier",
    "Wetland"
  ];

  const color = [
    "#466eab",
    "#fbe79f",
    "#b5b887",
    "#d2d082",
    "#c8d68f",
    "#b6d95d",
    "#29bc56",
    "#7dcb35",
    "#409c43",
    "#4b6b32",
    "#96784b",
    "#d5e7eb",
    "#0b9131"
  ];
  const habitability = [0, 4, 10, 22, 30, 50, 100, 80, 90, 12, 4, 0, 12];
  const iconsDensity = [0, 3, 2, 120, 120, 120, 120, 150, 150, 100, 5, 0, 250];
  const icons = [
    {},
    {dune: 3, cactus: 6, deadTree: 1},
    {dune: 9, deadTree: 1},
    {acacia: 1, grass: 9},
    {grass: 1},
    {acacia: 8, palm: 1},
    {deciduous: 1},
    {acacia: 5, palm: 3, deciduous: 1, swamp: 1},
    {deciduous: 6, swamp: 1},
    {conifer: 1},
    {grass: 1},
    {},
    {swamp: 1}
  ];
  const cost = [10, 200, 150, 60, 50, 70, 70, 80, 90, 200, 1000, 5000, 150]; // biome movement cost
  const biomesMartix = [
    // hot � cold [>19�C; <-4�C]; dry � wet
    new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10]),
    new Uint8Array([3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 10, 10, 10]),
    new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 9, 9, 9, 9, 10, 10, 10]),
    new Uint8Array([5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10]),
    new Uint8Array([7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 10, 10])
  ];

  // parse icons weighted array into a simple array
  for (let i = 0; i < icons.length; i++) {
    const parsed = [];
    for (const icon in icons[i]) {
      for (let j = 0; j < icons[i][icon]; j++) {
        parsed.push(icon);
      }
    }
    icons[i] = parsed;
  }

  return {i: Array.from({length: name.length}, (_, i) => i), name, color, biomesMartix, habitability, iconsDensity, icons, cost};
};

/**
 * Assign biome id for each cell
 *
 * REQUIRES:
 *   - pack.cells.h (heights from heightmap processing)
 *   - grid.cells.temp (temperature from geography module)
 *   - grid.cells.prec (precipitation from geography module)
 *   - pack.cells.g (grid reference from pack generation)
 *   - config.debug (debug configuration)
 *
 * PROVIDES:
 *   - pack.cells.biome (biome assignments for each cell)
 */
export function define(pack, grid, config, utils) {
  // Check required properties exist
  if (!pack.cells.h) {
    throw new Error("Biomes module requires pack.cells.h (heights) from heightmap processing");
  }
  if (!grid.cells.temp || !grid.cells.prec) {
    throw new Error("Biomes module requires grid.cells.temp and grid.cells.prec from geography module");
  }
  if (!pack.cells.g) {
    throw new Error("Biomes module requires pack.cells.g (grid reference) from pack generation");
  }
  if (!config.debug) {
    throw new Error("Biomes module requires config.debug section");
  }

  const { d3, rn} = utils;
  const { TIME } = config.debug;
  TIME && console.time("defineBiomes");

  const {fl: flux, r: riverIds, h: heights, c: neighbors, g: gridReference} = pack.cells;
  const {temp, prec} = grid.cells;
  const biome = new Uint8Array(pack.cells.i.length); // biomes array
  const biomesData = getDefault();

  for (let cellId = 0; cellId < heights.length; cellId++) {
    const height = heights[cellId];
    const moisture = height < MIN_LAND_HEIGHT ? 0 : calculateMoisture(cellId);
    const temperature = temp[gridReference[cellId]];
    biome[cellId] = getId(moisture, temperature, height, Boolean(riverIds[cellId]), biomesData);
  }

  function calculateMoisture(cellId) {
    let moisture = prec[gridReference[cellId]];
    if (riverIds[cellId]) moisture += Math.max(flux[cellId] / 10, 2);

    const moistAround = neighbors[cellId]
      .filter(neibCellId => heights[neibCellId] >= MIN_LAND_HEIGHT)
      .map(c => prec[gridReference[c]])
      .concat([moisture]);
    return rn(4 + d3.mean(moistAround));
  }

  TIME && console.timeEnd("defineBiomes");
  return {biome};
}

export function getId(moisture, temperature, height, hasRiver, biomesData = null) {
  const data = biomesData || getDefault();

  if (height < 20) return 0; // all water cells: marine biome
  if (temperature < -5) return 11; // too cold: permafrost biome
  if (temperature >= 25 && !hasRiver && moisture < 8) return 1; // too hot and dry: hot desert biome
  if (isWetland(moisture, temperature, height)) return 12; // too wet: wetland biome

  // in other cases use biome matrix
  const moistureBand = Math.min((moisture / 5) | 0, 4); // [0-4]
  const temperatureBand = Math.min(Math.max(20 - temperature, 0), 25); // [0-25]
  return data.biomesMartix[moistureBand][temperatureBand];
}

function isWetland(moisture, temperature, height) {
  if (temperature <= -2) return false; // too cold
  if (moisture > 40 && height < 25) return true; // near coast
  if (moisture > 24 && height > 24 && height < 60) return true; // off coast
  return false;
}

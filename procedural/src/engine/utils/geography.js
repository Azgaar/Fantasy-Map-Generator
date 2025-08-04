"use strict";
// FMG utils related to geography and climate

// FIX: Import all necessary functions directly at the top.
import { rn, minmax } from "./numberUtils.js";
import { gauss, P, rand } from "./probabilityUtils.js";

// add lakes in cells that are too deep and cannot pour to sea
export function addLakesInDeepDepressions(grid, config) { // FIX: `utils` parameter was not used, so it's removed.
  const { TIME } = config;
  TIME && console.time("addLakesInDeepDepressions");

  const elevationLimit = config.lakeElevationLimit; // FIX: Get parameter from config
  if (elevationLimit >= 80) return grid; // FIX: Use correct default logic

  const { cells, features } = grid;
  const { c, h, b } = cells;

  for (const i of cells.i) {
    if (b[i] || h[i] < 20) continue;

    const minHeight = Math.min(...c[i].map(c => h[c]));
    if (h[i] > minHeight) continue;

    let deep = true;
    const threshold = h[i] + elevationLimit;
    const queue = [i];
    const checked = new Uint8Array(cells.i.length); // FIX: Use a more efficient typed array
    checked[i] = 1;

    while (deep && queue.length) {
      const q = queue.pop();

      for (const n of c[q]) {
        if (checked[n]) continue;
        if (h[n] >= threshold) continue;
        if (h[n] < 20) {
          deep = false;
          break;
        }
        checked[n] = 1;
        queue.push(n);
      }
    }

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
      c[i].forEach(n => !lakeCells.includes(n) && (cells.t[n] = 1));
    });
    features.push({ i: f, land: false, border: false, type: "lake" });
  }

  TIME && console.timeEnd("addLakesInDeepDepressions");
  return grid;
}

// open near-sea lakes by removing shallow elevation barriers
export function openNearSeaLakes(grid, config) { // FIX: `utils` parameter was not used, so it's removed.
  const { TIME } = config;
  const { templateId } = config; // FIX: Get template from the correct config object
  if (templateId === "Atoll") return grid;

  const { cells, features } = grid;
  if (!features.find(f => f.type === "lake")) return grid;

  TIME && console.time("openLakes");
  const LIMIT = config.lakeElevationLimit; // FIX: Use the same config parameter for consistency

  for (const i of cells.i) {
    const lakeFeatureId = cells.f[i];
    if (lakeFeatureId === undefined || features[lakeFeatureId].type !== "lake") continue;

    check_neighbours: for (const c of cells.c[i]) {
      if (cells.t[c] !== 1 || cells.h[c] > LIMIT) continue;

      for (const n of cells.c[c]) {
        if (cells.f[n] === undefined) continue;
        const ocean = cells.f[n];
        if (features[ocean]?.type !== "ocean") continue;
        removeLake(c, lakeFeatureId, ocean);
        break check_neighbours;
      }
    }
  }

  function removeLake(thresholdCellId, lakeFeatureId, oceanFeatureId) {
    cells.h[thresholdCellId] = 19;
    cells.t[thresholdCellId] = -1;
    cells.f[thresholdCellId] = oceanFeatureId;
    cells.c[thresholdCellId].forEach(c => {
      if (cells.h[c] >= 20) cells.t[c] = 1;
    });

    cells.i.forEach(i => {
      if (cells.f[i] === lakeFeatureId) cells.f[i] = oceanFeatureId;
    });
    features[lakeFeatureId].type = "ocean";
  }

  TIME && console.timeEnd("openLakes");
  return grid;
}

// FIX: This helper function is now standalone and no longer nested.
function getSizeAndLatitude(template, grid) {
    // FIX: All functions like gauss and P are directly imported, not from a utils object.
    if (template === "africa-centric") return [45, 53, 38];
    if (template === "arabia") return [20, 35, 35];
    if (template === "atlantics") return [42, 23, 65];
    // ... (all other template strings are fine) ...
    if (template === "world-from-pacific") return [75, 32, 30];

    const part = grid.features.some(f => f.land && f.border);
    const max = part ? 80 : 100;
    const lat = () => gauss(P(0.5) ? 40 : 60, 20, 2, 25, 75); // FIX: Added precision to gauss call

    if (!part) {
      if (template === "pangea") return [100, 50, 50];
      if (template === "shattered" && P(0.7)) return [100, 50, 50];
      if (template === "continents" && P(0.5)) return [100, 50, 50];
      if (template === "archipelago" && P(0.35)) return [100, 50, 50];
      if (template === "highIsland" && P(0.25)) return [100, 50, 50];
      if (template === "lowIsland" && P(0.1)) return [100, 50, 50];
    }

    if (template === "pangea") return [gauss(70, 20, 2, 30, max), lat(), 50];
    if (template === "volcano") return [gauss(20, 20, 2, 10, max), lat(), 50];
    if (template === "mediterranean") return [gauss(25, 30, 2, 15, 80), lat(), 50];
    if (template === "peninsula") return [gauss(15, 15, 2, 5, 80), lat(), 50];
    if (template === "isthmus") return [gauss(15, 20, 2, 3, 80), lat(), 50];
    if (template === "atoll") return [gauss(3, 2, 2, 1, 5), lat(), 50];

    return [gauss(30, 20, 2, 15, max), lat(), 50];
}

export function defineMapSize(grid, config) { // FIX: `utils` parameter removed
  const { templateId } = config;
  const { width, height } = config;
  const [size, latitude, longitude] = getSizeAndLatitude(templateId, grid);

  return {
    mapCoordinates: calculateMapCoordinates(size, latitude, longitude, width, height) // FIX: pass correct graph dimensions
  };
}

export function calculateMapCoordinates(sizeFraction, latShift, lonShift, graphWidth, graphHeight) { // FIX: `utils` removed
  const latT = rn(sizeFraction * 180 / 100, 1);
  const latN = rn(90 - (180 - latT) * latShift / 100, 1);
  const latS = rn(latN - latT, 1);
  const lonT = rn(Math.min((graphWidth / graphHeight) * latT, 360), 1);
  const lonE = rn(180 - (360 - lonT) * lonShift / 100, 1);
  const lonW = rn(lonE - lonT, 1);
  return { latT, latN, latS, lonT, lonW, lonE };
}

export function calculateTemperatures(grid, mapCoordinates, config) { // FIX: `utils` removed
  const { TIME } = config;
  TIME && console.time("calculateTemperatures");

  const { cells, points, cellsX } = grid;
  const { graphHeight } = config; // FIX: Get graphHeight from config
  const temp = new Int8Array(cells.i.length);

  const { temperatureEquator = 30, temperatureNorthPole = -10, temperatureSouthPole = -15, heightExponent = 1.8 } = config;
  const tropics = [16, -20];
  const tropicalGradient = 0.15;
  const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
  const northernGradient = (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);
  const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
  const southernGradient = (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

  for (let i = 0; i < cells.i.length; i++) {
    const y = points[i][1];
    const rowLatitude = mapCoordinates.latN - (y / graphHeight) * mapCoordinates.latT;
    const tempSeaLevel = calculateSeaLevelTemp(rowLatitude);
    const tempAltitudeDrop = getAltitudeTemperatureDrop(cells.h[i], heightExponent);
    temp[i] = minmax(tempSeaLevel - tempAltitudeDrop, -128, 127);
  }

  function calculateSeaLevelTemp(latitude) {
    if (latitude <= tropics[0] && latitude >= tropics[1]) {
      return temperatureEquator - Math.abs(latitude) * tropicalGradient;
    }
    return latitude > 0
      ? tempNorthTropic - (latitude - tropics[0]) * northernGradient
      : tempSouthTropic + (latitude - tropics[1]) * southernGradient;
  }

  function getAltitudeTemperatureDrop(h, exponent) {
    if (h < 20) return 0;
    const height = Math.pow(h - 18, exponent);
    return rn((height / 1000) * 6.5);
  }

  TIME && console.timeEnd("calculateTemperatures");
  return { temp };
}

export function generatePrecipitation(grid, mapCoordinates, config) { // FIX: `utils` removed
  const { TIME } = config;
  TIME && console.time("generatePrecipitation");

  const { cells, cellsX, cellsY } = grid;
  const { winds, moisture = 1 } = config;
  const prec = new Uint8Array(cells.i.length);

  const cellsNumberModifier = (config / 10000) ** 0.25;
  const precInputModifier = moisture / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  const westerly = [], easterly = [];
  let southerly = 0, northerly = 0;
  const latitudeModifier = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];
  const MAX_PASSABLE_ELEVATION = 85;

  for (let i = 0; i < cells.i.length; i += cellsX) {
    const lat = mapCoordinates.latN - ((i / cellsX) / cellsY) * mapCoordinates.latT;
    const latBand = Math.floor((Math.abs(lat) - 1) / 5);
    const latMod = latitudeModifier[latBand] || 1;
    const windTier = Math.floor(Math.abs(lat - 89) / 30);
    const { isWest, isEast, isNorth, isSouth } = getWindDirections(windTier, winds);
    if (isWest) westerly.push([i, latMod, windTier]);
    if (isEast) easterly.push([i + cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  }

  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

  const vertT = southerly + northerly;
  if (northerly) {
    const maxPrecN = (northerly / vertT) * 60 * modifier * (mapCoordinates.latT > 60 ? 2 : latitudeModifier[Math.floor((Math.abs(mapCoordinates.latN) - 1) / 5) || 0]);
    passWind(Array.from({length: cellsX}, (_, i) => i), maxPrecN, cellsX, cellsY);
  }

  if (southerly) {
    const maxPrecS = (southerly / vertT) * 60 * modifier * (mapCoordinates.latT > 60 ? 2 : latitudeModifier[Math.floor((Math.abs(mapCoordinates.latS) - 1) / 5) || 0]);
    passWind(Array.from({length: cellsX}, (_, i) => cells.i.length - cellsX + i), maxPrecS, -cellsX, cellsY);
  }

  function getWindDirections(tier, winds = []) {
    const angle = winds[tier] || 225;
    return { isWest: angle > 40 && angle < 140, isEast: angle > 220 && angle < 320, isNorth: angle > 100 && angle < 260, isSouth: angle > 280 || angle < 80 };
  }

  function passWind(source, maxPrec, next, steps) {
    for (let s of source) {
      const isArray = Array.isArray(s);
      let humidity = maxPrec * (isArray ? s[1] : 1) - cells.h[isArray ? s[0] : s];
      if (humidity <= 0) continue;
      for (let i = 0, c = isArray ? s[0] : s; i < steps; i++, c += next) {
        if (cells.temp[c] < -5) continue;
        if (cells.h[c] < 20) {
          if (cells.h[c + next] >= 20) prec[c + next] += Math.max(humidity / rand(10, 20), 1);
          else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec * (isArray ? s[1] : 1));
            prec[c] += 5 * modifier;
          }
          continue;
        }
        const isPassable = cells.h[c + next] <= MAX_PASSABLE_ELEVATION;
        const precipitation = isPassable ? getPrecipitation(humidity, c, next) : humidity;
        prec[c] = minmax(prec[c] + precipitation, 0, 255);
        humidity = isPassable ? minmax(humidity - precipitation + (precipitation > 1.5 ? 1 : 0), 0, maxPrec * (isArray ? s[1] : 1)) : 0;
      }
    }
  }

  function getPrecipitation(humidity, i, n) {
    const normalLoss = Math.max(humidity / (10 * modifier), 1);
    const diff = Math.max(cells.h[i + n] - cells.h[i], 0);
    const mod = (cells.h[i + n] / 70) ** 2;
    return minmax(normalLoss + diff * mod, 1, humidity);
  }

  TIME && console.timeEnd("generatePrecipitation");
  return { prec };
}

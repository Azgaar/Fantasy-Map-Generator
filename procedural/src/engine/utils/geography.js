"use strict";
// FMG utils related to geography and climate

// add lakes in cells that are too deep and cannot pour to sea
function addLakesInDeepDepressions(grid, config, utils) {
  const { TIME } = utils;
  TIME && console.time("addLakesInDeepDepressions");
  
  const elevationLimit = config.elevationLimit || 80;
  if (elevationLimit === 80) return grid;

  const { cells, features } = grid;
  const { c, h, b } = cells;

  for (const i of cells.i) {
    if (b[i] || h[i] < 20) continue;

    const minHeight = Math.min(...c[i].map(c => h[c]));
    if (h[i] > minHeight) continue;

    let deep = true;
    const threshold = h[i] + elevationLimit;
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
      c[i].forEach(n => !lakeCells.includes(n) && (cells.t[n] = 1));
    });

    features.push({ i: f, land: false, border: false, type: "lake" });
  }

  TIME && console.timeEnd("addLakesInDeepDepressions");
  return grid;
}

// open near-sea lakes by removing shallow elevation barriers
function openNearSeaLakes(grid, config, utils) {
  const { TIME } = utils;
  const template = config.template;
  if (template === "Atoll") return grid; // no need for Atolls

  const { cells, features } = grid;
  if (!features.find(f => f.type === "lake")) return grid; // no lakes
  
  TIME && console.time("openLakes");
  const LIMIT = config.openLakeLimit || 22; // max height that can be breached by water

  for (const i of cells.i) {
    const lakeFeatureId = cells.f[i];
    if (features[lakeFeatureId].type !== "lake") continue; // not a lake

    check_neighbours: for (const c of cells.c[i]) {
      if (cells.t[c] !== 1 || cells.h[c] > LIMIT) continue; // water cannot break this

      for (const n of cells.c[c]) {
        const ocean = cells.f[n];
        if (features[ocean].type !== "ocean") continue; // not an ocean
        removeLake(c, lakeFeatureId, ocean);
        break check_neighbours;
      }
    }
  }

  function removeLake(thresholdCellId, lakeFeatureId, oceanFeatureId) {
    cells.h[thresholdCellId] = 19;
    cells.t[thresholdCellId] = -1;
    cells.f[thresholdCellId] = oceanFeatureId;
    cells.c[thresholdCellId].forEach(function (c) {
      if (cells.h[c] >= 20) cells.t[c] = 1; // mark as coastline
    });

    cells.i.forEach(i => {
      if (cells.f[i] === lakeFeatureId) cells.f[i] = oceanFeatureId;
    });
    features[lakeFeatureId].type = "ocean"; // mark former lake as ocean
  }

  TIME && console.timeEnd("openLakes");
  return grid;
}

// define map size and coordinate system based on template
function defineMapSize(grid, config) {
  const [size, latitude, longitude] = getSizeAndLatitude(config.template, grid);
  
  return {
    mapCoordinates: calculateMapCoordinates(size, latitude, longitude, config.graphWidth, config.graphHeight),
    size,
    latitude,
    longitude
  };

  function getSizeAndLatitude(template, grid) {
    const { rn, gauss, P } = config.utils || {};

    if (template === "africa-centric") return [45, 53, 38];
    if (template === "arabia") return [20, 35, 35];
    if (template === "atlantics") return [42, 23, 65];
    if (template === "britain") return [7, 20, 51.3];
    if (template === "caribbean") return [15, 40, 74.8];
    if (template === "east-asia") return [11, 28, 9.4];
    if (template === "eurasia") return [38, 19, 27];
    if (template === "europe") return [20, 16, 44.8];
    if (template === "europe-accented") return [14, 22, 44.8];
    if (template === "europe-and-central-asia") return [25, 10, 39.5];
    if (template === "europe-central") return [11, 22, 46.4];
    if (template === "europe-north") return [7, 18, 48.9];
    if (template === "greenland") return [22, 7, 55.8];
    if (template === "hellenica") return [8, 27, 43.5];
    if (template === "iceland") return [2, 15, 55.3];
    if (template === "indian-ocean") return [45, 55, 14];
    if (template === "mediterranean-sea") return [10, 29, 45.8];
    if (template === "middle-east") return [8, 31, 34.4];
    if (template === "north-america") return [37, 17, 87];
    if (template === "us-centric") return [66, 27, 100];
    if (template === "us-mainland") return [16, 30, 77.5];
    if (template === "world") return [78, 27, 40];
    if (template === "world-from-pacific") return [75, 32, 30];

    const part = grid.features.some(f => f.land && f.border); // if land goes over map borders
    const max = part ? 80 : 100; // max size
    const lat = () => gauss(P(0.5) ? 40 : 60, 20, 25, 75); // latitude shift

    if (!part) {
      if (template === "pangea") return [100, 50, 50];
      if (template === "shattered" && P(0.7)) return [100, 50, 50];
      if (template === "continents" && P(0.5)) return [100, 50, 50];
      if (template === "archipelago" && P(0.35)) return [100, 50, 50];
      if (template === "highIsland" && P(0.25)) return [100, 50, 50];
      if (template === "lowIsland" && P(0.1)) return [100, 50, 50];
    }

    if (template === "pangea") return [gauss(70, 20, 30, max), lat(), 50];
    if (template === "volcano") return [gauss(20, 20, 10, max), lat(), 50];
    if (template === "mediterranean") return [gauss(25, 30, 15, 80), lat(), 50];
    if (template === "peninsula") return [gauss(15, 15, 5, 80), lat(), 50];
    if (template === "isthmus") return [gauss(15, 20, 3, 80), lat(), 50];
    if (template === "atoll") return [gauss(3, 2, 1, 5, 1), lat(), 50];

    return [gauss(30, 20, 15, max), lat(), 50]; // Continents, Archipelago, High Island, Low Island
  }
}

// calculate map coordinates from size and position parameters
function calculateMapCoordinates(sizeFraction, latShift, lonShift, graphWidth, graphHeight, utils) {
  const { rn } = utils;
  
  const latT = rn(sizeFraction * 180 / 100, 1);
  const latN = rn(90 - (180 - latT) * latShift / 100, 1);
  const latS = rn(latN - latT, 1);

  const lonT = rn(Math.min((graphWidth / graphHeight) * latT, 360), 1);
  const lonE = rn(180 - (360 - lonT) * lonShift / 100, 1);
  const lonW = rn(lonE - lonT, 1);
  
  return { latT, latN, latS, lonT, lonW, lonE };
}

// calculate temperatures based on latitude and elevation
function calculateTemperatures(grid, mapCoordinates, config, utils) {
  const { TIME, rn, minmax } = utils;
  TIME && console.time("calculateTemperatures");
  
  const { cells } = grid;
  const temp = new Int8Array(cells.i.length); // temperature array

  const { temperatureEquator = 30, temperatureNorthPole = -10, temperatureSouthPole = -15 } = config;
  const tropics = [16, -20]; // tropics zone
  const tropicalGradient = 0.15;

  const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
  const northernGradient = (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);

  const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
  const southernGradient = (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

  const exponent = config.heightExponent || 1.8;

  for (let rowCellId = 0; rowCellId < cells.i.length; rowCellId += grid.cellsX) {
    const [, y] = grid.points[rowCellId];
    const rowLatitude = mapCoordinates.latN - (y / config.graphHeight) * mapCoordinates.latT; // [90; -90]
    const tempSeaLevel = calculateSeaLevelTemp(rowLatitude);

    for (let cellId = rowCellId; cellId < rowCellId + grid.cellsX; cellId++) {
      const tempAltitudeDrop = getAltitudeTemperatureDrop(cells.h[cellId]);
      temp[cellId] = minmax(tempSeaLevel - tempAltitudeDrop, -128, 127);
    }
  }

  function calculateSeaLevelTemp(latitude) {
    const isTropical = latitude <= 16 && latitude >= -20;
    if (isTropical) return temperatureEquator - Math.abs(latitude) * tropicalGradient;

    return latitude > 0
      ? tempNorthTropic - (latitude - tropics[0]) * northernGradient
      : tempSouthTropic + (latitude - tropics[1]) * southernGradient;
  }

  // temperature drops by 6.5°C per 1km of altitude
  function getAltitudeTemperatureDrop(h) {
    if (h < 20) return 0;
    const height = Math.pow(h - 18, exponent);
    return rn((height / 1000) * 6.5);
  }

  TIME && console.timeEnd("calculateTemperatures");
  return { temp };
}

// generate precipitation based on prevailing winds and elevation
function generatePrecipitation(grid, mapCoordinates, config, utils) {
  const { TIME, rn, minmax, rand } = utils;
  TIME && console.time("generatePrecipitation");
  
  const { cells, cellsX, cellsY } = grid;
  const prec = new Uint8Array(cells.i.length); // precipitation array

  const cellsDesired = config.cellsDesired || 10000;
  const cellsNumberModifier = (cellsDesired / 10000) ** 0.25;
  const precInputModifier = (config.precipitation || 100) / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  const westerly = [];
  const easterly = [];
  let southerly = 0;
  let northerly = 0;

  // precipitation modifier per latitude band
  const latitudeModifier = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];
  const MAX_PASSABLE_ELEVATION = 85;

  // define wind directions based on cells latitude and prevailing winds there
  for (let i = 0; i < cells.i.length; i += cellsX) {
    const c = i;
    const lat = mapCoordinates.latN - ((i / cellsX) / cellsY) * mapCoordinates.latT;
    const latBand = Math.floor((Math.abs(lat) - 1) / 5);
    const latMod = latitudeModifier[latBand] || 1;
    const windTier = Math.floor(Math.abs(lat - 89) / 30); // 30d tiers from 0 to 5 from N to S
    const { isWest, isEast, isNorth, isSouth } = getWindDirections(windTier, config.winds);

    if (isWest) westerly.push([c, latMod, windTier]);
    if (isEast) easterly.push([c + cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  }

  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

  const vertT = southerly + northerly;
  if (northerly) {
    const bandN = Math.floor((Math.abs(mapCoordinates.latN) - 1) / 5);
    const latModN = mapCoordinates.latT > 60 ? latitudeModifier.reduce((a, b) => a + b) / latitudeModifier.length : latitudeModifier[bandN];
    const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
    const northRange = [];
    for (let i = 0; i < cellsX; i++) northRange.push(i);
    passWind(northRange, maxPrecN, cellsX, cellsY);
  }

  if (southerly) {
    const bandS = Math.floor((Math.abs(mapCoordinates.latS) - 1) / 5);
    const latModS = mapCoordinates.latT > 60 ? latitudeModifier.reduce((a, b) => a + b) / latitudeModifier.length : latitudeModifier[bandS];
    const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
    const southRange = [];
    for (let i = cells.i.length - cellsX; i < cells.i.length; i++) southRange.push(i);
    passWind(southRange, maxPrecS, -cellsX, cellsY);
  }

  function getWindDirections(tier, winds = []) {
    const angle = winds[tier] || 225; // default southwest wind

    const isWest = angle > 40 && angle < 140;
    const isEast = angle > 220 && angle < 320;
    const isNorth = angle > 100 && angle < 260;
    const isSouth = angle > 280 || angle < 80;

    return { isWest, isEast, isNorth, isSouth };
  }

  function passWind(source, maxPrec, next, steps) {
    const maxPrecInit = maxPrec;

    for (let first of source) {
      if (first[0] !== undefined) {
        maxPrec = Math.min(maxPrecInit * first[1], 255);
        first = first[0];
      }

      let humidity = maxPrec - cells.h[first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated consider wind dry

      for (let s = 0, current = first; s < steps; s++, current += next) {
        if (cells.temp[current] < -5) continue; // no flux in permafrost

        if (cells.h[current] < 20) {
          // water cell
          if (cells.h[current + next] >= 20) {
            prec[current + next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            prec[current] += 5 * modifier; // water cells precipitation
          }
          continue;
        }

        // land cell
        const isPassable = cells.h[current + next] <= MAX_PASSABLE_ELEVATION;
        const precipitation = isPassable ? getPrecipitation(humidity, current, next) : humidity;
        prec[current] += precipitation;
        const evaporation = precipitation > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = isPassable ? minmax(humidity - precipitation + evaporation, 0, maxPrec) : 0;
      }
    }
  }

  function getPrecipitation(humidity, i, n) {
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(cells.h[i + n] - cells.h[i], 0); // difference in height
    const mod = (cells.h[i + n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return minmax(normalLoss + diff * mod, 1, humidity);
  }

  TIME && console.timeEnd("generatePrecipitation");
  return { prec };
}

export {
  addLakesInDeepDepressions,
  openNearSeaLakes,
  defineMapSize,
  calculateMapCoordinates,
  calculateTemperatures,
  generatePrecipitation
};
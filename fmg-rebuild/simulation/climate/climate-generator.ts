import { Grid } from "../../core/types";
import { createPRNG } from "../../core/random";

export interface ClimateOptions {
  temperatureEquator: number;
  temperatureNorthPole: number;
  temperatureSouthPole: number;
  winds: number[]; // 6 elements: winds in 30° latitude bands from North to South
  precInput: number; // 0-100 (e.g. 100)
}

function minmax(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function generateClimate(
  grid: Grid,
  heights: Uint8Array,
  width: number,
  height: number,
  options: ClimateOptions
): { temp: Float32Array; prec: Uint8Array } {
  const pointsN = heights.length;
  const temp = new Float32Array(pointsN);
  const prec = new Uint8Array(pointsN);

  const { temperatureEquator, temperatureNorthPole, temperatureSouthPole } = options;
  const tropics = [16, -20];
  const tropicalGradient = 0.15;
  const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
  const northernGradient = (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);
  const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
  const southernGradient = (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

  const exponent = 1.0; // default heightExponent

  // 1. Calculate temperatures based on latitude and elevation
  const latN = 34; // standard latitude North boundary from future data model
  const latT = 68; // standard latitude span

  for (let rowCellId = 0; rowCellId < pointsN; rowCellId += grid.cellsX) {
    const [, y] = grid.points[rowCellId];
    const rowLatitude = latN - (y / height) * latT; // [90 to -90]

    let tempSeaLevel = 0;
    const isTropical = rowLatitude <= 16 && rowLatitude >= -20;
    if (isTropical) {
      tempSeaLevel = temperatureEquator - Math.abs(rowLatitude) * tropicalGradient;
    } else {
      tempSeaLevel = rowLatitude > 0
        ? tempNorthTropic - (rowLatitude - tropics[0]) * northernGradient
        : tempSouthTropic + (rowLatitude - tropics[1]) * southernGradient;
    }

    const rowEnd = Math.min(rowCellId + grid.cellsX, pointsN);
    for (let cellId = rowCellId; cellId < rowEnd; cellId++) {
      const h = heights[cellId];
      let tempAltitudeDrop = 0;
      if (h >= 20) {
        const hAltitude = Math.pow(h - 18, exponent);
        tempAltitudeDrop = (hAltitude / 1000) * 6.5;
      }
      temp[cellId] = minmax(tempSeaLevel - tempAltitudeDrop, -128, 127);
    }
  }

  // 2. Generate wind directions and pass moisture across the map
  const cellsNumberModifier = Math.pow(grid.cellsDesired / 10000, 0.25);
  const precInputModifier = options.precInput / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  const westerly: [number, number, number][] = [];
  const easterly: [number, number, number][] = [];
  let southerly = 0;
  let northerly = 0;

  const latitudeModifier = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];
  const MAX_PASSABLE_ELEVATION = 85;

  const getWindDirections = (tier: number) => {
    const angle = options.winds[tier] || 0;
    return {
      isWest: angle > 40 && angle < 140,
      isEast: angle > 220 && angle < 320,
      isNorth: angle > 100 && angle < 260,
      isSouth: angle > 280 || angle < 80
    };
  };

  for (let i = 0; i < grid.cellsY; i++) {
    const rowCellId = i * grid.cellsX;
    if (rowCellId >= pointsN) break;
    const [, y] = grid.points[rowCellId];
    const lat = latN - (y / height) * latT;
    const latBand = minmax(Math.floor((Math.abs(lat) - 1) / 5), 0, latitudeModifier.length - 1);
    const latMod = latitudeModifier[latBand];
    const windTier = minmax(Math.floor(Math.abs(lat - 89) / 30), 0, 5);
    const { isWest, isEast, isNorth, isSouth } = getWindDirections(windTier);

    if (isWest) westerly.push([rowCellId, latMod, windTier]);
    if (isEast) easterly.push([rowCellId + grid.cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  }

  const rng = createPRNG("prec-rng-seed");
  const randRange = (min: number, max: number) => rng() * (max - min) + min;

  const passWind = (source: any[], maxPrec: number, next: number, steps: number) => {
    const maxPrecInit = maxPrec;
    for (let entry of source) {
      let firstCell = 0;
      let cellLatMod = 1.0;
      if (Array.isArray(entry)) {
        firstCell = entry[0];
        cellLatMod = entry[1];
        maxPrec = Math.min(maxPrecInit * cellLatMod, 255);
      } else {
        firstCell = entry;
      }

      if (firstCell < 0 || firstCell >= pointsN) continue;
      let humidity = maxPrec - heights[firstCell];
      if (humidity <= 0) continue;

      let current = firstCell;
      for (let s = 0; s < steps; s++) {
        if (current < 0 || current >= pointsN) break;
        if (temp[current] < -5) {
          current += next;
          continue;
        }

        if (heights[current] < 20) {
          const nextCell = current + next;
          if (nextCell >= 0 && nextCell < pointsN && heights[nextCell] >= 20) {
            prec[nextCell] += Math.max(humidity / randRange(10, 20), 1);
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec);
            prec[current] += Math.round(5 * modifier);
          }
        } else {
          const nextCell = current + next;
          const isPassable = nextCell >= 0 && nextCell < pointsN && heights[nextCell] <= MAX_PASSABLE_ELEVATION;
          
          let precipitation = humidity;
          if (isPassable && nextCell < pointsN) {
            const normalLoss = Math.max(humidity / (10 * modifier), 1);
            const diff = Math.max(heights[nextCell] - heights[current], 0);
            const mod = Math.pow(heights[nextCell] / 70, 2);
            precipitation = minmax(normalLoss + diff * mod, 1, humidity);
          }
          prec[current] += Math.round(precipitation);
          const evaporation = precipitation > 1.5 ? 1 : 0;
          humidity = isPassable ? minmax(humidity - precipitation + evaporation, 0, maxPrec) : 0;
        }
        current += next;
      }
    }
  };

  if (westerly.length) passWind(westerly, 120 * modifier, 1, grid.cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, grid.cellsX);

  const vertT = southerly + northerly;
  if (northerly && vertT > 0) {
    const latModN = d3Mean(latitudeModifier);
    const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
    const sources = Array.from({ length: grid.cellsX }, (_, idx) => idx);
    passWind(sources, maxPrecN, grid.cellsX, grid.cellsY);
  }

  if (southerly && vertT > 0) {
    const latModS = d3Mean(latitudeModifier);
    const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
    const sources = Array.from({ length: grid.cellsX }, (_, idx) => pointsN - grid.cellsX + idx);
    passWind(sources, maxPrecS, -grid.cellsX, grid.cellsY);
  }

  return { temp, prec };
}

function d3Mean(arr: number[]): number {
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

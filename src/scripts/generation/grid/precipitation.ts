// @ts-nocheck
import * as d3 from "d3";

import {TIME} from "config/logging";
import {minmax} from "utils/numberUtils";
import {rand} from "utils/probabilityUtils";
import {getInputNumber, getInputValue} from "utils/nodeUtils";
import {byId} from "utils/shorthands";

// simplest precipitation model
export function generatePrecipitation(heights: Uint8Array, temperatures: Int8Array, cellsX: number, cellsY: number) {
  TIME && console.time("generatePrecipitation");
  prec.selectAll("*").remove();

  const precipitation = new Uint8Array(heights.length); // precipitation array

  const cellsNumberModifier = (byId("pointsInput").dataset.cells / 10000) ** 0.25;
  const precInputModifier = getInputNumber("precInput") / 100;
  const modifier = cellsNumberModifier * precInputModifier;

  const westerly = [];
  const easterly = [];
  let southerly = 0;
  let northerly = 0;

  // precipitation modifier per latitude band
  // x4 = 0-5 latitude: wet through the year (rising zone)
  // x2 = 5-20 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 20-30 latitude: dry all year (sinking zone)
  // x2 = 30-50 latitude: wet winter (rising zone), dry summer (sinking zone)
  // x3 = 50-60 latitude: wet all year (rising zone)
  // x2 = 60-70 latitude: wet summer (rising zone), dry winter (sinking zone)
  // x1 = 70-85 latitude: dry all year (sinking zone)
  // x0.5 = 85-90 latitude: dry all year (sinking zone)
  const latitudeModifier = [4, 2, 2, 2, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 1, 0.5];
  const MAX_PASSABLE_ELEVATION = 85;

  // define wind directions based on cells latitude and prevailing winds there
  d3.range(0, heights.length, cellsX).forEach(function (c, i) {
    const lat = mapCoordinates.latN - (i / cellsY) * mapCoordinates.latT;
    const latBand = ((Math.abs(lat) - 1) / 5) | 0;
    const latMod = latitudeModifier[latBand];
    const windTier = (Math.abs(lat - 89) / 30) | 0; // 30d tiers from 0 to 5 from N to S
    const {isWest, isEast, isNorth, isSouth} = getWindDirections(windTier);

    if (isWest) westerly.push([c, latMod, windTier]);
    if (isEast) easterly.push([c + cellsX - 1, latMod, windTier]);
    if (isNorth) northerly++;
    if (isSouth) southerly++;
  });

  // distribute winds by direction
  if (westerly.length) passWind(westerly, 120 * modifier, 1, cellsX);
  if (easterly.length) passWind(easterly, 120 * modifier, -1, cellsX);

  const vertT = southerly + northerly;
  if (northerly) {
    const bandN = ((Math.abs(mapCoordinates.latN) - 1) / 5) | 0;
    const latModN = mapCoordinates.latT > 60 ? d3.mean(latitudeModifier) : latitudeModifier[bandN];
    const maxPrecN = (northerly / vertT) * 60 * modifier * latModN;
    passWind(d3.range(0, cellsX, 1), maxPrecN, cellsX, cellsY);
  }

  if (southerly) {
    const bandS = ((Math.abs(mapCoordinates.latS) - 1) / 5) | 0;
    const latModS = mapCoordinates.latT > 60 ? d3.mean(latitudeModifier) : latitudeModifier[bandS];
    const maxPrecS = (southerly / vertT) * 60 * modifier * latModS;
    passWind(d3.range(heights.length - cellsX, heights.length, 1), maxPrecS, -cellsX, cellsY);
  }

  function getWindDirections(tier) {
    const angle = options.winds[tier];

    const isWest = angle > 40 && angle < 140;
    const isEast = angle > 220 && angle < 320;
    const isNorth = angle > 100 && angle < 260;
    const isSouth = angle > 280 || angle < 80;

    return {isWest, isEast, isNorth, isSouth};
  }

  function passWind(source, maxPrec, next, steps) {
    const maxPrecInit = maxPrec;

    for (let first of source) {
      if (first[0]) {
        maxPrec = Math.min(maxPrecInit * first[1], 255);
        first = first[0];
      }

      let humidity = maxPrec - heights[first]; // initial water amount
      if (humidity <= 0) continue; // if first cell in row is too elevated consider wind dry

      for (let s = 0, current = first; s < steps; s++, current += next) {
        if (temperatures[current] < -5) continue; // no flux in permafrost

        if (heights[current] < 20) {
          // water cell
          if (heights[current + next] >= 20) {
            precipitation[current + next] += Math.max(humidity / rand(10, 20), 1); // coastal precipitation
          } else {
            humidity = Math.min(humidity + 5 * modifier, maxPrec); // wind gets more humidity passing water cell
            precipitation[current] += 5 * modifier; // water cells precipitation (need to correctly pour water through lakes)
          }
          continue;
        }

        // land cell
        const isPassable = heights[current + next] <= MAX_PASSABLE_ELEVATION;
        const cellPrec = isPassable ? getPrecipitation(humidity, current, next) : humidity;
        precipitation[current] += cellPrec;
        const evaporation = cellPrec > 1.5 ? 1 : 0; // some humidity evaporates back to the atmosphere
        humidity = isPassable ? minmax(humidity - cellPrec + evaporation, 0, maxPrec) : 0;
      }
    }
  }

  function getPrecipitation(humidity, i, n) {
    const normalLoss = Math.max(humidity / (10 * modifier), 1); // precipitation in normal conditions
    const diff = Math.max(heights[i + n] - heights[i], 0); // difference in height
    const mod = (heights[i + n] / 70) ** 2; // 50 stands for hills, 70 for mountains
    return minmax(normalLoss + diff * mod, 1, humidity);
  }

  TIME && console.timeEnd("generatePrecipitation");
  return precipitation;
}

// TODO: move to renderer
function drawWindDirection() {
  const wind = prec.append("g").attr("id", "wind");

  d3.range(0, 6).forEach(function (t) {
    if (westerly.length > 1) {
      const west = westerly.filter(w => w[2] === t);
      if (west && west.length > 3) {
        const from = west[0][0];
        const to = west[west.length - 1][0];
        const y = (grid.points[from][1] + grid.points[to][1]) / 2;
        wind.append("text").attr("x", 20).attr("y", y).text("\u21C9");
      }
    }
    if (easterly.length > 1) {
      const east = easterly.filter(w => w[2] === t);
      if (east && east.length > 3) {
        const from = east[0][0];
        const to = east[east.length - 1][0];
        const y = (grid.points[from][1] + grid.points[to][1]) / 2;
        wind
          .append("text")
          .attr("x", graphWidth - 52)
          .attr("y", y)
          .text("\u21C7");
      }
    }
  });

  if (northerly)
    wind
      .append("text")
      .attr("x", graphWidth / 2)
      .attr("y", 42)
      .text("\u21CA");
  if (southerly)
    wind
      .append("text")
      .attr("x", graphWidth / 2)
      .attr("y", graphHeight - 20)
      .text("\u21C8");
}

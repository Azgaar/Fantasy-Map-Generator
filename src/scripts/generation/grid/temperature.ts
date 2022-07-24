import * as d3 from "d3";

import {TIME} from "config/logging";
import {minmax} from "utils/numberUtils";
import {getInputNumber} from "utils/nodeUtils";
import {MIN_LAND_HEIGHT} from "config/generation";

const interpolate = d3.easePolyInOut.exponent(0.5); // interpolation function

export function calculateTemperatures(heights: Uint8Array, cellsX: number, points: TPoints) {
  TIME && console.time("calculateTemperatures");

  const temperatures = new Int8Array(heights.length); // temperature array

  // temperature decreases by 6.5 Celsius per kilometer
  const heightExponent = getInputNumber("heightExponentInput");
  function decreaseTempFromElevation(height: number) {
    if (height < MIN_LAND_HEIGHT) return 0;

    const realHeight = Math.pow(height - 18, heightExponent);
    return (realHeight / 1000) * 6.5;
  }

  const tEq = getInputNumber("temperatureEquatorInput");
  const tPole = getInputNumber("temperaturePoleInput");
  const tDelta = tEq - tPole;

  const {latN, latT} = window.mapCoordinates;

  d3.range(0, heights.length, cellsX).forEach(rowStart => {
    const y = points[rowStart][1];
    const lat = Math.abs(latN - (y / graphHeight) * latT); // [0; 90]

    const initTemp = tEq - interpolate(lat / 90) * tDelta;
    for (let i = rowStart; i < rowStart + cellsX; i++) {
      const elevationDecrease = decreaseTempFromElevation(heights[i]);
      temperatures[i] = minmax(initTemp - elevationDecrease, -128, 127);
    }
  });

  TIME && console.timeEnd("calculateTemperatures");

  return temperatures;
}

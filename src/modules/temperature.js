import * as d3 from "d3";

import {TIME} from "config/logging";
import {minmax, rn} from "utils/numberUtils";

// temperature model
export function calculateTemperatures() {
  TIME && console.time("calculateTemperatures");
  const cells = grid.cells;
  cells.temp = new Int8Array(cells.i.length); // temperature array

  const tEq = +temperatureEquatorInput.value;
  const tPole = +temperaturePoleInput.value;
  const tDelta = tEq - tPole;
  const int = d3.easePolyInOut.exponent(0.5); // interpolation function

  d3.range(0, cells.i.length, grid.cellsX).forEach(function (r) {
    const y = grid.points[r][1];
    const lat = Math.abs(mapCoordinates.latN - (y / graphHeight) * mapCoordinates.latT); // [0; 90]
    const initTemp = tEq - int(lat / 90) * tDelta;
    for (let i = r; i < r + grid.cellsX; i++) {
      cells.temp[i] = minmax(initTemp - convertToFriendly(cells.h[i]), -128, 127);
    }
  });

  // temperature decreases by 6.5 degree C per 1km
  function convertToFriendly(h) {
    if (h < 20) return 0;
    const exponent = +heightExponentInput.value;
    const height = Math.pow(h - 18, exponent);
    return rn((height / 1000) * 6.5);
  }

  TIME && console.timeEnd("calculateTemperatures");
}

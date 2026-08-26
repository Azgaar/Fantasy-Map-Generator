import { minmax, rn, SEA_LEVEL } from "@/utils";

declare global {
  var Temperature: TemperatureModule;
}

class TemperatureModule {
  /** calculate the temperature of every grid cell from its latitude and altitude */
  generate(): void {
    const { cells, cellsX, points } = grid;
    cells.temp = new Int8Array(cells.i.length);

    const { temperatureEquator, temperatureNorthPole, temperatureSouthPole } = options;
    const tropics = [16, -20]; // tropics zone
    const tropicalGradient = 0.15;

    const tempNorthTropic = temperatureEquator - tropics[0] * tropicalGradient;
    const northernGradient = (tempNorthTropic - temperatureNorthPole) / (90 - tropics[0]);

    const tempSouthTropic = temperatureEquator + tropics[1] * tropicalGradient;
    const southernGradient = (tempSouthTropic - temperatureSouthPole) / (90 + tropics[1]);

    const exponent = +heightExponentInput.value;

    const getSeaLevelTemperature = (latitude: number) => {
      const isTropical = latitude <= 16 && latitude >= -20;
      if (isTropical) return temperatureEquator - Math.abs(latitude) * tropicalGradient;

      return latitude > 0
        ? tempNorthTropic - (latitude - tropics[0]) * northernGradient
        : tempSouthTropic + (latitude - tropics[1]) * southernGradient;
    };

    // temperature drops by 6.5°C per 1km of altitude
    const getAltitudeDrop = (height: number) => {
      if (height < SEA_LEVEL) return 0;
      return rn(((height - 18) ** exponent / 1000) * 6.5);
    };

    for (let rowCellId = 0; rowCellId < cells.i.length; rowCellId += cellsX) {
      const [, y] = points[rowCellId];
      const rowLatitude = mapCoordinates.latN! - (y / graphHeight) * mapCoordinates.latT!; // [90; -90]
      const seaLevelTemp = getSeaLevelTemperature(rowLatitude);
      DEBUG.temperature && console.info(`${rn(rowLatitude)}° sea temperature: ${rn(seaLevelTemp)}°C`);

      for (let cellId = rowCellId; cellId < rowCellId + cellsX; cellId++) {
        cells.temp[cellId] = minmax(seaLevelTemp - getAltitudeDrop(cells.h[cellId]), -128, 127);
      }
    }
  }
}

window.Temperature = new TemperatureModule();

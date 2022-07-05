import {rn} from "./numberUtils";
import {findCell, findGridCell} from "./graphUtils";
import {getInputNumber, getInputValue} from "./nodeUtils";

// ***
// SI
// ***

// corvert number to short string with SI postfix
export function si(n: number) {
  if (n >= 1e9) return rn(n / 1e9, 1) + "B";
  if (n >= 1e8) return rn(n / 1e6) + "M";
  if (n >= 1e6) return rn(n / 1e6, 1) + "M";
  if (n >= 1e4) return rn(n / 1e3) + "K";
  if (n >= 1e3) return rn(n / 1e3, 1) + "K";
  return rn(n);
}

// convert SI number to integer
export function siToInteger(value: string) {
  const metric = value.slice(-1);
  const number = parseFloat(value.slice(0, -1));

  if (metric === "K") return rn(number * 1e3);
  if (metric === "M") return rn(number * 1e6);
  if (metric === "B") return rn(number * 1e9);
  return parseInt(value);
}

// ***
// Temperature
// ***

// conver temperature from °C to other scales
const temperatureConversionMap: Dict<(temp: number) => string> = {
  "°C": temp => rn(temp) + "°C",
  "°F": temp => rn((temp * 9) / 5 + 32) + "°F",
  K: temp => rn(temp + 273.15) + "K",
  "°R": temp => rn(((temp + 273.15) * 9) / 5) + "°R",
  "°De": temp => rn(((100 - temp) * 3) / 2) + "°De",
  "°N": temp => rn((temp * 33) / 100) + "°N",
  "°Ré": temp => rn((temp * 4) / 5) + "°Ré",
  "°Rø": temp => rn((temp * 21) / 40 + 7.5) + "°Rø"
};

export function convertTemperature(temp: number) {
  const scale = getInputValue("temperatureScale") || "°C";
  const conversionFn = temperatureConversionMap[scale];
  return conversionFn(temp);
}

// ***
// Elevation
// ***

// get user-friendly (real-world) height value from coordinates
export function getFriendlyHeight([x, y]: [number, number]) {
  const packH = pack.cells.h[findCell(x, y)];
  const gridH = grid.cells.h[findGridCell(x, y, grid)];
  const h = packH < 20 ? gridH : packH;
  return getHeight(h);
}

const heightUnitMap: Dict<number> = {
  m: 1, // meters
  ft: 3.281, // feet
  f: 0.5468 // fathoms
};

export function getHeight(h: number, abs: boolean = false) {
  const unit = getInputValue("heightUnit");
  const unitRatio = heightUnitMap[unit] || 1;
  const exponent = getInputNumber("heightExponentInput");

  let height = -990;
  if (h >= 20) height = Math.pow(h - 18, exponent);
  else if (h < 20 && h > 0) height = ((h - 20) / h) * 50;

  if (abs) height = Math.abs(height);
  return rn(height * unitRatio) + " " + unit;
}

// ***
// Precipitation
// ***

export function getFriendlyPrecipitation(prec: number) {
  return prec * 100 + " mm";
}

// get user-friendly (real-world) precipitation value from map data
export function getCellIdPrecipitation(gridCellId: number) {
  const prec = grid.cells.prec[pack.cells.g[gridCellId]];
  return getFriendlyPrecipitation(prec);
}

// ***
// Population
// ***

export function getCellPopulation(cellId: number) {
  const rural = pack.cells.pop[cellId] * populationRate;
  const burg = pack.cells.burg[cellId];
  const urban = burg ? pack.burgs[burg].population * populationRate * urbanization : 0;
  return [rural, urban];
}

// get user-friendly (real-world) population value from map data
export function getFriendlyPopulation(cellId: number) {
  const [rural, urban] = getCellPopulation(cellId);
  return `${si(rural + urban)} (${si(rural)} rural, urban ${si(urban)})`;
}

export function getPopulationTip(cellId: number) {
  const [rural, urban] = getCellPopulation(cellId);
  return `Cell population: ${si(rural + urban)}; Rural: ${si(rural)}; Urban: ${si(urban)}`;
}

import {rn} from "./numberUtils";

function getLongitude(x: number, decimals = 2) {
  return rn(window.mapCoordinates.lonW + (x / graphWidth) * window.mapCoordinates.lonT, decimals);
}

function getLatitude(y: number, decimals = 2) {
  return rn(window.mapCoordinates.latN - (y / graphHeight) * window.mapCoordinates.latT, decimals);
}

export function getCoordinates(x: number, y: number, decimals = 2) {
  return [getLongitude(x, decimals), getLatitude(y, decimals)];
}

// convert coordinate to DMS format
export function toDMS(coord: number, type: "lat" | "lon") {
  const degrees = Math.floor(Math.abs(coord));
  const minutesNotTruncated = (Math.abs(coord) - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const cardinal = type === "lat" ? (coord >= 0 ? "N" : "S") : coord >= 0 ? "E" : "W";
  return `${degrees}° ${minutes}′ ${seconds}″ ${cardinal}`;
}

"use strict";
// FMG utils related to units

// conver temperature from °C to other scales
function convertTemperature(temp) {
  switch (temperatureScale.value) {
    case "°C":
      return temp + "°C";
    case "°F":
      return rn((temp * 9) / 5 + 32) + "°F";
    case "K":
      return rn(temp + 273.15) + "K";
    case "°R":
      return rn(((temp + 273.15) * 9) / 5) + "°R";
    case "°De":
      return rn(((100 - temp) * 3) / 2) + "°De";
    case "°N":
      return rn((temp * 33) / 100) + "°N";
    case "°Ré":
      return rn((temp * 4) / 5) + "°Ré";
    case "°Rø":
      return rn((temp * 21) / 40 + 7.5) + "°Rø";
    default:
      return temp + "°C";
  }
}

// corvent number to short string with SI postfix
function si(n) {
  if (n >= 1e9) return rn(n / 1e9, 1) + "B";
  if (n >= 1e8) return rn(n / 1e6) + "M";
  if (n >= 1e6) return rn(n / 1e6, 1) + "M";
  if (n >= 1e4) return rn(n / 1e3) + "K";
  if (n >= 1e3) return rn(n / 1e3, 1) + "K";
  return rn(n);
}

// getInteger number from user input data
function getInteger(value) {
  const metric = value.slice(-1);
  if (metric === "K") return parseInt(value.slice(0, -1) * 1e3);
  if (metric === "M") return parseInt(value.slice(0, -1) * 1e6);
  if (metric === "B") return parseInt(value.slice(0, -1) * 1e9);
  return parseInt(value);
}

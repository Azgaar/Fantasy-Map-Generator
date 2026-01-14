import { rn } from "./numberUtils";

type TemperatureScale = "°C" | "°F" | "K" | "°R" | "°De" | "°N" | "°Ré" | "°Rø";
/**
 * Convert temperature from Celsius to other scales
 * @param {number} temperatureInCelsius - Temperature in Celsius
 * @param {string} targetScale - Target temperature scale
 * @returns {string} - Converted temperature with unit
 */
export const convertTemperature = (temperatureInCelsius: number, targetScale: TemperatureScale = "°C") => {
  const temperatureConversionMap: {[key: string]: (temp: number) => string} = {
    "°C": (temp: number) => rn(temp) + "°C",
    "°F": (temp: number) => rn((temp * 9) / 5 + 32) + "°F",
    K: (temp: number) => rn(temp + 273.15) + "K",
    "°R": (temp: number) => rn(((temp + 273.15) * 9) / 5) + "°R",
    "°De": (temp: number) => rn(((100 - temp) * 3) / 2) + "°De",
    "°N": (temp: number) => rn((temp * 33) / 100) + "°N",
    "°Ré": (temp: number) => rn((temp * 4) / 5) + "°Ré",
    "°Rø": (temp: number) => rn((temp * 21) / 40 + 7.5) + "°Rø"
  };
  return temperatureConversionMap[targetScale](temperatureInCelsius);
}

/**
 * Convert number to short string with SI postfix
 * @param {number} n - The number to convert
 * @returns {string} - The converted string
 */
export const si = (n: number): string => {
  if (n >= 1e9) return rn(n / 1e9, 1) + "B";
  if (n >= 1e8) return rn(n / 1e6) + "M";
  if (n >= 1e6) return rn(n / 1e6, 1) + "M";
  if (n >= 1e4) return rn(n / 1e3) + "K";
  if (n >= 1e3) return rn(n / 1e3, 1) + "K";
  return rn(n).toString();
}

/**
 * Convert string with SI postfix to integer
 * @param {string} value - The string to convert
 * @returns {number} - The converted integer
 */
export const getIntegerFromSI = (value: string): number => {
  const metric = value.slice(-1);
  if (metric === "K") return parseInt(value.slice(0, -1)) * 1e3;
  if (metric === "M") return parseInt(value.slice(0, -1)) * 1e6;
  if (metric === "B") return parseInt(value.slice(0, -1)) * 1e9;
  return parseInt(value);
}

declare global {
  interface Window {
    convertTemperature: typeof convertTemperature;
    si: typeof si;
    getInteger: typeof getIntegerFromSI;
  }
}

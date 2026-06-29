import { ensureEl } from "./nodeUtils";
import { rn } from "./numberUtils";

type TemperatureScale = "°C" | "°F" | "K" | "°R" | "°De" | "°N" | "°Ré" | "°Rø";
/**
 * Convert temperature from Celsius to other scales
 * @param {number} temperatureInCelsius - Temperature in Celsius
 * @param {string} targetScale - Target temperature scale
 * @returns {string} - Converted temperature with unit
 */
export const convertTemperature = (temperatureInCelsius: number, targetScale: TemperatureScale = "°C") => {
  const temperatureConversionMap: { [key: string]: (temp: number) => string } = {
    "°C": (temp: number) => `${rn(temp)}°C`,
    "°F": (temp: number) => `${rn((temp * 9) / 5 + 32)}°F`,
    K: (temp: number) => `${rn(temp + 273.15)}K`,
    "°R": (temp: number) => `${rn(((temp + 273.15) * 9) / 5)}°R`,
    "°De": (temp: number) => `${rn(((100 - temp) * 3) / 2)}°De`,
    "°N": (temp: number) => `${rn((temp * 33) / 100)}°N`,
    "°Ré": (temp: number) => `${rn((temp * 4) / 5)}°Ré`,
    "°Rø": (temp: number) => `${rn((temp * 21) / 40 + 7.5)}°Rø`
  };
  return temperatureConversionMap[targetScale](temperatureInCelsius);
};

/**
 * Convert number to short string with SI postfix
 * @param {number} n - The number to convert
 * @returns {string} - The converted string
 */
export const si = (n: number): string => {
  if (n >= 1e9) return `${rn(n / 1e9, 1)}B`;
  if (n >= 1e8) return `${rn(n / 1e6)}M`;
  if (n >= 1e6) return `${rn(n / 1e6, 1)}M`;
  if (n >= 1e4) return `${rn(n / 1e3)}K`;
  if (n >= 1e3) return `${rn(n / 1e3, 1)}K`;
  return rn(n).toString();
};

/**
 * Convert string with SI postfix to integer
 * @param {string} value - The string to convert
 * @returns {number} - The converted integer
 */
export const getIntegerFromSI = (value: string): number => {
  const metric = value.slice(-1);
  if (metric === "K") return parseInt(value.slice(0, -1), 10) * 1e3;
  if (metric === "M") return parseInt(value.slice(0, -1), 10) * 1e6;
  if (metric === "B") return parseInt(value.slice(0, -1), 10) * 1e9;
  return parseInt(value, 10);
};

/**
 * Convert height value from generator scale to real-world height with unit
 * @param {number} h - The height value from generator, [0, 100] scale
 * @param {boolean} abs - Whether to return absolute height or signed height
 * @returns {string} - The converted height with unit
 */
export function getHeight(h: number, abs = false): string {
  const unit = ensureEl<HTMLSelectElement>("heightUnit").value;
  let unitRatio = 3.281; // default calculations are in feet
  if (unit === "m")
    unitRatio = 1; // if meter
  else if (unit === "f") unitRatio = 0.5468; // if fathom

  let height = -990;
  if (h >= 20) height = (h - 18) ** +heightExponentInput.value;
  else if (h < 20 && h > 0) height = ((h - 20) / h) * 50;

  if (abs) height = Math.abs(height);
  return `${rn(height * unitRatio)}${unit}`;
}

/**
 * Format price value with currency symbol
 * @param value - The price value to format
 * @returns {string} - The formatted price string with money symbol
 */
export function formatPrice(value: number): string {
  return `🟡 ${rn(value, 2)}`;
}

// in °C, array from -1 °C; source: https://en.wikipedia.org/wiki/List_of_city_by_average_temperature
const meanTempCityMap: Record<number, string> = {
  [-5]: "Snag (Yukon)",
  [-4]: "Yellowknife (Canada)",
  [-3]: "Okhotsk (Russia)",
  [-2]: "Fairbanks (Alaska)",
  [-1]: "Nuuk (Greenland)",
  0: "Murmansk (Russia)",
  1: "Arkhangelsk (Russia)",
  2: "Anchorage (Alaska)",
  3: "Tromsø (Norway)",
  4: "Reykjavik (Iceland)",
  5: "Harbin (China)",
  6: "Stockholm (Sweden)",
  7: "Montreal (Canada)",
  8: "Prague (Czechia)",
  9: "Copenhagen (Denmark)",
  10: "London (England)",
  11: "Antwerp (Belgium)",
  12: "Paris (France)",
  13: "Milan (Italy)",
  14: "Washington (D.C.)",
  15: "Rome (Italy)",
  16: "Dubrovnik (Croatia)",
  17: "Lisbon (Portugal)",
  18: "Barcelona (Spain)",
  19: "Marrakesh (Morocco)",
  20: "Alexandria (Egypt)",
  21: "Tegucigalpa (Honduras)",
  22: "Guangzhou (China)",
  23: "Rio de Janeiro (Brazil)",
  24: "Dakar (Senegal)",
  25: "Miami (USA)",
  26: "Jakarta (Indonesia)",
  27: "Mogadishu (Somalia)",
  28: "Bangkok (Thailand)",
  29: "Niamey (Niger)",
  30: "Khartoum (Sudan)"
};

/**
 * Get a real-world city with a similar average yearly temperature
 * @param temperature - Average yearly temperature in °C
 * @returns {string | null} - Name of a city with a similar temperature
 */
export function getTemperatureLikeness(temperature: number): string | null {
  if (temperature < -5) return "Yakutsk (Russia)";
  if (temperature > 30) return "Mecca (Saudi Arabia)";
  return meanTempCityMap[temperature] || null;
}

declare global {
  interface Window {
    convertTemperature: typeof convertTemperature;
    si: typeof si;
    getInteger: typeof getIntegerFromSI;
    getHeight: typeof getHeight;
    formatPrice: typeof formatPrice;
  }
}

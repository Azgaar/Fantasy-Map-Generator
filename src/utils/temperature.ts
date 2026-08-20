export type TemperatureScale = "°C" | "°F" | "K" | "°R" | "°De" | "°N" | "°Ré" | "°Rø";

export function formatTemperature(temperatureInCelsius: number, scale: TemperatureScale): string {
  const conversions: Record<TemperatureScale, (temperature: number) => number> = {
    "°C": temperature => temperature,
    "°F": temperature => (temperature * 9) / 5 + 32,
    K: temperature => temperature + 273.15,
    "°R": temperature => ((temperature + 273.15) * 9) / 5,
    "°De": temperature => ((100 - temperature) * 3) / 2,
    "°N": temperature => (temperature * 33) / 100,
    "°Ré": temperature => (temperature * 4) / 5,
    "°Rø": temperature => (temperature * 21) / 40 + 7.5
  };
  return `${Math.round(conversions[scale](temperatureInCelsius))}${scale}`;
}

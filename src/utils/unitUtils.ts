import {byId} from "./shorthands";
import {rn} from "./numberUtils";

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
  const scale = (byId("temperatureScale") as HTMLInputElement)?.value || "°C";
  const conversionFn = temperatureConversionMap[scale];
  return conversionFn(temp);
}

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

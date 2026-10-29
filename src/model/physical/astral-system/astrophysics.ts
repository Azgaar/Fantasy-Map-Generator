// Ported from VerseEras game/js/world/generators/feral-system/astro/astrophysics.js (2026-10-25).
import type { Rng } from "./rng";
import { clamp, pickWeighted } from "./util";

/** Surface gravity (Earth g) from radius (km) and density (g/cc). */
export function gravity(radius: number, density: number): number {
  return (density / 5.56) * (radius / 6557);
}

/** Black-body temperature (K) given insolation (1.0 = Earth flux from Sol) and albedo. */
export function blackbody(insolation: number, albedo = 0): number {
  return ((1367 * insolation * (1 - albedo)) / (4 * 0.0000000567)) ** 0.25;
}

export interface StarTypeData {
  luminosity: number;
  color: string;
}

export const starTypeData: Record<string, StarTypeData> = {
  O: { luminosity: 50000, color: "rgb(255,192,255)" },
  B: { luminosity: 15000, color: "rgb(192,160,255)" },
  A: { luminosity: 25, color: "rgb(128,192,255)" },
  F: { luminosity: 2.5, color: "rgb(160,255,128)" },
  G: { luminosity: 1, color: "rgb(255,255,64)" },
  K: { luminosity: 0.25, color: "rgb(255,192,64)" },
  M: { luminosity: 0.05, color: "rgb(255,64,0)" }
};

const fixedValue =
  <T>(value: T) =>
  () =>
    value;

const atmosphereData: Record<string, { albedo: number }> = {
  Breathable: { albedo: 0.2 },
  Filterable: { albedo: 0.3 },
  Inert: { albedo: 0.1 },
  Corrosive: { albedo: 0.5 },
  Toxic: { albedo: 0.4 },
  Trace: { albedo: 0.05 },
  Crushing: { albedo: 0.8 }
};

export interface Habitability {
  HI: number;
  description: string;
  g: string;
  albedo: number;
  tempC: string;
  temp: string;
}

/** Habitability index (1 earthlike .. 5 inimical) plus gravity, albedo and temperature readouts. */
export function HI(
  insolation: number,
  radius: number,
  density: number,
  hydrographics: number,
  atmosphere: string
): Habitability {
  const gravityValue = gravity(radius, density);
  const g = gravityValue.toFixed(2);
  const { albedo } = atmosphereData[atmosphere];
  const tempK = blackbody(insolation, albedo + hydrographics * 0.002);
  const tempCValue = tempK - 275.15;
  let temp: string;

  if (tempCValue < -150) temp = "frigid";
  else if (tempCValue < -80) temp = "extremely cold";
  else if (tempCValue < -40) temp = "very cold";
  else if (tempCValue < -10) temp = "cold";
  else if (tempCValue < 30) temp = "temperate";
  else if (tempCValue < 50) temp = "hot";
  else if (tempCValue < 90) temp = "very hot";
  else if (tempCValue < 150) temp = "extremely hot";
  else temp = "inferno";

  const tempC = tempCValue.toFixed(1);

  let data: { HI: number; description: string };
  if (
    atmosphere === "Breathable" &&
    hydrographics > 0 &&
    gravityValue < 1.25 &&
    ["cold", "hot", "temperate"].includes(temp)
  ) {
    data = { HI: 1, description: "earthlike" };
  } else if (
    ["Breathable", "Filterable"].includes(atmosphere) &&
    gravityValue < 2 &&
    !["inferno", "extremely hot", "extremely cold", "frigid"].includes(temp)
  ) {
    data = { HI: 2, description: "survivable" };
  } else if (atmosphere === "Crushing" || gravityValue > 3 || ["inferno", "frigid"].includes(temp)) {
    data = tempCValue > 800 ? { HI: 5, description: "inimical" } : { HI: 4, description: "robot accessible" };
  } else {
    data = { HI: 3, description: "EVA possible" };
  }

  return { ...data, g, albedo, tempC, temp };
}

export interface PlanetTypeData {
  classification: string;
  radius: [number, number];
  density: [number, number];
  hydrographics: (rng: Rng, insolation: number, radius: number, density: number) => number | string;
  atmosphere: (rng: Rng, insolation: number, radius: number, density: number, hydrographics: number) => string;
  HI: typeof HI;
}

export const planetTypeData: PlanetTypeData[] = [
  {
    classification: "rocky",
    radius: [1000, 15000],
    density: [2, 8],
    hydrographics: (rng, insolation, radius, density) => {
      const g = gravity(radius, density);
      const tempK = blackbody(insolation, 0);
      return clamp(rng.range(-50, 150 - Math.abs(tempK - 270)) * g - Math.abs(density - 5.5) * 10, 0, 100).toFixed(0);
    },
    atmosphere: (rng, insolation, _radius, _density, hydrographics) => {
      if (hydrographics > 0 && insolation > 0.25 && insolation < 2) {
        return pickWeighted(
          rng,
          ["Breathable", "Filterable", "Inert", "Toxic", "Corrosive", "Trace"],
          [1, 2, 2, 1, 1, 1]
        );
      }
      return pickWeighted(
        rng,
        ["Breathable", "Filterable", "Inert", "Toxic", "Corrosive", "Trace"],
        [1, 2, 3, 4, 5, 5]
      );
    },
    HI
  },
  {
    classification: "gas giant",
    radius: [15000, 120000],
    density: [0.6, 2.0],
    hydrographics: fixedValue(0),
    atmosphere: fixedValue("Crushing"),
    HI
  },
  {
    classification: "brown dwarf",
    radius: [120000, 250000],
    density: [0.6, 2.0],
    hydrographics: fixedValue(0),
    atmosphere: fixedValue("Crushing"),
    HI
  }
];

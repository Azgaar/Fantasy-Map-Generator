// The generated system readout: the astro port mapped to dialog rows.

import { starClassFor } from "@/generators/astral-naming";
import type { Burg } from "@/generators/burgs-generator";
import { starTypeData } from "./astrophysics";
import { generateSystem } from "./system";

export interface StarRow {
  role: string;
  spectral: string;
  luminosityClass: string | null;
  massSolar: number;
  luminositySolar: number;
  color: string;
  separationAU: number | null;
  periodYears: number | null;
  massRatio: number | null;
}

export interface PlanetRow {
  name: string;
  type: string;
  orbitAU: number;
  radiusEarth: number;
  gravity: string;
  temperature: string;
  temperatureC: string;
  atmosphere: string;
  water: number;
  habitability: string;
  hi: number;
  moons: string[];
  color: string;
  periodDays: number;
}

export interface SystemDetails {
  stars: StarRow[];
  totalMassSolar: number;
  snowLineAU: number;
  planetCount: number;
  habitableCandidate: boolean;
  planets: PlanetRow[];
}

export interface SystemDetailsInput {
  seed: string;
  systemName: string;
  spectral: string;
}

const ROMAN_TABLE: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"]
];

function toRoman(value: number): string {
  let remainder = value;
  let result = "";
  for (const [number, symbol] of ROMAN_TABLE) {
    while (remainder >= number) {
      result += symbol;
      remainder -= number;
    }
  }
  return result;
}

function toLetter(index: number): string {
  return String.fromCharCode(97 + (index % 26));
}

/** Generate and map one system, a pure function of its inputs. */
export function generateSystemDetails({ seed, systemName, spectral }: SystemDetailsInput): SystemDetails {
  const primaryType = starTypeData[spectral] ? spectral : "G";
  const system = generateSystem(seed, { primaryType });
  const { star } = system;
  const name = systemName.trim() || "System";

  const stars: StarRow[] = [
    {
      role: "Primary",
      spectral: star.primary.spectral,
      luminosityClass: star.primary.lumClass,
      massSolar: star.primary.mass,
      luminositySolar: star.primary.luminosity,
      color: starTypeData[star.primary.spectral]?.color ?? "rgb(255,255,255)",
      separationAU: null,
      periodYears: null,
      massRatio: null
    },
    ...star.companions.map((companion, index) => ({
      role: index === 0 ? "Secondary" : `Companion ${index + 2}`,
      spectral: companion.spectral,
      luminosityClass: null,
      massSolar: companion.mass,
      luminositySolar: starTypeData[companion.spectral]?.luminosity ?? 0,
      color: starTypeData[companion.spectral]?.color ?? "rgb(255,255,255)",
      separationAU: companion.separationAU,
      periodYears: companion.periodYears,
      massRatio: companion.massRatio
    }))
  ];

  const planets: PlanetRow[] = system.planets.map((planet, index) => {
    const planetName = `${name} ${toRoman(index + 1)}`;
    return {
      name: planetName,
      type: planet.subtype ?? planet.type,
      orbitAU: planet.orbit,
      radiusEarth: planet.radius / 6371,
      gravity: planet.g,
      temperature: planet.temp,
      temperatureC: planet.tempC,
      atmosphere: planet.atmosphere,
      water: planet.hydrographics,
      habitability: planet.description,
      hi: planet.HI,
      moons: planet.moons.map((_, moonIndex) => `${planetName} ${toLetter(moonIndex)}`),
      color: Array.isArray(planet.color) ? planet.color[0] : planet.color,
      periodDays: planet.periodDays ?? 0
    };
  });

  return {
    stars,
    totalMassSolar: star.totalMass,
    snowLineAU: 2.7 * Math.sqrt(star.luminosity),
    planetCount: system.planets.length,
    habitableCandidate: star.isHabitableCandidate,
    planets
  };
}

/** The readout for one burg, seeded by the map and the burg id. */
export function systemDetailsFor(burg: Pick<Burg, "i" | "name" | "population">): SystemDetails {
  const { class: spectral } = starClassFor(burg);
  return generateSystemDetails({
    seed: `${options.map.seed}/astral/system/${burg.i}`,
    systemName: burg.name ?? "",
    spectral
  });
}

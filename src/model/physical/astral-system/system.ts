// Ported from VerseEras game/js/world/generators/feral-system/astro/system.js (2026-10-25).
import { layoutPosition } from "./layout";
import { generatePlanet, type Planet } from "./planet";
import { createRng } from "./rng";
import { type GenerateStarOptions, generateStar, type StarSummary } from "./stars";
import { rollDice } from "./util";

export interface PlanetarySummary {
  type: string;
  aAU: number;
  radiusRE: number;
}

export interface System {
  seed: string;
  star: StarSummary;
  planets: Planet[];
  HI: (number | number[])[][];
}

export interface GenerateSystemOptions {
  forceHabitable?: boolean;
  primaryType?: string;
}

interface DiceRate {
  count: number;
  sides: number;
  add?: number;
}

interface TypeRates {
  small: DiceRate | null;
  giant: DiceRate | null;
}

/** Generate a full star system: primary (+ companions), planets, and moons. */
export function generateSystem(seed: string, opts: GenerateSystemOptions = {}): System {
  // The readout's chart owns the primary's class: force a main-sequence reading.
  const starOptions: GenerateStarOptions = {
    forceHabitable: !!opts.forceHabitable,
    forcedLumClass: "V"
  };
  if (opts.primaryType) starOptions.forcedType = opts.primaryType;

  const star = generateStar(createRng(`${seed}/star`), starOptions);

  const HI: (number | number[])[][] = [[], [], [], [], []];
  const basePlanetData = generateSystemPlanets(seed, star);

  const planets = basePlanetData.map((summary, i) => {
    const planet = generatePlanet(
      { seed, star },
      {
        i,
        classification: summary.type === "gas giant" ? "gas giant" : "rocky",
        orbit: summary.aAU,
        radius: (summary.radiusRE * 6371) / 1000
      }
    );

    planet.subtype = summary.type;

    // Kepler's 3rd law: P^2 = a^3 / M_total.
    const periodYears = Math.sqrt(planet.orbit ** 3 / Math.max(star.totalMass, 1e-6));
    planet.periodDays = +(periodYears * 365.25).toFixed(1);

    HI[planet.HI - 1].push(i);
    planet.moonHI.forEach((indices, hi) => {
      for (const moonIndex of indices) HI[hi].push([i, moonIndex]);
    });

    return planet;
  });

  // Layout: primary (au 0), companions, then planets sorted by orbit.
  let index = 0;
  star.primary.pos = layoutPosition(0, index);
  index += 1;

  star.companions.forEach(companion => {
    companion.pos = layoutPosition(companion.separationAU, index);
    index += 1;
  });

  planets
    .slice()
    .sort((a, b) => a.orbit - b.orbit)
    .forEach(planet => {
      planet.pos = layoutPosition(planet.orbit, index);
      index += 1;
    });

  return { seed, star, planets, HI };
}

/** Decide how many planets a system has, and their rough type/orbit/radius. */
export function generateSystemPlanets(seed: string, star: StarSummary): PlanetarySummary[] {
  const primaryType = star.primary.spectral;
  const companionSepAU = star.multiplicity === 1 ? null : star.companions[0].separationAU;
  const orbits = star.orbits;

  const rand = createRng(`${seed}/planets`);
  const type = (primaryType || "G").toUpperCase().charAt(0);

  const baseRates: Record<string, TypeRates> = {
    M: { small: { count: 2, sides: 4 }, giant: { count: 1, sides: 3, add: -2 } },
    K: { small: { count: 2, sides: 3 }, giant: { count: 1, sides: 2 } },
    G: { small: { count: 1, sides: 4, add: 1 }, giant: { count: 1, sides: 3 } },
    F: { small: { count: 1, sides: 3, add: -1 }, giant: { count: 1, sides: 4 } },
    A: { small: { count: 1, sides: 3, add: -1 }, giant: { count: 1, sides: 4 } },
    B: { small: null, giant: { count: 1, sides: 3, add: -1 } },
    O: { small: null, giant: { count: 1, sides: 3, add: -1 } }
  };

  const rates = baseRates[type] || baseRates.G;

  let suppression = 1.0;
  if (companionSepAU != null && companionSepAU > 0) {
    if (companionSepAU < 10) suppression = 0.08;
    else if (companionSepAU < 50) suppression = 0.25;
    else if (companionSepAU < 100) suppression = 0.42;
    else if (companionSepAU < 500) suppression = 0.7;
    else if (companionSepAU < 1500) suppression = 0.88;
  }

  let smallRate = (rates.small ? rollDice(rand, rates.small) : 0) * suppression;
  let giantRate = (rates.giant ? rollDice(rand, rates.giant) : 0) * suppression;

  const maxPlanets = 10;
  const planets: PlanetarySummary[] = [];

  while (smallRate > 0 && planets.length < maxPlanets) {
    const wiggle = rand.range(0.85, 1);
    const aAU = wiggle * orbits[planets.length];
    let radiusRE = 0.6 + rand.next() * 2.4;
    if (rand.chance(0.18)) radiusRE = 2.8 + rand.next() * 2.5;
    planets.push({
      type: radiusRE < 1.6 ? "rocky" : radiusRE < 3.5 ? "super-Earth/sub-Neptune" : "Neptune-like",
      aAU: +aAU.toFixed(3),
      radiusRE: +radiusRE.toFixed(2)
    });
    smallRate -= 1;
  }

  while (giantRate > 0 && planets.length < maxPlanets) {
    const wiggle = rand.range(0.85, 1);
    const aAU = wiggle * orbits[planets.length];
    let radiusRE = 8 + rand.next() * 6;
    if (aAU < 1 && rand.chance(0.4)) radiusRE += 2 + rand.next() * 4;
    planets.push({
      type: "gas giant",
      aAU: +aAU.toFixed(3),
      radiusRE: +radiusRE.toFixed(1)
    });
    giantRate -= 1;
  }

  return planets;
}

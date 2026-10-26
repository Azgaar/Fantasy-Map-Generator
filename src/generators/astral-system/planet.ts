// Ported from VerseEras game/js/world/generators/feral-system/astro/planet.js (2026-10-25).
import type { Habitability } from "./astrophysics";
import { planetTypeData } from "./astrophysics";
import { type LayoutPosition, layoutPosition } from "./layout";
import { GasGiantColors, RockyColors } from "./palette";
import { createRng } from "./rng";
import { pickWeighted, rollDice } from "./util";

export interface PlanetParent {
  seed: string;
  orbits?: number[];
  star?: { luminosity: number };
}

export interface Planetoid {
  parentSeed: string | null;
  seed: string;
  i: number;
  orbit: number;
  eccentricity: number;
  minorAxis: number;
  insolation: number;
  rmin: number;
  rmax: number;
}

export interface Moon extends Planetoid, Habitability {
  kind: "moon";
  type: string;
  color: string;
  radius: number;
  density: number;
  hydrographics: number;
  atmosphere: string;
  pos: LayoutPosition;
}

export interface Planet extends Planetoid, Habitability {
  kind: "planet";
  type: string;
  radius: number;
  density: number;
  hydrographics: number;
  atmosphere: string;
  color: string | string[];
  orbits: number[];
  moons: Moon[];
  moonHI: number[][];
  periodDays?: number;
  /** the astro pre-classification rolled before generatePlanet's coarse class */
  subtype?: string;
  pos?: LayoutPosition;
}

export interface PlanetOptions {
  i: number;
  classification?: string;
  orbit?: number;
  radius?: number;
  density?: number;
  moons?: number | MoonOptions[];
  insolation?: number;
}

export interface MoonOptions extends PlanetOptions {
  isMinor?: boolean;
}

interface PlanetoidOptions {
  orbit?: number;
  insolation?: number;
}

interface MoonParent {
  seed: string;
  orbits: number[];
  insolation: number;
  type: string;
}

/** Shared orbital/physical base for a planet or moon. */
function generatePlanetoid(parent: PlanetParent, i: number, opts: PlanetoidOptions = {}): Planetoid {
  const parentSeed = parent.seed;
  const seed = parentSeed != null ? `${parentSeed}/${i}` : `${i}`;
  const rng = createRng(seed);

  const orbit = opts.orbit != null ? opts.orbit : (parent.orbits as number[])[i];
  const eBand = pickWeighted(rng, ["200.800", "5.200"], [1, 3]).split(".").map(Number);
  const eccentricity = rng.range(eBand[0], eBand[1]) / 1000;
  const minorAxis = Math.sqrt(orbit * orbit * (1 - eccentricity * eccentricity));

  return {
    parentSeed,
    seed,
    i,
    orbit,
    eccentricity,
    minorAxis,
    insolation:
      opts.insolation != null
        ? opts.insolation
        : (parent.star as { luminosity: number }).luminosity / Math.max(orbit, 1e-6) ** 2,
    rmin: (0.4 * rng.range(5, 20)) / 10,
    rmax: (50 * rng.range(5, 20)) / 10
  };
}

function generateMoon(parent: MoonParent, opts: MoonOptions): Moon {
  const { i, isMinor } = opts;
  const base = generatePlanetoid(parent, i, opts);

  // A second, independently-drawn stream off the same seed, separate from the orbital mechanics.
  const rng = createRng(base.seed);

  const template = planetTypeData[0]; // rocky — moons are never gas giants here
  const type = template.classification;
  const color = rng.choice(RockyColors).hex;

  const rBase =
    parent.type === "rocky" || isMinor ? rng.range(50, 2500) : rng.range(template.radius[0], template.radius[1]);
  const radius = opts.radius != null ? opts.radius * 1000 : rBase;
  const density = opts.density != null ? opts.density : rng.range(template.density[0], template.density[1]);
  const hydrographics = Number(template.hydrographics(rng, parent.insolation, radius, density));
  const atmosphere = template.atmosphere(rng, parent.insolation, radius, density, hydrographics);
  const habitability = template.HI(parent.insolation, radius, density, hydrographics, atmosphere);

  return {
    ...base,
    ...habitability,
    kind: "moon",
    type,
    color,
    radius,
    density,
    hydrographics,
    atmosphere,
    pos: layoutPosition(base.orbit, i)
  };
}

/** Generate a planet and its moons around `parent` (a system). */
export function generatePlanet(parent: PlanetParent, opts: PlanetOptions): Planet {
  const base = generatePlanetoid(parent, opts.i, opts);
  const rng = createRng(base.seed);

  const typeIds = planetTypeData.map(data => data.classification);
  let template = pickWeighted(rng, planetTypeData, [base.insolation * 100, 10, 1]);
  template = opts.classification ? planetTypeData[typeIds.indexOf(opts.classification)] : template;
  const type = template.classification;

  const radius = opts.radius != null ? opts.radius * 1000 : rng.range(template.radius[0], template.radius[1]);
  const density = opts.density != null ? opts.density : rng.range(template.density[0], template.density[1]);
  const hydrographics = Number(template.hydrographics(rng, base.insolation, radius, density));
  const atmosphere = template.atmosphere(rng, base.insolation, radius, density, hydrographics);
  const habitability = template.HI(base.insolation, radius, density, hydrographics, atmosphere);

  const color =
    type === "gas giant"
      ? [rng.choice(GasGiantColors).hex, rng.choice(GasGiantColors).hex]
      : type === "rocky"
        ? [rng.choice(RockyColors).hex]
        : "brown";

  let nMajor = type === "rocky" ? rng.choice([0, 0, 1, 2]) : 1 + rng.d(4);
  let nMinor = type === "rocky" ? rng.choice([0, 0, 1, 2]) : rollDice(rng, { count: 2, sides: 6 });
  let mods: MoonOptions[] = [];
  if (opts.moons != null) {
    const total = Array.isArray(opts.moons) ? opts.moons.length : opts.moons;
    mods = Array.isArray(opts.moons) ? opts.moons : [];
    nMajor = Math.min(nMajor, total);
    nMinor = total - nMajor;
  }
  const nm = nMajor + nMinor;

  // Guard the divisor so a moonless planet cannot produce NaN orbits.
  const moonWeight = nm > 0 ? (nm ** 2 + nm) * 0.5 : 1;
  let io = base.rmin;
  const moonOrbits = Array.from({ length: nm }, (_, index) => {
    const rvar = rng.range(0.5, 1);
    io += (index / moonWeight) * rvar * (base.rmax - base.rmin);
    return io;
  });

  const moonParent: MoonParent = { seed: base.seed, orbits: moonOrbits, insolation: base.insolation, type };
  const moonHI: number[][] = [[], [], [], [], []];
  const moons: Moon[] = [];

  for (let j = 0; j < nm; j += 1) {
    const moonOptions = Object.assign({ i: j, insolation: base.insolation, isMinor: !(j < nMajor) }, mods[j] ?? {});
    const moon = generateMoon(moonParent, moonOptions);

    moonHI[moon.HI - 1].push(j);
    moons.push(moon);
  }

  return {
    ...base,
    ...habitability,
    kind: "planet",
    type,
    radius,
    density,
    hydrographics,
    atmosphere,
    color,
    orbits: moonOrbits,
    moons,
    moonHI
  };
}

// Ported from VerseEras game/js/world/generators/feral-system/astro/stars.js (2026-10-25).
import { starTypeData } from "./astrophysics";
import type { LayoutPosition } from "./layout";
import type { Rng } from "./rng";
import { pickWeighted } from "./util";

/** Generalized Titius-Bode distances (AU) for a given total system mass. */
function calculateBodeDistancesForMass(stellarMassSolar: number, maxIndex = 15): number[] {
  const distances: number[] = [];
  const massScale = stellarMassSolar ** (1 / 3);

  for (let m = -2; m <= maxIndex; m += 1) {
    const term = m === -2 ? 0 : 2 ** m;
    const aM = (0.4 + 0.3 * term) * massScale;
    distances.push(Number(aM.toFixed(3)));
  }

  return distances;
}

/** Approximate main-sequence mass (M☉) from spectral type. */
function spectralToMass(rng: Rng, type: string): number {
  // Every entry is drawn, as in the source, so the stream stays aligned.
  const map: Record<string, number> = {
    O: 20 + rng.next() * 20,
    B: 3 + rng.next() * 12,
    A: 1.6 + rng.next() * 0.8,
    F: 1.1 + rng.next() * 0.4,
    G: 0.85 + rng.next() * 0.25,
    K: 0.5 + rng.next() * 0.3,
    M: 0.1 + rng.next() * 0.4
  };
  return map[type] || 0.5;
}

/** Rough spectral type from mass. */
function massToSpectral(mass: number): string {
  if (mass >= 16) return "O";
  if (mass >= 2.5) return "B";
  if (mass >= 1.5) return "A";
  if (mass >= 1.05) return "F";
  if (mass >= 0.8) return "G";
  if (mass >= 0.45) return "K";
  return "M";
}

/** Sample orbital period (years) — approximate log-normal. */
function samplePeriodYears(rng: Rng, primaryMass: number): number {
  const mu = 2.0 + 0.3 * Math.min(primaryMass, 1.5);
  const sigma = 1.6;
  let logP = mu + (rng.next() + rng.next() + rng.next() + rng.next() - 2) * sigma;
  logP = Math.max(-1.5, Math.min(6.5, logP));
  return 10 ** logP;
}

/** Kepler's 3rd law: a^3 / P^2 = M_tot (a in AU, P in years, M in M☉). */
function periodToSeparation(periodYears: number, totalMass: number): number {
  return (periodYears * periodYears * totalMass) ** (1 / 3);
}

/** Sample mass ratio q = M2/M1, with a mild twin preference for close pairs. */
function sampleMassRatio(rng: Rng, isClose = false): number {
  let q = rng.next();
  if (isClose && rng.chance(0.25)) {
    q = 0.7 + rng.next() * 0.3;
  }
  return Math.max(0.08, Math.min(0.98, q));
}

export interface StarBody {
  kind: "star";
  role: string;
  spectral: string;
  mass: number;
  pos?: LayoutPosition;
}

export interface PrimaryStar extends StarBody {
  luminosity: number;
  lumClass: string;
}

export interface CompanionStar extends StarBody {
  separationAU: number;
  periodYears: number;
  massRatio: number;
}

export interface StarSummary {
  primary: PrimaryStar;
  luminosity: number;
  companions: CompanionStar[];
  multiplicity: number;
  isHabitableCandidate: boolean;
  totalMass: number;
  orbits: number[];
}

export interface GenerateStarOptions {
  forceHabitable?: boolean;
  forcedType?: string;
  /** Overrides the rolled luminosity class while still consuming the source roll. */
  forcedLumClass?: string;
}

/** The astro spectral table: type, roll weight, and how much the class leans toward companions. */
export const SPECTRAL_TABLE = [
  { type: "O", weight: 0.00003, multBias: 0.95 },
  { type: "B", weight: 0.0013, multBias: 0.88 },
  { type: "A", weight: 0.006, multBias: 0.7 },
  { type: "F", weight: 0.03, multBias: 0.55 },
  { type: "G", weight: 0.076, multBias: 0.5 },
  { type: "K", weight: 0.12, multBias: 0.4 },
  { type: "M", weight: 0.766, multBias: 0.28 }
];

/** Generate a star system's primary and any companions. */
export function generateStar(rng: Rng, options: GenerateStarOptions = {}): StarSummary {
  let primaryType: string;
  if (options.forcedType) {
    primaryType = options.forcedType;
  } else if (options.forceHabitable) {
    primaryType = pickWeighted(rng, ["F", "G", "K"], [25, 45, 30]);
  } else {
    primaryType = pickWeighted(
      rng,
      SPECTRAL_TABLE.map(star => star.type),
      SPECTRAL_TABLE.map(star => star.weight)
    );
  }

  const primaryMass = spectralToMass(rng, primaryType);
  const luminosity = (starTypeData[primaryType] ?? starTypeData.G).luminosity;
  const rolledLumClass = rng.chance(0.92) ? "V" : rng.chance(0.65) ? "III" : "IV";
  const primary: PrimaryStar = {
    kind: "star",
    role: "primary",
    spectral: primaryType,
    luminosity,
    lumClass: options.forcedLumClass ?? rolledLumClass,
    mass: +primaryMass.toFixed(3)
  };

  const bias = SPECTRAL_TABLE.find(star => star.type === primaryType)?.multBias ?? 0.3;
  const roll = rng.next();
  let multiplicity = 1;
  if (roll < bias * 0.55) multiplicity = 2;
  else if (roll < bias * 0.72) multiplicity = 3;
  else if (roll < bias * 0.82) multiplicity = 4;

  const companions: CompanionStar[] = [];
  let currentPrimaryMass = primaryMass;
  let binaryMass = primaryMass;

  for (let i = 1; i < multiplicity; i += 1) {
    const isOuter = i > 1;
    const period = samplePeriodYears(rng, primaryMass) * (isOuter ? 8 + rng.next() * 40 : 1);
    const q = sampleMassRatio(rng, period < 30);
    const compMass = currentPrimaryMass * q;
    const totalMass = currentPrimaryMass + compMass;
    const separationAU = periodToSeparation(period, totalMass);

    companions.push({
      kind: "star",
      role: i === 1 ? "secondary" : `companion${i}`,
      spectral: massToSpectral(compMass),
      mass: +compMass.toFixed(3),
      separationAU: +separationAU.toFixed(2),
      periodYears: +period.toFixed(1),
      massRatio: +q.toFixed(3)
    });

    if (i === 1) {
      binaryMass = currentPrimaryMass = totalMass;
    }
  }

  const isHabitableCandidate =
    !!options.forceHabitable ||
    (["F", "G", "K"].includes(primaryType) && primary.lumClass === "V" && multiplicity === 1 && rng.chance(0.18));

  const totalMass = +(primary.mass + companions.reduce((sum, star) => sum + star.mass, 0)).toFixed(3);
  const orbits = calculateBodeDistancesForMass(multiplicity > 2 ? binaryMass : totalMass);

  return {
    primary,
    luminosity,
    companions,
    multiplicity,
    isHabitableCandidate,
    totalMass,
    orbits
  };
}

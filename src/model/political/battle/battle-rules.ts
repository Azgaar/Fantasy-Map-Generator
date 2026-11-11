import Alea from "alea";

export type Side = "attackers" | "defenders";
export type BattleType = "field" | "naval" | "siege" | "ambush" | "landing" | "air";
export type Stance = "hold" | "shoot" | "advance" | "flee";

export const SIDES: Side[] = ["attackers", "defenders"];
export const BATTLE_TYPES: BattleType[] = ["field", "naval", "siege", "ambush", "landing", "air"];
export const enemyOf = (side: Side): Side => (side === "attackers" ? "defenders" : "attackers");

export interface BattleRandom {
  next: () => number;
  rand: (min: number, max: number) => number;
  P: (probability: number) => boolean;
  Pint: (float: number) => number;
}

/** A generator of its own, so a battle replays from its seed and leaves the map seed alone */
export function createRandom(seed: string): BattleRandom {
  const next = Alea(seed);
  const P = (probability: number): boolean => {
    if (probability >= 1) return true;
    if (probability <= 0) return false;
    return next() < probability;
  };
  return {
    next,
    P,
    rand: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    Pint: float => ~~float + +P(float % 1)
  };
}

/** Phases a side can be in, the first one is where it starts */
export const PHASES: Record<BattleType, Record<Side, string[]>> = {
  field: {
    attackers: ["skirmish", "melee", "pursue", "retreat"],
    defenders: ["skirmish", "melee", "pursue", "retreat"]
  },
  naval: {
    attackers: ["shelling", "boarding", "chase", "withdrawal"],
    defenders: ["shelling", "boarding", "chase", "withdrawal"]
  },
  siege: {
    attackers: ["blockade", "bombardment", "storming", "looting", "retreat"],
    defenders: ["sheltering", "sortie", "bombardment", "defense", "surrendering", "pursue"]
  },
  ambush: {
    attackers: ["shock", "melee", "pursue", "retreat"],
    defenders: ["surprise", "melee", "pursue", "retreat"]
  },
  landing: {
    attackers: ["landing", "melee", "pursue", "flee"],
    defenders: ["defense", "shock", "melee", "waiting", "pursue", "retreat"]
  },
  air: {
    attackers: ["maneuvering", "dogfight", "pursue", "retreat"],
    defenders: ["maneuvering", "dogfight", "pursue", "retreat"]
  }
};

/** How strong a unit type is in a phase; levies and unknown types fight as melee */
export const PHASE_POWER: Record<string, Record<string, number>> = {
  // field
  skirmish: {
    melee: 0.2,
    ranged: 2.4,
    mounted: 0.1,
    machinery: 3,
    naval: 1,
    armored: 0.2,
    aviation: 1.8,
    magical: 1.8
  },
  melee: { melee: 2, ranged: 1.2, mounted: 1.5, machinery: 0.5, naval: 0.2, armored: 2, aviation: 0.8, magical: 0.8 },
  pursue: { melee: 1, ranged: 1, mounted: 4, machinery: 0.05, naval: 1, armored: 1, aviation: 1.5, magical: 0.6 },
  retreat: {
    melee: 0.1,
    ranged: 0.01,
    mounted: 0.5,
    machinery: 0.01,
    naval: 0.2,
    armored: 0.1,
    aviation: 0.8,
    magical: 0.05
  },

  // naval
  shelling: { melee: 0, ranged: 0.2, mounted: 0, machinery: 2, naval: 2, armored: 0, aviation: 0.1, magical: 0.5 },
  boarding: { melee: 1, ranged: 0.5, mounted: 0.5, machinery: 0, naval: 0.5, armored: 0.4, aviation: 0, magical: 0.2 },
  chase: { melee: 0, ranged: 0.15, mounted: 0, machinery: 1, naval: 1, armored: 0, aviation: 0.15, magical: 0.5 },
  withdrawal: {
    melee: 0,
    ranged: 0.02,
    mounted: 0,
    machinery: 0.5,
    naval: 0.1,
    armored: 0,
    aviation: 0.1,
    magical: 0.3
  },

  // siege
  blockade: {
    melee: 0.25,
    ranged: 0.25,
    mounted: 0.2,
    machinery: 0.5,
    naval: 0.2,
    armored: 0.1,
    aviation: 0.25,
    magical: 0.25
  },
  sheltering: {
    melee: 0.3,
    ranged: 0.5,
    mounted: 0.2,
    machinery: 0.5,
    naval: 0.2,
    armored: 0.1,
    aviation: 0.25,
    magical: 0.25
  },
  sortie: { melee: 2, ranged: 0.5, mounted: 1.2, machinery: 0.2, naval: 0.1, armored: 0.5, aviation: 1, magical: 1 },
  bombardment: { melee: 0.2, ranged: 0.5, mounted: 0.2, machinery: 3, naval: 1, armored: 0.5, aviation: 1, magical: 1 },
  storming: {
    melee: 1,
    ranged: 0.6,
    mounted: 0.5,
    machinery: 1,
    naval: 0.1,
    armored: 0.1,
    aviation: 0.5,
    magical: 0.5
  },
  defense: { melee: 2, ranged: 3, mounted: 1, machinery: 1, naval: 0.1, armored: 1, aviation: 0.5, magical: 1 },
  looting: {
    melee: 1.6,
    ranged: 1.6,
    mounted: 0.5,
    machinery: 0.2,
    naval: 0.02,
    armored: 0.2,
    aviation: 0.1,
    magical: 0.3
  },
  surrendering: {
    melee: 0.1,
    ranged: 0.1,
    mounted: 0.05,
    machinery: 0.01,
    naval: 0.01,
    armored: 0.02,
    aviation: 0.01,
    magical: 0.03
  },

  // ambush
  surprise: { melee: 2, ranged: 2.4, mounted: 1, machinery: 1, naval: 1, armored: 1, aviation: 0.8, magical: 1.2 },
  shock: {
    melee: 0.5,
    ranged: 0.5,
    mounted: 0.5,
    machinery: 0.4,
    naval: 0.3,
    armored: 0.1,
    aviation: 0.4,
    magical: 0.5
  },

  // landing
  landing: {
    melee: 0.8,
    ranged: 0.6,
    mounted: 0.6,
    machinery: 0.5,
    naval: 0.5,
    armored: 0.5,
    aviation: 0.5,
    magical: 0.6
  },
  flee: {
    melee: 0.1,
    ranged: 0.01,
    mounted: 0.5,
    machinery: 0.01,
    naval: 0.5,
    armored: 0.1,
    aviation: 0.2,
    magical: 0.05
  },
  waiting: {
    melee: 0.05,
    ranged: 0.5,
    mounted: 0.05,
    machinery: 0.5,
    naval: 2,
    armored: 0.05,
    aviation: 0.5,
    magical: 0.5
  },

  // air
  maneuvering: { melee: 0, ranged: 0.1, mounted: 0, machinery: 0.2, naval: 0, armored: 0, aviation: 1, magical: 0.2 },
  dogfight: { melee: 0, ranged: 0.1, mounted: 0, machinery: 0.1, naval: 0, armored: 0, aviation: 2, magical: 0.1 }
};

/** Share of troops lost in a round of the phase, at most */
export const PHASE_CASUALTY_RATE: Record<string, number> = {
  skirmish: 0.1,
  melee: 0.2,
  pursue: 0.3,
  retreat: 0.3,
  boarding: 0.2,
  shelling: 0.1,
  chase: 0.03,
  withdrawal: 0.03,
  blockade: 0,
  sheltering: 0,
  sortie: 0.1,
  bombardment: 0.05,
  storming: 0.2,
  defense: 0.2,
  looting: 0.5,
  surrendering: 0.5,
  surprise: 0.3,
  shock: 0.3,
  landing: 0.3,
  flee: 0,
  waiting: 0,
  maneuvering: 0.1,
  dogfight: 0.2
};

/** What troops do on the battlefield in a phase */
const PHASE_STANCE: Record<string, Stance> = {
  skirmish: "shoot",
  shelling: "shoot",
  bombardment: "shoot",
  maneuvering: "shoot",
  blockade: "hold",
  sheltering: "hold",
  defense: "hold",
  shock: "hold",
  waiting: "hold",
  surrendering: "hold",
  retreat: "flee",
  withdrawal: "flee",
  flee: "flee"
};

export const getStance = (phase: string): Stance => PHASE_STANCE[phase] ?? "advance";

export const getPhasePower = (phase: string, unitType: string): number => {
  const scheme = PHASE_POWER[phase] ?? PHASE_POWER.melee;
  return scheme[unitType] ?? scheme.melee;
};

export interface PhaseInput {
  type: BattleType;
  round: number;
  previous: [string | undefined, string | undefined]; // attackers, defenders
  morale: [number, number];
  powerRatio: number; // attackers to defenders
  casualties: [number, number]; // share of the initial troops lost
  rangedShare: number; // ranged troops among all on the field
  machinery: [number, number]; // machinery troops
}

/** Phases of both sides for the next round */
export function selectPhases(input: PhaseInput, random: BattleRandom): [string, string] {
  const { P } = random;
  const { round: i, morale, powerRatio, casualties, machinery } = input;
  const [prevA, prevD] = input.previous;

  // a side that turned to run does not come back
  const broken = (): [string, string] | null =>
    prevA === "retreat" ? ["retreat", "pursue"] : prevD === "retreat" ? ["pursue", "retreat"] : null;

  // a side with morale below 25 may turn to run, the more shaken one first
  const breaks = (): [string, string] | null => {
    const attackersFirst = morale[0] <= morale[1];
    for (const attackers of [attackersFirst, !attackersFirst]) {
      if (P(1 - morale[attackers ? 0 : 1] / 25)) return attackers ? ["retreat", "pursue"] : ["pursue", "retreat"];
    }
    return null;
  };

  const field = (): [string, string] => {
    const run = breaks();
    if (run) return run;
    const skirmishing = (prevA || "skirmish") === "skirmish" && (prevD || "skirmish") === "skirmish";
    if (skirmishing && (P(input.rangedShare) || P(0.8 - i / 10))) return ["skirmish", "skirmish"];
    return ["melee", "melee"];
  };

  const naval = (): [string, string] => {
    const prev = prevA || "shelling";
    if (prev === "withdrawal") return ["withdrawal", "chase"];
    if (prev === "chase") return ["chase", "withdrawal"];
    if (prev !== "boarding") {
      if (powerRatio < 0.5 || (P(casualties[0]) && powerRatio < 1)) return ["withdrawal", "chase"];
      if (powerRatio > 2 || (P(casualties[1]) && powerRatio > 1)) return ["chase", "withdrawal"];
    }
    if (prev === "boarding" || P(i / 10 - 0.1)) return ["boarding", "boarding"];
    return ["shelling", "shelling"];
  };

  const siege = (): [string, string] => {
    const prev: [string, string] = [prevA || "blockade", prevD || "sheltering"];
    const phase: [string, string] = ["blockade", "sheltering"];
    if (prev[0] === "retreat" || prev[0] === "looting") return prev;

    if (P(1 - morale[0] / 30) && powerRatio < 1) return ["retreat", "pursue"];
    if (P(1 - morale[1] / 15)) return ["looting", "surrendering"];
    if (P((powerRatio - 1) / 2)) return ["storming", "defense"];

    if (prev[0] !== "storming") {
      if (i && machinery[0] && P(0.9)) phase[0] = "bombardment";
      if (machinery[1] && P(0.9)) phase[1] = "bombardment";
      if (i && prev[1] !== "sortie" && machinery[1] < machinery[0] && P(0.25) && P(morale[1] / 70)) phase[1] = "sortie";
    }
    return phase;
  };

  const ambush = (): [string, string] => {
    if ((prevD || "surprise") === "surprise" && P(1 - (powerRatio * i) / 5)) return ["shock", "surprise"];
    const run = breaks();
    if (run) return run;
    return ["melee", "melee"];
  };

  const landing = (): [string, string] => {
    const prev = [prevA || "landing", prevD || "defense"];
    if (prev[1] === "waiting") return ["flee", "waiting"];
    if (prev[1] === "pursue") return ["flee", P(0.3) ? "pursue" : "waiting"];
    if (prev[1] === "retreat") return ["pursue", "retreat"];

    if (prev[0] === "landing") {
      const attackers = P(i / 2) ? "melee" : "landing";
      const defenders = i ? prev[1] : P(0.5) ? "defense" : "shock";
      return [attackers, defenders];
    }

    if (P(1 - morale[0] / 40)) return ["flee", "pursue"];
    if (P(1 - morale[1] / 25)) return ["pursue", "retreat"];
    return ["melee", "melee"];
  };

  const air = (): [string, string] => {
    const run = breaks();
    if (run) return run;
    if ((prevA || "maneuvering") === "maneuvering" && P(1 - i / 10)) return ["maneuvering", "maneuvering"];
    return ["dogfight", "dogfight"];
  };

  if (input.type === "field" || input.type === "ambush" || input.type === "air")
    return broken() ?? { field, ambush, air }[input.type]();
  return { naval, siege, landing }[input.type]();
}

/** Morale a side starts with: outmatched, far from base or badly ruled troops lose heart */
export function getInitialMorale(powerRatio: number, stability: number, distances: number[]): number {
  const powerFee = minmax(100 - powerRatio ** 1.5 * 10 + 10, 50, 100); // enemy to own power
  const meanDistance = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
  const distanceFee = Math.min(meanDistance / 50, 15);
  return Math.min(100, powerFee * (0.75 + stability / 2) - distanceFee);
}

export function getBattleName(type: BattleType, place: string | null, random: BattleRandom): string {
  if (type === "field") return `Battle of ${place}`;
  if (type === "naval") return `Naval Battle of ${place}`;
  if (type === "siege") return `Siege of ${place}`;
  if (type === "ambush") return `${place} Ambush`;
  if (type === "landing") return `${place} Landing`;
  return `${place} ${random.P(0.8) ? "Air Battle" : "Dogfight"}`;
}

export function getTypeName(type: BattleType): string {
  if (type === "field") return "field battle";
  if (type === "naval") return "naval battle";
  if (type === "air") return "battle";
  return type;
}

/** Outcome as the attackers and the defenders see it, by the share of all losses the defenders took */
export function getBattleStatus(attackersLosses: number, defendersLosses: number): [string, string] {
  const total = attackersLosses + defendersLosses;
  if (!total) return ["standoff", "standoff"];
  if (Math.max(attackersLosses, defendersLosses) < 0.05) return ["minor skirmishes", "minor skirmishes"];
  const relative = defendersLosses / total;
  if (relative > 0.95) return ["attackers flawless victory", "disorderly retreat of defenders"];
  if (relative > 0.7) return ["attackers decisive victory", "defenders disastrous defeat"];
  if (relative > 0.6) return ["attackers victory", "defenders defeat"];
  if (relative > 0.4) return ["stalemate", "stalemate"];
  if (relative > 0.3) return ["attackers defeat", "defenders victory"];
  return ["attackers disorderly retreat", "flawless victory of defenders"];
}

export function getRegimentStatus(losses: number): string {
  if (losses >= 1) return "was annihilated";
  if (losses > 0.9) return "was virtually wiped out";
  if (losses > 0.75) return "was nearly destroyed";
  if (losses > 0.6) return "was devastated";
  if (losses > 0.45) return "sustained catastrophic losses";
  if (losses > 0.3) return "sustained severe losses";
  if (losses > 0.2) return "sustained heavy losses";
  if (losses > 0.1) return "took considerable losses";
  if (losses > 0.05) return "took noticeable losses";
  if (losses > 0) return "took minor losses";
  return "emerged unscathed";
}

function minmax(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

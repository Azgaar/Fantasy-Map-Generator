export type Side = "attackers" | "defenders";
export type BattleType = "field" | "naval" | "siege" | "ambush" | "landing" | "air";
export type Stance = "hold" | "shoot" | "advance" | "flee";

export const SIDES: Side[] = ["attackers", "defenders"];
export const BATTLE_TYPES: BattleType[] = ["field", "naval", "siege", "ambush", "landing", "air"];
export const enemyOf = (side: Side): Side => (side === "attackers" ? "defenders" : "attackers");

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

/** What a side is told to do: the user sees and gives orders, the phases carry them out */
export type Command = "hold" | "skirmish" | "attack" | "defend" | "pursue" | "retreat" | "surrender";

/** The order a phase carries out; any other phase is an attack */
const PHASE_COMMAND: Record<string, Command> = {
  blockade: "hold",
  sheltering: "hold",
  waiting: "hold",
  skirmish: "skirmish",
  shelling: "skirmish",
  bombardment: "skirmish",
  maneuvering: "skirmish",
  defense: "defend",
  shock: "defend",
  pursue: "pursue",
  chase: "pursue",
  looting: "pursue",
  retreat: "retreat",
  withdrawal: "retreat",
  flee: "retreat",
  surrendering: "surrender"
};

/** What troops do on the battlefield under an order */
const COMMAND_STANCE: Record<Command, Stance> = {
  hold: "hold",
  defend: "hold",
  surrender: "hold",
  skirmish: "shoot",
  attack: "advance",
  pursue: "advance",
  retreat: "flee"
};

export const getStance = (phase: string): Stance => COMMAND_STANCE[PHASE_COMMAND[phase] ?? "attack"];

/** A battle of two lines: no walls, no ambush, no ships to land from */
export const isOpen = (type: BattleType): boolean => type === "field" || type === "naval" || type === "air";

/**
 * The order a side is under, by its phase: one that waits for the foe holds where it would skirmish and defends where
 * it would attack; in a siege the phase says it all
 */
export function getCommand(type: BattleType, phase: string, advancing: boolean): Command {
  const command = PHASE_COMMAND[phase] ?? "attack";
  if (advancing || type === "siege") return command;
  return command === "skirmish" ? "hold" : command === "attack" ? "defend" : command;
}

/**
 * In an ambush and a landing the phases are how the fight stands, not what a general picks: an order by hand changes
 * what the troops do and leaves the phase to take its course, unless it is to pursue or to retreat
 */
export const keepsPhase = (type: BattleType, command: Command): boolean =>
  (type === "ambush" || type === "landing") && command !== "pursue" && command !== "retreat";

export const getPhasePower = (phase: string, unitType: string): number => {
  const scheme = PHASE_POWER[phase] ?? PHASE_POWER.melee;
  return scheme[unitType] ?? scheme.melee;
};

/** What the phases of a battle type are to a general: standing off, closing, chasing, running */
export interface Postures {
  apart: string;
  close: string;
  chase: string;
  run: string;
}

const postures = (apart: string, close: string, chase: string, run: string): Postures => ({ apart, close, chase, run });
const FIELD_POSTURES = postures("skirmish", "melee", "pursue", "retreat");

export const POSTURES: Record<BattleType, Record<Side, Postures>> = {
  field: { attackers: FIELD_POSTURES, defenders: FIELD_POSTURES },
  naval: {
    attackers: postures("shelling", "boarding", "chase", "withdrawal"),
    defenders: postures("shelling", "boarding", "chase", "withdrawal")
  },
  siege: {
    attackers: postures("blockade", "storming", "looting", "retreat"),
    defenders: postures("sheltering", "defense", "pursue", "surrendering")
  },
  ambush: {
    attackers: postures("shock", "melee", "pursue", "retreat"),
    defenders: postures("surprise", "melee", "pursue", "retreat")
  },
  landing: {
    attackers: postures("landing", "melee", "pursue", "flee"),
    defenders: postures("defense", "melee", "pursue", "retreat")
  },
  air: {
    attackers: postures("maneuvering", "dogfight", "pursue", "retreat"),
    defenders: postures("maneuvering", "dogfight", "pursue", "retreat")
  }
};

type Commands = Partial<Record<Command, string>>;

/** An ambush and a landing have no phase to stand off in: see keepsPhase */
const inField = ({ apart, close, chase, run }: Postures, open = false): Commands => {
  const off = open ? apart : close;
  return { hold: off, skirmish: off, attack: close, defend: close, pursue: chase, retreat: run };
};
const forBoth = (type: BattleType): Record<Side, Commands> => ({
  attackers: inField(POSTURES[type].attackers, isOpen(type)),
  defenders: inField(POSTURES[type].defenders, isOpen(type))
});

/** The orders a side can be given by hand, each with the phase that carries it out */
export const COMMANDS: Record<BattleType, Record<Side, Commands>> = {
  field: forBoth("field"),
  naval: forBoth("naval"),
  siege: {
    attackers: { hold: "blockade", skirmish: "bombardment", attack: "storming", pursue: "looting", retreat: "retreat" },
    defenders: {
      hold: "sheltering",
      skirmish: "bombardment",
      attack: "sortie",
      defend: "defense",
      pursue: "pursue",
      surrender: "surrendering"
    }
  },
  ambush: forBoth("ambush"),
  landing: forBoth("landing"),
  air: forBoth("air")
};

/**
 * The rows of the power table a battalion fights by as it stands apart, is at grips or strikes the broken;
 * in any other phase, and in a siege, the side's phase is the row
 */
const SITUATIONS: Partial<Record<BattleType, Omit<Postures, "run">>> = {
  field: { apart: "skirmish", close: "melee", chase: "pursue" },
  naval: { apart: "shelling", close: "boarding", chase: "chase" },
  air: { apart: "maneuvering", close: "dogfight", chase: "pursue" },
  ambush: { apart: "melee", close: "melee", chase: "pursue" },
  landing: { apart: "melee", close: "melee", chase: "pursue" }
};

export function getRow(type: BattleType, phase: string, atGrips: boolean, chasing: boolean): string {
  const rows = SITUATIONS[type];
  if (!rows || !Object.values(rows).includes(phase)) return phase;
  return chasing ? rows.chase : atGrips ? rows.close : rows.apart;
}

/** Morale a side starts with: outmatched, far from base or badly ruled troops lose heart */
export function getInitialMorale(powerRatio: number, stability: number, distances: number[]): number {
  const powerFee = minmax(100 - powerRatio ** 1.5 * 10 + 10, 50, 100); // enemy to own power
  const meanDistance = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
  const distanceFee = Math.min(meanDistance / 50, 15);
  return Math.min(100, powerFee * (0.75 + stability / 2) - distanceFee);
}

export function getBattleName(type: BattleType, place: string | null): string {
  if (type === "field") return `Battle of ${place}`;
  if (type === "naval") return `Naval Battle of ${place}`;
  if (type === "siege") return `Siege of ${place}`;
  if (type === "ambush") return `${place} Ambush`;
  if (type === "landing") return `${place} Landing`;
  return `${place} Air Battle`;
}

export function getTypeName(type: BattleType): string {
  if (type === "field") return "field battle";
  if (type === "naval") return "naval battle";
  if (type === "air") return "battle";
  return type;
}

/**
 * Outcome as the attackers and the defenders see it, by the share of all losses the defenders took;
 * the side that holds the field has won, whatever it cost
 */
export function getBattleStatus(
  attackersLosses: number,
  defendersLosses: number,
  winner?: Side | null
): [string, string] {
  const total = attackersLosses + defendersLosses;
  if (!total && !winner) return ["standoff", "standoff"];
  if (Math.max(attackersLosses, defendersLosses) < 0.05 && !winner) return ["minor skirmishes", "minor skirmishes"];
  let relative = total ? defendersLosses / total : 0.5;
  if (winner === "attackers") relative = Math.max(relative, 0.61);
  if (winner === "defenders") relative = Math.min(relative, 0.39);
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

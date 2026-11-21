import { minmax } from "@/utils/number-utils";
export type Side = "attackers" | "defenders";
export type BattleType = "field" | "naval" | "siege" | "ambush" | "landing" | "bombardment" | "air";
export type Stance = "hold" | "shoot" | "advance" | "flee";
export type Phase =
  | "skirmish"
  | "melee"
  | "pursue"
  | "retreat"
  | "feint"
  | "surrendering"
  | "shelling"
  | "boarding"
  | "chase"
  | "withdrawal"
  | "blockade"
  | "bombardment"
  | "storming"
  | "looting"
  | "sheltering"
  | "sortie"
  | "defense"
  | "shock"
  | "surprise"
  | "landing"
  | "flee"
  | "waiting"
  | "maneuvering"
  | "dogfight";

export const SIDES: Side[] = ["attackers", "defenders"];
export const BATTLE_TYPES: BattleType[] = ["field", "naval", "siege", "ambush", "landing", "bombardment", "air"];

export const SURRENDER = "surrendering"; // the phase a side lays down its arms in, of any battle type; final
export const FEINT = "feint"; // a field side that runs to draw the foe out, and turns on him

/** Phases a side can be in, the first one is where it starts */
export const PHASES: Record<BattleType, Record<Side, Phase[]>> = {
  field: {
    attackers: ["skirmish", "melee", "pursue", "retreat", FEINT, SURRENDER],
    defenders: ["skirmish", "melee", "pursue", "retreat", FEINT, SURRENDER]
  },
  naval: {
    attackers: ["shelling", "boarding", "chase", "withdrawal", SURRENDER],
    defenders: ["shelling", "boarding", "chase", "withdrawal", SURRENDER]
  },
  siege: {
    attackers: ["blockade", "bombardment", "storming", "looting", "retreat", SURRENDER],
    defenders: ["sheltering", "sortie", "bombardment", "defense", SURRENDER, "pursue"]
  },
  ambush: {
    attackers: ["shock", "melee", "pursue", "retreat", SURRENDER],
    defenders: ["surprise", "melee", "pursue", "retreat", SURRENDER]
  },
  landing: {
    attackers: ["landing", "melee", "pursue", "flee", SURRENDER],
    defenders: ["defense", "melee", "waiting", "pursue", "retreat", SURRENDER]
  },
  bombardment: {
    attackers: ["bombardment", "withdrawal", SURRENDER],
    defenders: ["defense", "retreat", SURRENDER]
  },
  air: {
    attackers: ["maneuvering", "dogfight", "pursue", "retreat", SURRENDER],
    defenders: ["maneuvering", "dogfight", "pursue", "retreat", SURRENDER]
  }
};

/** What a side is told to do: the user sees and gives orders, the phases carry them out */
export type Command = "hold" | "fortify" | "skirmish" | "attack" | "defend" | "pursue" | "retreat" | "surrender";

/** The order a phase carries out; any other phase is an attack */
const PHASE_COMMAND: Partial<Record<Phase, Command>> = {
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
  [FEINT]: "retreat", // to the foe and to the eye
  [SURRENDER]: "surrender"
};

/** What troops do on the battlefield under an order */
const COMMAND_STANCE: Record<Command, Stance> = {
  hold: "hold",
  fortify: "hold",
  defend: "hold",
  surrender: "hold",
  skirmish: "shoot",
  attack: "advance",
  pursue: "advance",
  retreat: "flee"
};

/** What the phases of a battle type are to a general: standing off, closing, chasing, running */
export interface Postures {
  apart: Phase;
  close: Phase;
  chase: Phase;
  run: Phase;
}

const FIELD_POSTURES: Postures = { apart: "skirmish", close: "melee", chase: "pursue", run: "retreat" };
const NAVAL_POSTURES: Postures = { apart: "shelling", close: "boarding", chase: "chase", run: "withdrawal" };
const AIR_POSTURES: Postures = { apart: "maneuvering", close: "dogfight", chase: "pursue", run: "retreat" };

export const POSTURES: Record<BattleType, Record<Side, Postures>> = {
  field: { attackers: FIELD_POSTURES, defenders: FIELD_POSTURES },
  naval: { attackers: NAVAL_POSTURES, defenders: NAVAL_POSTURES },
  siege: {
    attackers: { apart: "blockade", close: "storming", chase: "looting", run: "retreat" },
    defenders: { apart: "sheltering", close: "defense", chase: "pursue", run: SURRENDER }
  },
  ambush: {
    attackers: { apart: "shock", close: "melee", chase: "pursue", run: "retreat" },
    defenders: { apart: "surprise", close: "melee", chase: "pursue", run: "retreat" }
  },
  landing: {
    attackers: { apart: "landing", close: "melee", chase: "pursue", run: "flee" },
    defenders: { apart: "defense", close: "melee", chase: "pursue", run: "retreat" }
  },
  // ships and troops never come to grips: the fleet shells what it reaches, the troops hold and shoot back
  bombardment: {
    attackers: { apart: "bombardment", close: "bombardment", chase: "bombardment", run: "withdrawal" },
    defenders: { apart: "defense", close: "defense", chase: "defense", run: "retreat" }
  },
  air: { attackers: AIR_POSTURES, defenders: AIR_POSTURES }
};

type Commands = Partial<Record<Command, Phase>>;

// a side that may build works is told to in its holding phase
const FIELD_COMMANDS: Commands = {
  hold: "skirmish",
  fortify: "skirmish",
  skirmish: "skirmish",
  attack: "melee",
  defend: "melee",
  pursue: "pursue",
  retreat: "retreat",
  surrender: SURRENDER
};
const NAVAL_COMMANDS: Commands = {
  hold: "shelling",
  skirmish: "shelling",
  attack: "boarding",
  defend: "boarding",
  pursue: "chase",
  retreat: "withdrawal",
  surrender: SURRENDER
};
// an ambush and a landing have no phase to stand off in: see keepsPhase
const AMBUSH_COMMANDS: Commands = {
  hold: "melee",
  skirmish: "melee",
  attack: "melee",
  defend: "melee",
  pursue: "pursue",
  retreat: "retreat",
  surrender: SURRENDER
};
const AIR_COMMANDS: Commands = {
  hold: "maneuvering",
  skirmish: "maneuvering",
  attack: "dogfight",
  defend: "dogfight",
  pursue: "pursue",
  retreat: "retreat",
  surrender: SURRENDER
};

/** The orders a side can be given by hand, each with the phase that carries it out */
export const COMMANDS: Record<BattleType, Record<Side, Commands>> = {
  field: { attackers: FIELD_COMMANDS, defenders: FIELD_COMMANDS },
  naval: { attackers: NAVAL_COMMANDS, defenders: NAVAL_COMMANDS },
  siege: {
    attackers: {
      hold: "blockade",
      fortify: "blockade",
      skirmish: "bombardment",
      attack: "storming",
      pursue: "looting",
      retreat: "retreat",
      surrender: SURRENDER
    },
    defenders: {
      hold: "sheltering",
      skirmish: "bombardment",
      attack: "sortie",
      defend: "defense",
      pursue: "pursue",
      surrender: SURRENDER
    }
  },
  ambush: { attackers: AMBUSH_COMMANDS, defenders: AMBUSH_COMMANDS },
  landing: {
    attackers: {
      hold: "melee",
      skirmish: "melee",
      attack: "melee",
      defend: "melee",
      pursue: "pursue",
      retreat: "flee",
      surrender: SURRENDER
    },
    defenders: {
      hold: "melee",
      fortify: "melee",
      skirmish: "melee",
      attack: "melee",
      defend: "melee",
      pursue: "pursue",
      retreat: "retreat",
      surrender: SURRENDER
    }
  },
  bombardment: {
    attackers: { hold: "bombardment", skirmish: "bombardment", retreat: "withdrawal", surrender: SURRENDER },
    defenders: { hold: "defense", skirmish: "defense", retreat: "retreat", surrender: SURRENDER }
  },
  air: { attackers: AIR_COMMANDS, defenders: AIR_COMMANDS }
};

class BattleRulesModule {
  enemyOf(side: Side): Side {
    return side === "attackers" ? "defenders" : "attackers";
  }

  getStance(phase: Phase): Stance {
    return COMMAND_STANCE[PHASE_COMMAND[phase] ?? "attack"];
  }

  /** A side that sits it out: a blockade, the shelter of the walls, a shore the foe has left. It holds its fire */
  isIdle(phase: Phase): boolean {
    return PHASE_COMMAND[phase] === "hold";
  }

  /** The attackers come from the sea: they keep their approach, cross nothing, and the defenders hold the shore or wait inland */
  isFromSea(type: BattleType): boolean {
    return type === "landing" || type === "bombardment";
  }

  /** A battle of two lines: no walls, no ambush, no ships to land from */
  isOpen(type: BattleType): boolean {
    return type === "field" || type === "naval" || type === "air";
  }

  /**
   * The order a side is under, by its phase: one that waits for the foe holds where it would skirmish and defends where
   * it would attack; in a siege the phase says it all
   */
  getCommand(type: BattleType, phase: Phase, advancing: boolean): Command {
    const command = PHASE_COMMAND[phase] ?? "attack";
    if (advancing || type === "siege") return command;
    return command === "skirmish" ? "hold" : command === "attack" ? "defend" : command;
  }

  /**
   * In an ambush, a landing and a bombardment the phases are how the fight stands, not what a general picks: an order by
   * hand changes what the troops do and leaves the phase to take its course, unless it is to pursue or to retreat
   */
  keepsPhase(type: BattleType, command: Command): boolean {
    return (
      (type === "ambush" || type === "landing" || type === "bombardment") &&
      ["hold", "fortify", "skirmish", "attack", "defend"].includes(command)
    );
  }

  /** A side that turned to run or laid down its arms: it neither fights on nor holds the field */
  isBeaten(type: BattleType, side: Side, phase: Phase): boolean {
    return phase === POSTURES[type][side].run || phase === SURRENDER;
  }

  /** Morale a side starts with: outmatched, far from base or badly ruled troops lose heart */
  getInitialMorale(powerRatio: number, stability: number, distances: number[]): number {
    const powerFee = minmax(100 - powerRatio ** 1.5 * 10 + 10, 50, 100); // enemy to own power
    const meanDistance = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0;
    const distanceFee = Math.min(meanDistance / 50, 15);
    return Math.min(100, powerFee * (0.75 + stability / 2) - distanceFee);
  }

  getName(type: BattleType, place: string | null): string {
    if (type === "field") return `Battle of ${place}`;
    if (type === "naval") return `Naval Battle of ${place}`;
    if (type === "siege") return `Siege of ${place}`;
    if (type === "ambush") return `${place} Ambush`;
    if (type === "landing") return `${place} Landing`;
    if (type === "bombardment") return `Bombardment of ${place}`;
    return `${place} Air Battle`;
  }

  getTypeName(type: BattleType): string {
    if (type === "field") return "field battle";
    if (type === "naval") return "naval battle";
    if (type === "air") return "battle";
    return type;
  }

  /**
   * Outcome as the attackers and the defenders see it, by the share of all losses the defenders took;
   * the side that holds the field has won, whatever it cost
   */
  getStatus(attackersLosses: number, defendersLosses: number, winner?: Side | null): [string, string] {
    const total = attackersLosses + defendersLosses;
    if (!total && !winner) return ["standoff", "standoff"];
    if (Math.max(attackersLosses, defendersLosses) < 0.05 && !winner) return ["minor skirmishes", "minor skirmishes"];
    let relative = total ? defendersLosses / total : 0.5;
    if (winner === null) relative = Math.min(Math.max(relative, 0.31), 0.69); // nobody was driven off: no more than a plain victory
    if (winner === "attackers") relative = Math.max(relative, 0.61);
    if (winner === "defenders") relative = Math.min(relative, 0.39);
    if (relative > 0.95) return ["attackers flawless victory", "disorderly retreat of defenders"];
    if (relative > 0.7) return ["attackers decisive victory", "defenders disastrous defeat"];
    if (relative > 0.6) return ["attackers victory", "defenders defeat"];
    if (relative > 0.4) return ["stalemate", "stalemate"];
    if (relative > 0.3) return ["attackers defeat", "defenders victory"];
    return ["attackers disorderly retreat", "flawless victory of defenders"];
  }

  getRegimentStatus(losses: number): string {
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
}

export const BattleRules = new BattleRulesModule();

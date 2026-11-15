import { sum } from "d3";
import { type BattleSettings, DEFAULT_BATTLE_SETTINGS } from "@/data/battle-options";
import { getUnitPower } from "@/model/political/military-units";
import type { Point } from "@/types/global";
import type { MilitaryUnit } from "@/types/military";
import { Battalions, type Kind, type Sense } from "./battalion";
import {
  AT_HAND,
  BREACH_BLOWS,
  BREAK,
  BROKEN,
  COVER,
  EXERTION,
  FLANK,
  FLIGHT,
  HUNGER,
  IMPETUS,
  KILL_RATE,
  MAX_IMPETUS,
  MORALE_LOSS,
  NERVE,
  RALLY,
  REAR,
  REST,
  RUNNING,
  SAFE,
  SHAKE,
  SHOCK,
  SPENT,
  STARVED,
  WALLS,
  YIELD
} from "./battle-balance";
import { BattleRules, type BattleType, type Command, PHASES, SIDES, type Side, SURRENDER } from "./battle-rules";
import { BattleScale } from "./battle-scale";
import { type Battlefield, Battlefields, type FieldWall } from "./battlefield";
import type { TacticName } from "./formations";
import { Generals, type Option } from "./general";
import { type Move, Movement, ROUND_TICKS } from "./movement";
import { type Condition, HEAT, SKIES, type Weather } from "./weather";
import { Works } from "./works";

export { ROUND_TICKS };

// in battalion fronts
const BLOCK_DEPTH = 0.5;
const BLOCK_WIDTH = [0.41, 1.32]; // the least and the most, by its men
const MARCHING = 0.7; // further from its place a battalion faces the way it marches

// of a pace a tick
const MARCH = 1.4; // the way a battalion makes in a round to be on the march

export type BlockStatus = "ready" | "routed" | "surrendered" | "fled" | "destroyed";
export type BlockAction = "hold" | "move" | "shoot" | "fight" | "flee" | "build";
export type Role = "line" | "support" | "battery" | "wing" | "reserve" | "wedge";
export type Mission = "line" | "support" | "battery" | "guard" | "reserve" | "flank" | "hunt" | "withdraw";

/** What the general tells a battalion: its place in the formation and what to do there */
export interface Order {
  role: Role; // what it is in the formation
  mission: Mission; // what it is to do this round
  rank: number; // the line it stands in, 0 the first
  across: number; // its place: to the right of the middle of the formation
  along: number; // and ahead of its first line
  x: number; // the place on the field this round, or the point to go round by
  y: number;
  facing: number;
  target: number | null; // the foe the general points at
  sent: boolean; // away from its place on the general's errand
}

/** A general's mind: the tactic, where the formation stands and how the day has gone */
export interface Plan {
  tactic: TacticName;
  strike: number; // the massed wing: -1 the left, 1 the right
  x: number; // the middle of the first line
  y: number;
  heading: number;
  camp: [number, number]; // where it formed up
  fixed: boolean; // places are points of the field: the formation does not move
  half: number; // half the first line
  halt: number; // how far from the foe the formation stops to shoot
  since: number; // round the phase was taken
  fired: number | null; // round its shooting began
  order: Command | null; // given by hand, while it stands
  byHand: number | null; // the round it was given
  opening: number; // rounds the surprise of an ambush lasts
  gap: number; // between the sides, last round
  walk: number; // on a field with cliffs: the shortest way round them from the side to the foe, last round
  idle: number; // rounds it has not closed
  losses: number; // share of the troops lost by the last round
  bled: number; // rounds in a row it lost men to shots alone
  fortify: boolean; // the side builds works
  arrival: number; // ticks till the foe is upon it, as the general reckons it this round; Infinity when it does not come
  wedge: Wedge | null; // the riders' own formation, when they fight apart
  muster: Muster | null; // a sortie's party forming up outside the walls
  hooks: [left: number[], right: number[]]; // battalions turned out at the ends of the line, the nearest the end first
}

/** The party of a sortie formed up outside the gate it goes out by, before it falls on the foe */
export interface Muster {
  x: number;
  y: number;
  heading: number;
  until: number; // round it goes at the latest, formed up or not
  launched: number | null; // round it went for the foe
}

/** Riders drawn up in a wedge of their own: where its point is, and the foe it falls on once it charges */
export interface Wedge {
  x: number;
  y: number;
  heading: number;
  launched: boolean; // gone from beside the line on its way round the foe
  charging: boolean; // it fell on the foe: the wedge broke up, every battalion of it hunts
  target: number | null; // the foe it fell on, while it stands
}

/** A battalion: troops of one unit of a regiment that stand, move and fight together */
export interface Block {
  id: number;
  key: string; // stable across redeployment, for the log
  side: Side;
  state: number;
  regiment: number;
  unit: string;
  number: number; // among the regiment's battalions of the unit, from 1; 0 when it is the only one
  type: string;
  kind: Kind;
  unitPower: number;
  attack: number; // of a unit
  defense: number;
  speed: number; // metres a tick
  range: number; // it shoots over, 0 to fight hand to hand
  steadiness: number; // the unit's morale: what its losses of morale are divided by
  upkeep: number; // share of the power ill-kept troops fight with
  initial: number;
  troops: number;
  x: number;
  y: number;
  vx: number; // the way it went this tick and how fast, metres a tick
  vy: number;
  impetus: number; // what its charge adds to its blows at grips: 1 none, 0 while not at grips
  facing: number; // radians
  width: number;
  depth: number;
  morale: number;
  energy: number; // 1 fresh to 0 spent, when it strikes and stands with half its strength
  status: BlockStatus;
  action: BlockAction;
  target: number | null;
  hit: boolean; // took losses this round
  harm: number; // the part of a man lost so far
  leaving: boolean; // its regiment was taken out of the battle: it marches off the field
  detour: number; // the side it goes round what is in its way by: -1, 1, or 0 on a clear way
  goal: Point | null; // where it is going this tick
  task: Task | null; // given by hand: it comes before the general's order while it stands
  order: Order;
}

export type TaskKind = "move" | "attack" | "protect";

/** What the user tells a battalion to do: go to a point, attack a foe or protect a friend */
export interface Task {
  kind: TaskKind;
  x: number;
  y: number;
  facing: number; // on the spot it was sent to
  target: number | null; // the foe or the friend
  round: number; // it was given
}

/** A regiment as the battle needs it; troops by unit name */
export interface BattleRegiment {
  state: number;
  i: number;
  name: string;
  icon: string;
  troops: Record<string, number>;
  upkeep: number;
  stability: number; // of its state, 0 to 1
  distance: number; // to its base
}

export interface BattleSide {
  regiments: BattleRegiment[];
  morale: number;
  casualties: number; // share of the initial troops fallen
  captured: number; // and taken prisoner
  power: number;
  phase: string;
  die: number;
  tactic: TacticName | null; // what its general settled on, thinking the battle through
  waits: boolean; // and that he will wait for the foe rather than go to meet him
  storms: boolean; // or storm the walls at once, a little short of the odds they ask for
  advancing: boolean; // comes to the foe rather than waits for it
  plan: Plan;
}

export type Intervention =
  | { tick: number; kind: "move"; block: string; x: number; y: number }
  | { tick: number; kind: "turn"; block: string; facing: number }
  | { tick: number; kind: "task"; blocks: string[]; task: TaskKind; x: number; y: number; target: string | null }
  | { tick: number; kind: "order"; side: Side; order: Command }
  | { tick: number; kind: "morale"; side: Side; value: number }
  | { tick: number; kind: "die"; side: Side; die: number }
  | { tick: number; kind: "add"; side: Side; regiment: BattleRegiment }
  | { tick: number; kind: "withdraw"; state: number; regiment: number }
  | { tick: number; kind: "type"; type: BattleType }
  | { tick: number; kind: "dig"; side: Side; on: boolean } // before the start: the side starts behind its works
  | { tick: number; kind: "weather"; weather: Weather }
  | { tick: number; kind: "condition"; condition: Condition; on: boolean }
  | { tick: number; kind: "tactic"; side: Side; tactic: TacticName | null }; // before the start; null: as its general sees fit

export type LogEvent =
  | "task"
  | "order"
  | "ordered"
  | "move"
  | "turn"
  | "die"
  | "morale"
  | "join"
  | "withdraw"
  | "tactic"
  | "rout"
  | "rally"
  | "surrender"
  | "destroyed"
  | "fled"
  | "breach"
  | "cut"
  | "supplied"
  | "dig"
  | "weather"
  | "condition"
  | "fortified"
  | "gap"
  | "raised"
  | "clash"
  | "broken"
  | "end";

/** What happened; the screen words it */
export interface LogEntry {
  tick: number;
  event: LogEvent;
  side?: Side | null;
  params?: Record<string, string>;
}

export interface BattleResult {
  winner: Side | null;
  status: [string, string]; // as the attackers and the defenders see it
}

export interface Battle {
  type: BattleType;
  name: string;
  place: string | null;
  x: number;
  y: number;
  cell: number;
  approach: number; // direction the attackers came from the map, radians
  axis: number; // direction of the attack on the field: the approach, turned to start from dry land
  field: Battlefield;
  units: MilitaryUnit[];
  populationScale: number; // men in a population point
  battalion: number; // men in a full battalion, the same for both sides
  attackers: BattleSide;
  defenders: BattleSide;
  blocks: Block[];
  tick: number;
  round: number;
  engaged: number | null; // round of the first blow: phases count from it, however long the approach
  lastLoss: number; // tick of the last casualty
  storm: number | null; // round the besiegers set out to storm the walls
  raised: boolean; // the besiegers drew off before a garrison out in force: they were not broken
  cutOff: boolean; // the besieged burg is ringed in by land and water: nothing comes in
  battered: number; // how far the engines are with the next breach, 0 to 1
  course: { orders: string; count: number }[]; // the orders the sides were under, round by round
  interventions: Intervention[];
  log: LogEntry[];
  result: BattleResult | null;
  planned: boolean; // the generals have thought the battle through
  rehearsal: boolean; // it is fought in a general's mind
  settings: BattleSettings; // copied in at the setup: a battle under way never changes
  weather: Weather;
  mud: boolean; // the ground is soaked
  ice: boolean; // the ground and the rivers are frozen
  heat: boolean;
}

/** How a game the generals play in their minds ended */
interface Rehearsal {
  winner: Side | null;
  lost: Record<Side, number>; // share of each side's troops
}

export interface BattleSetup {
  type: BattleType;
  name: string;
  place: string | null;
  x: number;
  y: number;
  cell: number;
  axis: number;
  field: Battlefield;
  units: MilitaryUnit[];
  populationScale: number;
  attackers: BattleRegiment[];
  defenders: BattleRegiment[];
  settings?: BattleSettings;
  weather?: Weather; // clear by default
  mud?: boolean;
  ice?: boolean;
  heat?: boolean;
}

const NO_ORDER: Order = {
  role: "line",
  mission: "line",
  rank: 0,
  across: 0,
  along: 0,
  x: 0,
  y: 0,
  facing: 0,
  target: null,
  sent: false
};

const NO_PLAN: Plan = {
  tactic: "assault",
  strike: 1,
  x: 0,
  y: 0,
  heading: 0,
  camp: [0, 0],
  fixed: true,
  half: 0,
  halt: 0,
  since: 0,
  fired: null,
  order: null,
  byHand: null,
  opening: 0,
  gap: Infinity,
  walk: Infinity,
  idle: 0,
  losses: 0,
  bled: 0,
  fortify: false,
  arrival: Infinity,
  wedge: null,
  muster: null,
  hooks: [[], []]
};

class BattleModule {
  private readonly places = new WeakMap<Battle, Map<number, [number, number]>>();

  private createSide(regiments: BattleRegiment[], phase: string): BattleSide {
    return {
      regiments,
      morale: 100,
      casualties: 0,
      captured: 0,
      power: 0,
      phase,
      die: 3,
      tactic: null,
      waits: false,
      storms: false,
      advancing: false,
      plan: NO_PLAN
    };
  }

  create(setup: BattleSetup): Battle {
    const { attackers, defenders, settings, ...rest } = setup;
    const battle: Battle = {
      weather: "clear",
      mud: false,
      ice: false,
      heat: false,
      ...rest,
      settings: { ...DEFAULT_BATTLE_SETTINGS, ...settings },
      approach: setup.axis,
      battalion: 0,
      attackers: this.createSide(attackers, PHASES[setup.type].attackers[0]),
      defenders: this.createSide(defenders, PHASES[setup.type].defenders[0]),
      blocks: [],
      tick: 0,
      round: 0,
      engaged: null,
      lastLoss: 0,
      storm: null,
      raised: false,
      cutOff: false,
      battered: 0,
      course: [],
      interventions: [],
      log: [],
      result: null,
      planned: false,
      rehearsal: false
    };
    this.prepare(battle);
    return battle;
  }

  /** Draw the troops up anew; only before the first tick, the user's moves are kept */
  prepare(battle: Battle): void {
    if (battle.tick) return;
    battle.blocks = [];
    battle.battalion = this.getBattalionSize(battle);
    this.setScale(battle);
    battle.field.frozen = battle.ice;
    Movement.forgetWays(battle.field);
    battle.axis = this.findAxis(battle);
    battle.field.held = this.getHeld(battle);
    Movement.openCrossing(battle, Generals.getBase(battle, "attackers"), Generals.getBase(battle, "defenders"));
    for (const side of SIDES) {
      battle[side].phase = PHASES[battle.type][side][0];
      for (const regiment of battle[side].regiments) this.addBlocks(battle, side, regiment);
    }
    this.updatePower(battle);
    this.setInitialMorale(battle);
    this.drawUp(battle);
    for (const change of battle.interventions) {
      if (change.kind === "morale") this.addMorale(battle, change.side, change.value);
    }
  }

  /** Stand the battalions there are in their places, by the tactics of the generals and then by the user's hand */
  private drawUp(battle: Battle): void {
    Movement.forgetWays(battle.field);
    Generals.deploy(battle);
    Movement.separate(battle, battle.blocks); // a crowded line spreads out
    Generals.settle(battle);
    for (const block of battle.blocks) Generals.takePlace(battle, block);
    for (const change of battle.interventions) {
      if (change.kind === "move") this.moveBlock(battle, change.block, change.x, change.y);
      if (change.kind === "turn") this.turnBlock(battle, change.block, change.facing);
      if (change.kind === "order") Generals.obey(battle, change.side, change.order);
    }
    Generals.digIn(battle);
    Movement.forgetWays(battle.field);
    this.noteTactics(battle);
  }

  /** The log opens with the tactic each side is drawn up in, whatever was done before the start */
  private noteTactics(battle: Battle): void {
    if (battle.tick || battle.rehearsal) return;
    const rest = battle.log.filter(entry => entry.event !== "tactic");
    const tactics = SIDES.map(
      (side): LogEntry => ({ tick: 0, event: "tactic", side, params: { tactic: battle[side].plan.tactic } })
    );
    battle.log.splice(0, battle.log.length, ...tactics, ...rest);
  }

  /**
   * The generals think the battle through before it begins: each plays the tactics open to him against the foe as he
   * expects it, and takes the one that ends best.
   * Done once, before the first tick at the latest; a change of the armies or of the ground makes them think again.
   */
  plan(battle: Battle): void {
    if (battle.tick || battle.planned) return;
    battle.planned = true;
    if (battle.rehearsal) return;
    // each against the foe as the odds make him expect it: neither knows what the other has settled on
    const options = SIDES.map(side => Generals.getOptions(battle, side));
    const laager = [...options.flat(), ...SIDES.map(side => battle[side].plan)].some(
      ({ tactic }) => tactic === "laager"
    );
    const { planTicks } = battle.settings;
    const stormPlanTicks = planTicks / 2; // a storm of walls or of a wagon ring is slow to reckon
    const ticks = battle.type === "siege" || laager ? stormPlanTicks : planTicks;
    const played = new Map<string, Rehearsal>(); // a side's option is often what the other expects of it: the same game
    const settled = SIDES.map((side, i) => {
      let best: Option | null = null;
      let most = -Infinity;
      for (const option of options[i]) {
        const outcome = this.rehearse(battle, side, option, ticks, played);
        if (outcome > most) [best, most] = [option, outcome];
      }
      return best;
    });
    let changed = false;
    SIDES.forEach((side, i) => {
      const { tactic = null, waits = false, storms = false } = settled[i] ?? {};
      if (waits || (tactic && tactic !== battle[side].plan.tactic)) changed = true;
      Object.assign(battle[side], { tactic, waits, storms });
    });
    if (changed)
      this.drawUp(battle); // the same battalions, in other places
    else Movement.forgetWays(battle.field);
  }

  /**
   * How a battle goes for a side that does as its general has in mind: who holds the field, then whose losses are the
   * lighter. A game is played once: drawn up alike, both sides do the same whoever's option it is
   */
  private rehearse(battle: Battle, side: Side, option: Option, ticks: number, played: Map<string, Rehearsal>): number {
    const copy = (name: Side): BattleSide => ({
      ...this.createSide(battle[name].regiments, battle[name].phase),
      ...(name === side ? option : {})
    });
    // fortune is not theirs to know: the dice are even, and nobody has moved a battalion by hand;
    // the ground is a copy: a storm in the mind breaches no walls
    const trial: Battle = {
      ...battle,
      field: structuredClone(battle.field),
      attackers: copy("attackers"),
      defenders: copy("defenders"),
      blocks: [],
      course: [],
      interventions: battle.interventions.filter(change => change.kind === "dig" || change.kind === "tactic"), // the ground as prepared, tactics given by hand
      log: [],
      result: null,
      planned: true,
      rehearsal: true
    };
    this.prepare(trial); // the tactics are settled here: a side's own `tactic` is read no more
    const key = SIDES.map(name => `${trial[name].plan.tactic}|${trial[name].waits}|${trial[name].storms}`).join("|");
    let game = played.get(key);
    if (!game) {
      for (let i = 0; i < ticks && !trial.result; i++) this.tick(trial);
      game = {
        winner: trial.result?.winner ?? null,
        lost: { attackers: this.getLost(trial.attackers), defenders: this.getLost(trial.defenders) }
      };
      played.set(key, game);
    }
    const held = game.winner === side ? 1 : game.winner ? -1 : 0;
    return held + game.lost[BattleRules.enemyOf(side)] - game.lost[side];
  }

  intervene(battle: Battle, change: Intervention): void {
    battle.interventions.push(change);
    if (change.kind === "move" || change.kind === "turn") {
      const block = battle.blocks.find(block => block.key === change.block);
      if (!block) return;
      if (change.kind === "move") this.moveBlock(battle, change.block, change.x, change.y);
      else this.turnBlock(battle, change.block, change.facing);
      if (!battle.tick) {
        Generals.digIn(battle); // the works prepared before the battle stand before the battalion where it is now
        Movement.forgetWays(battle.field);
      }
      battle.log.push({
        tick: battle.tick,
        event: change.kind,
        side: block.side,
        params: { block: this.blockName(block) }
      });
      return;
    }

    if (change.kind === "task") {
      if (battle.tick) this.assign(battle, change);
      return;
    }

    if (change.kind === "order") {
      Generals.obey(battle, change.side, change.order);
      battle.log.push({ tick: battle.tick, event: "ordered", side: change.side, params: { order: change.order } });
    } else if (change.kind === "morale") {
      if (battle.tick) this.addMorale(battle, change.side, change.value); // before the start the troops are lined up anew
      battle.log.push({
        tick: battle.tick,
        event: "morale",
        side: change.side,
        params: { value: this.signed(change.value) }
      });
    } else if (change.kind === "die") {
      battle[change.side].die = change.die;
      battle.log.push({ tick: battle.tick, event: "die", side: change.side, params: { die: String(change.die) } });
    } else if (change.kind === "type") {
      battle.type = change.type;
      battle.interventions = battle.interventions.filter(c => (c.kind !== "order" && c.kind !== "tactic") || c.tick); // given for the old type
      for (const side of SIDES) battle[side].phase = PHASES[battle.type][side][0];
    } else if (change.kind === "withdraw") {
      this.withdraw(battle, change.state, change.regiment);
    } else if (change.kind === "dig") {
      battle.log.push({ tick: battle.tick, event: "dig", side: change.side, params: { on: String(change.on) } });
    } else if (change.kind === "weather") {
      battle.weather = change.weather;
      battle.log.push({ tick: battle.tick, event: "weather", params: { weather: change.weather } });
    } else if (change.kind === "condition") {
      battle[change.condition] = change.on;
      if (change.condition === "ice") this.freeze(battle);
      battle.log.push({
        tick: battle.tick,
        event: "condition",
        params: { condition: change.condition, on: String(change.on) }
      });
    } else if (change.kind === "add") {
      battle[change.side].regiments.push(change.regiment);
      battle.log.push({
        tick: battle.tick,
        event: "join",
        side: change.side,
        params: { regiment: change.regiment.name }
      });
      if (battle.tick) this.reinforce(battle, change.side, change.regiment);
    }

    if (battle.tick) this.updatePower(battle);
    else {
      // what the generals settled on does not stand; a move or a turn of a battalion leaves it be
      if (["add", "withdraw", "type", "order", "dig", "tactic", "weather", "condition"].includes(change.kind))
        this.rethink(battle);
      this.prepare(battle);
    }
  }

  /** The rivers freeze over or thaw: the ways over the field are found anew */
  private freeze(battle: Battle): void {
    battle.field.frozen = battle.ice;
    Movement.forgetWays(battle.field);
  }

  /** Take a regiment out: before the start as if it never came, after it its battalions march off the field */
  private withdraw(battle: Battle, state: number, i: number): void {
    const side = SIDES.find(side => battle[side].regiments.some(r => r.state === state && r.i === i));
    if (!side) return;
    const regiment = battle[side].regiments.find(r => r.state === state && r.i === i)!;
    if (battle.tick) {
      for (const block of battle.blocks) {
        if (block.state === state && block.regiment === i && block.side === side) block.leaving = true;
      }
    } else {
      const prefix = `${side[0]}${state}-${i}-`; // of its battalions' keys
      battle[side].regiments = battle[side].regiments.filter(other => other !== regiment);
      battle.interventions = battle.interventions.filter(change => {
        if (change.kind === "withdraw") return false;
        if (change.kind === "add") return change.regiment.state !== state || change.regiment.i !== i;
        if (change.kind === "move" || change.kind === "turn") return !change.block.startsWith(prefix);
        return true;
      });
    }
    battle.log.push({ tick: battle.tick, event: "withdraw", side, params: { regiment: regiment.name } });
  }

  /** The armies or the ground changed before the start: what the general settled on does not stand */
  rethink(battle: Battle): void {
    battle.planned = false;
    for (const side of SIDES) Object.assign(battle[side], { tactic: null, waits: false, storms: false });
  }

  /** Drop the user's moves made before the start */
  resetDeployment(battle: Battle): void {
    if (battle.tick) return;
    battle.interventions = battle.interventions.filter(change => change.kind !== "move");
    this.prepare(battle);
  }

  /** Apply the changes of a recorded battle that are due at the current tick */
  applyDue(battle: Battle, script: Intervention[]): void {
    while (script.length && script[0].tick <= battle.tick)
      this.intervene(battle, { ...script.shift()!, tick: battle.tick });
  }

  /** Run a recorded battle to its end */
  replay(battle: Battle, interventions: Intervention[]): void {
    const script = [...interventions];
    this.applyDue(battle, script);
    while (!battle.result) {
      this.tick(battle);
      this.applyDue(battle, script);
    }
  }

  getTroops(battle: Battle, side: Side): { initial: number; left: number; captured: number } {
    const blocks = battle.blocks.filter(block => block.side === side);
    return {
      initial: sum(blocks, block => block.initial),
      left: sum(blocks, block => this.getFree(block)),
      captured: sum(blocks, block => this.getPrisoners(block))
    };
  }

  /** Troops of a battalion still its side's: those who gave themselves up are lost to it, unless it holds the field */
  private getFree(block: Block): number {
    return block.status === "surrendered" ? 0 : block.troops;
  }

  private getPrisoners(block: Block): number {
    return block.troops - this.getFree(block);
  }

  /** Share of a side's troops lost to it: fallen or taken prisoner */
  private getLost(side: BattleSide): number {
    return side.casualties + side.captured;
  }

  /** The regiment was taken out of the battle and is leaving the field */
  isWithdrawn(battle: Battle, regiment: BattleRegiment): boolean {
    return battle.blocks.some(
      block => block.state === regiment.state && block.regiment === regiment.i && block.leaving
    );
  }

  private isInOrder(block: Block): boolean {
    return block.status === "ready" && !block.leaving; // and fights on
  }

  /** Troops of a regiment fallen, by unit */
  getLosses(battle: Battle, regiment: BattleRegiment): Record<string, number> {
    return this.countUnits(battle, regiment, block => block.initial - block.troops);
  }

  /** Troops of a regiment taken prisoner, by unit */
  getCaptured(battle: Battle, regiment: BattleRegiment): Record<string, number> {
    return this.countUnits(battle, regiment, block => this.getPrisoners(block));
  }

  private countUnits(
    battle: Battle,
    regiment: BattleRegiment,
    count: (block: Block) => number
  ): Record<string, number> {
    const units: Record<string, number> = {};
    for (const block of battle.blocks) {
      if (block.state !== regiment.state || block.regiment !== regiment.i) continue;
      units[block.unit] = (units[block.unit] ?? 0) + count(block);
    }
    return units;
  }

  /** Outcome so far, for a battle the user ends by hand */
  getResult(battle: Battle): BattleResult {
    if (battle.result) return battle.result;
    return {
      winner: null,
      status: BattleRules.getStatus(this.getLost(battle.attackers), this.getLost(battle.defenders))
    };
  }

  tick(battle: Battle): void {
    if (battle.result) return;
    if (!battle.tick) this.plan(battle);
    if (battle.tick % ROUND_TICKS === 0) this.startRound(battle);
    this.capitulate(battle);
    this.act(battle);
    Works.buildWorks(battle, battle.tick % ROUND_TICKS);
    this.fight(battle);
    this.tire(battle);
    battle.tick += 1;
    this.updatePower(battle);
    this.checkEnd(battle);
  }

  private startRound(battle: Battle): void {
    battle.round = battle.tick / ROUND_TICKS;
    const cutOff = Generals.isCutOff(battle);
    if (cutOff !== battle.cutOff) {
      const burg = battle.field.burgs[battle.field.held!].name;
      battle.log.push({ tick: battle.tick, event: cutOff ? "cut" : "supplied", side: "attackers", params: { burg } });
    }
    battle.cutOff = cutOff;
    const raised = Works.raiseWorks(battle); // what was finished last round stands now
    if (battle.round) {
      this.steady(battle);
      this.updatePower(battle);
    }

    // the approach is over at the first blow, or once nobody moves
    const fighting = battle.blocks.some(block => block.action === "fight" || block.action === "shoot");
    // on the march are those who got somewhere since the last round: a battalion shuffling about its place is not
    const stood = this.places.get(battle) ?? new Map<number, [number, number]>();
    const marching = battle.blocks.some(block => {
      const [x, y] = stood.get(block.id) ?? [block.x, block.y];
      return block.action === "move" && Math.hypot(block.x - x, block.y - y) > Movement.getPace(battle, block) * MARCH;
    });
    this.places.set(battle, new Map(battle.blocks.map(block => [block.id, [block.x, block.y]])));
    const held = SIDES.some(side => battle[side].plan.order); // stood by an order, a side has not begun
    if (battle.engaged === null && battle.round && (fighting || (!marching && !held))) {
      battle.engaged = battle.round;
      battle.lastLoss = battle.tick;
      battle.log.push({ tick: battle.tick, event: "clash" });
    }

    const beaten = SIDES.map(side => BattleRules.isBeaten(battle.type, side, battle[side].phase));
    Generals.command(battle);
    SIDES.forEach((side, i) => {
      if (!beaten[i] && BattleRules.isBeaten(battle.type, side, battle[side].phase))
        battle.log.push({
          tick: battle.tick,
          event: side === "attackers" && battle.raised ? "raised" : "broken",
          side
        });
    });
    this.batter(battle);
    if (Works.breakWagons(battle) || raised) Movement.forgetWays(battle.field, true); // the troops go round what bars them, or in by a gap

    const [attackers, defenders] = Generals.getCommands(battle);
    const orders = `Attackers: ${attackers}, defenders: ${defenders}`;
    const last = battle.course.at(-1);
    if (last?.orders === orders) last.count += 1;
    else battle.course.push({ orders, count: 1 });
  }

  /** A side that has troops in order and has neither turned to run nor laid down its arms */
  private isFighting(battle: Battle, side: Side): boolean {
    return (
      !BattleRules.isBeaten(battle.type, side, battle[side].phase) &&
      battle.blocks.some(block => block.side === side && block.status === "ready")
    );
  }

  /**
   * Morale by what a battalion sees around it: it loses heart outnumbered and takes heart with the upper hand or left alone.
   * The spent break and run, the most shaken first: their flight heartens the foes; the broken who got away rally.
   */
  private steady(battle: Battle): void {
    for (const block of [...battle.blocks].sort((a, b) => a.morale - b.morale || a.id - b.id)) {
      if (block.status !== "ready" && block.status !== "routed") continue;
      const { friends, foes, nearest } = this.getHand(battle, block);

      const hungry = this.isHungry(battle, block);
      if (block.status === "routed") {
        if (nearest < SAFE * battle.field.front || !this.isFighting(battle, block.side) || hungry) continue;
        block.morale += REST;
        if (block.morale >= RALLY) this.rally(battle, block);
        continue;
      }

      if (foes) {
        const change = (friends / (friends + foes) - 0.5) * NERVE;
        block.morale += change > 0 ? (hungry ? 0 : change) : change / block.steadiness;
      } else if (!block.hit && !hungry) block.morale += REST;
      if (hungry) block.morale = Math.max(block.morale - HUNGER / block.steadiness, Math.min(block.morale, STARVED));
      block.morale = Math.min(Math.max(block.morale, 0), 100);
      if (block.morale < YIELD && foes && this.isCornered(battle, block)) this.surrender(battle, block);
      else if (block.morale <= BREAK) this.rout(battle, block);
      block.hit = false;
    }
  }

  /** Every battalion turns its order into a move, then blows are settled together */
  private act(battle: Battle): void {
    const onField = battle.blocks.filter(block => block.status === "ready" || block.status === "routed");
    const sense: Sense = { onField, crowd: new Map(), held: new Set() };
    for (const block of onField) {
      if (block.status !== "ready" || block.target === null) continue;
      sense.crowd.set(block.target, (sense.crowd.get(block.target) ?? 0) + 1);
      if (block.action === "fight") sense.held.add(block.id).add(block.target);
    }

    const shooting = new Set<number>();
    const moves: Move[] = [];
    for (const block of onField) {
      block.vx = block.vy = 0;
      block.goal = null;
      if (block.task && this.isTaskOver(battle, block, block.task)) block.task = null;
    }
    // the sides take the first move in turn: whoever moves first takes the ground
    for (const block of battle.tick % 2 ? [...onField].reverse() : onField) {
      if (block.status === "routed" || block.order.mission === "withdraw" || block.leaving) {
        this.flee(battle, block, onField);
        continue;
      }

      const { target, to, stop, key, shared, shoot, facing, haste, keep, build } = Battalions.decide(
        battle,
        block,
        sense
      );
      if (target && target.id !== block.target) sense.crowd.set(target.id, (sense.crowd.get(target.id) ?? 0) + 1);
      block.target = target?.id ?? null;
      const fires = shoot && !BattleRules.isIdle(battle[block.side].phase);
      if (fires) shooting.add(block.id);
      const bearing = target ? Math.atan2(target.y - block.y, target.x - block.x) : facing;

      if (build) block.action = "build";
      else if (target && Movement.inContact(battle, block, target)) block.action = "fight";
      else if (target && fires && Movement.canShoot(battle, block, target)) block.action = "shoot";
      else if (Movement.giveWay(battle, block, onField)) block.action = block.vx || block.vy ? "move" : "hold";
      else if (to) {
        // to the place, or to the next turn of the way round the water and no further
        const whole = Math.hypot(to.x - block.x, to.y - block.y) - stop;
        const [x, y] = shared
          ? Movement.getSharedHeading(battle, block, to)
          : Movement.getHeading(battle, block, to, key);
        const due = keep ? whole / (ROUND_TICKS - (battle.tick % ROUND_TICKS)) : whole; // the place moves once a round
        const leg = Math.min(due, x === to.x && y === to.y ? whole : Math.hypot(x - block.x, y - block.y));
        if (whole > 0) moves.push({ block, from: [block.x, block.y], to: [x, y], leg });
        const moved = whole > 0 && Movement.step(battle, block, x - block.x, y - block.y, leg, onField, haste);
        block.action = moved ? "move" : "hold";
        if (moved) block.goal = [to.x, to.y];
        if (moved && !target && whole > MARCHING * battle.field.front) {
          block.facing = Movement.turn(block.facing, Math.atan2(y - block.y, x - block.x), 0.7); // it marches
          continue;
        }
      } else block.action = "hold";
      block.facing = Movement.turn(block.facing, bearing, 0.7);
    }

    // nobody is pushed into the water, out of a ford into the deep or through a wall
    const stood = onField.map(block => ({
      x: block.x,
      y: block.y,
      dry: !Movement.isWet(battle, block, block.x, block.y),
      safe: !Movement.shuns(battle, block, block.x, block.y)
    }));
    Movement.separate(battle, onField);
    onField.forEach((block, i) => {
      const { x, y, dry, safe } = stood[i];
      const pushed =
        (dry && Movement.isWet(battle, block, block.x, block.y)) ||
        (safe && Movement.shuns(battle, block, block.x, block.y)) ||
        Battlefields.getWallsBetween(battle.field, [x, y], [block.x, block.y]).length > 0 || // not even by a gate
        Movement.isCliffed(battle, block, [x, y], [block.x, block.y]) ||
        Works.isBarredByWorks(battle, block, [x, y], [block.x, block.y]);
      if (pushed) [block.x, block.y] = [x, y];
    });
    Movement.noteTraffic(battle, moves, onField);

    // who strikes is settled once all have moved, so neither side gets the first blow
    const byId = new Map(onField.map(block => [block.id, block]));
    for (const block of onField) {
      const target = block.action === "flee" ? undefined : byId.get(block.target ?? -1);
      if (target && Movement.inContact(battle, block, target)) block.action = "fight";
      else if (target && shooting.has(block.id) && Movement.canShoot(battle, block, target)) block.action = "shoot";
      else if (block.action === "fight") block.action = "hold"; // pushed apart from its foe
      if (!target || block.action !== "fight") block.impetus = 0;
      else if (!block.impetus && Works.isSheltered(battle, block, target))
        block.impetus = 1; // a charge breaks on the works
      else if (!block.impetus) {
        // a charge strikes with the speed it closed at; who stood has none
        const distance = Math.hypot(target.x - block.x, target.y - block.y) || 1;
        const closing = (block.vx * (target.x - block.x) + block.vy * (target.y - block.y)) / distance;
        block.impetus = Math.min(1 + BattleScale.toMetresPerSecond(Math.max(closing, 0)) / IMPETUS, MAX_IMPETUS);
      }
    }
  }

  /** Run for the edge of the field; the broken stop once no foe in order is near, to gather themselves, while their side fights on */
  private flee(battle: Battle, block: Block, others: Block[]): void {
    block.target = null;
    const safe = SAFE * battle.field.front;
    const chased = others.some(
      foe => foe.side !== block.side && foe.status === "ready" && Math.hypot(foe.x - block.x, foe.y - block.y) < safe
    );
    if (block.status === "routed" && !chased && this.isFighting(battle, block.side)) {
      block.action = "hold";
      return;
    }
    block.action = "flee";
    // ships on water with no way off the field sail out of the fight at once
    const sails = Movement.isMoored(battle, block) && Movement.isLandlocked(battle, block);
    const away =
      Movement.getFlight(battle, block) ?? (block.side === "attackers" ? battle.axis + Math.PI : battle.axis);
    block.facing = Movement.turn(block.facing, away, 1.2);
    if (!sails) Movement.step(battle, block, Math.cos(away), Math.sin(away), Infinity, others, FLIGHT);
    const off = block.x < 0 || block.x > battle.field.width || block.y < 0 || block.y > battle.field.height;
    if (off || sails) {
      block.status = "fled";
      battle.log.push({
        tick: battle.tick,
        event: "fled",
        side: block.side,
        params: { block: this.blockName(block) }
      });
    }
  }

  // Walls. A wall stops everybody; a gate lets through whom the burg is open to: all but the besiegers of the burg
  // the defenders of a siege hold. The besiegers get in by storm, over the walls and through the forced gates, or by a breach.

  /** The burg a siege is for, where the defenders form up: the one the battle is named after, or the nearest */
  private getHeld(battle: Battle): number | null {
    const { burgs } = battle.field;
    if (battle.type !== "siege" || !burgs.length) return null;
    const { width, height } = battle.field;
    const middle = (burg: { x: number; y: number }): number => Math.hypot(burg.x - width / 2, burg.y - height / 2);
    const named = burgs.filter(burg => burg.name === battle.place);
    return burgs.indexOf((named.length ? named : burgs).reduce((a, b) => (middle(a) < middle(b) ? a : b)));
  }

  /** Engines in range of a besieged burg work a breach into its wall, where it is nearest to them: by the weight of their blows */
  private batter(battle: Battle): void {
    const { field } = battle;
    const { phase } = battle.attackers;
    if (field.held === null || (phase !== "bombardment" && phase !== "storming")) return; // engines cover a storm too
    const burg = field.burgs[field.held];
    if (!burg.walled) return;
    const engines = battle.blocks.filter(
      block =>
        block.side === "attackers" &&
        block.status === "ready" &&
        block.type === "machinery" &&
        Math.hypot(block.x - burg.x, block.y - burg.y) <= block.range + burg.radius
    );
    if (!engines.length) return;
    battle.lastLoss = battle.tick; // no lull while the engines are at the walls
    battle.battered +=
      sum(engines, engine => this.getPower(battle, engine, engine.attack)) * (KILL_RATE / BREACH_BLOWS);
    if (battle.battered < 1) return;

    battle.battered -= 1;
    const engine = engines.reduce((a, b) => (b.troops > a.troops ? b : a));
    const middle = (wall: FieldWall): [number, number] => [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2];
    const far = (wall: FieldWall): number => Math.hypot(middle(wall)[0] - engine.x, middle(wall)[1] - engine.y);
    const walls = field.walls.filter(wall => wall.burg === field.held && !wall.gate);
    if (!walls.length) return;
    Battlefields.openBreach(field, field.held, middle(walls.reduce((a, b) => (far(b) < far(a) ? b : a))));
    battle.log.push({ tick: battle.tick, event: "breach", side: "attackers", params: { burg: burg.name } });
  }

  private fight(battle: Battle): void {
    const byId = new Map(battle.blocks.map(block => [block.id, block]));
    const strikers = battle.blocks.filter(block => block.action === "fight" || block.action === "shoot");

    const landed = new Map<number, number>(); // men it would cut down of defense 1, past the cover of those hit
    const pressed = new Map<number, number>(); // morale lost to hits in the flank and rear
    for (const block of strikers) {
      const target = byId.get(block.target!)!;
      const from = Battlefields.terrainAt(battle.field, block.x, block.y);
      const to = Battlefields.terrainAt(battle.field, target.x, target.y);
      const shot = block.action === "shoot";
      let power =
        this.getPower(battle, block, block.attack) *
        this.getImpetus(battle, block, target) *
        Movement.getFooting(battle, block, from);
      // cover takes its share of the losses: walls from without, woods and houses from shots
      const besieging = to.walled > 0 && from.walled !== to.walled;
      const cover =
        (besieging ? 1 / WALLS : shot && (to.wood || to.town) ? COVER : 1) * Works.getShelter(battle, block, target);

      if (shot) power *= SKIES[battle.weather].shot;
      else block.impetus = 1 + (block.impetus - 1) * SPENT;
      const bearing = Math.atan2(block.y - target.y, block.x - target.x);
      const angle = Math.abs(Movement.normalize(bearing - target.facing));
      const side = angle > 2.1 ? 2 : angle > 1.05 ? 1 : 0; // rear, flank, front
      if (side) {
        power *= side === 2 ? REAR : FLANK;
        pressed.set(target.id, (pressed.get(target.id) ?? 0) + side / 2);
      }
      landed.set(target.id, (landed.get(target.id) ?? 0) + power * cover * KILL_RATE);
    }

    for (const [id, blows] of landed) {
      const block = byId.get(id)!;
      const ground = Battlefields.terrainAt(battle.field, block.x, block.y);
      // what each man stands with: the harder the blows and the weaker the man, the more fall; counted in fractions
      const stands = this.getPower(battle, block, block.defense, 1, true) * Movement.getFooting(battle, block, ground);
      const fallen = blows / Math.max(stands, 0.01) / ROUND_TICKS;
      const share = fallen / block.initial;
      block.harm += fallen;
      const died = Math.min(Math.floor(block.harm), block.troops);
      block.harm -= died;
      block.troops -= died;
      const shaken = share * MORALE_LOSS + 1 / ROUND_TICKS + (pressed.get(id) ?? 0);
      block.morale = Math.max(block.morale - shaken / block.steadiness, 0);
      if (share) battle.lastLoss = battle.tick;
      block.hit = true;

      if (!block.troops) {
        block.status = "destroyed";
        block.action = "hold";
        battle.log.push({
          tick: battle.tick,
          event: "destroyed",
          side: block.side,
          params: { block: this.blockName(block) }
        });
        this.shake(battle, block, 6);
      }
    }
  }

  /** Battalions spend energy by what they do and win it back at rest; slopes and mud tire by taking longer */
  private tire(battle: Battle): void {
    for (const block of battle.blocks) {
      if (block.status !== "ready" && block.status !== "routed") continue;
      const speed = Math.hypot(block.vx, block.vy);
      const doing =
        block.action === "fight" || block.action === "shoot" || block.action === "build"
          ? block.action
          : speed > Movement.getPace(battle, block) * RUNNING || (block.status === "routed" && speed)
            ? "run"
            : speed
              ? "march"
              : "rest";
      const exertion = EXERTION[doing] * (battle.heat && doing !== "rest" ? HEAT : 1);
      block.energy = Math.min(Math.max(block.energy - exertion, 0), 1);
    }
  }

  private rout(battle: Battle, block: Block): void {
    block.status = "routed";
    battle.log.push({ tick: battle.tick, event: "rout", side: block.side, params: { block: this.blockName(block) } });
    this.shake(battle, block, 8);
  }

  /**
   * About to break with no way off the field round deep water and walls, past no foe: it gives itself up. It stays where
   * it is, in the way of all, strikes no blow and takes none; its men are lost to its side unless the side holds the field
   */
  private isCornered(battle: Battle, block: Block): boolean {
    return !Movement.hasWayOut(battle, block);
  }

  private surrender(battle: Battle, block: Block): void {
    this.yieldBlock(block);
    battle.log.push({
      tick: battle.tick,
      event: "surrender",
      side: block.side,
      params: { block: this.blockName(block) }
    });
    this.shake(battle, block, 6);
  }

  private yieldBlock(block: Block): void {
    Object.assign(block, { status: "surrendered", action: "hold", target: null, impetus: 0, vx: 0, vy: 0 });
  }

  /**
   * A side that gives itself up lays down its arms all at once, and its runners with nowhere to run with it: its order
   * says so in the log. A side that turns to run leaves behind who cannot break off: those at grips with no way out
   */
  private capitulate(battle: Battle): void {
    for (const block of battle.blocks) {
      if (block.leaving) continue;
      const { phase } = battle[block.side];
      if (block.status === "routed" && phase === SURRENDER && this.isCornered(battle, block)) this.yieldBlock(block);
      if (block.status !== "ready") continue;
      if (phase === SURRENDER) this.yieldBlock(block);
      else if (
        block.action === "fight" &&
        BattleRules.isBeaten(battle.type, block.side, phase) &&
        this.isCornered(battle, block)
      )
        this.surrender(battle, block);
    }
  }

  /** Strength in order of the friends and the foes about a battalion, and how far the nearest foe in order is */
  private getHand(battle: Battle, block: Block): { friends: number; foes: number; nearest: number } {
    let friends = 0;
    let foes = 0;
    let nearest = Infinity;
    const near = AT_HAND * battle.field.front;
    for (const other of battle.blocks) {
      if (other.status !== "ready") continue;
      const distance = Math.hypot(other.x - block.x, other.y - block.y);
      if (other.side !== block.side) nearest = Math.min(nearest, distance);
      if (distance > near) continue;
      if (other.side === block.side) friends += Battalions.getStrength(other);
      else if (battle.type !== "bombardment" || other.range) foes += Battalions.getStrength(other); // ships and troops only shoot
    }
    return { friends, foes, nearest };
  }

  /** A broken battalion that got away stands again, behind its side */
  private rally(battle: Battle, block: Block): void {
    block.status = "ready";
    block.action = "hold";
    // those who fight hand to hand join the reserve; shooters and engines go on shooting from where they stand
    const role: Role = block.kind === "shooter" ? "support" : block.kind === "engine" ? "battery" : "reserve";
    Object.assign(block.order, { role, mission: role, sent: false, target: null });
    Generals.takePlace(battle, block);
    battle.log.push({ tick: battle.tick, event: "rally", side: block.side, params: { block: this.blockName(block) } });
  }

  /** A loss nearby unsettles friends and heartens foes */
  private shake(battle: Battle, lost: Block, morale: number): void {
    const reach = SHAKE * battle.field.front;
    for (const block of battle.blocks) {
      if (block.status !== "ready" || Math.hypot(block.x - lost.x, block.y - lost.y) > reach) continue;
      const change = block.side === lost.side ? -morale / block.steadiness : this.isHungry(battle, block) ? 0 : morale;
      block.morale = Math.min(Math.max(block.morale + change, 0), 100);
    }
  }

  /** A garrison cut off goes hungry: it takes heart from nothing, and only food coming in ends it */
  private isHungry(battle: Battle, block: Block): boolean {
    return battle.cutOff && block.side === "defenders";
  }

  /** Power multiplier of a die: 0.375 for ⚀ to 1.125 for ⚅, 0.75 on average */
  getFortune(die: number): number {
    return 0.75 + (die - 3.5) * 0.15;
  }

  /** What a battalion strikes with, or stands with when `standing`; troops on the run hardly strike */
  private getPower(battle: Battle, block: Block, of: number, troops = block.troops, standing = false): number {
    const side = battle[block.side];
    const state = !standing && Movement.isRunning(block) ? BROKEN : side.phase === "shock" ? SHOCK : 1;
    return troops * block.upkeep * of * state * this.getFortune(side.die) * (0.5 + block.energy / 2);
  }

  /** What speed adds to a blow: a charge's, spent within a round or two at grips; a missile's, the more the nearer it was loosed */
  private getImpetus(battle: Battle, block: Block, target: Block): number {
    if (block.action === "fight") return Math.max(block.impetus, 1);
    const share = Math.hypot(target.x - block.x, target.y - block.y) / Movement.getRange(battle, block, target);
    return Math.min(Math.max(1.5 - share, 0.5), 1.5);
  }

  /** Power of the troops a side has in order, as the military screens count it */
  getUnitsPower(battle: Battle, side: Side): number {
    const inOrder = battle.blocks.filter(block => block.side === side && this.isInOrder(block));
    return sum(inOrder, block => block.troops * block.unitPower * block.upkeep);
  }

  /** Hearten or shake the troops of a side that are in order */
  private addMorale(battle: Battle, side: Side, value: number): void {
    const clamp = (morale: number): number => Math.min(Math.max(morale + value, 0), 100);
    for (const block of battle.blocks)
      if (block.side === side && block.status === "ready") block.morale = clamp(block.morale);
    battle[side].morale = clamp(battle[side].morale);
  }

  private signed(value: number): string {
    return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  }

  private updatePower(battle: Battle): void {
    for (const side of SIDES) {
      const blocks = battle.blocks.filter(block => block.side === side);
      const base = sum(
        blocks.filter(block => this.isInOrder(block)),
        block => Battalions.getStrength(block)
      );
      battle[side].power = base / (battle.populationScale / 10);
      const initial = sum(blocks, block => block.initial);
      const troops = sum(blocks, block => this.getFree(block));
      battle[side].casualties = initial ? 1 - sum(blocks, block => block.troops) / initial : 0;
      battle[side].captured = initial ? sum(blocks, block => this.getPrisoners(block)) / initial : 0;
      if (battle.tick)
        battle[side].morale = troops ? sum(blocks, block => block.morale * this.getFree(block)) / troops : 0;
    }
  }

  private setInitialMorale(battle: Battle): void {
    for (const side of SIDES) {
      const own = battle[side];
      const enemy = battle[BattleRules.enemyOf(side)];
      const troops = sum(own.regiments, regiment => this.total(regiment));
      const stability = troops
        ? sum(own.regiments, regiment => regiment.stability * this.total(regiment)) / troops
        : 0.5;
      const ratio = own.power ? enemy.power / own.power : 1;
      own.morale = BattleRules.getInitialMorale(
        ratio,
        stability,
        own.regiments.map(regiment => regiment.distance)
      );
      for (const block of battle.blocks) if (block.side === side) block.morale = own.morale;
    }
  }

  private checkEnd(battle: Battle): void {
    const standing = (side: Side, statuses: BlockStatus[]): boolean =>
      battle.blocks.some(block => block.side === side && statuses.includes(block.status));
    const ready = SIDES.map(side => battle.blocks.some(block => block.side === side && this.isInOrder(block)));
    const onField = SIDES.map(side => standing(side, ["ready", "routed"]));

    const over =
      !onField[0] ||
      !onField[1] ||
      (!ready[0] && !ready[1]) ||
      battle.tick >= BattleScale.minutesToTicks(battle.settings.maxMinutes) ||
      (battle.engaged !== null &&
        !battle.cutOff &&
        battle.tick - battle.lastLoss > battle.settings.lullRounds * ROUND_TICKS); // a long way round is no lull, nor a blockade
    if (!over) return;

    // a side holds the field while it has troops in order and has neither turned to run nor given itself up
    const holds = SIDES.map((side, i) => ready[i] && !BattleRules.isBeaten(battle.type, side, battle[side].phase));
    const winner = holds[0] === holds[1] ? null : holds[0] ? "attackers" : "defenders";
    // who holds the field frees its own who gave themselves up
    for (const block of battle.blocks)
      if (block.side === winner && block.status === "surrendered") block.status = "ready";
    this.updatePower(battle);
    const status = BattleRules.getStatus(this.getLost(battle.attackers), this.getLost(battle.defenders), winner);
    if (battle.raised) status[0] = "attackers raised the siege";
    battle.result = { winner, status };
    battle.log.push({ tick: battle.tick, event: "end", side: winner });
  }

  private getMen(unit: MilitaryUnit, troops: number): number {
    return troops * Math.max(unit.crew, 1);
  }

  /** The field sized by the battalions; a siege is about the walls. A field of the map is built anew to it */
  private setScale(battle: Battle): void {
    const { field } = battle;
    const radius = battle.type === "siege" && field.site ? Battlefields.getSiegeRadius(field.site) : Infinity;
    const size = BattleScale.getFieldSize(battle.battalion, radius);
    if (field.width === size.width && field.front === size.front) return;
    if (field.site) battle.field = Battlefields.build(field.site[0], field.site[1], size, battle.type);
    else {
      const ratio = size.width / field.width; // cliffs are ground, drawn on the nodes as water is
      const scale = ([x, y]: [number, number]): [number, number] => [x * ratio, y * ratio];
      field.cliffs = field.cliffs.map(({ a, b, height }) => ({ a: scale(a), b: scale(b), height }));
      Object.assign(field, size);
      if (field.burgs.length) Battlefields.raiseWalls(field); // their grid of the new nodes
    }
  }

  /** Men in a battalion: 0.3 to 1 population point, the least that makes no more battalions of all the troops than allowed; 0.2 when 0.3 makes fewer than the fewest */
  private getBattalionSize(battle: Battle): number {
    let men = 0;
    for (const side of SIDES) {
      for (const regiment of battle[side].regiments) {
        for (const unit of battle.units) men += this.getMen(unit, regiment.troops[unit.name] ?? 0);
      }
    }
    const battalions = (size: number): number => men / (size * battle.populationScale);
    const { minBattalions, maxBattalions } = battle.settings;
    const size =
      battalions(0.3) < minBattalions ? 0.2 : ([0.3, 0.5].find(size => battalions(size) <= maxBattalions) ?? 1);
    return Math.round(size * battle.populationScale);
  }

  /** Split the regiment into battalions: a unit ten times as numerous fields ten times as many */
  private addBlocks(battle: Battle, side: Side, regiment: BattleRegiment): Block[] {
    const added: Block[] = [];
    const { front } = battle.field;
    for (const unit of battle.units) {
      const troops = regiment.troops[unit.name];
      if (!troops) continue;
      const count = Math.min(Math.max(Math.round(this.getMen(unit, troops) / battle.battalion), 1), troops);

      for (let n = 0; n < count; n++) {
        const share = Math.floor(troops / count) + +(n < troops % count);
        const block: Block = {
          id: battle.blocks.length,
          key: `${side[0]}${regiment.state}-${regiment.i}-${unit.name}-${n}`,
          side,
          state: regiment.state,
          regiment: regiment.i,
          unit: unit.name,
          number: count > 1 ? n + 1 : 0,
          type: unit.type,
          kind: Battalions.getKind(unit, battle.field.open !== null),
          unitPower: getUnitPower(unit),
          attack: unit.attack,
          defense: unit.defense,
          speed: BattleScale.toMetresPerTick(unit.speed),
          range: unit.range,
          steadiness: Math.max(unit.morale, 0.1),
          upkeep: regiment.upkeep,
          initial: share,
          troops: share,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          impetus: 0,
          facing: 0,
          width:
            Math.min(Math.max(this.getMen(unit, share) / battle.battalion, BLOCK_WIDTH[0]), BLOCK_WIDTH[1]) * front,
          depth: BLOCK_DEPTH * front,
          morale: battle[side].morale,
          energy: 1,
          status: "ready",
          action: "hold",
          target: null,
          hit: false,
          harm: 0.5, // losses are rounded to the nearest man, or ship
          leaving: false,
          detour: 0,
          goal: null,
          task: null,
          order: { ...NO_ORDER }
        };
        battle.blocks.push(block);
        added.push(block);
      }
    }
    return added;
  }

  /** Latecomers form up behind their side */
  private reinforce(battle: Battle, side: Side, regiment: BattleRegiment): void {
    Generals.enlist(battle, side, this.addBlocks(battle, side, regiment));
  }

  /** The approach, turned as little as it takes for the attackers to form up on land */
  private findAxis(battle: Battle): number {
    const { field, approach } = battle;
    if (BattleRules.isFromSea(battle.type) && !field.open) {
      // the way the fleet came, unless that is from the land: then straight from the water
      const landward = this.getLandward(field);
      return landward === null || Math.abs(Movement.normalize(approach - landward)) < Math.PI / 3 ? approach : landward;
    }
    if (field.open) return approach;
    const dry = (axis: number): boolean =>
      [-0.3, 0, 0.3].every(shift =>
        [0.6, 0.8, 1].every(depth => {
          const across = axis + Math.PI / 2;
          const [along, aside] = [Generals.reach(field, axis), Generals.reach(field, across)];
          const x = field.width / 2 - Math.cos(axis) * along * depth + Math.cos(across) * aside * shift;
          const y = field.height / 2 - Math.sin(axis) * along * depth + Math.sin(across) * aside * shift;
          return Battlefields.terrainAt(field, x, y).water !== 1;
        })
      );
    for (const swing of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2, Math.PI])
      if (dry(approach + swing)) return approach + swing;
    return approach;
  }

  /** From the sea or a lake onto the land, as the field lies: the way a fleet comes at the shore */
  private getLandward(field: Battlefield): number | null {
    const [land, sea] = [
      { x: 0, y: 0, n: 0 },
      { x: 0, y: 0, n: 0 }
    ];
    for (let node = 0; node < field.water.length; node++) {
      if (field.water[node] === 2) continue; // a river says nothing of where the sea is
      const [x, y] = Battlefields.nodeCentre(field, node);
      const sum = field.water[node] ? sea : land;
      [sum.x, sum.y, sum.n] = [sum.x + x, sum.y + y, sum.n + 1];
    }
    if (!land.n || !sea.n) return null;
    return Math.atan2(land.y / land.n - sea.y / sea.n, land.x / land.n - sea.x / sea.n);
  }

  private moveBlock(battle: Battle, key: string, x: number, y: number): void {
    const block = battle.blocks.find(block => block.key === key);
    if (!block) return;
    [block.x, block.y] = Generals.onField(battle.field, [x, y]);
    block.action = "hold";
    Generals.takePlace(battle, block);
  }

  private turnBlock(battle: Battle, key: string, facing: number): void {
    const block = battle.blocks.find(block => block.key === key);
    if (block) block.facing = block.order.facing = Movement.normalize(facing);
  }

  /** Battalions given a task by hand: those of the side that can still take orders */
  private assign(battle: Battle, change: Extract<Intervention, { kind: "task" }>): void {
    const target = battle.blocks.find(block => block.key === change.target) ?? null;
    const blocks = change.blocks
      .map(key => battle.blocks.find(block => block.key === key))
      .filter((block): block is Block => block?.status === "ready" && !block.leaving && block !== target);
    if (!blocks.length || (change.task !== "move" && target?.status !== "ready")) return;
    // sent to a point, they keep their places to one another and all face the way they go
    const [cx, cy] = [sum(blocks, block => block.x) / blocks.length, sum(blocks, block => block.y) / blocks.length];
    const facing = Math.atan2(change.y - cy, change.x - cx);
    for (const block of blocks) {
      const at: Point = [change.x + block.x - cx, change.y + block.y - cy];
      const [x, y] = change.task === "move" ? Generals.onField(battle.field, at) : [change.x, change.y];
      block.task = { kind: change.task, x, y, facing, target: target?.id ?? null, round: battle.round };
    }
    const params: Record<string, string> = {
      block: this.blockName(blocks[0]),
      count: String(blocks.length),
      task: change.task
    };
    if (target) params.target = this.blockName(target);
    battle.log.push({ tick: battle.tick, event: "task", side: blocks[0].side, params });
  }

  /** A task stands till it is done or has stood its time; a battalion that broke or leaves the field drops it */
  private isTaskOver(battle: Battle, block: Block, task: Task): boolean {
    if (block.status !== "ready" || block.leaving) return true;
    if (battle.round - task.round >= battle.settings.orderRounds) return true;
    if (task.kind === "move") return false;
    const target = battle.blocks.find(other => other.id === task.target);
    return target?.status !== "ready";
  }

  /** A battalion in the log: the side is shown beside it, and the regiment's name would take the line */
  private blockName(block: Block): string {
    return `${block.unit.replace(/_/g, " ")} ${block.number || ""}`.trim();
  }

  private total(regiment: BattleRegiment): number {
    return sum(Object.values(regiment.troops), troops => troops);
  }
}

export const Battles = new BattleModule();

import { sum } from "d3";
import { type BattleSettings, DEFAULT_BATTLE_SETTINGS, MAX_FORTUNE } from "@/data/battle-options";
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
  RISK,
  RUNNING,
  SAFE,
  SHAKE,
  SHOCK,
  SPENT,
  STARVED,
  STORM_ODDS,
  THROWN,
  WALLS,
  YIELD
} from "./battle-balance";
import {
  BattleRules,
  type BattleType,
  type Command,
  PHASES,
  type Phase,
  SIDES,
  type Side,
  SURRENDER
} from "./battle-rules";
import { BattleScale } from "./battle-scale";
import { type Battlefield, Battlefields, BURG_END, type FieldWall } from "./battlefield";
import type { TacticName } from "./formations";
import { Generals } from "./general";
import { ARRIVED, type Move, Movement, ROUND_TICKS } from "./movement";
import { Sight } from "./sight";
import { BattleTime } from "./time";
import { type Condition, HEAT, SKIES, type Weather } from "./weather";
import { Works } from "./works";

export { ROUND_TICKS };

// in battalion fronts
const BATTALION_DEPTH = 0.5;
const BATTALION_WIDTH = [0.41, 1.32]; // the least and the most, by its men
const MARCHING = 0.7; // further from its place a battalion faces the way it marches

// of a pace a tick
const MARCH = 1.4; // the way a battalion makes in a round to be on the march
const PUSH = 0.25; // battalion fronts a battalion is pushed aside in a tick at the most, or its pace

const HIGH_GROUND = 20; // metres the defenders' ground above the attackers' turns the attack its way in full
const AXIS_SHIFTS = [-0.3, 0, 0.3]; // across the field, in shares of its reach: where the sides' ground is looked at

export type BattalionStatus = "ready" | "routed" | "surrendered" | "fled" | "destroyed";
export type BattalionAction = "hold" | "move" | "shoot" | "fight" | "flee" | "build";
export type Role = "line" | "support" | "battery" | "wing" | "reserve" | "wedge";
export type Mission = "line" | "support" | "battery" | "guard" | "reserve" | "flank" | "hunt" | "withdraw" | "feint";

/** What the general tells a battalion: its place in the formation and what to do there */
export interface Order {
  role: Role; // what it is in the formation
  mission: Mission; // what it is to do this round
  rank: number; // the line it stands in, 0 the first
  across: number; // its place: to the right of the middle of the formation
  along: number; // and ahead of its first line
  ahead: number | null; // a shooter's along while its side stands off, before the first line: none if it shoots from its place
  x: number; // where it goes this round: its place, or on a flank errand the point it goes round the foe by
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
  camp: Point; // where it formed up
  fixed: boolean; // places are points of the field: the formation does not move
  half: number; // half the first line
  halt: number; // how far from the foe the formation stops to shoot
  reach: number; // how far from the foe its shooters' shots fall on its front
  since: number; // round the phase was taken
  fired: number | null; // round its shooting began
  byHand: {
    order: Command | null; // while it stands
    round: number | null; // the order was given
    defiant: boolean; // to fight a day its general gave up for lost before it began
    stands: boolean; // out of a retreat: its general does not turn back to it
  };
  opening: number; // rounds the surprise of an ambush lasts
  gap: number; // between the sides, last round
  apart: number; // between the middles of the sides, last round
  walk: number; // on a field with cliffs: the shortest way round them from the side to the foe, last round
  idle: number; // rounds it has not closed
  losses: number; // share of the troops lost by the last round, the parts of men too
  bled: number; // rounds in a row it lost men to shots alone
  fortify: boolean; // the side builds works
  arrival: number; // ticks till the foe is upon it, as the general reckons it this round; Infinity when it does not come
  wedge: Wedge | null; // the riders' own formation, when they fight apart
  muster: Muster | null; // a sortie's party forming up outside the walls
  hooks: [left: number[], right: number[]]; // battalions turned out at the ends of the line, the nearest the end first
  lure: Point | null; // where the foe stood when the side fell back to draw him out: it feigns once
  declined: boolean; // attackers who would not go in and left the field unbroken
}

/** The party of a sortie formed up outside the gate it goes out by, before it falls on the foe */
export interface Muster {
  x: number;
  y: number;
  heading: number;
  until: number; // round it goes at the latest, formed up or not
  launched: number | null; // round it went for the foe
  homes: Record<number, [x: number, y: number, facing: number]>; // the places its party left, by battalion
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
export interface Battalion {
  id: number;
  key: string; // stable across redeployment, for the log
  side: Side;
  state: number;
  regiment: number;
  unit: string;
  number: number; // among the regiment's battalions of the unit, from 1; 0 when it is the only one
  type: string;
  kind: Kind;
  stats: BattalionStats;
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
  status: BattalionStatus;
  action: BattalionAction;
  target: number | null;
  hit: boolean; // took losses this round
  harm: number; // the part of a man lost so far
  leaving: boolean; // its regiment was taken out of the battle: it marches off the field
  detour: number; // the side it goes round what is in its way by: -1, 1, or 0 on a clear way
  goal: Point | null; // where it is going this tick
  byHand: {
    task: Task | null; // it comes before the general's order while it stands
    parole: boolean; // to give itself up: nobody frees it before the end
    stays: boolean; // to fight on as its side withdraws: it does till it breaks
  };
  order: Order;
}

/** What a battalion's unit fights with, fixed for the battle */
export interface BattalionStats {
  power: number; // of the unit
  attack: number;
  defense: number;
  speed: number; // metres a tick
  range: number; // it shoots over, 0 to fight hand to hand
  steadiness: number; // the unit's morale: what its losses of morale are divided by
  upkeep: number; // share of the power ill-kept troops fight with
}

/** Pointed at a spot, a foe or a friend: move, attack, pursue a broken foe, protect; or given on the battalion's own spot */
export type TaskKind =
  | "move"
  | "attack"
  | "pursue"
  | "protect"
  | "hold"
  | "defend"
  | "skirmish"
  | "fortify"
  | "retreat"
  | "surrender";

const POINTED_TASKS: TaskKind[] = ["move", "attack", "pursue", "protect"];
const REHEARSED: Intervention["kind"][] = ["dig", "tactic", "order", "morale"]; // set before the start, and kept in the generals' minds

/** What the user tells a battalion to do; retreat and surrender are done at once and stand as no task */
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
  phase: Phase;
  die: number | null; // cast at the opening; null: no fortune, ×1
  tactic: TacticName | null; // what its general settled on, thinking the battle through
  waits: boolean; // and that he will wait for the foe rather than go to meet him
  storms: boolean; // or storm the walls at once, a little short of the odds they ask for
  advancing: boolean; // comes to the foe rather than waits for it
  plan: Plan;
}

export type Intervention =
  | { tick: number; kind: "move"; battalion: string; x: number; y: number }
  | { tick: number; kind: "turn"; battalion: string; facing: number }
  | { tick: number; kind: "task"; battalions: string[]; task: TaskKind; x: number; y: number; target: string | null }
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
  | "freed"
  | "destroyed"
  | "fled"
  | "breach"
  | "cut"
  | "supplied"
  | "dig"
  | "weather"
  | "condition"
  | "time"
  | "fortified"
  | "gap"
  | "raised"
  | "clash"
  | "feint"
  | "turned"
  | "broken"
  | "end";

/** What happened; the screen words it */
export interface LogEntry {
  tick: number;
  event: LogEvent;
  side?: Side;
  params?: Record<string, string>;
}

export interface BattleResult {
  winner: Side | null;
  status: [string, string]; // as the attackers and the defenders see it
}

/** What a general may settle on before a battle: a tactic, to wait for the foe rather than go to meet him, to storm at once */
export type GeneralChoice = Pick<BattleSide, "tactic" | "waits" | "storms">;

/** What each general settled on before the start */
export type Settled = Record<Side, GeneralChoice>;

export interface Battle {
  type: BattleType;
  name: string;
  place: string | null;
  x: number;
  y: number;
  cell: number;
  approach: number; // direction the attackers came from the map, radians: breaks a tie of the field's axes
  axis: number; // direction of the attack on the field, as the field lies (`findAxis`)
  field: Battlefield;
  scene: Battlefield | null; // the field's ground and more round it, for the drawing: the field is cut from its middle, and changes to it are copied in
  units: MilitaryUnit[];
  populationScale: number; // men in a population point
  battalionSize: number; // men in a full battalion, the same for both sides
  attackers: BattleSide;
  defenders: BattleSide;
  battalions: Battalion[];
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
  settled: Settled | null; // what they settled on: a replay takes it and does not think it through again
  rehearsal: boolean; // it is fought in a general's mind
  settings: BattleSettings; // copied in at the setup: a battle under way never changes
  seed?: number; // the dice are cast by it; none: no fortune
  weather: Weather;
  mud: boolean; // the ground is soaked
  ice: boolean; // the ground and the rivers are frozen
  heat: boolean;
  hour: number; // of the day the battle starts at, 0 to 23
  latitude: number; // of the place, in degrees: where the sun stands
}

/** How a game the generals play in their minds ended */
interface Rehearsal {
  winner: Side | null;
  fought: boolean; // a blow was struck hand to hand before anybody ran: a side that left before is not beaten
  lost: Record<Side, number>; // share of each side's troops
}

/** Optional ground and time default to clear weather at midday */
export interface BattleSetup
  extends Pick<Battle, "type" | "name" | "place" | "x" | "y" | "cell" | "axis" | "field" | "units" | "populationScale">,
    Partial<Pick<Battle, "settings" | "seed" | "weather" | "mud" | "ice" | "heat" | "hour" | "latitude">> {
  attackers: BattleRegiment[];
  defenders: BattleRegiment[];
}

const NO_ORDER: Order = {
  role: "line",
  mission: "line",
  rank: 0,
  across: 0,
  along: 0,
  ahead: null,
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
  reach: 0,
  since: 0,
  fired: null,
  byHand: { order: null, round: null, defiant: false, stands: false },
  opening: 0,
  gap: Infinity,
  apart: Infinity,
  walk: Infinity,
  idle: 0,
  losses: 0,
  bled: 0,
  fortify: false,
  arrival: Infinity,
  wedge: null,
  muster: null,
  hooks: [[], []],
  lure: null,
  declined: false
};

class BattleModule {
  private readonly places = new WeakMap<Battle, Map<number, [number, number]>>();

  private createSide(regiments: BattleRegiment[], phase: Phase): BattleSide {
    return {
      regiments,
      morale: 100,
      casualties: 0,
      captured: 0,
      power: 0,
      phase,
      die: null,
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
      hour: 12,
      latitude: 45,
      scene: null,
      ...rest,
      settings: { ...DEFAULT_BATTLE_SETTINGS, ...settings },
      approach: setup.axis,
      battalionSize: 0,
      attackers: this.createSide(attackers, PHASES[setup.type].attackers[0]),
      defenders: this.createSide(defenders, PHASES[setup.type].defenders[0]),
      battalions: [],
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
      settled: null,
      rehearsal: false
    };
    this.prepare(battle);
    return battle;
  }

  /** Draw the troops up anew; only before the first tick, the user's moves are kept */
  prepare(battle: Battle): void {
    if (battle.tick) return;
    battle.battalions = [];
    const size = this.getBattalionSize(battle);
    // battalions of another size are other battalions on another field: those placed by hand are drawn up anew
    if (battle.battalionSize && size !== battle.battalionSize)
      battle.interventions = battle.interventions.filter(change => change.kind !== "move" && change.kind !== "turn");
    battle.battalionSize = size;
    this.setScale(battle);
    battle.field.frozen = battle.ice;
    Movement.forgetWays(battle.field);
    battle.axis = this.findAxis(battle);
    battle.field.held = this.getHeld(battle);
    Movement.openCrossing(battle, Generals.getBase(battle, "attackers"), Generals.getBase(battle, "defenders"));
    for (const side of SIDES) {
      battle[side].phase = PHASES[battle.type][side][0];
      for (const regiment of battle[side].regiments) this.addBattalions(battle, side, regiment);
    }
    this.castDice(battle);
    this.updatePower(battle);
    this.setInitialMorale(battle);
    for (const change of battle.interventions) {
      if (change.kind === "morale") this.addMorale(battle, change.side, change.value);
    }
    this.drawUp(battle); // with the morale as it stands: a general who sees the day lost leaves the field
  }

  /** Stand the battalions there are in their places, by the tactics of the generals and then by the user's hand */
  private drawUp(battle: Battle, retreating: Side[] = []): void {
    Movement.forgetWays(battle.field);
    Generals.deploy(battle, retreating);
    Movement.separate(battle, battle.battalions); // a crowded line spreads out
    Generals.settle(battle);
    for (const battalion of battle.battalions) Generals.takePlace(battle, battalion);
    for (const change of battle.interventions) {
      if (change.kind === "move") this.moveBattalion(battle, change.battalion, change.x, change.y);
      if (change.kind === "turn") this.turnBattalion(battle, change.battalion, change.facing);
      if (change.kind === "order") Generals.obey(battle, change.side, change.order);
    }
    Generals.digIn(battle);
    Movement.forgetWays(battle.field);
    // a general who sees the day lost before it begins leaves the field: that is his tactic
    const hopeless = Generals.giveUp(battle, retreating);
    if (hopeless.length) this.drawUp(battle, [...retreating, ...hopeless]);
    else this.noteTactics(battle);
  }

  /** The log tells the time of day the battle starts at, and every turn of it the battle lasts into */
  private noteTime(battle: Battle): void {
    if (battle.rehearsal) return;
    const period = (tick: number) => BattleTime.getPeriod(BattleTime.getTime(battle.hour, tick));
    const now = period(battle.tick);
    if (battle.tick && now === period(battle.tick - ROUND_TICKS)) return;
    battle.log.push({ tick: battle.tick, event: "time", params: { period: now } });
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
  plan(battle: Battle, settled: Settled | null = null): void {
    if (battle.tick || battle.planned) return;
    battle.planned = true;
    if (battle.rehearsal) return;
    battle.settled = settled ?? this.think(battle);
    let changed = false;
    for (const side of SIDES) {
      const { tactic, waits, storms } = battle.settled[side];
      if (waits || (tactic && tactic !== battle[side].plan.tactic)) changed = true;
      Object.assign(battle[side], { tactic, waits, storms });
    }
    if (changed)
      this.drawUp(battle); // the same battalions, in other places
    else Movement.forgetWays(battle.field);
  }

  /** Each general plays the options open to him and takes the one that ends best */
  private think(battle: Battle): Settled {
    // each against the foe as the odds make him expect it: neither knows what the other has settled on
    const choices = SIDES.map(side => Generals.getChoices(battle, side));
    const wagenburg = [...choices.flat(), ...SIDES.map(side => battle[side].plan)].some(
      ({ tactic }) => tactic === "wagenburg"
    );
    const { planTicks } = battle.settings;
    const stormPlanTicks = planTicks / 2; // a storm of walls or of a wagon ring is slow to reckon
    const ticks = battle.type === "siege" || wagenburg ? stormPlanTicks : planTicks;
    const played = new Map<string, Rehearsal>(); // a side's option is often what the other expects of it: the same game
    const settled = SIDES.map((side, i) => {
      let best: GeneralChoice | null = null;
      let most = -Infinity;
      for (const choice of choices[i]) {
        // an attackers' general takes a risk: an attack or a storm he cannot see the end of is worth some losses
        const bold = side === "attackers" && !choice.waits && (choice.storms || battle.type !== "siege");
        const outcome = this.rehearse(battle, side, choice, ticks, played) + (bold ? RISK : 0);
        if (outcome > most) [best, most] = [choice, outcome];
      }
      return best ?? { tactic: null, waits: false, storms: false };
    });
    return { attackers: settled[0], defenders: settled[1] };
  }

  /**
   * How a battle goes for a side that does as its general has in mind: who holds the field, then whose losses are the
   * lighter. A game is played once: drawn up alike, both sides do the same whoever's option it is
   */
  private rehearse(
    battle: Battle,
    side: Side,
    choice: GeneralChoice,
    ticks: number,
    played: Map<string, Rehearsal>
  ): number {
    const copy = (name: Side): BattleSide => ({
      ...this.createSide(battle[name].regiments, battle[name].phase),
      ...(name === side ? choice : {})
    });
    // fortune is not theirs to know: no dice are cast, and nobody has moved a battalion by hand;
    // the ground is a copy: a storm in the mind breaches no walls
    const trial: Battle = {
      ...battle,
      field: structuredClone(battle.field),
      scene: null, // nobody draws a rehearsal
      attackers: copy("attackers"),
      defenders: copy("defenders"),
      battalions: [],
      course: [],
      interventions: battle.interventions.filter(change => REHEARSED.includes(change.kind)), // the ground, tactics, orders and morale set by hand
      log: [],
      result: null,
      planned: true,
      rehearsal: true
    };
    this.prepare(trial); // the tactics are settled here: a side's own `tactic` is read no more
    const key = SIDES.map(name => `${trial[name].plan.tactic}|${trial[name].waits}|${trial[name].storms}`).join("|");
    let game = played.get(key);
    if (!game) {
      let fought = false;
      for (let i = 0; i < ticks && !trial.result; i++) {
        this.tick(trial);
        const running = SIDES.some(name => BattleRules.isBeaten(trial.type, name, trial[name].phase)); // a pursuit is no battle
        fought ||= !running && trial.battalions.some(battalion => battalion.action === "fight");
      }
      game = {
        winner: trial.result?.winner ?? null,
        fought,
        lost: { attackers: this.getLost(trial.attackers), defenders: this.getLost(trial.defenders) }
      };
      played.set(key, game);
    }
    const held = game.winner === side ? 1 : game.winner && game.fought ? -1 : 0;
    return held * 3 + game.lost[BattleRules.enemyOf(side)] - game.lost[side]; // losses differ by 2 at most: they only break ties
  }

  intervene(battle: Battle, change: Intervention): void {
    battle.interventions.push(change);
    if (change.kind === "move" || change.kind === "turn") {
      const battalion = battle.battalions.find(battalion => battalion.key === change.battalion);
      if (!battalion) return;
      if (change.kind === "move") this.moveBattalion(battle, change.battalion, change.x, change.y);
      else this.turnBattalion(battle, change.battalion, change.facing);
      if (!battle.tick) {
        Generals.digIn(battle); // the works prepared before the battle stand before the battalion where it is now
        Movement.forgetWays(battle.field);
      }
      battle.log.push({
        tick: battle.tick,
        event: change.kind,
        side: battalion.side,
        params: { battalion: this.battalionName(battalion) }
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
      const die = this.toDie(change.die);
      battle[change.side].die = die;
      battle.log.push({ tick: battle.tick, event: "die", side: change.side, params: { die: String(die) } });
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
      for (const battalion of battle.battalions) {
        if (battalion.state === state && battalion.regiment === i && battalion.side === side) battalion.leaving = true;
      }
    } else {
      const prefix = `${side[0]}${state}-${i}-`; // of its battalions' keys
      battle[side].regiments = battle[side].regiments.filter(other => other !== regiment);
      battle.interventions = battle.interventions.filter(change => {
        if (change.kind === "withdraw") return false;
        if (change.kind === "add") return change.regiment.state !== state || change.regiment.i !== i;
        if (change.kind === "move" || change.kind === "turn") return !change.battalion.startsWith(prefix);
        return true;
      });
      // a side left with latecomers only: the first of them is the regiment it began with
      const [first, ...rest] = battle[side].regiments;
      const isLate = (other: BattleRegiment, change: Intervention): boolean =>
        change.kind === "add" && change.regiment.state === other.state && change.regiment.i === other.i;
      if (first && [first, ...rest].every(other => battle.interventions.some(change => isLate(other, change))))
        battle.interventions = battle.interventions.filter(change => !isLate(first, change));
    }
    battle.log.push({ tick: battle.tick, event: "withdraw", side, params: { regiment: regiment.name } });
  }

  /** The armies or the ground changed before the start: what the general settled on does not stand */
  rethink(battle: Battle): void {
    battle.planned = false;
    battle.settled = null;
    for (const side of SIDES) Object.assign(battle[side], { tactic: null, waits: false, storms: false });
  }

  /** The hour the battle starts at, before the start: the dark changes how far the troops see, so the generals think again */
  setHour(battle: Battle, hour: number): void {
    if (battle.tick || battle.hour === hour) return;
    battle.hour = hour;
    this.rethink(battle);
    this.prepare(battle);
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

  /** Run a recorded battle to its end, or to the tick it was applied at, with the generals' plan when it is known */
  replay(battle: Battle, interventions: Intervention[], settled: Settled | null = null, until = Infinity): void {
    const script = [...interventions];
    this.applyDue(battle, script);
    this.plan(battle, settled);
    while (!battle.result && battle.tick < until) {
      this.tick(battle);
      this.applyDue(battle, script);
    }
    if (!battle.result) this.settleLosses(battle);
  }

  getTroops(battle: Battle, side: Side): { initial: number; left: number; captured: number } {
    const battalions = battle.battalions.filter(battalion => battalion.side === side);
    return {
      initial: sum(battalions, battalion => battalion.initial),
      left: sum(battalions, battalion => this.getFree(battalion)),
      captured: sum(battalions, battalion => this.getPrisoners(battalion))
    };
  }

  /** Troops of a battalion still its side's: those who gave themselves up are lost to it, unless it holds the field */
  private getFree(battalion: Battalion): number {
    return battalion.status === "surrendered" ? 0 : battalion.troops;
  }

  private getPrisoners(battalion: Battalion): number {
    return battalion.troops - this.getFree(battalion);
  }

  /** Share of a side's troops lost to it: fallen or taken prisoner */
  private getLost(side: BattleSide): number {
    return side.casualties + side.captured;
  }

  /** The regiment was taken out of the battle and is leaving the field */
  isWithdrawn(battle: Battle, regiment: BattleRegiment): boolean {
    return battle.battalions.some(
      battalion => battalion.state === regiment.state && battalion.regiment === regiment.i && battalion.leaving
    );
  }

  private isInOrder(battalion: Battalion): boolean {
    return battalion.status === "ready" && !battalion.leaving; // and fights on
  }

  /** Troops of a regiment fallen, by unit */
  getLosses(battle: Battle, regiment: BattleRegiment): Record<string, number> {
    return this.countUnits(battle, regiment, battalion => battalion.initial - battalion.troops);
  }

  /** Troops of a regiment taken prisoner, by unit */
  getCaptured(battle: Battle, regiment: BattleRegiment): Record<string, number> {
    return this.countUnits(battle, regiment, battalion => this.getPrisoners(battalion));
  }

  private countUnits(
    battle: Battle,
    regiment: BattleRegiment,
    count: (battalion: Battalion) => number
  ): Record<string, number> {
    const units: Record<string, number> = {};
    for (const battalion of battle.battalions) {
      if (battalion.state !== regiment.state || battalion.regiment !== regiment.i) continue;
      units[battalion.unit] = (units[battalion.unit] ?? 0) + count(battalion);
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
    this.noteTime(battle);
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
    const fighting = battle.battalions.some(battalion => battalion.action === "fight" || battalion.action === "shoot");
    // on the march are those who got somewhere since the last round: a battalion shuffling about its place is not
    const stood = this.places.get(battle) ?? new Map<number, [number, number]>();
    const marching = battle.battalions.some(battalion => {
      const [x, y] = stood.get(battalion.id) ?? [battalion.x, battalion.y];
      return (
        battalion.action === "move" &&
        Math.hypot(battalion.x - x, battalion.y - y) > Movement.getPace(battle, battalion) * MARCH
      );
    });
    this.places.set(battle, new Map(battle.battalions.map(battalion => [battalion.id, [battalion.x, battalion.y]])));
    const held = SIDES.some(side => battle[side].plan.byHand.order); // stood by an order, a side has not begun
    if (battle.engaged === null && battle.round && (fighting || (!marching && !held))) {
      battle.engaged = battle.round;
      battle.lastLoss = battle.tick;
    }
    // the armies clash at the first blow struck hand to hand, not when they halt apart
    if (
      battle.battalions.some(battalion => battalion.action === "fight") &&
      !battle.log.some(entry => entry.event === "clash")
    )
      battle.log.push({ tick: battle.tick, event: "clash" });

    const beaten = SIDES.map(side => BattleRules.isBeaten(battle.type, side, battle[side].phase));
    Generals.command(battle);
    SIDES.forEach((side, i) => {
      const { tactic, declined } = battle[side].plan;
      if (tactic === "strategicRetreat" || declined) return; // it leaves as it meant to, unbroken
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
      battle.battalions.some(battalion => battalion.side === side && battalion.status === "ready")
    );
  }

  /**
   * Morale by what a battalion sees around it: it loses heart outnumbered and takes heart with the upper hand or left alone.
   * The spent break and run, the most shaken first: their flight heartens the foes; the broken who got away rally.
   */
  private steady(battle: Battle): void {
    for (const battalion of [...battle.battalions].sort((a, b) => a.morale - b.morale || a.id - b.id)) {
      if (battalion.status === "surrendered" && this.isFreed(battle, battalion)) this.rally(battle, battalion, "freed");
      if (battalion.status !== "ready" && battalion.status !== "routed") continue;
      const { friends, foes, nearest } = this.getHand(battle, battalion);

      const hungry = this.isHungry(battle, battalion);
      if (battalion.status === "routed") {
        const shot = battalion.hit;
        battalion.hit = false;
        if (nearest < SAFE * battle.field.front || shot || !this.isFighting(battle, battalion.side) || hungry) continue;
        battalion.morale += REST;
        if (battalion.morale >= RALLY) this.rally(battle, battalion);
        continue;
      }

      if (foes) {
        const change = (friends / (friends + foes) - 0.5) * NERVE;
        battalion.morale += change > 0 ? (hungry ? 0 : change) : change / battalion.stats.steadiness;
      } else if (!battalion.hit && !hungry) battalion.morale += REST;
      if (hungry)
        battalion.morale = Math.max(
          battalion.morale - HUNGER / battalion.stats.steadiness,
          Math.min(battalion.morale, STARVED)
        );
      battalion.morale = Math.min(Math.max(battalion.morale, 0), 100);
      if (battalion.morale < YIELD && foes && this.isCornered(battle, battalion)) this.surrender(battle, battalion);
      else if (battalion.morale <= BREAK) this.rout(battle, battalion);
      battalion.hit = false;
    }
  }

  /** Every battalion turns its order into a move, then blows are settled together */
  private act(battle: Battle): void {
    const onField = battle.battalions.filter(
      battalion => battalion.status === "ready" || battalion.status === "routed"
    );
    const sense: Sense = { onField, crowd: new Map(), held: new Set() };
    for (const battalion of onField) {
      if (battalion.status !== "ready" || battalion.target === null) continue;
      sense.crowd.set(battalion.target, (sense.crowd.get(battalion.target) ?? 0) + 1);
      if (battalion.action === "fight") sense.held.add(battalion.id).add(battalion.target);
    }

    const shooting = new Set<number>();
    const moves: Move[] = [];
    for (const battalion of onField) {
      battalion.vx = battalion.vy = 0;
      battalion.goal = null;
      if (battalion.byHand.task && this.isTaskOver(battle, battalion, battalion.byHand.task))
        battalion.byHand.task = null;
    }
    // the sides take the first move in turn: whoever moves first takes the ground
    for (const battalion of battle.tick % 2 ? [...onField].reverse() : onField) {
      if (battalion.byHand.task && battalion.order.mission === "withdraw") battalion.byHand.stays = true;
      if (
        battalion.status === "routed" ||
        battalion.leaving ||
        (battalion.order.mission === "withdraw" && !battalion.byHand.stays)
      ) {
        this.flee(battle, battalion, onField);
        continue;
      }
      if (battalion.order.mission === "feint" && !battalion.byHand.task) {
        this.feign(battle, battalion, onField);
        continue;
      }

      const { target, to, stop, key, shared, shoot, facing, haste, keep, build, steady } = Battalions.decide(
        battle,
        battalion,
        sense
      );
      if (target && target.id !== battalion.target) sense.crowd.set(target.id, (sense.crowd.get(target.id) ?? 0) + 1);
      battalion.target = target?.id ?? null;
      const fires = shoot && !BattleRules.isIdle(battle[battalion.side].phase);
      if (fires) shooting.add(battalion.id);
      const bearing = target && !steady ? Math.atan2(target.y - battalion.y, target.x - battalion.x) : facing;

      if (build) battalion.action = "build";
      else if (target && Movement.inContact(battle, battalion, target)) battalion.action = "fight";
      else if (target && fires && Movement.canShoot(battle, battalion, target)) battalion.action = "shoot";
      else if (Movement.giveWay(battle, battalion, onField))
        battalion.action = battalion.vx || battalion.vy ? "move" : "hold";
      else if (to) {
        // to the place, or to the next turn of the way round the water and no further
        const whole = Math.hypot(to.x - battalion.x, to.y - battalion.y) - stop;
        const [x, y] = shared
          ? Movement.getSharedHeading(battle, battalion, to)
          : Movement.getHeading(battle, battalion, to, key);
        const due = keep ? whole / (ROUND_TICKS - (battle.tick % ROUND_TICKS)) : whole; // the place moves once a round
        const leg = Math.min(due, x === to.x && y === to.y ? whole : Math.hypot(x - battalion.x, y - battalion.y));
        if (whole > 0) moves.push({ battalion, from: [battalion.x, battalion.y], to: [x, y], leg });
        const moved =
          whole > 0 && Movement.step(battle, battalion, x - battalion.x, y - battalion.y, leg, onField, haste);
        battalion.action = moved ? "move" : "hold";
        if (moved) battalion.goal = [to.x, to.y];
        if (moved && !target && whole > MARCHING * battle.field.front) {
          battalion.facing = Movement.turn(battalion.facing, Math.atan2(y - battalion.y, x - battalion.x), 0.7); // it marches
          continue;
        }
      } else battalion.action = "hold";
      battalion.facing = Movement.turn(battalion.facing, bearing, 0.7);
    }

    // nobody is pushed into the water, out of a ford into the deep, through a wall or off the field
    const stood = onField.map(battalion => ({
      x: battalion.x,
      y: battalion.y,
      dry: !Movement.isWet(battle, battalion, battalion.x, battalion.y),
      safe: !Movement.shuns(battle, battalion, battalion.x, battalion.y),
      shoal: !Movement.isDeep(battle, battalion, battalion.x, battalion.y)
    }));
    Movement.separate(battle, onField);
    onField.forEach((battalion, i) => {
      const { x, y, dry, safe, shoal } = stood[i];
      // friends on each other part over a few ticks: no hop of a front when one steps out of the crowd within the walls
      const shift = Math.hypot(battalion.x - x, battalion.y - y);
      const most = Math.max(Movement.getPace(battle, battalion), battle.field.front * PUSH);
      if (shift > most)
        [battalion.x, battalion.y] = [x + ((battalion.x - x) * most) / shift, y + ((battalion.y - y) * most) / shift];
      const pushed =
        (dry && Movement.isWet(battle, battalion, battalion.x, battalion.y)) ||
        (safe && Movement.shuns(battle, battalion, battalion.x, battalion.y)) ||
        (shoal && !Movement.isRunning(battalion) && Movement.isDeep(battle, battalion, battalion.x, battalion.y)) ||
        (!Movement.isRunning(battalion) &&
          !Movement.isOff(battle.field, x, y) &&
          Movement.isOff(battle.field, battalion.x, battalion.y)) ||
        Battlefields.getWallsBetween(battle.field, [x, y], [battalion.x, battalion.y]).length > 0 || // not even by a gate
        Movement.isCliffed(battle, battalion, [x, y], [battalion.x, battalion.y]) ||
        Works.isBarredByWorks(battle, battalion, [x, y], [battalion.x, battalion.y]);
      if (pushed) [battalion.x, battalion.y] = [x, y];
    });
    Movement.noteTraffic(battle, moves, onField);

    // who strikes is settled once all have moved, so neither side gets the first blow
    const byId = new Map(onField.map(battalion => [battalion.id, battalion]));
    for (const battalion of onField) {
      const aimed = battalion.action === "flee" ? undefined : byId.get(battalion.target ?? -1);
      const target = aimed?.status === "ready" || aimed?.status === "routed" ? aimed : undefined; // not one that got away this tick
      if (target && Movement.inContact(battle, battalion, target)) battalion.action = "fight";
      else if (target && shooting.has(battalion.id) && Movement.canShoot(battle, battalion, target))
        battalion.action = "shoot";
      else if (battalion.action === "fight" || battalion.action === "shoot") battalion.action = "hold"; // pushed apart or out of range
      if (!target || battalion.action !== "fight") battalion.impetus = 0;
      else if (!battalion.impetus && Works.isSheltered(battle, battalion, target))
        battalion.impetus = 1; // a charge breaks on the works
      else if (!battalion.impetus) {
        // a charge strikes with the speed it closed at; who stood has none
        const distance = Math.hypot(target.x - battalion.x, target.y - battalion.y) || 1;
        const closing = (battalion.vx * (target.x - battalion.x) + battalion.vy * (target.y - battalion.y)) / distance;
        battalion.impetus = Math.min(1 + BattleScale.toMetresPerSecond(Math.max(closing, 0)) / IMPETUS, MAX_IMPETUS);
      }
    }
  }

  /** Run back to its place in the formation fallen back, as if broken; there it stands, its back to the foe no more */
  private feign(battle: Battle, battalion: Battalion, others: Battalion[]): void {
    battalion.target = null;
    const { order } = battalion;
    const [dx, dy] = [order.x - battalion.x, order.y - battalion.y];
    const distance = Math.hypot(dx, dy);
    if (distance < ARRIVED * battle.field.front) {
      battalion.action = "hold";
      battalion.facing = Movement.turn(battalion.facing, order.facing, 1.2);
      return;
    }
    battalion.action = "flee";
    battalion.facing = Movement.turn(battalion.facing, Math.atan2(dy, dx), 1.2);
    Movement.step(battle, battalion, dx, dy, distance, others, FLIGHT);
  }

  /** Run for the edge of the field; the broken stop once no foe in order is near, to gather themselves, while their side fights on */
  private flee(battle: Battle, battalion: Battalion, others: Battalion[]): void {
    battalion.target = null;
    const safe = SAFE * battle.field.front;
    const chased =
      battalion.hit || // shot at from further off
      others.some(
        foe =>
          foe.side !== battalion.side &&
          this.isInOrder(foe) &&
          Math.hypot(foe.x - battalion.x, foe.y - battalion.y) < safe
      );
    if (battalion.status === "routed" && !chased && this.isFighting(battle, battalion.side)) {
      battalion.action = "hold";
      return;
    }
    battalion.action = "flee";
    // ships on water with no way off the field sail out of the fight at once
    const sails = Movement.isMoored(battle, battalion) && Movement.isLandlocked(battle, battalion);
    const away =
      Movement.getFlight(battle, battalion) ?? (battalion.side === "attackers" ? battle.axis + Math.PI : battle.axis);
    battalion.facing = Movement.turn(battalion.facing, away, 1.2);
    if (!sails) Movement.step(battle, battalion, Math.cos(away), Math.sin(away), Infinity, others, FLIGHT);
    const off =
      battalion.x < 0 || battalion.x > battle.field.width || battalion.y < 0 || battalion.y > battle.field.height;
    if (off || sails) {
      battalion.status = "fled";
      battle.log.push({
        tick: battle.tick,
        event: "fled",
        side: battalion.side,
        params: { battalion: this.battalionName(battalion) }
      });
    }
  }

  // Walls. A wall stops everybody; a gate lets through whom the burg is open to: all but the besiegers of the burg
  // the defenders of a siege hold. The besiegers get in by storm, foot over the walls on ladders, or by a breach their
  // engines made in the walls or a gate.

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
    const held = field.held;
    if (held === null || !this.isBattering(battle)) return;
    const engines = Movement.getBatterers(battle);
    const walls = Battlefields.getBurgWalls(field, held);
    if (!engines.length || !walls.length) return;
    const burg = field.burgs[held];
    battle.lastLoss = battle.tick; // no lull while the engines are at the walls
    battle.battered +=
      sum(engines, engine => this.getPower(battle, engine, engine.stats.attack)) * (KILL_RATE / BREACH_BLOWS);
    if (battle.battered < 1) return;

    battle.battered -= 1;
    const engine = engines.reduce((a, b) => (b.troops > a.troops ? b : a));
    const middle = (wall: FieldWall): [number, number] => [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2];
    const far = (wall: FieldWall): number => Math.hypot(middle(wall)[0] - engine.x, middle(wall)[1] - engine.y);
    const hit = walls.reduce((a, b) => (far(b) < far(a) ? b : a));
    Battlefields.openBreach(field, held, middle(hit), hit.gate);
    battle.log.push({ tick: battle.tick, event: "breach", side: "attackers", params: { burg: burg.name } });
  }

  /** Whether the besiegers' engines are at the walls: while they bombard or cover a storm, and more breaches still tell */
  private isBattering(battle: Battle): boolean {
    const { field } = battle;
    const { phase } = battle.attackers;
    if (field.held === null || (phase !== "bombardment" && phase !== "storming")) return false; // engines cover a storm too
    return this.getBreaches(field) < STORM_ODDS.length - 1; // more make the walls no weaker
  }

  /** Where an engine's shots strike the walls it batters: the nearest point of the nearest solid stretch; null if none */
  getWallShot(battle: Battle, engine: Battalion): Point | null {
    if (!this.isBattering(battle) || !Movement.getBatterers(battle).includes(engine)) return null;
    let best: Point | null = null;
    let least = Infinity;
    for (const { a, b } of Battlefields.getBurgWalls(battle.field, battle.field.held)) {
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const t = Math.min(Math.max(((engine.x - a[0]) * dx + (engine.y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0), 1);
      const point: Point = [a[0] + dx * t, a[1] + dy * t];
      const far = Math.hypot(point[0] - engine.x, point[1] - engine.y);
      if (far < least) [best, least] = [point, far];
    }
    return best;
  }

  private fight(battle: Battle): void {
    const byId = new Map(battle.battalions.map(battalion => [battalion.id, battalion]));
    const strikers = battle.battalions.filter(
      battalion => battalion.action === "fight" || battalion.action === "shoot"
    );

    const landed = new Map<number, number>(); // men it would cut down of defense 1, past the cover of those hit
    const pressed = new Map<number, number>(); // morale lost to hits in the flank and rear
    for (const battalion of strikers) {
      const target = byId.get(battalion.target!)!;
      const from = Battlefields.terrainAt(battle.field, battalion.x, battalion.y);
      const to = Battlefields.terrainAt(battle.field, target.x, target.y);
      const shot = battalion.action === "shoot";
      let power =
        this.getPower(battle, battalion, battalion.stats.attack) *
        this.getImpetus(battle, battalion, target) *
        Movement.getFooting(battle, battalion, from);
      // cover takes its share of the losses: walls from without, woods and houses from shots
      const besieging = to.walled > 0 && from.walled !== to.walled;
      const cover =
        (besieging ? 1 / WALLS : shot && (to.wood || to.burg) ? COVER : 1) *
        Works.getShelter(battle, battalion, target);

      if (shot) power *= SKIES[battle.weather].shot * (battalion.stats.range ? 1 : THROWN.strength);
      else battalion.impetus = 1 + (battalion.impetus - 1) * SPENT;
      const bearing = Math.atan2(battalion.y - target.y, battalion.x - target.x);
      const angle = Math.abs(Movement.normalize(bearing - target.facing));
      const side = angle > 2.1 ? 2 : angle > 1.05 ? 1 : 0; // rear, flank, front
      if (side) {
        power *= side === 2 ? REAR : FLANK;
        pressed.set(target.id, (pressed.get(target.id) ?? 0) + side / 2);
      }
      landed.set(target.id, (landed.get(target.id) ?? 0) + power * cover * KILL_RATE);
    }

    const lost: Battalion[] = [];
    for (const [id, blows] of landed) {
      const battalion = byId.get(id)!;
      const ground = Battlefields.terrainAt(battle.field, battalion.x, battalion.y);
      // what each man stands with: the harder the blows and the weaker the man, the more fall; counted in fractions
      const stands =
        this.getPower(battle, battalion, battalion.stats.defense, 1, true) *
        Movement.getFooting(battle, battalion, ground);
      const fallen = blows / Math.max(stands, 0.01) / ROUND_TICKS;
      const share = fallen / battalion.initial;
      battalion.harm += fallen;
      const died = Math.min(Math.floor(battalion.harm), battalion.troops);
      battalion.harm -= died;
      battalion.troops -= died;
      const shaken = share * MORALE_LOSS + 1 / ROUND_TICKS + (pressed.get(id) ?? 0);
      battalion.morale = Math.max(battalion.morale - shaken / battalion.stats.steadiness, 0);
      if (share) battle.lastLoss = battle.tick;
      battalion.hit = true;

      if (!battalion.troops) {
        battalion.status = "destroyed";
        battalion.action = "hold";
        battle.log.push({
          tick: battle.tick,
          event: "destroyed",
          side: battalion.side,
          params: { battalion: this.battalionName(battalion) }
        });
        lost.push(battalion);
      }
    }
    this.shake(battle, lost, 6); // once all losses are in: no order among them
  }

  /** Battalions spend energy by what they do and win it back at rest; slopes and mud tire by taking longer */
  private tire(battle: Battle): void {
    for (const battalion of battle.battalions) {
      if (battalion.status !== "ready" && battalion.status !== "routed") continue;
      const speed = Math.hypot(battalion.vx, battalion.vy);
      const doing =
        battalion.action === "fight" || battalion.action === "shoot" || battalion.action === "build"
          ? battalion.action
          : speed > Movement.getPace(battle, battalion) * RUNNING || (battalion.status === "routed" && speed)
            ? "run"
            : speed
              ? "march"
              : "rest";
      const exertion = EXERTION[doing] * (battle.heat && doing !== "rest" ? HEAT : 1);
      battalion.energy = Math.min(Math.max(battalion.energy - exertion, 0), 1);
    }
  }

  private rout(battle: Battle, battalion: Battalion): void {
    battalion.status = "routed";
    battalion.byHand.stays = false;
    battle.log.push({
      tick: battle.tick,
      event: "rout",
      side: battalion.side,
      params: { battalion: this.battalionName(battalion) }
    });
    this.shake(battle, [battalion], 8);
  }

  /**
   * About to break with no way off the field round deep water and walls, past no foe: it gives itself up. It stays where
   * it is, in the way of all, strikes no blow and takes none; its men are lost to its side unless the side holds the field
   */
  private isCornered(battle: Battle, battalion: Battalion): boolean {
    return !Movement.hasWayOut(battle, battalion);
  }

  private surrender(battle: Battle, battalion: Battalion): void {
    this.yieldBattalion(battalion);
    battle.log.push({
      tick: battle.tick,
      event: "surrender",
      side: battalion.side,
      params: { battalion: this.battalionName(battalion) }
    });
    this.shake(battle, [battalion], 6);
  }

  private yieldBattalion(battalion: Battalion): void {
    battalion.byHand.stays = false;
    Object.assign(battalion, {
      status: "surrendered",
      action: "hold",
      target: null,
      impetus: 0,
      vx: 0,
      vy: 0
    });
  }

  /**
   * A side that gives itself up lays down its arms all at once, and its runners with nowhere to run with it: its order
   * says so in the log. A side that turns to run leaves behind who cannot break off: those at grips with no way out
   */
  private capitulate(battle: Battle): void {
    for (const battalion of battle.battalions) {
      if (battalion.leaving) continue;
      const { phase } = battle[battalion.side];
      if (battalion.status === "routed" && phase === SURRENDER && this.isCornered(battle, battalion))
        this.yieldBattalion(battalion);
      if (battalion.status !== "ready") continue;
      if (phase === SURRENDER) this.yieldBattalion(battalion);
      else if (
        battalion.action === "fight" &&
        !battalion.byHand.stays &&
        BattleRules.isBeaten(battle.type, battalion.side, phase) &&
        this.isCornered(battle, battalion)
      )
        this.surrender(battle, battalion);
    }
  }

  /** Strength in order of the friends and the foes about a battalion, and how far the nearest foe in order is */
  private getHand(battle: Battle, battalion: Battalion): { friends: number; foes: number; nearest: number } {
    let friends = 0;
    let foes = 0;
    let nearest = Infinity;
    const near = AT_HAND * battle.field.front;
    const walls = this.getWallsHeart(battle, battalion);
    for (const other of battle.battalions) {
      if (!this.isInOrder(other)) continue;
      const distance = Math.hypot(other.x - battalion.x, other.y - battalion.y);
      if (other.side !== battalion.side) nearest = Math.min(nearest, distance);
      if (distance > near) continue;
      if (other.side === battalion.side) friends += Battalions.getStrength(other);
      else if (battle.type !== "bombardment" || other.stats.range) foes += Battalions.getStrength(other) / walls(other); // ships and troops only shoot
    }
    return { friends, foes, nearest };
  }

  /** A garrison within its walls fears foes outside them as much less as the walls ask stormers to outnumber it */
  private getWallsHeart(battle: Battle, battalion: Battalion): (foe: Battalion) => number {
    const { field } = battle;
    const within = (at: Battalion): boolean => Battlefields.terrainAt(field, at.x, at.y).walled === field.held! + 1;
    if (battalion.side !== "defenders" || !Movement.hasWalls(battle) || !within(battalion)) return () => 1;
    const odds = STORM_ODDS[Math.min(this.getBreaches(field), STORM_ODDS.length - 1)];
    return foe => (within(foe) ? 1 : odds);
  }

  private getBreaches(field: Battlefield): number {
    return field.breaches.filter(breach => breach.burg === field.held).length;
  }

  /**
   * Nobody holds those who gave themselves up any more: the foe has turned to run, or friends in order stand by them
   * with no foe in order at hand. Not while their side has given up, nor those told by hand to lay down their arms
   */
  private isFreed(battle: Battle, battalion: Battalion): boolean {
    if (battalion.byHand.parole || battalion.leaving || !this.isFighting(battle, battalion.side)) return false;
    const foe = BattleRules.enemyOf(battalion.side);
    if (BattleRules.isBeaten(battle.type, foe, battle[foe].phase)) return true;
    const { friends, foes } = this.getHand(battle, battalion);
    return friends > 0 && !foes;
  }

  /** A broken battalion that got away stands again, behind its side; so does one freed, with the heart of one rallied */
  private rally(battle: Battle, battalion: Battalion, event: "rally" | "freed" = "rally"): void {
    battalion.status = "ready";
    battalion.action = "hold";
    battalion.byHand.task = null;
    battalion.morale = Math.max(battalion.morale, RALLY);
    // those who fight hand to hand join the reserve; shooters and engines go on shooting from where they stand
    const role: Role = battalion.kind === "ranged" ? "support" : battalion.kind === "machinery" ? "battery" : "reserve";
    Object.assign(battalion.order, { role, mission: role, sent: false, target: null });
    Generals.takePlace(battle, battalion);
    battle.log.push({
      tick: battle.tick,
      event,
      side: battalion.side,
      params: { battalion: this.battalionName(battalion) }
    });
  }

  /** Losses nearby unsettle friends and hearten foes who see them, all at once */
  private shake(battle: Battle, lost: Battalion[], morale: number): void {
    if (!lost.length) return;
    const reach = SHAKE * battle.field.front;
    for (const battalion of battle.battalions) {
      if (battalion.status !== "ready") continue;
      let change = 0;
      for (const one of lost) {
        if (Math.hypot(battalion.x - one.x, battalion.y - one.y) > reach || !Sight.sees(battle, battalion, one))
          continue;
        change +=
          battalion.side === one.side
            ? -morale / battalion.stats.steadiness
            : this.isHungry(battle, battalion)
              ? 0
              : morale;
      }
      if (change) battalion.morale = Math.min(Math.max(battalion.morale + change, 0), 100);
    }
  }

  /** A garrison cut off goes hungry: it takes heart from nothing, and only food coming in ends it */
  private isHungry(battle: Battle, battalion: Battalion): boolean {
    return battle.cutOff && battalion.side === "defenders";
  }

  /** The die of each side, cast once at the opening by the seed and standing to the end; one set by hand stands instead */
  private castDice(battle: Battle): void {
    const { seed, settings, rehearsal } = battle;
    SIDES.forEach((side, i) => {
      const set = battle.interventions.findLast(change => change.kind === "die" && change.side === side);
      if (seed === undefined || !settings.fortune || rehearsal) battle[side].die = null;
      else if (set?.kind === "die") battle[side].die = this.toDie(set.die);
      else battle[side].die = 1 + Math.floor(Battlefields.mix(seed, i, 0) * 6);
    });
  }

  /** Blow multiplier of a die: `weight` a face off the average, ×1 on average and with no die */
  getFortune(die: number | null, weight: number): number {
    return die === null ? 1 : 1 + (this.toDie(die) - 3.5) * Math.min(Math.max(weight, 0), MAX_FORTUNE);
  }

  /** A face of the die: a whole number 1 to 6 */
  private toDie(die: number): number {
    return Math.min(Math.max(Math.round(die) || 1, 1), 6);
  }

  /** What a battalion strikes with, or stands with when `standing`; troops on the run hardly strike, fortune tells on blows */
  private getPower(
    battle: Battle,
    battalion: Battalion,
    of: number,
    troops = battalion.troops,
    standing = false
  ): number {
    const side = battle[battalion.side];
    const state = !standing && Movement.isRunning(battalion) ? BROKEN : side.phase === "shock" ? SHOCK : 1;
    const fortune = standing ? 1 : this.getFortune(side.die, battle.settings.fortune);
    return troops * battalion.stats.upkeep * of * state * fortune * (0.5 + battalion.energy / 2);
  }

  /** What speed adds to a blow: a charge's, spent within a round or two at grips; a missile's, the more the nearer it was loosed */
  private getImpetus(battle: Battle, battalion: Battalion, target: Battalion): number {
    if (battalion.action === "fight") return Math.max(battalion.impetus, 1);
    if (!battalion.stats.range) return 1; // stones thrown from the walls
    const share =
      Math.hypot(target.x - battalion.x, target.y - battalion.y) / Movement.getRange(battle, battalion, target);
    return Math.min(Math.max(1.5 - share, 0.5), 1.5);
  }

  /** Power of the troops a side has in order, as the military screens count it */
  getUnitsPower(battle: Battle, side: Side): number {
    const inOrder = battle.battalions.filter(battalion => battalion.side === side && this.isInOrder(battalion));
    return sum(inOrder, battalion => battalion.troops * battalion.stats.power * battalion.stats.upkeep);
  }

  /** Hearten or shake the troops of a side that are in order */
  private addMorale(battle: Battle, side: Side, value: number): void {
    const clamp = (morale: number): number => Math.min(Math.max(morale + value, 0), 100);
    for (const battalion of battle.battalions)
      if (battalion.side === side && battalion.status === "ready") battalion.morale = clamp(battalion.morale);
    battle[side].morale = clamp(battle[side].morale);
  }

  private signed(value: number): string {
    return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  }

  private updatePower(battle: Battle): void {
    for (const side of SIDES) {
      const battalions = battle.battalions.filter(battalion => battalion.side === side);
      const base = sum(
        battalions.filter(battalion => this.isInOrder(battalion)),
        battalion => Battalions.getStrength(battalion)
      );
      battle[side].power = base / (battle.populationScale / 10);
      const initial = sum(battalions, battalion => battalion.initial);
      const troops = sum(battalions, battalion => this.getFree(battalion));
      battle[side].casualties = initial ? 1 - sum(battalions, battalion => battalion.troops) / initial : 0;
      battle[side].captured = initial ? sum(battalions, battalion => this.getPrisoners(battalion)) / initial : 0;
      if (battle.tick)
        battle[side].morale = troops
          ? sum(battalions, battalion => battalion.morale * this.getFree(battalion)) / troops
          : 0;
    }
  }

  private setInitialMorale(battle: Battle): void {
    for (const side of SIDES) {
      battle[side].morale = this.getStartingMorale(battle, side, battle[side].regiments);
      for (const battalion of battle.battalions) if (battalion.side === side) battalion.morale = battle[side].morale;
    }
  }

  /** Morale troops start with: by the odds, the stability of their states and the way from their bases */
  private getStartingMorale(battle: Battle, side: Side, regiments: BattleRegiment[]): number {
    const own = battle[side];
    const enemy = battle[BattleRules.enemyOf(side)];
    const troops = sum(regiments, regiment => this.total(regiment));
    const stability = troops ? sum(regiments, regiment => regiment.stability * this.total(regiment)) / troops : 0.5;
    const walls = side === "defenders" && Movement.hasWalls(battle) ? STORM_ODDS[0] : 1; // a garrison trusts its walls
    const ratio = own.power ? enemy.power / own.power / walls : 1;
    return BattleRules.getInitialMorale(
      ratio,
      stability,
      regiments.map(regiment => regiment.distance)
    );
  }

  private checkEnd(battle: Battle): void {
    const standing = (side: Side, statuses: BattalionStatus[]): boolean =>
      battle.battalions.some(battalion => battalion.side === side && statuses.includes(battalion.status));
    const ready = SIDES.map(side =>
      battle.battalions.some(battalion => battalion.side === side && this.isInOrder(battalion))
    );
    const onField = SIDES.map(side => standing(side, ["ready", "routed"]));

    const over =
      !onField[0] ||
      !onField[1] ||
      (!ready[0] && !ready[1]) ||
      battle.tick >= battle.settings.maxRounds * ROUND_TICKS ||
      (battle.engaged !== null &&
        !battle.cutOff &&
        battle.tick - battle.lastLoss > battle.settings.lullRounds * ROUND_TICKS); // a long way round is no lull, nor a blockade
    if (!over) return;

    // a side holds the field while it has troops in order and has neither turned to run nor given itself up
    const holds = SIDES.map((side, i) => ready[i] && !BattleRules.isBeaten(battle.type, side, battle[side].phase));
    const winner = holds[0] === holds[1] ? null : holds[0] ? "attackers" : "defenders";
    this.settleLosses(battle);
    // who holds the field frees its own who gave themselves up
    for (const battalion of battle.battalions)
      if (battalion.side === winner && battalion.status === "surrendered") battalion.status = "ready";
    this.updatePower(battle);
    const status = BattleRules.getStatus(this.getLost(battle.attackers), this.getLost(battle.defenders), winner);
    if (battle.raised) status[0] = "attackers raised the siege";
    battle.result = { winner, status };
    battle.log.push({ tick: battle.tick, event: "end", side: winner ?? undefined });
  }

  /**
   * A battalion loses whole men or ships; when the battle is over the parts its battalions lost are counted together by
   * regiment and unit, so a fleet of two-ship battalions that each lost a third of a ship has lost a ship
   */
  settleLosses(battle: Battle): void {
    const units = new Map<string, Battalion[]>();
    for (const battalion of battle.battalions) {
      if (!battalion.troops) continue;
      const key = `${battalion.side}-${battalion.state}-${battalion.regiment}-${battalion.unit}`;
      units.set(key, [...(units.get(key) ?? []), battalion]);
    }
    for (const battalions of units.values()) {
      const more = Math.round(sum(battalions, battalion => battalion.harm - 0.5)); // each began half a man in, to round to the nearest
      const hardest = battalions.sort((a, b) => b.harm - a.harm || a.id - b.id).slice(0, Math.max(more, 0));
      for (const battalion of hardest) {
        battalion.troops -= 1;
        battalion.harm -= 1;
        if (!battalion.troops) battalion.status = "destroyed";
      }
    }
  }

  private getMen(unit: MilitaryUnit, troops: number): number {
    return troops * Math.max(unit.crew, 1);
  }

  /** The field sized by the battalions; a siege is about the walls. A field of the map is built anew to it */
  private setScale(battle: Battle): void {
    const { field } = battle;
    const siege = battle.type === "siege" ? field.site : null;
    const radius = siege ? Battlefields.getSiegeRadius(siege) : Infinity;
    const ring = siege ? Generals.getSiegeRing(battle) : undefined;
    const size = BattleScale.getFieldSize(battle.battalionSize, radius, ring);
    if (field.width === size.width && field.front === size.front) return;
    if (field.site) {
      battle.scene = Battlefields.build(field.site[0], field.site[1], size, battle.type, ring);
      battle.field = Battlefields.cut(battle.scene, size);
    } else {
      const ratio = size.width / field.width; // cliffs are ground, drawn on the nodes as water is
      const scale = ([x, y]: [number, number]): [number, number] => [x * ratio, y * ratio];
      field.cliffs = field.cliffs.map(({ a, b, height }) => ({ a: scale(a), b: scale(b), height }));
      Object.assign(field, size);
      if (field.burgs.length) Battlefields.raiseWalls(field); // their grid of the new nodes
    }
  }

  /**
   * Men in a battalion: 0.3 to 1 population point, the least that makes no more battalions of all the troops than allowed;
   * 0.2 when 0.3 makes fewer than the fewest. A host too big for that gets as many whole points as keep it within the limit
   */
  private getBattalionSize(battle: Battle): number {
    let men = 0;
    for (const side of SIDES) {
      for (const regiment of battle[side].regiments) {
        for (const unit of battle.units) men += this.getMen(unit, regiment.troops[unit.name] ?? 0);
      }
    }
    const countAt = (size: number): number => men / (size * battle.populationScale);
    const { minBattalions, maxBattalions } = battle.settings;
    const size =
      countAt(0.3) < minBattalions
        ? 0.2
        : ([0.3, 0.5, 1].find(size => countAt(size) <= maxBattalions) ?? Math.ceil(countAt(1) / maxBattalions));
    return Math.round(size * battle.populationScale);
  }

  /** Split the regiment into battalions: a unit ten times as numerous fields ten times as many */
  private addBattalions(battle: Battle, side: Side, regiment: BattleRegiment): Battalion[] {
    const added: Battalion[] = [];
    const { front } = battle.field;
    for (const unit of battle.units) {
      const troops = regiment.troops[unit.name];
      if (!troops) continue;
      const count = Math.min(Math.max(Math.round(this.getMen(unit, troops) / battle.battalionSize), 1), troops);

      for (let n = 0; n < count; n++) {
        const share = Math.floor(troops / count) + +(n < troops % count);
        const battalion: Battalion = {
          id: battle.battalions.length,
          key: `${side[0]}${regiment.state}-${regiment.i}-${unit.name}-${n}`,
          side,
          state: regiment.state,
          regiment: regiment.i,
          unit: unit.name,
          number: count > 1 ? n + 1 : 0,
          type: unit.type,
          kind: Battalions.getKind(unit.type, unit.range, battle.field.open !== null),
          stats: {
            power: getUnitPower(unit),
            attack: unit.attack,
            defense: unit.defense,
            speed: BattleScale.toMetresPerTick(unit.speed),
            range: unit.range,
            steadiness: Math.max(unit.morale, 0.1),
            upkeep: regiment.upkeep
          },
          initial: share,
          troops: share,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          impetus: 0,
          facing: 0,
          width:
            Math.min(
              Math.max(this.getMen(unit, share) / battle.battalionSize, BATTALION_WIDTH[0]),
              BATTALION_WIDTH[1]
            ) * front,
          depth: BATTALION_DEPTH * front,
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
          byHand: { task: null, parole: false, stays: false },
          order: { ...NO_ORDER }
        };
        battle.battalions.push(battalion);
        added.push(battalion);
      }
    }
    return added;
  }

  /** Latecomers form up behind their side */
  private reinforce(battle: Battle, side: Side, regiment: BattleRegiment): void {
    const battalions = this.addBattalions(battle, side, regiment);
    this.updatePower(battle); // the odds with them
    const morale = this.getStartingMorale(battle, side, [regiment]); // fresh: not the routed's
    for (const battalion of battalions) battalion.morale = morale;
    Generals.enlist(battle, side, battalions);
  }

  /**
   * The attack as the field lies: from the water onto the land, else square to the field's edges, both sides on dry
   * land, a river between them and none through either, the defenders on the higher ground and in the burg. The way
   * the attackers came breaks a tie
   */
  private findAxis(battle: Battle): number {
    const { field, approach } = battle;
    const landward = BattleRules.isFromSea(battle.type) && !field.open ? this.getLandward(field) : null;
    if (landward !== null) return landward;
    const turn = (axis: number): number => Math.abs(Movement.normalize(axis - approach)) / Math.PI;
    const burg = Generals.getFieldBurg(battle);
    const score = (axis: number): number => {
      if (field.open) return -turn(axis);
      const across = axis + Math.PI / 2;
      const [along, aside] = [Generals.reach(field, axis), Generals.reach(field, across)];
      const point = (depth: number, shift: number): Point => [
        field.width / 2 + Math.cos(axis) * along * depth + Math.cos(across) * aside * shift,
        field.height / 2 + Math.sin(axis) * along * depth + Math.sin(across) * aside * shift
      ];
      const ground = (depths: number[]) =>
        AXIS_SHIFTS.flatMap(shift => depths.map(depth => Battlefields.terrainAt(field, ...point(depth, shift))));
      const [attackers, defenders] = [ground([-0.6, -0.8, -1]), ground([0.2, 0.35, 0.5])];
      const share = (count: number): number => count / attackers.length;
      const wet = [...attackers, ...defenders].filter(terrain => terrain.water === 1).length;
      if (battle.type === "ambush") return -wet - turn(axis) / 2; // a column on the march: no sides drawn up to face
      const rise = share(sum(defenders, terrain => terrain.height) - sum(attackers, terrain => terrain.height));
      // the burg on the defenders' side, as far as the field is built to stand it
      const toBurg = burg
        ? ((burg.x - field.width / 2) * Math.cos(axis) + (burg.y - field.height / 2) * Math.sin(axis)) /
          along /
          BURG_END
        : 0;
      const between = AXIS_SHIFTS.filter(shift => this.crossesRiver(field, point(-0.6, shift), point(0.2, shift)));
      const split = [-0.8, 0.35].filter(depth => this.crossesRiver(field, point(depth, -0.3), point(depth, 0.3)));
      return (
        -wet +
        Math.max(-1, Math.min(1, (rise * field.relief) / HIGH_GROUND)) * 0.6 +
        Math.max(-1, Math.min(1, toBurg)) * 1.5 +
        (between.length / AXIS_SHIFTS.length) * 0.8 -
        split.length * 0.8 -
        turn(axis) / 2
      );
    };
    return [0, Math.PI / 2, Math.PI, -Math.PI / 2].reduce((a, b) => (score(b) > score(a) ? b : a));
  }

  /** Whether a river runs between two points of the field */
  private crossesRiver(field: Battlefield, [ax, ay]: Point, [bx, by]: Point): boolean {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (field.cell / 2));
    for (let i = 0; i <= steps; i++)
      if (Battlefields.terrainAt(field, ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps).water === 2)
        return true;
    return false;
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

  private moveBattalion(battle: Battle, key: string, x: number, y: number): void {
    const battalion = battle.battalions.find(battalion => battalion.key === key);
    if (!battalion) return;
    [battalion.x, battalion.y] = Generals.onField(battle.field, [x, y]);
    battalion.action = "hold";
    Generals.takePlace(battle, battalion);
  }

  private turnBattalion(battle: Battle, key: string, facing: number): void {
    const battalion = battle.battalions.find(battalion => battalion.key === key);
    if (battalion) battalion.facing = battalion.order.facing = Movement.normalize(facing);
  }

  /** Battalions given a task by hand: those of the side that can still take orders, and can carry this one out */
  private assign(battle: Battle, change: Extract<Intervention, { kind: "task" }>): void {
    const { task } = change;
    const target = battle.battalions.find(battalion => battalion.key === change.target) ?? null;
    const pointed = POINTED_TASKS.includes(task);
    const battalions = change.battalions
      .map(key => battle.battalions.find(battalion => battalion.key === key))
      .filter(
        (battalion): battalion is Battalion =>
          battalion?.status === "ready" && !battalion.leaving && battalion !== target
      )
      .filter(battalion => pointed || Battalions.getTasks(battle, battalion).includes(task));
    if (!battalions.length || (task !== "move" && pointed && target?.status !== this.getTargetStatus(task))) return;
    if (task === "retreat")
      for (const battalion of battalions) {
        battalion.leaving = true;
        battalion.byHand.task = null;
      }
    else if (task === "surrender")
      for (const battalion of battalions) {
        this.yieldBattalion(battalion);
        battalion.byHand.parole = true;
        this.shake(battle, [battalion], 6);
      }
    else if (!pointed)
      for (const battalion of battalions)
        battalion.byHand.task = {
          kind: task,
          x: battalion.x,
          y: battalion.y,
          facing: battalion.facing,
          target: null,
          round: battle.round
        };
    else {
      // sent to a point, they keep their places to one another and all face the way they go
      const [cx, cy] = [
        sum(battalions, battalion => battalion.x) / battalions.length,
        sum(battalions, battalion => battalion.y) / battalions.length
      ];
      const facing = Math.atan2(change.y - cy, change.x - cx);
      for (const battalion of battalions) {
        const at: Point = [change.x + battalion.x - cx, change.y + battalion.y - cy];
        const [x, y] = task === "move" ? Generals.onField(battle.field, at) : [change.x, change.y];
        battalion.byHand.task = { kind: task, x, y, facing, target: target?.id ?? null, round: battle.round };
      }
    }
    const params: Record<string, string> = {
      battalion: this.battalionName(battalions[0]),
      count: String(battalions.length),
      task: change.task
    };
    if (target) params.target = this.battalionName(target);
    battle.log.push({ tick: battle.tick, event: "task", side: battalions[0].side, params });
  }

  /** A task stands till it is done or has stood its time; a battalion that broke or leaves the field drops it */
  private isTaskOver(battle: Battle, battalion: Battalion, task: Task): boolean {
    if (battalion.status !== "ready" || battalion.leaving) return true;
    if (battle.round - task.round >= battle.settings.orderRounds) return true;
    if (task.target === null) return false; // a spot to go to or to keep
    const target = battle.battalions.find(other => other.id === task.target);
    return target?.status !== this.getTargetStatus(task.kind);
  }

  /** Who a task pointed at a battalion goes for: a broken foe is pursued, a foe in order attacked, a friend protected */
  private getTargetStatus(task: TaskKind): BattalionStatus {
    return task === "pursue" ? "routed" : "ready";
  }

  /** A battalion in the log: the side is shown beside it, and the regiment's name would take the line */
  private battalionName(battalion: Battalion): string {
    return `${battalion.unit.replace(/_/g, " ")} ${battalion.number || ""}`.trim();
  }

  private total(regiment: BattleRegiment): number {
    return sum(Object.values(regiment.troops), troops => troops);
  }
}

export const Battles = new BattleModule();

import { getUnitPower } from "@/model/political/military-units";
import type { MilitaryUnit } from "@/types/military";
import { decide, getKind, type Kind, type Sense, SHAKEN } from "./battalion";
import {
  type BattleType,
  type Command,
  enemyOf,
  getBattleStatus,
  getInitialMorale,
  isBeaten,
  isIdle,
  PHASES,
  SIDES,
  type Side,
  STARVED,
  SURRENDER
} from "./battle-rules";
import {
  type Battlefield,
  buildBattlefield,
  FIELD,
  type FieldWall,
  getSiegeMetres,
  getWallsBetween,
  openBreach,
  terrainAt
} from "./battlefield";
import type { TacticName } from "./formations";
import {
  command,
  deploy,
  enlist,
  getBase,
  getCommands,
  getOptions,
  isCutOff,
  type Option,
  obey,
  reach,
  settle,
  takePlace
} from "./general";
import {
  canShoot,
  forgetWays,
  getFlight,
  getFooting,
  getHeading,
  getRange,
  getSharedHeading,
  hasWalls,
  inContact,
  isRunning,
  isStorming,
  isWet,
  normalize,
  openCrossing,
  ROUND_TICKS,
  separate,
  shuns,
  step,
  turn
} from "./movement";

export { ROUND_TICKS };

const MAX_TICKS = 600;
const IDLE_ROUNDS = 12; // rounds without losses that end a battle
const REHEARSAL_TICKS = 360; // how far ahead a general plays a battle through in his mind
const STORM_TICKS = 150; // and a storm of walls, slow to reckon: long enough to see it carried or thrown back
const BLOCK_DEPTH = 22;
const BATTALION_WIDTH = 44; // field units a full battalion stands wide
const RANKS = 5; // it stands so deep, a metre a man along its front

// morale
const MORALE_LOSS = 180; // morale a block loses when all its troops fall
const NEAR = 130; // how far a battalion counts friends and foes to take or lose heart
const NERVE = 12; // morale a round the odds at hand give or take, at most half of it
const REST = 4; // morale a round a battalion left alone recovers
const BREAK = 15; // morale at which it breaks and runs
const RALLY = 35; // and at which a broken one that got away stands again
const SAFE = 200; // with no foe in order that near
const HUNGER = 1; // morale a round a garrison cut off loses, down to STARVED
const HEART = 2; // morale every battalion of a side takes when it breaks a foe's
const CORNERED = 1 / 4.5; // share of the strength at hand (foes three and a half to one) under which a shaken battalion at grips on a losing side gives itself up

const BREACHES = 3; // most that are made in the walls of a burg
const TOWN = 1.25; // how much stronger troops in a burg defend
const WALLS = 3; // how many times weaker a blow or a shot is from without the walls at those within
const COVER = 0.6; // share of the shots that tell on troops in a wood or a burg

// blows: a hundred men of attack 1 cut down five men of defense 1 a round hand to hand, and shoot down three and a half
const BLOW_RATE = 0.05;
const SHOT_RATE = 0.035;
const BROKEN = 0.1; // strength of troops on the run or giving themselves up
const SHOCK = 0.5; // strength of a side taken by surprise
const IMPETUS = 12; // closing pace that adds a whole blow again: riders at full tilt strike 2.7 times, foot at the charge 1.6
const MAX_IMPETUS = 5;
const SPENT = 0.85; // share of a charge's impetus left after each tick at grips

export type BlockStatus = "ready" | "routed" | "surrendered" | "fled" | "destroyed";
export type BlockAction = "hold" | "move" | "shoot" | "fight" | "flee";
export type Role = "line" | "support" | "battery" | "wing" | "reserve";
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
  idle: number; // rounds it has not closed
  losses: number; // share of the troops lost by the last round
  bled: number; // rounds in a row it lost men to shots alone
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
  speed: number; // field units a tick
  range: number; // it shoots over, 0 to fight hand to hand
  steadiness: number; // the unit's morale: what its losses of morale are divided by
  upkeep: number; // share of the power ill-kept troops fight with
  initial: number;
  troops: number;
  x: number;
  y: number;
  vx: number; // the way it went this tick and how fast, field units a tick
  vy: number;
  impetus: number; // what its charge adds to its blows at grips: 1 none, 0 while not at grips
  facing: number; // radians
  width: number;
  depth: number;
  morale: number;
  status: BlockStatus;
  action: BlockAction;
  target: number | null;
  hit: boolean; // took losses this round
  harm: number; // the part of a man lost so far
  routs: number; // times it broke: it gathers itself once, the second time it is gone
  leaving: boolean; // its regiment was taken out of the battle: it marches off the field
  detour: number; // the side it goes round what is in its way by: -1, 1, or 0 on a clear way
  order: Order;
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
  bonus: number; // power added by hand, in troops × unit power × upkeep
  boost: number; // what the bonus multiplies the strength of the troops by
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
  | { tick: number; kind: "order"; side: Side; order: Command }
  | { tick: number; kind: "power"; side: Side; value: number }
  | { tick: number; kind: "morale"; side: Side; value: number }
  | { tick: number; kind: "die"; side: Side; die: number }
  | { tick: number; kind: "add"; side: Side; regiment: BattleRegiment }
  | { tick: number; kind: "withdraw"; state: number; regiment: number }
  | { tick: number; kind: "type"; type: BattleType };

export type LogEvent =
  | "start"
  | "order"
  | "ordered"
  | "move"
  | "turn"
  | "die"
  | "power"
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
  brokenAt: number | null; // tick a side was left with no troops in order
  storm: number | null; // round the besiegers set out to storm the walls
  cutOff: boolean; // the besieged burg is ringed in by land and water: nothing comes in
  battered: number; // how far the engines are with the next breach, 0 to 1
  course: { orders: string; count: number }[]; // the orders the sides were under, round by round
  interventions: Intervention[];
  log: LogEntry[];
  result: BattleResult | null;
  planned: boolean; // the generals have thought the battle through
  rehearsal: boolean; // it is fought in a general's mind
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
}

const createSide = (regiments: BattleRegiment[], phase: string): BattleSide => ({
  regiments,
  bonus: 0,
  boost: 1,
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
});

export function createBattle(setup: BattleSetup): Battle {
  const { attackers, defenders, ...rest } = setup;
  const battle: Battle = {
    ...rest,
    approach: setup.axis,
    battalion: 0,
    attackers: createSide(attackers, PHASES[setup.type].attackers[0]),
    defenders: createSide(defenders, PHASES[setup.type].defenders[0]),
    blocks: [],
    tick: 0,
    round: 0,
    engaged: null,
    lastLoss: 0,
    brokenAt: null,
    storm: null,
    cutOff: false,
    battered: 0,
    course: [],
    interventions: [],
    log: [],
    result: null,
    planned: false,
    rehearsal: false
  };
  prepare(battle);
  return battle;
}

/** Draw the troops up anew; only before the first tick, the user's moves are kept */
export function prepare(battle: Battle): void {
  if (battle.tick) return;
  battle.blocks = [];
  battle.battalion = getBattalionSize(battle);
  setScale(battle);
  forgetWays(battle.field);
  battle.axis = findAxis(battle);
  battle.field.held = getHeld(battle);
  openCrossing(battle, getBase(battle, "attackers"), getBase(battle, "defenders"));
  for (const side of SIDES) {
    battle[side].phase = PHASES[battle.type][side][0];
    for (const regiment of battle[side].regiments) addBlocks(battle, side, regiment);
  }
  updatePower(battle);
  setInitialMorale(battle);
  drawUp(battle);
  for (const change of battle.interventions) {
    if (change.kind === "morale") addMorale(battle, change.side, change.value);
  }
}

/** Stand the battalions there are in their places, by the tactics of the generals and then by the user's hand */
function drawUp(battle: Battle): void {
  forgetWays(battle.field);
  deploy(battle);
  separate(battle, battle.blocks); // a crowded line spreads out
  settle(battle);
  for (const block of battle.blocks) takePlace(battle, block);
  for (const change of battle.interventions) {
    if (change.kind === "move") moveBlock(battle, change.block, change.x, change.y);
    if (change.kind === "turn") turnBlock(battle, change.block, change.facing);
    if (change.kind === "order") obey(battle, change.side, change.order);
  }
}

/**
 * The generals think the battle through before it begins: each plays the tactics open to him against the foe as he
 * expects it, and takes the one that ends best.
 * Done once, before the first tick at the latest; a change of the armies or of the ground makes them think again.
 */
export function plan(battle: Battle): void {
  if (battle.tick || battle.planned) return;
  battle.planned = true;
  if (battle.rehearsal) return;
  // each against the foe as the odds make him expect it: neither knows what the other has settled on
  const settled = SIDES.map(side => {
    let best: Option | null = null;
    let most = -Infinity;
    for (const option of getOptions(battle, side)) {
      const outcome = rehearse(battle, side, option);
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
    drawUp(battle); // the same battalions, in other places
  else forgetWays(battle.field);
}

/** How a battle goes for a side that does as its general has in mind: who holds the field, then whose losses are the lighter */
function rehearse(battle: Battle, side: Side, option: Option): number {
  const copy = (name: Side): BattleSide => ({
    ...createSide(battle[name].regiments, battle[name].phase),
    bonus: battle[name].bonus,
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
    interventions: [],
    log: [],
    result: null,
    planned: true,
    rehearsal: true
  };
  prepare(trial);
  const ticks = battle.type === "siege" ? STORM_TICKS : REHEARSAL_TICKS;
  for (let i = 0; i < ticks && !trial.result; i++) tick(trial);
  const winner = trial.result?.winner;
  const held = winner === side ? 1 : winner ? -1 : 0;
  return held + getLost(trial[enemyOf(side)]) - getLost(trial[side]);
}

export function intervene(battle: Battle, change: Intervention): void {
  battle.interventions.push(change);
  if (change.kind === "move" || change.kind === "turn") {
    const block = battle.blocks.find(block => block.key === change.block);
    if (!block) return;
    if (change.kind === "move") moveBlock(battle, change.block, change.x, change.y);
    else turnBlock(battle, change.block, change.facing);
    battle.log.push({
      tick: battle.tick,
      event: change.kind,
      side: block.side,
      params: { block: blockName(block) }
    });
    return;
  }

  if (change.kind === "order") {
    obey(battle, change.side, change.order);
    battle.log.push({ tick: battle.tick, event: "ordered", side: change.side, params: { order: change.order } });
  } else if (change.kind === "power") {
    battle[change.side].bonus += change.value;
    battle.log.push({ tick: battle.tick, event: "power", side: change.side, params: { value: signed(change.value) } });
  } else if (change.kind === "morale") {
    if (battle.tick) addMorale(battle, change.side, change.value); // before the start the troops are lined up anew
    battle.log.push({ tick: battle.tick, event: "morale", side: change.side, params: { value: signed(change.value) } });
  } else if (change.kind === "die") {
    battle[change.side].die = change.die;
    battle.log.push({ tick: battle.tick, event: "die", side: change.side, params: { die: String(change.die) } });
  } else if (change.kind === "type") {
    battle.type = change.type;
    battle.interventions = battle.interventions.filter(c => c.kind !== "order" || c.tick); // orders for the old type
    for (const side of SIDES) battle[side].phase = PHASES[battle.type][side][0];
  } else if (change.kind === "withdraw") {
    withdraw(battle, change.state, change.regiment);
  } else {
    battle[change.side].regiments.push(change.regiment);
    battle.log.push({
      tick: battle.tick,
      event: "join",
      side: change.side,
      params: { regiment: change.regiment.name }
    });
    if (battle.tick) reinforce(battle, change.side, change.regiment);
  }

  if (battle.tick) updatePower(battle);
  else {
    // what the generals settled on does not stand; a move or a turn of a battalion leaves it be
    if (["power", "add", "withdraw", "type", "order"].includes(change.kind)) rethink(battle);
    prepare(battle);
  }
}

/** Take a regiment out: before the start as if it never came, after it its battalions march off the field */
function withdraw(battle: Battle, state: number, i: number): void {
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
export function rethink(battle: Battle): void {
  battle.planned = false;
  for (const side of SIDES) Object.assign(battle[side], { tactic: null, waits: false, storms: false });
}

/** Drop the user's moves made before the start */
export function resetDeployment(battle: Battle): void {
  if (battle.tick) return;
  battle.interventions = battle.interventions.filter(change => change.kind !== "move");
  prepare(battle);
}

/** Apply the changes of a recorded battle that are due at the current tick */
export function applyDue(battle: Battle, script: Intervention[]): void {
  while (script.length && script[0].tick <= battle.tick) intervene(battle, { ...script.shift()!, tick: battle.tick });
}

/** Run a recorded battle to its end */
export function replay(battle: Battle, interventions: Intervention[]): void {
  const script = [...interventions];
  applyDue(battle, script);
  while (!battle.result) {
    tick(battle);
    applyDue(battle, script);
  }
}

export function getTroops(battle: Battle, side: Side): { initial: number; left: number; captured: number } {
  const blocks = battle.blocks.filter(block => block.side === side);
  return {
    initial: sum(blocks, block => block.initial),
    left: sum(blocks, getFree),
    captured: sum(blocks, getPrisoners)
  };
}

/** Troops of a battalion still its side's: those who gave themselves up are lost to it, unless it holds the field */
const getFree = (block: Block): number => (block.status === "surrendered" ? 0 : block.troops);
const getPrisoners = (block: Block): number => block.troops - getFree(block);

/** Share of a side's troops lost to it: fallen or taken prisoner */
export const getLost = (side: BattleSide): number => side.casualties + side.captured;

/** The regiment was taken out of the battle and is leaving the field */
export function isWithdrawn(battle: Battle, regiment: BattleRegiment): boolean {
  return battle.blocks.some(block => block.state === regiment.state && block.regiment === regiment.i && block.leaving);
}

const isInOrder = (block: Block): boolean => block.status === "ready" && !block.leaving; // and fights on

/** Troops of a regiment fallen, by unit */
export function getLosses(battle: Battle, regiment: BattleRegiment): Record<string, number> {
  return countUnits(battle, regiment, block => block.initial - block.troops);
}

/** Troops of a regiment taken prisoner, by unit */
export function getCaptured(battle: Battle, regiment: BattleRegiment): Record<string, number> {
  return countUnits(battle, regiment, getPrisoners);
}

function countUnits(battle: Battle, regiment: BattleRegiment, count: (block: Block) => number): Record<string, number> {
  const units: Record<string, number> = {};
  for (const block of battle.blocks) {
    if (block.state !== regiment.state || block.regiment !== regiment.i) continue;
    units[block.unit] = (units[block.unit] ?? 0) + count(block);
  }
  return units;
}

/** Outcome so far, for a battle the user ends by hand */
export function getResult(battle: Battle): BattleResult {
  if (battle.result) return battle.result;
  return { winner: null, status: getBattleStatus(getLost(battle.attackers), getLost(battle.defenders)) };
}

export function tick(battle: Battle): void {
  if (battle.result) return;
  if (!battle.tick) plan(battle);
  if (battle.tick % ROUND_TICKS === 0) startRound(battle);
  capitulate(battle);
  act(battle);
  fight(battle);
  battle.tick += 1;
  updatePower(battle);
  checkEnd(battle);
}

const places = new WeakMap<Battle, Map<number, [number, number]>>(); // where the battalions stood a round ago

function startRound(battle: Battle): void {
  battle.round = battle.tick / ROUND_TICKS;
  if (!battle.tick) {
    battle.log.push({ tick: 0, event: "start" });
    for (const side of SIDES)
      battle.log.push({ tick: 0, event: "tactic", side, params: { tactic: battle[side].plan.tactic } });
  }
  const cutOff = isCutOff(battle);
  if (cutOff !== battle.cutOff) {
    const burg = battle.field.burgs[battle.field.held!].name;
    battle.log.push({ tick: battle.tick, event: cutOff ? "cut" : "supplied", side: "attackers", params: { burg } });
  }
  battle.cutOff = cutOff;
  if (battle.round) {
    steady(battle);
    updatePower(battle);
  }

  // the approach is over at the first blow, or once nobody moves
  const fighting = battle.blocks.some(block => block.action === "fight" || block.action === "shoot");
  // on the march are those who got somewhere since the last round: a battalion shuffling about its place is not
  const stood = places.get(battle) ?? new Map<number, [number, number]>();
  const marching = battle.blocks.some(block => {
    const [x, y] = stood.get(block.id) ?? [block.x, block.y];
    return block.action === "move" && Math.hypot(block.x - x, block.y - y) > 10;
  });
  places.set(battle, new Map(battle.blocks.map(block => [block.id, [block.x, block.y]])));
  const held = SIDES.some(side => battle[side].plan.order); // stood by an order, a side has not begun
  if (battle.engaged === null && battle.round && (fighting || (!marching && !held))) {
    battle.engaged = battle.round;
    battle.lastLoss = battle.tick;
  }

  command(battle);
  batter(battle);

  const [attackers, defenders] = getCommands(battle);
  const orders = `Attackers: ${attackers}, defenders: ${defenders}`;
  const last = battle.course.at(-1);
  if (last?.orders === orders) last.count += 1;
  else battle.course.push({ orders, count: 1 });
}

const strength = (block: Block): number => block.troops * block.unitPower * block.upkeep;

/** A side that has troops in order and has neither turned to run nor laid down its arms */
const isFighting = (battle: Battle, side: Side): boolean =>
  !isBeaten(battle.type, side, battle[side].phase) &&
  battle.blocks.some(block => block.side === side && block.status === "ready");

/**
 * Morale by what a battalion sees around it: it loses heart outnumbered and takes heart with the upper hand or left alone.
 * The spent break and run, the most shaken first: their flight heartens the foes; the broken who got away rally.
 */
function steady(battle: Battle): void {
  for (const block of [...battle.blocks].sort((a, b) => a.morale - b.morale || a.id - b.id)) {
    if (block.status !== "ready" && block.status !== "routed") continue;
    const { friends, foes, nearest } = getHand(battle, block);

    const hungry = isHungry(battle, block);
    if (block.status === "routed") {
      if (nearest < SAFE || block.routs > 1 || !isFighting(battle, block.side) || hungry) continue;
      block.morale += REST;
      if (block.morale >= RALLY) rally(battle, block);
      continue;
    }

    if (foes) {
      const change = (friends / (friends + foes) - 0.5) * NERVE;
      block.morale += change > 0 ? (hungry ? 0 : change) : change / block.steadiness;
    } else if (!block.hit && !hungry) block.morale += REST;
    if (hungry) block.morale = Math.max(block.morale - HUNGER / block.steadiness, Math.min(block.morale, STARVED));
    block.morale = Math.min(Math.max(block.morale, 0), 100);
    if (block.morale <= BREAK) rout(battle, block);
    else if (isCornered(battle, block, friends / (friends + foes || 1))) surrender(battle, block);
    block.hit = false;
  }
}

/** Every battalion turns its order into a move, then blows are settled together */
function act(battle: Battle): void {
  const onField = battle.blocks.filter(block => block.status === "ready" || block.status === "routed");
  const present = battle.blocks.filter(block => block.status === "surrendered").concat(onField); // prisoners are in the way
  const sense: Sense = { onField, crowd: new Map(), held: new Set() };
  for (const block of onField) {
    if (block.status !== "ready" || block.target === null) continue;
    sense.crowd.set(block.target, (sense.crowd.get(block.target) ?? 0) + 1);
    if (block.action === "fight") sense.held.add(block.id).add(block.target);
  }

  const shooting = new Set<number>();
  for (const block of onField) block.vx = block.vy = 0;
  // the sides take the first move in turn: whoever moves first takes the ground
  for (const block of battle.tick % 2 ? [...onField].reverse() : onField) {
    if (block.status === "routed" || block.order.mission === "withdraw" || block.leaving) {
      flee(battle, block, present);
      continue;
    }

    const { target, to, stop, key, shared, shoot, facing, haste, keep } = decide(battle, block, sense);
    if (target && target.id !== block.target) sense.crowd.set(target.id, (sense.crowd.get(target.id) ?? 0) + 1);
    block.target = target?.id ?? null;
    const fires = shoot && !isIdle(battle[block.side].phase);
    if (fires) shooting.add(block.id);
    const bearing = target ? Math.atan2(target.y - block.y, target.x - block.x) : facing;

    if (target && inContact(battle, block, target)) block.action = "fight";
    else if (target && fires && canShoot(battle, block, target)) block.action = "shoot";
    else if (to) {
      // to the place, or to the next turn of the way round the water and no further
      const whole = Math.hypot(to.x - block.x, to.y - block.y) - stop;
      const [x, y] = shared ? getSharedHeading(battle, block, to) : getHeading(battle, block, to, key);
      const due = keep ? whole / (ROUND_TICKS - (battle.tick % ROUND_TICKS)) : whole; // the place moves once a round
      const leg = Math.min(due, x === to.x && y === to.y ? whole : Math.hypot(x - block.x, y - block.y));
      const moved = whole > 0 && step(battle, block, x - block.x, y - block.y, leg, present, haste);
      block.action = moved ? "move" : "hold";
      if (moved && !target && whole > 30) {
        block.facing = turn(block.facing, Math.atan2(y - block.y, x - block.x), 0.7); // it marches
        continue;
      }
    } else block.action = "hold";
    block.facing = turn(block.facing, bearing, 0.7);
  }

  // nobody is pushed into the water, out of a ford into the deep or through a wall
  const stood = present.map(block => ({
    x: block.x,
    y: block.y,
    dry: !isWet(battle, block, block.x, block.y),
    safe: !shuns(battle, block, block.x, block.y)
  }));
  separate(battle, present);
  present.forEach((block, i) => {
    const { x, y, dry, safe } = stood[i];
    const pushed =
      (dry && isWet(battle, block, block.x, block.y)) ||
      (safe && shuns(battle, block, block.x, block.y)) ||
      getWallsBetween(battle.field, [x, y], [block.x, block.y]).length > 0; // not even by a gate
    if (pushed) [block.x, block.y] = [x, y];
  });

  // who strikes is settled once all have moved, so neither side gets the first blow
  const byId = new Map(onField.map(block => [block.id, block]));
  for (const block of onField) {
    const target = block.action === "flee" ? undefined : byId.get(block.target ?? -1);
    if (target && inContact(battle, block, target)) block.action = "fight";
    else if (target && shooting.has(block.id) && canShoot(battle, block, target)) block.action = "shoot";
    if (!target || block.action !== "fight") block.impetus = 0;
    else if (!block.impetus) {
      // a charge strikes with the pace it closed at; who stood has none
      const distance = Math.hypot(target.x - block.x, target.y - block.y) || 1;
      const closing = (block.vx * (target.x - block.x) + block.vy * (target.y - block.y)) / distance;
      block.impetus = Math.min(1 + Math.max(closing, 0) / IMPETUS, MAX_IMPETUS);
    }
  }
}

/** Run for the edge of the field; the broken stop once no foe in order is near, to gather themselves, while their side fights on */
function flee(battle: Battle, block: Block, others: Block[]): void {
  block.target = null;
  const chased = others.some(
    foe => foe.side !== block.side && foe.status === "ready" && Math.hypot(foe.x - block.x, foe.y - block.y) < SAFE
  );
  if (block.status === "routed" && !chased && block.routs < 2 && isFighting(battle, block.side)) {
    block.action = "hold";
    return;
  }
  block.action = "flee";
  const away = getFlight(battle, block) ?? (block.side === "attackers" ? battle.axis + Math.PI : battle.axis);
  block.facing = turn(block.facing, away, 1.2);
  step(battle, block, Math.cos(away), Math.sin(away), Infinity, others, 1.3);
  const off = block.x < 0 || block.x > FIELD.width || block.y < 0 || block.y > FIELD.height;
  if (off) {
    block.status = "fled";
    battle.log.push({
      tick: battle.tick,
      event: "fled",
      side: block.side,
      params: { block: blockName(block) }
    });
  }
}

// Walls. A wall stops everybody; a gate lets through whom the burg is open to: all but the besiegers of the burg
// the defenders of a siege hold. The besiegers get in by storm, over the walls and through the forced gates, or by a breach.

/** The burg a siege is for, where the defenders form up: the one the battle is named after, or the nearest */
function getHeld(battle: Battle): number | null {
  const { burgs } = battle.field;
  if (battle.type !== "siege" || !burgs.length) return null;
  const middle = (burg: { x: number; y: number }): number =>
    Math.hypot(burg.x - FIELD.width / 2, burg.y - FIELD.height / 2);
  const named = burgs.filter(burg => burg.name === battle.place);
  return burgs.indexOf((named.length ? named : burgs).reduce((a, b) => (middle(a) < middle(b) ? a : b)));
}

/** Engines in range of a besieged burg work a breach into its wall, where it is nearest to them: the more of them the sooner */
function batter(battle: Battle): void {
  const { field } = battle;
  const { phase } = battle.attackers;
  if (field.held === null || (phase !== "bombardment" && phase !== "storming")) return; // engines cover a storm too
  const burg = field.burgs[field.held];
  if (!burg.walled || field.breaches.filter(breach => breach.burg === field.held).length >= BREACHES) return;
  const engines = battle.blocks.filter(
    block =>
      block.side === "attackers" &&
      block.status === "ready" &&
      block.type === "machinery" &&
      Math.hypot(block.x - burg.x, block.y - burg.y) <= block.range + burg.radius
  );
  if (!engines.length) return;
  battle.lastLoss = battle.tick; // no lull while the engines are at the walls
  battle.battered += Math.min(engines.length * 0.04, 0.2);
  if (battle.battered < 1) return;

  battle.battered -= 1;
  const engine = engines.reduce((a, b) => (b.troops > a.troops ? b : a));
  const middle = (wall: FieldWall): [number, number] => [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2];
  const far = (wall: FieldWall): number => Math.hypot(middle(wall)[0] - engine.x, middle(wall)[1] - engine.y);
  const walls = field.walls.filter(wall => wall.burg === field.held && !wall.gate);
  if (!walls.length) return;
  openBreach(field, field.held, middle(walls.reduce((a, b) => (far(b) < far(a) ? b : a))));
  battle.log.push({ tick: battle.tick, event: "breach", side: "attackers", params: { burg: burg.name } });
}

function fight(battle: Battle): void {
  const byId = new Map(battle.blocks.map(block => [block.id, block]));
  const strikers = battle.blocks.filter(block => block.action === "fight" || block.action === "shoot");

  const landed = new Map<number, number>(); // men it would cut down of defense 1, past the cover of those hit
  const pressed = new Map<number, number>(); // morale lost to hits in the flank and rear
  const struck = new Set<number>(); // those hit hand to hand
  for (const block of strikers) {
    const target = byId.get(block.target!)!;
    const from = terrainAt(battle.field, block.x, block.y);
    const to = terrainAt(battle.field, target.x, target.y);
    const shot = block.action === "shoot";
    let power =
      getPower(battle, block, block.attack) * getImpetus(battle, block, target) * getFooting(battle, block, from);
    if (block.type === "mounted" && (from.wood || to.wood)) power *= 0.6;
    // cover takes its share of the losses: walls from without, woods and houses from shots
    const besieging = to.walled > 0 && from.walled !== to.walled;
    const cover = besieging ? 1 / WALLS : shot && (to.wood || to.town) ? COVER : 1;
    if (shot && from.walled && !to.walled) power *= 1.25; // from the walls

    if (!shot) {
      block.impetus = 1 + (block.impetus - 1) * SPENT;
      struck.add(target.id);
      const bearing = Math.atan2(block.y - target.y, block.x - target.x);
      const angle = Math.abs(normalize(bearing - target.facing));
      const side = angle > 2.1 ? 2 : angle > 1.05 ? 1 : 0; // rear, flank, front
      if (side) {
        power *= side === 2 ? 1.6 : 1.3;
        pressed.set(target.id, (pressed.get(target.id) ?? 0) + side / 2);
      }
    }
    landed.set(target.id, (landed.get(target.id) ?? 0) + power * cover * (shot ? SHOT_RATE : BLOW_RATE));
  }

  for (const [id, blows] of landed) {
    const block = byId.get(id)!;
    const ground = terrainAt(battle.field, block.x, block.y);
    // what each man stands with: the harder the blows and the weaker the man, the more fall; counted in fractions
    const stands =
      getPower(battle, block, block.defense, 1) * (ground.town ? TOWN : 1) * getFooting(battle, block, ground);
    const fallen = blows / Math.max(stands, 0.01) / ROUND_TICKS;
    const share = fallen / block.initial;
    block.harm += fallen;
    const died = Math.min(Math.floor(block.harm), block.troops);
    block.harm -= died;
    block.troops -= died;
    const shaken = share * MORALE_LOSS + 1 / ROUND_TICKS + (pressed.get(id) ?? 0);
    block.morale = Math.max(block.morale - shaken / block.steadiness, 0);
    // shots over the walls of a besieged burg do not keep a battle going: a storm, a sortie or a breach does
    if (share && (!hasWalls(battle) || struck.has(id) || isStorming(battle))) battle.lastLoss = battle.tick;
    block.hit = true;

    if (!block.troops) {
      block.status = "destroyed";
      block.action = "hold";
      battle.log.push({
        tick: battle.tick,
        event: "destroyed",
        side: block.side,
        params: { block: blockName(block) }
      });
      shake(battle, block, 6);
      hearten(battle, enemyOf(block.side));
    }
  }
}

function rout(battle: Battle, block: Block): void {
  block.status = "routed";
  block.routs += 1;
  battle.log.push({ tick: battle.tick, event: "rout", side: block.side, params: { block: blockName(block) } });
  shake(battle, block, 8);
  hearten(battle, enemyOf(block.side));
}

/**
 * Shaken, at grips, outmatched at hand and on the losing side: the battalion gives itself up. It stays where it is,
 * in the way of all, strikes no blow and takes none; its men are lost to its side unless the side holds the field
 */
function isCornered(battle: Battle, block: Block, share: number): boolean {
  if (block.morale >= SHAKEN || block.action !== "fight" || share >= CORNERED) return false;
  const own = battle[block.side];
  const foe = battle[enemyOf(block.side)];
  return own.power < foe.power && getLost(own) > getLost(foe);
}

function surrender(battle: Battle, block: Block): void {
  yieldBlock(block);
  battle.log.push({ tick: battle.tick, event: "surrender", side: block.side, params: { block: blockName(block) } });
  shake(battle, block, 6);
  hearten(battle, enemyOf(block.side));
}

const yieldBlock = (block: Block): void => {
  Object.assign(block, { status: "surrendered", action: "hold", target: null, impetus: 0, vx: 0, vy: 0 });
};

/**
 * A side that gives itself up lays down its arms all at once: its order says so in the log.
 * A side that turns to run leaves behind who cannot break off: those held at grips by stronger foes
 */
function capitulate(battle: Battle): void {
  for (const block of battle.blocks) {
    if (block.status !== "ready" || block.leaving) continue;
    const { phase } = battle[block.side];
    if (phase === SURRENDER) yieldBlock(block);
    else if (block.action === "fight" && isBeaten(battle.type, block.side, phase)) {
      const { friends, foes } = getHand(battle, block);
      if (foes > friends) surrender(battle, block);
    }
  }
}

/** Strength in order of the friends and the foes about a battalion, and how far the nearest foe in order is */
function getHand(battle: Battle, block: Block): { friends: number; foes: number; nearest: number } {
  let friends = 0;
  let foes = 0;
  let nearest = Infinity;
  for (const other of battle.blocks) {
    if (other.status !== "ready") continue;
    const distance = Math.hypot(other.x - block.x, other.y - block.y);
    if (other.side !== block.side) nearest = Math.min(nearest, distance);
    if (distance > NEAR) continue;
    if (other.side === block.side) friends += strength(other);
    else foes += strength(other);
  }
  return { friends, foes, nearest };
}

/** A broken battalion that got away stands again, behind its side */
function rally(battle: Battle, block: Block): void {
  block.status = "ready";
  block.action = "hold";
  // those who fight hand to hand join the reserve; shooters and engines go on shooting from where they stand
  const role: Role = block.kind === "shooter" ? "support" : block.kind === "engine" ? "battery" : "reserve";
  Object.assign(block.order, { role, mission: role, sent: false, target: null });
  takePlace(battle, block);
  battle.log.push({ tick: battle.tick, event: "rally", side: block.side, params: { block: blockName(block) } });
}

/** A loss nearby unsettles friends and heartens foes */
function shake(battle: Battle, lost: Block, morale: number): void {
  for (const block of battle.blocks) {
    if (block.status !== "ready" || Math.hypot(block.x - lost.x, block.y - lost.y) > 160) continue;
    const change = block.side === lost.side ? -morale / block.steadiness : isHungry(battle, block) ? 0 : morale;
    block.morale = Math.min(Math.max(block.morale + change, 0), 100);
  }
}

/** A foe broken or cut down heartens the whole side a little, not only who saw it */
function hearten(battle: Battle, side: Side): void {
  for (const block of battle.blocks)
    if (block.side === side && block.status === "ready" && !isHungry(battle, block))
      block.morale = Math.min(block.morale + HEART, 100);
}

/** A garrison cut off goes hungry: it takes heart from nothing, and only food coming in ends it */
const isHungry = (battle: Battle, block: Block): boolean => battle.cutOff && block.side === "defenders";

/** Power multiplier of a die: 0.375 for ⚀ to 1.125 for ⚅, 0.75 on average */
export const getFortune = (die: number): number => 0.75 + (die - 3.5) * 0.15;

/** Troops on the run, and a side in retreat: they hardly strike or stand */
const isBroken = (battle: Battle, block: Block): boolean =>
  isRunning(block) || isBeaten(battle.type, block.side, battle[block.side].phase);

function getPower(battle: Battle, block: Block, of: number, troops = block.troops): number {
  const side = battle[block.side];
  const state = isBroken(battle, block) ? BROKEN : side.phase === "shock" ? SHOCK : 1;
  return troops * block.upkeep * of * state * getFortune(side.die) * side.boost;
}

/** What speed adds to a blow: a charge's, spent within a round or two at grips; a missile's, the more the nearer it was loosed */
function getImpetus(battle: Battle, block: Block, target: Block): number {
  if (block.action === "fight") return Math.max(block.impetus, 1);
  const share = Math.hypot(target.x - block.x, target.y - block.y) / getRange(battle, block, target);
  return Math.min(Math.max(1.5 - share, 0.5), 1.5);
}

/** Power of the troops a side has in order, as the military screens count it, with what was added by hand */
export function getUnitsPower(battle: Battle, side: Side): number {
  const inOrder = battle.blocks.filter(block => block.side === side && isInOrder(block));
  const base = sum(inOrder, block => block.troops * block.unitPower * block.upkeep);
  return base ? Math.max(base + battle[side].bonus, 0) : 0;
}

/** Hearten or shake the troops of a side that are in order */
function addMorale(battle: Battle, side: Side, value: number): void {
  const clamp = (morale: number): number => Math.min(Math.max(morale + value, 0), 100);
  for (const block of battle.blocks)
    if (block.side === side && block.status === "ready") block.morale = clamp(block.morale);
  battle[side].morale = clamp(battle[side].morale);
}

const signed = (value: number): string => (value > 0 ? `+${value}` : `−${Math.abs(value)}`);

function updatePower(battle: Battle): void {
  for (const side of SIDES) {
    const blocks = battle.blocks.filter(block => block.side === side);
    const base = sum(blocks.filter(isInOrder), strength);
    battle[side].boost = base ? Math.max(1 + battle[side].bonus / base, 0) : 1;
    battle[side].power = (base * battle[side].boost) / (battle.populationScale / 10);
    const initial = sum(blocks, block => block.initial);
    const troops = sum(blocks, getFree);
    battle[side].casualties = initial ? 1 - sum(blocks, block => block.troops) / initial : 0;
    battle[side].captured = initial ? sum(blocks, getPrisoners) / initial : 0;
    if (battle.tick) battle[side].morale = troops ? sum(blocks, block => block.morale * getFree(block)) / troops : 0;
  }
}

function setInitialMorale(battle: Battle): void {
  for (const side of SIDES) {
    const own = battle[side];
    const enemy = battle[enemyOf(side)];
    const troops = sum(own.regiments, regiment => total(regiment));
    const stability = troops ? sum(own.regiments, regiment => regiment.stability * total(regiment)) / troops : 0.5;
    const ratio = own.power ? enemy.power / own.power : 1;
    own.morale = getInitialMorale(
      ratio,
      stability,
      own.regiments.map(regiment => regiment.distance)
    );
    for (const block of battle.blocks) if (block.side === side) block.morale = own.morale;
  }
}

function checkEnd(battle: Battle): void {
  const standing = (side: Side, statuses: BlockStatus[]): boolean =>
    battle.blocks.some(block => block.side === side && statuses.includes(block.status));
  const ready = SIDES.map(side => battle.blocks.some(block => block.side === side && isInOrder(block)));
  const onField = SIDES.map(side => standing(side, ["ready", "routed"]));

  // a side with nobody left in order: the rest is over in a few rounds
  if (!ready[0] || !ready[1]) battle.brokenAt ??= battle.tick;
  const pursued = battle.brokenAt !== null && battle.tick - battle.brokenAt >= ROUND_TICKS * 3; // the rest get away

  const over =
    !onField[0] ||
    !onField[1] ||
    (!ready[0] && !ready[1]) ||
    pursued ||
    battle.tick >= MAX_TICKS ||
    (battle.engaged !== null && !battle.cutOff && battle.tick - battle.lastLoss > IDLE_ROUNDS * ROUND_TICKS); // a long way round is no lull, nor a blockade
  if (!over) return;

  // a side holds the field while it has troops in order and has neither turned to run nor given itself up
  const holds = SIDES.map((side, i) => ready[i] && !isBeaten(battle.type, side, battle[side].phase));
  const winner = holds[0] === holds[1] ? null : holds[0] ? "attackers" : "defenders";
  // who holds the field frees its own who gave themselves up
  for (const block of battle.blocks)
    if (block.side === winner && block.status === "surrendered") block.status = "ready";
  updatePower(battle);
  battle.result = { winner, status: getBattleStatus(getLost(battle.attackers), getLost(battle.defenders), winner) };
  battle.log.push({ tick: battle.tick, event: "end", side: winner });
}

const getMen = (unit: MilitaryUnit, troops: number): number => troops * Math.max(unit.crew, 1);

/** Men in a battalion: 0.3 to 1 population point, the least that makes no more than forty battalions of all the troops; 0.2 when 0.3 makes fewer than ten */
/** The field at the scale of the battalions: a full one's front fills its width. A field of the map is built anew to it */
function setScale(battle: Battle): void {
  const { field } = battle;
  const troops = battle.battalion / RANKS / BATTALION_WIDTH;
  const zoom = battle.type === "siege" && field.site ? getSiegeMetres(field.site) : Infinity; // a siege is about the walls
  const metres = Math.min(Math.max(Math.min(troops, zoom), 0.25), 10);
  if (field.metres === metres) return;
  if (field.site) battle.field = buildBattlefield(field.site[0], field.site[1], metres, battle.type !== "ambush");
  else field.metres = metres;
}

function getBattalionSize(battle: Battle): number {
  let men = 0;
  for (const side of SIDES) {
    for (const regiment of battle[side].regiments) {
      for (const unit of battle.units) men += getMen(unit, regiment.troops[unit.name] ?? 0);
    }
  }
  const battalions = (size: number): number => men / (size * battle.populationScale);
  const size = battalions(0.3) < 10 ? 0.2 : ([0.3, 0.5].find(size => battalions(size) <= 40) ?? 1);
  return Math.round(size * battle.populationScale);
}

/** Split the regiment into battalions: a unit ten times as numerous fields ten times as many */
function addBlocks(battle: Battle, side: Side, regiment: BattleRegiment): Block[] {
  const added: Block[] = [];
  for (const unit of battle.units) {
    const troops = regiment.troops[unit.name];
    if (!troops) continue;
    const count = Math.min(Math.max(Math.round(getMen(unit, troops) / battle.battalion), 1), troops);

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
        kind: getKind(unit, battle.field.open !== null),
        unitPower: getUnitPower(unit),
        attack: unit.attack,
        defense: unit.defense,
        speed: unit.speed,
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
        width: Math.min(Math.max((getMen(unit, share) / battle.battalion) * BATTALION_WIDTH, 18), 58), // by its men
        depth: BLOCK_DEPTH,
        morale: battle[side].morale,
        status: "ready",
        action: "hold",
        target: null,
        hit: false,
        harm: 0.5, // losses are rounded to the nearest man, or ship
        routs: 0,
        leaving: false,
        detour: 0,
        order: { ...NO_ORDER }
      };
      battle.blocks.push(block);
      added.push(block);
    }
  }
  return added;
}

/** Latecomers form up behind their side */
function reinforce(battle: Battle, side: Side, regiment: BattleRegiment): void {
  enlist(battle, side, addBlocks(battle, side, regiment));
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
  idle: 0,
  losses: 0,
  bled: 0
};

/** The approach, turned as little as it takes for the attackers to form up on land */
function findAxis(battle: Battle): number {
  const { field, approach } = battle;
  if (field.open || battle.type === "landing") return approach;
  const dry = (axis: number): boolean =>
    [-0.3, 0, 0.3].every(shift =>
      [0.6, 0.8, 1].every(depth => {
        const across = axis + Math.PI / 2;
        const x = FIELD.width / 2 - Math.cos(axis) * reach(axis) * depth + Math.cos(across) * reach(across) * shift;
        const y = FIELD.height / 2 - Math.sin(axis) * reach(axis) * depth + Math.sin(across) * reach(across) * shift;
        return terrainAt(field, x, y).water !== 1;
      })
    );
  for (const swing of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2, Math.PI])
    if (dry(approach + swing)) return approach + swing;
  return approach;
}

function moveBlock(battle: Battle, key: string, x: number, y: number): void {
  const block = battle.blocks.find(block => block.key === key);
  if (!block) return;
  block.x = Math.min(Math.max(x, 20), FIELD.width - 20);
  block.y = Math.min(Math.max(y, 20), FIELD.height - 20);
  block.action = "hold";
  takePlace(battle, block);
}

function turnBlock(battle: Battle, key: string, facing: number): void {
  const block = battle.blocks.find(block => block.key === key);
  if (block) block.facing = block.order.facing = normalize(facing);
}

/** A battalion in the log: the side is shown beside it, and the regiment's name would take the line */
const blockName = (block: Block): string => `${block.unit.replace(/_/g, " ")} ${block.number || ""}`.trim();

const total = (regiment: BattleRegiment): number => sum(Object.values(regiment.troops), troops => troops);

function sum<T>(items: T[], value: (item: T) => number): number {
  let result = 0;
  for (const item of items) result += value(item);
  return result;
}

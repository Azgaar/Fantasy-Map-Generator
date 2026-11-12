import { FOOT_SPEED, getUnitPower } from "@/model/political/military-units";
import type { MilitaryUnit } from "@/types/military";
import {
  type BattleRandom,
  type BattleType,
  createRandom,
  enemyOf,
  getBattleStatus,
  getInitialMorale,
  getPhasePower,
  getStance,
  PHASE_CASUALTY_RATE,
  PHASES,
  SIDES,
  type Side,
  selectPhases
} from "./battle-rules";
import {
  type Battlefield,
  FIELD,
  type FieldWall,
  getWallsBetween,
  nodeAt,
  nodeCentre,
  openBreach,
  type Terrain,
  terrainAt
} from "./battlefield";
import { getStepBit, isClear, type Reach, spread, trace } from "./pathfinding";

export const ROUND_TICKS = 6;
const MAX_TICKS = 600;
const IDLE_ROUNDS = 12; // rounds without losses that end a battle
const DIE_ROUNDS = 10; // the dice are rolled once in so many rounds
const ROW_GAP = 40;
const BLOCK_DEPTH = 22;
const GAP = 10; // between neighbours in a line
const MORALE_LOSS = 180; // morale a block loses when all its troops fall

// field units a tick
const PACE = FOOT_SPEED; // of troops on foot
const WADING = 0.12; // share of the pace kept in deep water
const FORDING = 0.4; // and in a ford
const SCALING = 0.25; // share of the pace kept climbing a wall or forcing a gate
const RUBBLE = 0.5; // and over the rubble of a breach
const BREACHES = 3; // most that are made in the walls of a burg
const TOWN = 1.25; // how much stronger troops in a burg defend
const WALLS = 3; // how many times weaker a blow or a shot is from without the walls at those within
const STORM_ODDS = [4, 2.5, 1.8, 1.4]; // besiegers to besieged it takes to storm walls, by the breaches in them
const ASSAULT_ODDS = 1.25; // and a burg without walls
const STORM_ROUNDS = 12; // a storm of walls lasts that long at least: the time to cross the field to them
const COVER = 0.6; // share of the shots that tell on troops in a wood or a burg
const SHIPPED = 5; // pace of troops carried over water
const PRIZE = 0.3; // how much nearer a foe that only hits looks to who picks a target
const CHARGE = 120; // how far those who fight hand to hand look for such a foe
const LONG_SHOT = 200; // shooters of this range and more are drawn up behind the line

export type BlockStatus = "ready" | "routed" | "fled" | "destroyed";
export type BlockAction = "hold" | "move" | "shoot" | "fight" | "flee";

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
  facing: number; // radians
  width: number;
  depth: number;
  morale: number;
  status: BlockStatus;
  action: BlockAction;
  target: number | null;
  hit: boolean; // took losses this round
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
  casualties: number; // share of the initial troops lost
  power: number;
  phase: string;
  die: number;
  dieSet: boolean; // rolled by hand: kept to the end of the battle
}

export type Intervention =
  | { tick: number; kind: "move"; block: string; x: number; y: number }
  | { tick: number; kind: "turn"; block: string; facing: number }
  | { tick: number; kind: "phase"; side: Side; phase: string }
  | { tick: number; kind: "power"; side: Side; value: number }
  | { tick: number; kind: "morale"; side: Side; value: number }
  | { tick: number; kind: "die"; side: Side; die: number }
  | { tick: number; kind: "add"; side: Side; regiment: BattleRegiment }
  | { tick: number; kind: "type"; type: BattleType };

export type LogEvent =
  | "start"
  | "phases"
  | "order"
  | "move"
  | "turn"
  | "die"
  | "power"
  | "morale"
  | "join"
  | "rout"
  | "destroyed"
  | "fled"
  | "breach"
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
  seed: string;
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
  phasesRecord: { phase: string; count: number }[];
  interventions: Intervention[];
  log: LogEntry[];
  result: BattleResult | null;
  random: BattleRandom;
}

export interface BattleSetup {
  seed: string;
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
  power: 0,
  phase,
  die: 3,
  dieSet: false
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
    phasesRecord: [],
    interventions: [],
    log: [],
    result: null,
    random: createRandom(`${setup.seed}_s`)
  };
  prepare(battle);
  return battle;
}

/** Line the troops up anew; only before the first tick, the user's moves are kept */
export function prepare(battle: Battle): void {
  if (battle.tick) return;
  battle.blocks = [];
  ways.delete(battle.field);
  battle.battalion = getBattalionSize(battle);
  battle.axis = findAxis(battle);
  battle.field.held = getHeld(battle);
  openCrossing(battle);
  for (const side of SIDES) {
    battle[side].phase = PHASES[battle.type][side][0];
    for (const regiment of battle[side].regiments) addBlocks(battle, side, regiment);
  }
  deploy(battle);
  separate(battle, battle.blocks); // a crowded line spreads out
  garrison(battle);
  settle(battle);
  for (const change of battle.interventions) {
    if (change.kind === "move") moveBlock(battle, change.block, change.x, change.y);
    if (change.kind === "turn") turnBlock(battle, change.block, change.facing);
    if (change.kind === "phase") battle[change.side].phase = change.phase;
  }
  updatePower(battle);
  setInitialMorale(battle);
  for (const change of battle.interventions) {
    if (change.kind === "morale") addMorale(battle, change.side, change.value);
  }
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
      params: { block: blockName(battle, block) }
    });
    return;
  }

  if (change.kind === "phase") {
    battle[change.side].phase = change.phase;
    battle.log.push({ tick: battle.tick, event: "order", side: change.side, params: { phase: change.phase } });
  } else if (change.kind === "power") {
    battle[change.side].bonus += change.value;
    battle.log.push({ tick: battle.tick, event: "power", side: change.side, params: { value: signed(change.value) } });
  } else if (change.kind === "morale") {
    if (battle.tick) addMorale(battle, change.side, change.value); // before the start the troops are lined up anew
    battle.log.push({ tick: battle.tick, event: "morale", side: change.side, params: { value: signed(change.value) } });
  } else if (change.kind === "die") {
    battle[change.side].die = change.die;
    battle[change.side].dieSet = true;
    battle.log.push({ tick: battle.tick, event: "die", side: change.side, params: { die: String(change.die) } });
  } else if (change.kind === "type") {
    battle.type = change.type;
    battle.interventions = battle.interventions.filter(c => c.kind !== "phase" || c.tick); // phases of the old type
    for (const side of SIDES) battle[side].phase = PHASES[battle.type][side][0];
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
  else prepare(battle);
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

export function getTroops(battle: Battle, side: Side): { initial: number; left: number } {
  const blocks = battle.blocks.filter(block => block.side === side);
  return { initial: sum(blocks, block => block.initial), left: sum(blocks, block => block.troops) };
}

/** Troops a regiment lost, by unit */
export function getLosses(battle: Battle, regiment: BattleRegiment): Record<string, number> {
  const losses: Record<string, number> = {};
  for (const block of battle.blocks) {
    if (block.state !== regiment.state || block.regiment !== regiment.i) continue;
    losses[block.unit] = (losses[block.unit] ?? 0) + block.initial - block.troops;
  }
  return losses;
}

/** Outcome so far, for a battle the user ends by hand */
export function getResult(battle: Battle): BattleResult {
  if (battle.result) return battle.result;
  return { winner: null, status: getBattleStatus(battle.attackers.casualties, battle.defenders.casualties) };
}

export function tick(battle: Battle): void {
  if (battle.result) return;
  if (battle.tick % ROUND_TICKS === 0) startRound(battle);
  act(battle);
  fight(battle);
  battle.tick += 1;
  updatePower(battle);
  checkEnd(battle);
}

function startRound(battle: Battle): void {
  const { random } = battle;
  battle.round = battle.tick / ROUND_TICKS;
  if (!battle.tick) battle.log.push({ tick: 0, event: "start" });

  if (battle.round) {
    // those hit hard may break, the most shaken first: their flight heartens the foes; the rest take heart
    for (const block of [...battle.blocks].sort((a, b) => a.morale - b.morale)) {
      if (block.status !== "ready") continue;
      if (!block.hit) block.morale = Math.min(block.morale + 3, 100);
      else if (random.P(1 - block.morale / 25)) rout(battle, block);
      block.hit = false;
    }
    updatePower(battle);
  }

  // the approach is over at the first blow, or once nobody moves
  const fighting = battle.blocks.some(block => block.action === "fight" || block.action === "shoot");
  const marching = battle.blocks.some(block => block.action === "move");
  if (battle.engaged === null && battle.round && (fighting || !marching)) {
    battle.engaged = battle.round;
    battle.lastLoss = battle.tick;
  }

  if (battle.engaged !== null && battle.round > battle.engaged) {
    const ready = battle.blocks.filter(block => block.status === "ready");
    const machinery = SIDES.map(side =>
      sum(
        ready.filter(block => block.side === side && block.type === "machinery"),
        block => block.troops
      )
    ) as [number, number];
    let [attackers, defenders] = selectPhases(
      {
        type: battle.type,
        round: battle.round - battle.engaged,
        previous: [battle.attackers.phase, battle.defenders.phase],
        morale: [battle.attackers.morale, battle.defenders.morale],
        powerRatio: battle.attackers.power / battle.defenders.power,
        casualties: [battle.attackers.casualties, battle.defenders.casualties],
        rangedShare:
          sum(
            ready.filter(block => block.type === "ranged"),
            block => block.troops
          ) / (sum(ready, block => block.troops) || 1),
        machinery
      },
      random
    );
    // a burg is not stormed at poor odds, and walls are stormed in earnest:
    // the storm goes on till it has had time to reach them, and while it is on them
    if (battle.attackers.phase !== "storming") {
      battle.storm = null;
      if (attackers === "storming" && battle.field.held !== null && !hasOdds(battle)) {
        attackers = machinery[0] ? "bombardment" : "blockade";
        defenders = battle.defenders.phase;
      }
    } else if (hasWalls(battle)) {
      if (battle.storm === null) {
        battle.storm = battle.round - 1;
        battle.lastLoss = battle.tick; // the lull is over
      }
      const slackens = attackers === "blockade" || attackers === "bombardment";
      const under = battle.round - battle.storm < STORM_ROUNDS || isOnWalls(battle);
      if (slackens && under) [attackers, defenders] = ["storming", "defense"];
    }
    if (attackers !== battle.attackers.phase || defenders !== battle.defenders.phase) {
      battle.log.push({
        tick: battle.tick,
        event: "phases",
        params: { attackers, defenders }
      });
    }
    battle.attackers.phase = attackers;
    battle.defenders.phase = defenders;
    batter(battle);
  }

  if (battle.round % DIE_ROUNDS === 0) {
    for (const side of SIDES) {
      const roll = random.rand(1, 6); // rolled either way, so a die set by hand changes nothing else
      if (!battle[side].dieSet) battle[side].die = roll;
    }
  }

  const phase = `Attackers: ${battle.attackers.phase}, defenders: ${battle.defenders.phase}`;
  const last = battle.phasesRecord.at(-1);
  if (last?.phase === phase) last.count += 1;
  else battle.phasesRecord.push({ phase, count: 1 });
}

/** Pick targets and move */
function act(battle: Battle): void {
  const { blocks } = battle;
  const onField = blocks.filter(block => block.status === "ready" || block.status === "routed");

  // friends already going for a foe
  const crowd = new Map<number, number>();
  for (const block of onField) {
    if (block.target !== null && block.status === "ready") crowd.set(block.target, (crowd.get(block.target) ?? 0) + 1);
  }

  // the sides take the first move in turn: whoever moves first takes the ground
  for (const block of battle.tick % 2 ? [...onField].reverse() : onField) {
    const stance = getStance(battle[block.side].phase);
    if (block.status === "routed" || stance === "flee") {
      flee(battle, block, onField);
      continue;
    }

    const pursuing = battle[block.side].phase === "pursue";
    // a foe at its throat comes first
    const assailant = onField.find(
      foe =>
        foe.side !== block.side && foe.status === "ready" && foe.target === block.id && inContact(battle, foe, block)
    );
    const target = assailant ?? pickTarget(battle, block, onField, pursuing, crowd);
    if (target && target.id !== block.target) crowd.set(target.id, (crowd.get(target.id) ?? 0) + 1);
    block.target = target?.id ?? null;
    if (!target) {
      block.action = "hold";
      continue;
    }

    const distance = Math.hypot(target.x - block.x, target.y - block.y);
    const { range } = block;
    const touching = inContact(battle, block, target);
    const pinned =
      touching ||
      onField.some(foe => foe.side !== block.side && foe.target === block.id && inContact(battle, foe, block));
    if (!pinned || touching) block.facing = turn(block.facing, Math.atan2(target.y - block.y, target.x - block.x), 0.7);

    if (touching) block.action = "fight";
    else if (pinned) block.action = "hold";
    else if (range && distance <= range) block.action = "shoot";
    else if (stance !== "hold") {
      // shooters close to their range, the rest to contact or, while skirmishing, just out of range
      const reach = range ? distance - range * 0.85 : stance === "shoot" ? distance - 200 : distance;
      const march = distance > 240 && !pursuing ? PACE / getPace(battle, block) : 1; // the line keeps together until the charge
      // to the target, or to the next turn of the way round the water and no further
      const [x, y] = getHeading(battle, block, target);
      const leg = x === target.x && y === target.y ? reach : Math.min(reach, Math.hypot(x - block.x, y - block.y));
      const moved = reach > 0 && step(battle, block, x - block.x, y - block.y, leg, onField, Math.min(march, 1));
      block.action = moved ? "move" : "hold";
    } else block.action = "hold";
  }

  // nobody is pushed into the water, out of a ford into the deep or through a wall
  const stood = onField.map(block => ({
    x: block.x,
    y: block.y,
    dry: !isWet(battle, block, block.x, block.y),
    safe: !shuns(battle, block, block.x, block.y)
  }));
  separate(battle, onField);
  onField.forEach((block, i) => {
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
    if (!target) continue;
    const { range } = block;
    if (inContact(battle, block, target) || inContact(battle, target, block)) block.action = "fight";
    else if (range && Math.hypot(target.x - block.x, target.y - block.y) <= range) block.action = "shoot";
  }
}

function pickTarget(
  battle: Battle,
  block: Block,
  onField: Block[],
  pursuing: boolean,
  crowd: Map<number, number>
): Block | null {
  let best: Block | null = null;
  let bestScore = Infinity;
  for (const foe of onField) {
    if (foe.side === block.side) continue;
    let score = getDistance(battle, block, foe);
    if (foe.status === "routed") score = pursuing ? score * 0.8 : score + 400; // the broken are left alone unless pursued
    if (foe.id === block.target)
      score *= 0.75; // stick to the target
    else if (!block.range) score += (crowd.get(foe.id) ?? 0) * 45; // spread along the line
    if (isRider(block) && isShooter(foe)) score *= 0.75; // riders hunt shooters
    // of the foes at hand, who hits harder than it stands is struck first
    if (score <= Math.max(block.range, CHARGE)) score *= 1 - PRIZE * getEdge(foe);
    if (score < bestScore) {
      bestScore = score;
      best = foe;
    }
  }
  return best;
}

const isShooter = (block: Block): boolean => block.range > 0;
const isEngine = (block: Block): boolean => block.range >= LONG_SHOT;
const isRider = (block: Block): boolean => !block.range && block.speed >= PACE * 2;

/** How much more a block's units hit than they stand, -1 to 1 */
const getEdge = (block: Block): number => (block.attack - block.defense) / (block.attack + block.defense || 1);

function flee(battle: Battle, block: Block, others: Block[]): void {
  block.action = "flee";
  block.target = null;
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
      params: { block: blockName(battle, block) }
    });
  }
}

/** Move towards the point at the block's pace, around whoever stands in the way; false when hemmed in */
function step(
  battle: Battle,
  block: Block,
  dx: number,
  dy: number,
  limit: number,
  others: Block[],
  haste = 1
): boolean {
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const terrain = terrainAt(battle.field, block.x, block.y);
  const pace = getPace(battle, block, terrain.water) * haste * getGoing(battle, block, terrain);
  const distance = Math.min(pace, limit);
  const heading = Math.atan2(dy, dx);
  const wading = shuns(battle, block, block.x, block.y); // may wade out
  // a step aside ends in the water only midstream, when the way ahead is water too
  const ahead: [number, number] = [block.x + Math.cos(heading) * distance, block.y + Math.sin(heading) * distance];
  const midstream = isWet(battle, block, block.x, block.y) && isWet(battle, block, ...ahead);

  // straight on, a shorter step to close up, then to either side
  for (const [swing, share] of [
    [0, 1],
    [0, 0.5],
    [0, 0.25],
    [0.7, 1],
    [-0.7, 1],
    [1.4, 1],
    [-1.4, 1]
  ]) {
    const x = block.x + Math.cos(heading + swing) * distance * share;
    const y = block.y + Math.sin(heading + swing) * distance * share;
    if (!isFree(battle, block, x, y, others) || (!wading && shuns(battle, block, x, y))) continue;
    if (isBarred(battle, block, [block.x, block.y], [x, y])) continue;
    if (swing && !midstream && isWet(battle, block, x, y)) continue;
    block.x = x;
    block.y = y;
    return true;
  }
  return false;
}

/** Share of its pace a block keeps on the ground */
function getGoing(battle: Battle, block: Block, terrain: Terrain): number {
  if (terrain.rampart === 3) return RUBBLE;
  if (terrain.rampart && isClimbing(battle, block)) return SCALING;
  if (terrain.road) return 1.2;
  if (terrain.water) return isAfloat(battle, block, terrain.water) ? 1 : terrain.ford ? FORDING : WADING;
  if (terrain.wood) return block.type === "mounted" ? 0.4 : 0.65;
  return terrain.marsh ? 0.5 : 1;
}

/** Ships carry the attackers of a landing to the shore */
const isShipped = (battle: Battle, block: Block, water: number): boolean =>
  battle.type === "landing" && block.side === "attackers" && water === 1;

/** Water is no trouble for those who fly, sail or are shipped */
const isAfloat = (battle: Battle, block: Block, water: number): boolean =>
  block.type === "aviation" || block.type === "naval" || isShipped(battle, block, water);

/** Water under the feet of troops that neither fly, sail nor are shipped */
function isWet(battle: Battle, block: Block, x: number, y: number): boolean {
  const { water } = terrainAt(battle.field, x, y);
  return Boolean(water) && !isAfloat(battle, block, water);
}

/**
 * Troops in order keep out of lakes, the sea and a river out of its fords;
 * at a ford and at a bridge the defenders hold the bank until they pursue
 */
function shuns(battle: Battle, block: Block, x: number, y: number): boolean {
  const { water, ford, deck } = terrainAt(battle.field, x, y);
  if ((!water && !deck) || isRunning(block) || isAfloat(battle, block, water || 2)) return false;
  return (!ford && !deck) || (block.side === "defenders" && battle.defenders.phase !== "pursue");
}

/** Field units a tick; all but the fliers go as fast as their ships on the open sea and when shipped */
function getPace(battle: Battle, block: Block, water = 0): number {
  const sailing = battle.field.open === "sea" || isShipped(battle, block, water);
  if (sailing && block.type !== "aviation" && block.type !== "naval") return SHIPPED;
  return block.speed;
}

/** Share of its strength a block has on the ground it stands on, in attack and in defence */
function getFooting(battle: Battle, block: Block, terrain: Terrain): number {
  if (terrain.rampart && terrain.rampart < 3 && isClimbing(battle, block)) return 0.5;
  if (terrain.water && !isAfloat(battle, block, terrain.water)) return terrain.water === 1 ? 0.25 : 0.5;
  return terrain.marsh ? 0.75 : 1;
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

/** A siege of a burg that has walls */
const hasWalls = (battle: Battle): boolean =>
  battle.field.held !== null && battle.field.burgs[battle.field.held].walled;

/** Whether the besiegers are strong enough to storm the burg, with its walls as they stand */
function hasOdds(battle: Battle): boolean {
  const breaches = battle.field.breaches.filter(breach => breach.burg === battle.field.held).length;
  const odds = getUnitsPower(battle, "attackers") / (getUnitsPower(battle, "defenders") || 1);
  return odds >= (hasWalls(battle) ? STORM_ODDS[Math.min(breaches, STORM_ODDS.length - 1)] : ASSAULT_ODDS);
}

/** Besiegers go over the walls while they storm the burg or loot it */
const isStorming = (battle: Battle): boolean =>
  battle.field.held !== null && (battle.attackers.phase === "storming" || battle.attackers.phase === "looting");

/** A besieger on its way over the walls or out of them: slowed at their foot and weak there */
const isClimbing = (battle: Battle, block: Block): boolean =>
  battle.field.held !== null &&
  block.side === "attackers" &&
  block.type !== "aviation" &&
  (isStorming(battle) || isRunning(block));

function canCross(battle: Battle, block: Block, wall: FieldWall): boolean {
  if (block.type === "aviation") return true;
  if (wall.burg !== battle.field.held || block.side === "defenders") return wall.gate;
  return isStorming(battle) || isRunning(block);
}

/** Whether a wall or a shut gate stands between two points for the block */
function isBarred(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
  const walls = getWallsBetween(battle.field, from, to);
  return walls.length > 0 && walls.some(wall => !canCross(battle, block, wall));
}

/** Besiegers in order on the walls of the burg or within them */
function isOnWalls(battle: Battle): boolean {
  const { held } = battle.field;
  if (held === null) return false;
  return battle.blocks.some(block => {
    if (block.side !== "attackers" || block.status !== "ready") return false;
    const { walled, rampart } = terrainAt(battle.field, block.x, block.y);
    return walled === held + 1 || rampart > 0;
  });
}

/** Engines in range of a besieged burg may knock a breach into its wall, where it is nearest to them */
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
  if (!battle.random.P(Math.min(engines.length * 0.04, 0.2))) return;

  const engine = engines.reduce((a, b) => (b.troops > a.troops ? b : a));
  const middle = (wall: FieldWall): [number, number] => [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2];
  const far = (wall: FieldWall): number => Math.hypot(middle(wall)[0] - engine.x, middle(wall)[1] - engine.y);
  const walls = field.walls.filter(wall => wall.burg === field.held && !wall.gate);
  if (!walls.length) return;
  openBreach(field, field.held, middle(walls.reduce((a, b) => (far(b) < far(a) ? b : a))));
  battle.lastLoss = battle.tick; // no lull while the walls come down
  battle.log.push({ tick: battle.tick, event: "breach", side: "attackers", params: { burg: burg.name } });
}

/** The defenders of a siege are drawn up within the walls of their burg, spread over it */
function garrison(battle: Battle): void {
  const { field } = battle;
  if (field.held === null || !field.burgs[field.held].walled) return;
  const burg = field.burgs[field.held];
  const within = (node: number): boolean => field.walled[node] === field.held! + 1;
  let nodes = field.walled.map((_, node) => node).filter(node => within(node) && !field.rampart[node]);
  if (!nodes.length) nodes = field.walled.map((_, node) => node).filter(within);
  if (!nodes.length) return;
  const far = (node: number): number => Math.hypot(nodeCentre(node)[0] - burg.x, nodeCentre(node)[1] - burg.y);
  nodes.sort((a, b) => far(a) - far(b) || a - b);
  const blocks = battle.blocks.filter(block => block.side === "defenders");
  blocks.forEach((block, i) => {
    [block.x, block.y] = nodeCentre(nodes[Math.floor((i * nodes.length) / blocks.length)]);
  });
}

// Ways round the water and the walls. Troops go straight while nothing but open dry ground lies ahead, so a field
// without water or walls plays as it did; where they are in the way troops take the cheapest way over the grid.

interface Ways {
  rough: boolean; // the field has water or walls at all
  costs: Map<string, Float32Array>; // what a kind of troops pays for a node, by the kind
  closed: Map<string, Uint16Array>; // the steps walls shut to a kind of troops
  reach: Map<number, { node: number; kind: string; reach: Reach }>; // the field as a block last saw it from where it stood
  routes: Map<number, { target: number; made: number; points: [number, number][] }>;
  flight: Map<string, Reach>; // the ways off the field, by the kind and the side
}

const ways = new WeakMap<Battlefield, Ways>();

/** The turns of the way a block follows round water and walls, for diagnostics; none while it goes straight */
export const getWay = (battle: Battle, block: Block): [number, number][] =>
  ways.get(battle.field)?.routes.get(block.id)?.points ?? [];

function getWays(battle: Battle): Ways {
  let known = ways.get(battle.field);
  if (!known) {
    known = {
      rough: battle.field.water.some(Boolean) || battle.field.walls.length > 0,
      costs: new Map(),
      closed: new Map(),
      reach: new Map(),
      routes: new Map(),
      flight: new Map()
    };
    ways.set(battle.field, known);
  }
  return known;
}

/** All that the going, the water and the walls mean differently for: the unit, its side, whether it runs, the battle */
const getKind = (battle: Battle, block: Block): string =>
  `${block.type}|${block.side}|${isRunning(block)}|${battle.type}|${battle.defenders.phase === "pursue"}|${isStorming(battle)}|${battle.field.breaches.length}`;

/** The steps from node to node that walls shut to the block: a bit a neighbour */
function getClosed(battle: Battle, block: Block): Uint16Array {
  const known = getWays(battle);
  const kind = getKind(battle, block);
  let closed = known.closed.get(kind);
  if (!closed) {
    const { field } = battle;
    closed = new Uint16Array(FIELD.cols * FIELD.rows);
    for (let node = 0; node < closed.length; node++) {
      const col = node % FIELD.cols;
      const row = (node - col) / FIELD.cols;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = col + dx;
          const y = row + dy;
          if ((!dx && !dy) || x < 0 || y < 0 || x >= FIELD.cols || y >= FIELD.rows) continue;
          const next = y * FIELD.cols + x;
          if (!field.rampart[node] && !field.rampart[next]) continue; // no wall near
          if (isBarred(battle, block, nodeCentre(node), nodeCentre(next))) closed[node] |= getStepBit(dx, dy);
        }
      }
    }
    known.closed.set(kind, closed);
  }
  return closed;
}

/** What a node's width of the way costs the block, node by node: the slower the going the dearer, no way where it keeps out */
function getCosts(battle: Battle, block: Block): Float32Array {
  const known = getWays(battle);
  const kind = getKind(battle, block);
  let costs = known.costs.get(kind);
  if (!costs) {
    costs = new Float32Array(FIELD.cols * FIELD.rows);
    for (let node = 0; node < costs.length; node++) {
      const [x, y] = nodeCentre(node);
      costs[node] = shuns(battle, block, x, y) ? Infinity : 1 / getGoing(battle, block, terrainAt(battle.field, x, y));
    }
    known.costs.set(kind, costs);
  }
  return costs;
}

const WET = 3; // a node's cost from which it is water to wade through or to keep out of

/** Whether the block can walk straight from one point to another: no water to wet its feet, no wall in the way */
function isDry(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
  const costs = getCosts(battle, block);
  if (!isClear(FIELD.cols, FIELD.rows, FIELD.cell, from, to, node => costs[node] > WET)) return false;
  return !isBarred(battle, block, from, to);
}

/** The field from where the block stands; for distances it is kept while the block stays about the place */
function getReach(battle: Battle, block: Block, exact = false): Reach {
  const known = getWays(battle);
  const kind = getKind(battle, block);
  const node = nodeAt(block.x, block.y);
  const last = known.reach.get(block.id);
  const row = (at: number): number => Math.floor(at / FIELD.cols);
  const moved = last
    ? Math.max(Math.abs((last.node % FIELD.cols) - (node % FIELD.cols)), Math.abs(row(last.node) - row(node)))
    : Infinity;
  if (last && last.kind === kind && moved < (exact ? 1 : 3)) return last.reach;
  const reach = spread(FIELD.cols, FIELD.rows, [node], getCosts(battle, block), getClosed(battle, block));
  known.reach.set(block.id, { node, kind, reach });
  return reach;
}

/** The node by a foe the block can come to, when there is one: a foe may stand where the block does not go */
function getGoal(reach: Reach, foe: Block): number | null {
  const node = nodeAt(foe.x, foe.y);
  if (reach.cost[node] !== Infinity) return node;
  let best: number | null = null;
  const col = node % FIELD.cols;
  const row = (node - col) / FIELD.cols;
  for (let y = Math.max(row - 2, 0); y <= Math.min(row + 2, FIELD.rows - 1); y++) {
    for (let x = Math.max(col - 2, 0); x <= Math.min(col + 2, FIELD.cols - 1); x++) {
      const near = y * FIELD.cols + x;
      if (reach.cost[near] < (best === null ? Infinity : reach.cost[best])) best = near;
    }
  }
  return best;
}

/** How far a foe is: as the block would walk, round the water or through it; straight when there is no way at all */
function getDistance(battle: Battle, block: Block, foe: Block): number {
  const straight = Math.hypot(foe.x - block.x, foe.y - block.y);
  if (!getWays(battle).rough || isDry(battle, block, [block.x, block.y], [foe.x, foe.y])) return straight;
  const reach = getReach(battle, block);
  const goal = getGoal(reach, foe);
  return goal === null ? straight : Math.max(reach.cost[goal] * FIELD.cell, straight);
}

/** Where to step to come to the target: the target itself, or the next turn of the way round the water */
function getHeading(battle: Battle, block: Block, target: Block): [number, number] {
  const known = getWays(battle);
  if (!known.rough) return [target.x, target.y];
  let route = known.routes.get(block.id);
  if (!route || route.target !== target.id || battle.tick - route.made >= ROUND_TICKS) {
    route = { target: target.id, made: battle.tick, points: findWay(battle, block, target) };
    known.routes.set(block.id, route);
  }
  const here: [number, number] = [block.x, block.y];
  // a turn is done with once the block stands on it or can walk straight to the next one
  const reached = (): void => {
    const { points } = route!;
    while (
      points.length &&
      (Math.hypot(points[0][0] - block.x, points[0][1] - block.y) < 3 ||
        (points.length > 1 && isDry(battle, block, here, points[1])))
    )
      points.shift();
  };
  reached();
  // pushed off its way, with water now between it and the next turn: the way is found anew
  const [next] = route.points;
  if (next && route.made !== battle.tick && !isWet(battle, block, ...here) && !isWet(battle, block, ...next)) {
    if (!isDry(battle, block, here, next)) {
      route = { target: target.id, made: battle.tick, points: findWay(battle, block, target) };
      known.routes.set(block.id, route);
      reached();
    }
  }
  return route.points[0] ?? [target.x, target.y];
}

/** The turns of the way to the target; none when the block can walk straight to it or cannot come to it at all */
function findWay(battle: Battle, block: Block, target: Block): [number, number][] {
  if (isDry(battle, block, [block.x, block.y], [target.x, target.y])) return [];
  const reach = getReach(battle, block, true);
  const goal = getGoal(reach, target);
  if (goal === null) return [];
  const nodes = trace(reach, goal).slice(1).map(nodeCentre);

  // only the turns are kept: from each the block walks straight to the farthest node it can
  const turns: [number, number][] = [];
  let from: [number, number] = [block.x, block.y];
  for (let i = 0; i < nodes.length; ) {
    let next = i;
    while (next + 1 < nodes.length && isDry(battle, block, from, nodes[next + 1])) next++;
    turns.push(nodes[next]);
    from = nodes[next];
    i = next + 1;
  }
  return turns;
}

/** The way off the field for troops on the run: to the nearest edge behind their side, round the water */
function getFlight(battle: Battle, block: Block): number | null {
  const known = getWays(battle);
  if (!known.rough) return null;
  const kind = getKind(battle, block);
  let reach = known.flight.get(kind);
  if (!reach) {
    const away = block.side === "attackers" ? battle.axis + Math.PI : battle.axis;
    const edge: number[] = [];
    for (let node = 0; node < FIELD.cols * FIELD.rows; node++) {
      const col = node % FIELD.cols;
      const row = (node - col) / FIELD.cols;
      if (col && row && col < FIELD.cols - 1 && row < FIELD.rows - 1) continue;
      const [x, y] = nodeCentre(node);
      if ((x - FIELD.width / 2) * Math.cos(away) + (y - FIELD.height / 2) * Math.sin(away) > 0) edge.push(node);
    }
    reach = spread(FIELD.cols, FIELD.rows, edge, getCosts(battle, block), getClosed(battle, block));
    known.flight.set(kind, reach);
  }

  const node = nodeAt(block.x, block.y);
  const col = node % FIELD.cols;
  const row = (node - col) / FIELD.cols;
  if (!reach.cost[node]) {
    // on the edge: straight out of the field
    const out = [col, FIELD.cols - 1 - col, row, FIELD.rows - 1 - row];
    return [Math.PI, 0, -Math.PI / 2, Math.PI / 2][out.indexOf(Math.min(...out))];
  }
  let best = node;
  for (let y = Math.max(row - 2, 0); y <= Math.min(row + 2, FIELD.rows - 1); y++) {
    for (let x = Math.max(col - 2, 0); x <= Math.min(col + 2, FIELD.cols - 1); x++) {
      if (reach.cost[y * FIELD.cols + x] < reach.cost[best]) best = y * FIELD.cols + x;
    }
  }
  if (best === node) return null;
  const [x, y] = nodeCentre(best);
  return Math.atan2(y - block.y, x - block.x);
}

/** Nobody is drawn up in water it keeps out of: such a block steps to the nearest ground, rather back than forward */
function settle(battle: Battle): void {
  for (const block of battle.blocks) {
    if (!shuns(battle, block, block.x, block.y)) continue;
    const forward = block.side === "attackers" ? battle.axis : battle.axis + Math.PI;
    const node = nodeAt(block.x, block.y);
    const col = node % FIELD.cols;
    const row = (node - col) / FIELD.cols;
    let best: [number, number] | null = null;
    let least = Infinity;
    for (let y = Math.max(row - 8, 0); y <= Math.min(row + 8, FIELD.rows - 1); y++) {
      for (let x = Math.max(col - 8, 0); x <= Math.min(col + 8, FIELD.cols - 1); x++) {
        const [nx, ny] = nodeCentre(y * FIELD.cols + x);
        if (shuns(battle, block, nx, ny)) continue;
        const ahead = (nx - block.x) * Math.cos(forward) + (ny - block.y) * Math.sin(forward) > 0;
        const score = Math.hypot(nx - block.x, ny - block.y) + (ahead ? 20 : 0);
        if (score < least) {
          least = score;
          best = [nx, ny];
        }
      }
    }
    if (best) [block.x, block.y] = best;
  }
}

/** Sides that water keeps apart get a crossing where it is narrowest for them: a ford on a river, shallows in a lake */
function openCrossing(battle: Battle): void {
  const { field } = battle;
  if (field.open || battle.type === "landing" || !field.water.some(Boolean)) return;
  const from = nodeAt(...getCentre(battle, "attackers"));
  const to = nodeAt(...getCentre(battle, "defenders"));
  const size = FIELD.cols * FIELD.rows;
  const deep = (node: number): boolean => field.water[node] === 2 && !field.ford[node];
  const still = (node: number): boolean => field.water[node] === 1;
  const dry = Float32Array.from({ length: size }, (_, node) => (deep(node) || still(node) ? Infinity : 1));
  if (spread(FIELD.cols, FIELD.rows, [from], dry).cost[to] !== Infinity && dry[to] === 1) return;

  // the way with the least water on it; a river is easier forded than a lake
  const wet = Float32Array.from({ length: size }, (_, node) => (still(node) ? 60 : deep(node) ? 20 : 1));
  for (const node of trace(spread(FIELD.cols, FIELD.rows, [from], wet), to)) {
    if (!deep(node) && !still(node)) continue;
    const col = node % FIELD.cols;
    const row = (node - col) / FIELD.cols;
    for (let y = Math.max(row - 1, 0); y <= Math.min(row + 1, FIELD.rows - 1); y++) {
      for (let x = Math.max(col - 1, 0); x <= Math.min(col + 1, FIELD.cols - 1); x++) {
        const near = y * FIELD.cols + x;
        if (deep(near)) field.ford[near] = 1;
        else if (still(near)) {
          field.water[near] = 0;
          field.marsh[near] = 1; // shallows: slow going and poor footing
        }
      }
    }
  }
}

const CONTACT = 9; // gap at which blocks fight
const CLEARANCE = 5; // gap blocks keep from each other

/** A block as discs across its width: they keep blocks apart whatever way each faces */
function getDiscs(block: Block, x = block.x, y = block.y): [number, number][] {
  const span = Math.max(block.width - block.depth, 0) / 2;
  const count = Math.max(Math.round(block.width / block.depth), 1);
  const discs: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : span * ((2 * i) / (count - 1) - 1);
    discs.push([x - Math.sin(block.facing) * offset, y + Math.cos(block.facing) * offset]);
  }
  return discs;
}

/** Space between two blocks, negative when they overlap, and the way from the first to the second there */
function getGap(a: Block, b: Block, discsA = getDiscs(a), discsB = getDiscs(b)): [number, number, number] {
  let best: [number, number, number] = [Infinity, 0, 0];
  const reach = (a.depth + b.depth) / 2;
  for (const [ax, ay] of discsA) {
    for (const [bx, by] of discsB) {
      const distance = Math.hypot(bx - ax, by - ay);
      if (distance - reach < best[0])
        best = [distance - reach, (bx - ax) / (distance || 1), (by - ay) / (distance || 1)];
    }
  }
  return best;
}

/** Troops on the run are no obstacle and nobody holds them up */
const isRunning = (block: Block): boolean => block.status === "routed" || block.action === "flee";

const isNear = (a: Block, b: Block): boolean => Math.abs(a.x - b.x) < 110 && Math.abs(a.y - b.y) < 110 && a !== b;

/** Close enough to fight, with no wall between that neither of them can cross */
const inContact = (battle: Battle, a: Block, b: Block): boolean =>
  isNear(a, b) &&
  getGap(a, b)[0] <= CONTACT &&
  !getWallsBetween(battle.field, [a.x, a.y], [b.x, b.y]).some(
    wall => !canCross(battle, a, wall) && !canCross(battle, b, wall)
  );

/** Whether the block would stand clear of all the others at the point */
function isFree(battle: Battle, block: Block, x: number, y: number, others: Block[]): boolean {
  if (isRunning(block)) return true;
  const discs = getDiscs(block, x, y);
  const town = terrainAt(battle.field, x, y).walled;
  return others.every(
    other =>
      Math.abs(other.x - x) > 110 ||
      Math.abs(other.y - y) > 110 ||
      other === block ||
      isRunning(other) ||
      (town && other.side === block.side && terrainAt(battle.field, other.x, other.y).walled === town) ||
      getGap(block, other, discs)[0] >= 1
  );
}

/** Friends within the walls of one burg: packed in its streets, they keep no lines and do not stand in each other's way */
function isPacked(battle: Battle, a: Block, b: Block): boolean {
  if (a.side !== b.side) return false;
  const town = terrainAt(battle.field, a.x, a.y).walled;
  return town > 0 && terrainAt(battle.field, b.x, b.y).walled === town;
}

/** Push overlapping blocks apart; those in a fight give less ground */
function separate(battle: Battle, blocks: Block[]): void {
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
        if (!isNear(a, b) || isRunning(a) || isRunning(b) || isPacked(battle, a, b)) continue;
        const [gap, dx, dy] = getGap(a, b);
        if (gap >= CLEARANCE) continue;
        const heavyA = a.action === "fight" ? 3 : 1;
        const heavyB = b.action === "fight" ? 3 : 1;
        const push = CLEARANCE - gap;
        a.x -= (dx * push * heavyB) / (heavyA + heavyB);
        a.y -= (dy * push * heavyB) / (heavyA + heavyB);
        b.x += (dx * push * heavyA) / (heavyA + heavyB);
        b.y += (dy * push * heavyA) / (heavyA + heavyB);
      }
    }
  }
}

function fight(battle: Battle): void {
  const { random } = battle;
  const byId = new Map(battle.blocks.map(block => [block.id, block]));
  const rate = Math.max(
    PHASE_CASUALTY_RATE[battle.attackers.phase] ?? 0.2,
    PHASE_CASUALTY_RATE[battle.defenders.phase] ?? 0.2
  );
  if (!rate) return;

  const incoming = new Map<number, number>();
  const landed = new Map<number, number>(); // what of it gets past the cover of those hit
  const pressed = new Map<number, number>(); // morale lost to hits in the flank and rear
  const struck = new Set<number>(); // those hit hand to hand
  for (const block of battle.blocks) {
    if (block.action !== "fight" && block.action !== "shoot") continue;
    const target = byId.get(block.target!)!;
    const from = terrainAt(battle.field, block.x, block.y);
    const to = terrainAt(battle.field, target.x, target.y);
    let power = getPower(battle, block, block.attack);
    power *= 1 + Math.min(Math.max((from.height - to.height) * 0.6, -0.2), 0.2); // high ground
    power *= getFooting(battle, block, from);
    if (block.type === "mounted" && (from.wood || to.wood)) power *= 0.6;
    // cover takes its share of the losses however hard the blow: walls from without, woods and houses from shots
    const besieging = to.walled > 0 && from.walled !== to.walled;
    const cover = besieging ? 1 / WALLS : block.action === "shoot" && (to.wood || to.town) ? COVER : 1;
    if (block.action === "shoot" && from.walled && !to.walled) power *= 1.25; // from the walls

    if (block.action === "fight") {
      struck.add(target.id);
      const bearing = Math.atan2(block.y - target.y, block.x - target.x);
      const angle = Math.abs(normalize(bearing - target.facing));
      const side = angle > 2.1 ? 2 : angle > 1.05 ? 1 : 0; // rear, flank, front
      if (side) {
        power *= side === 2 ? 1.6 : 1.3;
        pressed.set(target.id, (pressed.get(target.id) ?? 0) + side / 2);
      }
    }
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + power);
    landed.set(target.id, (landed.get(target.id) ?? 0) + power * cover);
  }

  for (const [id, hits] of incoming) {
    const block = byId.get(id)!;
    const ground = terrainAt(battle.field, block.x, block.y);
    const own = getPower(battle, block, block.defense) * (ground.town ? TOWN : 1) * getFooting(battle, block, ground);
    if (!hits) continue;
    const share = (random.next() * rate * landed.get(id)!) / (hits + own) / ROUND_TICKS;
    const died = Math.min(random.Pint(block.initial * share), block.troops);
    block.troops -= died;
    const shaken = share * MORALE_LOSS + 1 / ROUND_TICKS + (pressed.get(id) ?? 0);
    block.morale = Math.max(block.morale - shaken / block.steadiness, 0);
    // shots over the walls of a besieged burg do not keep a battle going: a storm, a sortie or a breach does
    if (died && (!hasWalls(battle) || struck.has(id) || isStorming(battle))) battle.lastLoss = battle.tick;
    block.hit = true;

    if (!block.troops) {
      block.status = "destroyed";
      block.action = "hold";
      battle.log.push({
        tick: battle.tick,
        event: "destroyed",
        side: block.side,
        params: { block: blockName(battle, block) }
      });
      shake(battle, block, 6);
    }
  }
}

function rout(battle: Battle, block: Block): void {
  block.status = "routed";
  battle.log.push({ tick: battle.tick, event: "rout", side: block.side, params: { block: blockName(battle, block) } });
  shake(battle, block, 8);
}

/** A loss nearby unsettles friends and heartens foes */
function shake(battle: Battle, lost: Block, morale: number): void {
  for (const block of battle.blocks) {
    if (block.status !== "ready" || Math.hypot(block.x - lost.x, block.y - lost.y) > 160) continue;
    const change = block.side === lost.side ? -morale / block.steadiness : morale;
    block.morale = Math.min(Math.max(block.morale + change, 0), 100);
  }
}

/** Power multiplier of a die: 0.375 for ⚀ to 1.125 for ⚅, 0.75 on average */
export const getFortune = (die: number): number => 0.75 + (die - 3.5) * 0.15;

function getPower(battle: Battle, block: Block, of = block.unitPower): number {
  const side = battle[block.side];
  const phase = block.status === "routed" ? "retreat" : side.phase;
  const fortune = getFortune(side.die);
  return block.troops * block.upkeep * of * getPhasePower(phase, block.type) * fortune * side.boost;
}

/** Power of the troops a side has on the field, as the military screens count it, with what was added by hand */
export function getUnitsPower(battle: Battle, side: Side): number {
  const standing = battle.blocks.filter(
    block => block.side === side && (block.status === "ready" || block.status === "routed")
  );
  const base = sum(standing, block => block.troops * block.unitPower * block.upkeep);
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
    const standing = blocks.filter(block => block.status === "ready" || block.status === "routed");
    const base = sum(standing, block => block.troops * block.unitPower * block.upkeep);
    battle[side].boost = base ? Math.max(1 + battle[side].bonus / base, 0) : 1;
    const fortune = getFortune(battle[side].die);
    battle[side].power = sum(standing, block => getPower(battle, block)) / fortune / (battle.populationScale / 10); // the die is shown apart
    const initial = sum(blocks, block => block.initial);
    const troops = sum(blocks, block => block.troops);
    battle[side].casualties = initial ? 1 - troops / initial : 0;
    if (battle.tick) battle[side].morale = troops ? sum(blocks, block => block.morale * block.troops) / troops : 0;
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
  const ready = SIDES.map(side => standing(side, ["ready"]));
  const onField = SIDES.map(side => standing(side, ["ready", "routed"]));

  if (!ready[0] || !ready[1]) battle.brokenAt ??= battle.tick;
  const pursued = battle.brokenAt !== null && battle.tick - battle.brokenAt >= ROUND_TICKS * 3; // the rest get away

  const over =
    !onField[0] ||
    !onField[1] ||
    (!ready[0] && !ready[1]) ||
    pursued ||
    battle.tick >= MAX_TICKS ||
    (battle.engaged !== null && battle.tick - battle.lastLoss > IDLE_ROUNDS * ROUND_TICKS); // a long way round is no lull
  if (!over) return;

  const winner = ready[0] === ready[1] ? null : ready[0] ? "attackers" : "defenders";
  battle.result = { winner, status: getBattleStatus(battle.attackers.casualties, battle.defenders.casualties) };
  battle.log.push({ tick: battle.tick, event: "end", side: winner });
}

const getMen = (unit: MilitaryUnit, troops: number): number => troops * Math.max(unit.crew, 1);

/** Men in a battalion: 0.3 to 1 population point, the least that makes no more than forty battalions of all the troops; 0.2 when 0.3 makes fewer than ten */
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
        facing: 0,
        width: Math.min(Math.max((getMen(unit, share) / battle.battalion) * 44, 18), 58), // by its men
        depth: BLOCK_DEPTH,
        morale: battle[side].morale,
        status: "ready",
        action: "hold",
        target: null,
        hit: false
      };
      battle.blocks.push(block);
      added.push(block);
    }
  }
  return added;
}

/** Latecomers form up behind their side */
function reinforce(battle: Battle, side: Side, regiment: BattleRegiment): void {
  const blocks = addBlocks(battle, side, regiment);
  const forward = side === "attackers" ? battle.axis : battle.axis + Math.PI;
  const [cx, cy] = getCentre(battle, side);
  const friends = battle.blocks.filter(
    block => block.side === side && block.status === "ready" && !blocks.includes(block)
  );
  const rear = friends.length
    ? Math.min(...friends.map(block => (block.x - cx) * Math.cos(forward) + (block.y - cy) * Math.sin(forward)))
    : 0;
  placeRow(blocks, cx + Math.cos(forward) * (rear - ROW_GAP), cy + Math.sin(forward) * (rear - ROW_GAP), forward);
}

function deploy(battle: Battle): void {
  for (const side of SIDES) {
    const blocks = battle.blocks.filter(block => block.side === side);
    const forward = side === "attackers" ? battle.axis : battle.axis + Math.PI;
    const [cx, cy] = getCentre(battle, side);

    if (battle.type === "ambush") {
      if (side === "attackers") {
        // caught on the march, in a column
        const column = FIELD.width / 2;
        blocks.forEach((block, i) => {
          const back = (i - (blocks.length - 1) / 2) * (BLOCK_DEPTH + 26);
          place(block, column - Math.cos(forward) * back, FIELD.height / 2 - Math.sin(forward) * back, forward);
        });
      } else {
        // on both sides of the road
        [blocks.filter((_, i) => i % 2 === 0), blocks.filter((_, i) => i % 2 === 1)].forEach((wing, i) => {
          const out = battle.axis + (i ? Math.PI / 2 : -Math.PI / 2);
          const distance = Math.min(reach(out) * 0.75, 190);
          const x = FIELD.width / 2 + Math.cos(out) * distance;
          const y = FIELD.height / 2 + Math.sin(out) * distance;
          placeRow(wing, x, y, out + Math.PI);
        });
      }
      continue;
    }

    // one line, so nobody has to pass through friends: melee in the middle, shooters beside them, mounted on the wings
    const limit = reach(forward + Math.PI / 2) * 1.7;
    const line = [
      ...blocks.filter(block => !isShooter(block) && !isRider(block)).sort((a, b) => b.troops - a.troops),
      ...blocks.filter(block => isShooter(block) && !isEngine(block)),
      ...blocks.filter(isRider)
    ];
    const depth = Math.max(Math.ceil(sum(line, block => block.width + GAP) / limit), 1);
    const rows: Block[][] = Array.from({ length: depth }, () => []);
    line.forEach((block, i) => {
      // pairs go to the lines in turn, so every line has the same order from its middle out
      const row = rows[Math.floor(i / 2) % depth];
      if (i % 2) row.unshift(block);
      else row.push(block);
    });
    rows.push(...wrap(blocks.filter(isEngine), limit)); // engines behind

    rows.forEach((row, i) => {
      placeRow(row, cx - Math.cos(forward) * ROW_GAP * i, cy - Math.sin(forward) * ROW_GAP * i, forward);
    });
  }
}

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

/** Where a side forms up: the defenders hold the battle point, on the best ground around */
function getCentre(battle: Battle, side: Side): [number, number] {
  const { axis, field } = battle;
  const along = reach(axis);
  const middle: [number, number] = [FIELD.width / 2, FIELD.height / 2];
  if (side === "defenders" && field.held !== null) return [field.burgs[field.held].x, field.burgs[field.held].y];

  const depth = side === "attackers" ? -along * 0.8 : along * 0.35;
  const across = axis + Math.PI / 2;
  const width = reach(across);
  const at = (shift: number): [number, number] => [
    middle[0] + Math.cos(axis) * depth + Math.cos(across) * shift,
    middle[1] + Math.sin(axis) * depth + Math.sin(across) * shift
  ];
  // score a line by the ground under it
  const score = (shift: number): number => {
    let value = -Math.abs(shift) / width / 4;
    for (const offset of [-0.3, -0.15, 0, 0.15, 0.3]) {
      const [x, y] = at(shift + offset * width);
      const terrain = terrainAt(field, x, y);
      value += side === "defenders" ? terrain.height : 0;
      if (terrain.water) value -= 2;
      if (terrain.wood || terrain.marsh) value -= 0.2;
    }
    return value;
  };
  const shifts = [0, -0.2, 0.2, -0.4, 0.4].map(share => share * width);
  return at(shifts.reduce((best, shift) => (score(shift) > score(best) ? shift : best)));
}

/** Distance from the middle of the field towards its edge, with a margin */
function reach(angle: number): number {
  return 1 / Math.hypot(Math.cos(angle) / (FIELD.width / 2 - 60), Math.sin(angle) / (FIELD.height / 2 - 50));
}

function wrap(row: Block[], limit: number): Block[][] {
  const rows: Block[][] = [];
  let width = Infinity;
  for (const block of row) {
    if (width + block.width + GAP > limit) {
      rows.push([]);
      width = 0;
    }
    rows.at(-1)!.push(block);
    width += block.width + GAP;
  }
  return rows;
}

function placeRow(row: Block[], x: number, y: number, facing: number): void {
  const total = sum(row, block => block.width + GAP) - GAP;
  let offset = -total / 2;
  for (const block of row) {
    const shift = offset + block.width / 2;
    place(block, x - Math.sin(facing) * shift, y + Math.cos(facing) * shift, facing);
    offset += block.width + GAP;
  }
}

function place(block: Block, x: number, y: number, facing: number): void {
  block.x = Math.min(Math.max(x, 20), FIELD.width - 20);
  block.y = Math.min(Math.max(y, 20), FIELD.height - 20);
  block.facing = facing;
}

function moveBlock(battle: Battle, key: string, x: number, y: number): void {
  const block = battle.blocks.find(block => block.key === key);
  if (!block) return;
  place(block, x, y, block.facing);
  block.action = "hold";
}

function turnBlock(battle: Battle, key: string, facing: number): void {
  const block = battle.blocks.find(block => block.key === key);
  if (block) block.facing = normalize(facing);
}

export function blockName(battle: Battle, block: Block): string {
  const regiment = battle[block.side].regiments.find(r => r.state === block.state && r.i === block.regiment);
  return `${regiment?.name ?? ""} ${block.unit.replace(/_/g, " ")} ${block.number || ""}`.trim();
}

const total = (regiment: BattleRegiment): number => sum(Object.values(regiment.troops), troops => troops);

function sum<T>(items: T[], value: (item: T) => number): number {
  let result = 0;
  for (const item of items) result += value(item);
  return result;
}

function normalize(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function turn(from: number, to: number, limit: number): number {
  const diff = normalize(to - from);
  return from + Math.min(Math.max(diff, -limit), limit);
}

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
import { type Battlefield, FIELD, terrainAt } from "./battlefield";

export const ROUND_TICKS = 6;
const MAX_TICKS = 600;
const IDLE_ROUNDS = 12; // rounds without losses that end a battle
const ROW_GAP = 40;
const BLOCK_DEPTH = 22;
const GAP = 10; // between neighbours in a line
const MORALE_LOSS = 180; // morale a block loses when all its troops fall

// field units a tick
const SPEED: Record<string, number> = { mounted: 14, aviation: 18, armored: 9, naval: 8, machinery: 3, magical: 6 };
const RANGE: Record<string, number> = { ranged: 170, machinery: 280, magical: 150, aviation: 120, naval: 200 };

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
  dieSet: boolean; // rolled by hand: the next round keeps the die
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
  powerScale: number; // troops per point of power
  battalion: number; // men in a full battalion, the same for both sides
  attackers: BattleSide;
  defenders: BattleSide;
  blocks: Block[];
  tick: number;
  round: number;
  engaged: number | null; // round of the first blow: phases count from it, however long the approach
  lastLoss: number; // tick of the last casualty
  brokenAt: number | null; // tick a side was left with no troops in order
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
  powerScale: number;
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
  battle.battalion = getBattalionSize(battle);
  battle.axis = findAxis(battle);
  for (const side of SIDES) {
    battle[side].phase = PHASES[battle.type][side][0];
    for (const regiment of battle[side].regiments) addBlocks(battle, side, regiment);
  }
  deploy(battle);
  separate(battle.blocks); // a crowded line spreads out
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
    const [attackers, defenders] = selectPhases(
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
    if (attackers !== battle.attackers.phase || defenders !== battle.defenders.phase) {
      battle.log.push({
        tick: battle.tick,
        event: "phases",
        params: { attackers, defenders }
      });
    }
    battle.attackers.phase = attackers;
    battle.defenders.phase = defenders;
  }

  for (const side of SIDES) {
    const roll = random.rand(1, 6); // rolled either way, so a die set by hand changes nothing else
    if (!battle[side].dieSet) battle[side].die = roll;
    battle[side].dieSet = false;
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
      foe => foe.side !== block.side && foe.status === "ready" && foe.target === block.id && inContact(foe, block)
    );
    const target = assailant ?? pickTarget(block, onField, pursuing, crowd);
    if (target && target.id !== block.target) crowd.set(target.id, (crowd.get(target.id) ?? 0) + 1);
    block.target = target?.id ?? null;
    if (!target) {
      block.action = "hold";
      continue;
    }

    const distance = Math.hypot(target.x - block.x, target.y - block.y);
    const range = RANGE[block.type] ?? 0;
    const touching = inContact(block, target);
    const pinned =
      touching || onField.some(foe => foe.side !== block.side && foe.target === block.id && inContact(foe, block));
    if (!pinned || touching) block.facing = turn(block.facing, Math.atan2(target.y - block.y, target.x - block.x), 0.7);

    if (touching) block.action = "fight";
    else if (pinned) block.action = "hold";
    else if (range && distance <= range) block.action = "shoot";
    else if (stance !== "hold") {
      // shooters close to their range, the rest to contact or, while skirmishing, just out of range
      const reach = range ? distance - range * 0.85 : stance === "shoot" ? distance - 200 : distance;
      const march = distance > 240 && !pursuing ? 7 / (SPEED[block.type] ?? 7) : 1; // the line keeps together until the charge
      const moved =
        reach > 0 && step(battle, block, target.x - block.x, target.y - block.y, reach, onField, Math.min(march, 1));
      block.action = moved ? "move" : "hold";
    } else block.action = "hold";
  }

  separate(onField);

  // who strikes is settled once all have moved, so neither side gets the first blow
  const byId = new Map(onField.map(block => [block.id, block]));
  for (const block of onField) {
    const target = block.action === "flee" ? undefined : byId.get(block.target ?? -1);
    if (!target) continue;
    const range = RANGE[block.type] ?? 0;
    if (inContact(block, target) || inContact(target, block)) block.action = "fight";
    else if (range && Math.hypot(target.x - block.x, target.y - block.y) <= range) block.action = "shoot";
  }
}

function pickTarget(block: Block, onField: Block[], pursuing: boolean, crowd: Map<number, number>): Block | null {
  let best: Block | null = null;
  let bestScore = Infinity;
  for (const foe of onField) {
    if (foe.side === block.side) continue;
    let score = Math.hypot(foe.x - block.x, foe.y - block.y);
    if (foe.status === "routed") score = pursuing ? score * 0.8 : score + 400; // the broken are left alone unless pursued
    if (foe.id === block.target)
      score *= 0.75; // stick to the target
    else if (!RANGE[block.type]) score += (crowd.get(foe.id) ?? 0) * 45; // spread along the line
    if (block.type === "mounted" && (RANGE[foe.type] ?? 0)) score *= 0.75; // cavalry hunts shooters
    if (score < bestScore) {
      bestScore = score;
      best = foe;
    }
  }
  return best;
}

function flee(battle: Battle, block: Block, others: Block[]): void {
  block.action = "flee";
  block.target = null;
  const away = block.side === "attackers" ? battle.axis + Math.PI : battle.axis;
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
  let pace = (SPEED[block.type] ?? 7) * haste;
  if (terrain.road) pace *= 1.2;
  else if (terrain.water) pace *= terrain.water === 2 ? 0.4 : 0.25;
  else if (terrain.wood) pace *= block.type === "mounted" ? 0.4 : 0.65;
  else if (terrain.marsh) pace *= 0.5;
  const distance = Math.min(pace, limit);
  const heading = Math.atan2(dy, dx);

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
    if (!isFree(block, x, y, others)) continue;
    block.x = x;
    block.y = y;
    return true;
  }
  return false;
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

const isNear = (a: Block, b: Block): boolean => Math.abs(a.x - b.x) < 110 && Math.abs(a.y - b.y) < 110 && a !== b;

const inContact = (a: Block, b: Block): boolean => isNear(a, b) && getGap(a, b)[0] <= CONTACT;

/** Whether the block would stand clear of all the others at the point */
function isFree(block: Block, x: number, y: number, others: Block[]): boolean {
  const discs = getDiscs(block, x, y);
  return others.every(
    other =>
      Math.abs(other.x - x) > 110 ||
      Math.abs(other.y - y) > 110 ||
      other === block ||
      getGap(block, other, discs)[0] >= 1
  );
}

/** Push overlapping blocks apart; those in a fight give less ground */
function separate(blocks: Block[]): void {
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
        if (!isNear(a, b)) continue;
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
  const pressed = new Map<number, number>(); // morale lost to hits in the flank and rear
  for (const block of battle.blocks) {
    if (block.action !== "fight" && block.action !== "shoot") continue;
    const target = byId.get(block.target!)!;
    const from = terrainAt(battle.field, block.x, block.y);
    const to = terrainAt(battle.field, target.x, target.y);
    let power = getPower(battle, block);
    power *= 1 + Math.min(Math.max((from.height - to.height) * 0.6, -0.2), 0.2); // high ground
    if (from.water === 2) power *= 0.5;
    else if (from.marsh) power *= 0.75;
    if (block.type === "mounted" && (from.wood || to.wood)) power *= 0.6;
    if (block.action === "shoot" && (to.wood || to.town)) power *= 0.6;

    if (block.action === "fight") {
      const bearing = Math.atan2(block.y - target.y, block.x - target.x);
      const angle = Math.abs(normalize(bearing - target.facing));
      const side = angle > 2.1 ? 2 : angle > 1.05 ? 1 : 0; // rear, flank, front
      if (side) {
        power *= side === 2 ? 1.6 : 1.3;
        pressed.set(target.id, (pressed.get(target.id) ?? 0) + side / 2);
      }
    }
    incoming.set(target.id, (incoming.get(target.id) ?? 0) + power);
  }

  for (const [id, hits] of incoming) {
    const block = byId.get(id)!;
    const cover = terrainAt(battle.field, block.x, block.y).town ? 1.25 : 1;
    const own = getPower(battle, block) * cover;
    if (!hits) continue;
    const share = (random.next() * rate * hits) / (hits + own) / ROUND_TICKS;
    const died = Math.min(random.Pint(block.initial * share), block.troops);
    block.troops -= died;
    block.morale = Math.max(block.morale - share * MORALE_LOSS - 1 / ROUND_TICKS - (pressed.get(id) ?? 0), 0);
    if (died) battle.lastLoss = battle.tick;
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
    const change = block.side === lost.side ? -morale : morale;
    block.morale = Math.min(Math.max(block.morale + change, 0), 100);
  }
}

function getPower(battle: Battle, block: Block): number {
  const side = battle[block.side];
  const phase = block.status === "routed" ? "retreat" : side.phase;
  const fortune = side.die / 10 + 0.4;
  return block.troops * block.upkeep * block.unitPower * getPhasePower(phase, block.type) * fortune * side.boost;
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
    const fortune = battle[side].die / 10 + 0.4;
    battle[side].power = sum(standing, block => getPower(battle, block)) / fortune / battle.powerScale; // the die is shown apart
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
    battle.tick - battle.lastLoss > IDLE_ROUNDS * ROUND_TICKS;
  if (!over) return;

  const winner = ready[0] === ready[1] ? null : ready[0] ? "attackers" : "defenders";
  battle.result = { winner, status: getBattleStatus(battle.attackers.casualties, battle.defenders.casualties) };
  battle.log.push({ tick: battle.tick, event: "end", side: winner });
}

const MAX_BATTALIONS = 12; // of a unit in a regiment
const getMen = (unit: MilitaryUnit, troops: number): number => troops * Math.max(unit.crew, 1);

/** Men in a battalion: a round number that makes about thirty battalions of all the troops */
function getBattalionSize(battle: Battle): number {
  let men = 0;
  for (const side of SIDES) {
    for (const regiment of battle[side].regiments) {
      for (const unit of battle.units) men += getMen(unit, regiment.troops[unit.name] ?? 0);
    }
  }
  const size = Math.max(men / 30, 100);
  const magnitude = 10 ** Math.floor(Math.log10(size));
  return ([1, 2, 5, 10].find(step => step * magnitude >= size) ?? 10) * magnitude;
}

/** Split the regiment into battalions: a unit ten times as numerous fields ten times as many */
function addBlocks(battle: Battle, side: Side, regiment: BattleRegiment): Block[] {
  const added: Block[] = [];
  for (const unit of battle.units) {
    const troops = regiment.troops[unit.name];
    if (!troops) continue;
    const count = Math.min(Math.max(Math.round(getMen(unit, troops) / battle.battalion), 1), MAX_BATTALIONS, troops);

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
        unitPower: unit.power,
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
      ...blocks.filter(block => !RANGE[block.type] && block.type !== "mounted").sort((a, b) => b.troops - a.troops),
      ...blocks.filter(block => block.type === "ranged"),
      ...blocks.filter(block => block.type === "mounted")
    ];
    const depth = Math.max(Math.ceil(sum(line, block => block.width + GAP) / limit), 1);
    const rows: Block[][] = Array.from({ length: depth }, () => []);
    line.forEach((block, i) => {
      // pairs go to the lines in turn, so every line has the same order from its middle out
      const row = rows[Math.floor(i / 2) % depth];
      if (i % 2) row.unshift(block);
      else row.push(block);
    });
    rows.push(
      ...wrap(
        blocks.filter(block => RANGE[block.type] && block.type !== "ranged"),
        limit
      )
    ); // engines behind

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
  if (battle.type === "siege" && side === "defenders" && field.burgs.length) {
    const burg = field.burgs.reduce((a, b) =>
      Math.hypot(a.x - middle[0], a.y - middle[1]) < Math.hypot(b.x - middle[0], b.y - middle[1]) ? a : b
    );
    return [burg.x, burg.y];
  }

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

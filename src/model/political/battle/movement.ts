import { FOOT_SPEED } from "@/model/political/military-units";
import type { MilitaryUnit } from "@/types/military";
import type { Battle, Block } from "./battle";
import { isFromSea, type Side } from "./battle-rules";
import { COLS, ROWS, toMetresPerTick } from "./battle-scale";
import {
  type Battlefield,
  type FieldWall,
  type FieldWork,
  getCrossing,
  getElevation,
  getGrade,
  getSlope,
  getWallsBetween,
  isFordable,
  isStanding,
  nodeAt,
  nodeCentre,
  type Terrain,
  terrainAt,
  WALL_HEIGHT
} from "./battlefield";
import { flood, getStepBit, isClear, type Reach, spread, trace } from "./pathfinding";
import { ICE, MUD, SKIES } from "./weather";
import { bars, isBarredByWorks, isInDitch, isRider, isStaked } from "./works";

export type Point = [number, number];

/** A point of the field to go to */
export interface Spot {
  x: number;
  y: number;
}

export const ROUND_TICKS = 6;

export const PACE = toMetresPerTick(FOOT_SPEED); // of troops on foot
const WADING = 0.12; // share of the pace kept in deep water
const FORDING = 0.4; // and in a ford
const RUBBLE = 0.5; // and over the rubble of a breach
const POINT_BLANK = { shooter: 2, engine: 20 }; // under which they cannot shoot
export const CHARGE_HASTE = 3; // how much faster than its pace a battalion runs in at a foe it is about to strike
const SAMPLE = 11; // the way of a step is checked this often, under the contact gap: a charge ends at contact

/**
 * Move towards the point at the block's pace, around whoever stands in the way; false when hemmed in.
 * The whole way is checked: straight on, the step ends short of the first block or ground in the way
 */
export function step(
  battle: Battle,
  block: Block,
  dx: number,
  dy: number,
  limit: number,
  others: Block[],
  haste = 1,
  swings = SWINGS
): boolean {
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const heading = Math.atan2(dy, dx);
  const pace = getStride(battle, block, heading, haste);
  const distance = Math.min(pace, limit);
  const wading = !isMoored(battle, block) && shuns(battle, block, block.x, block.y); // may wade out; a ship aground stays
  // a step aside ends in the water only midstream, when the way ahead is water too
  const ahead: [number, number] = [block.x + Math.cos(heading) * distance, block.y + Math.sin(heading) * distance];
  const midstream = isWet(battle, block, block.x, block.y) && isWet(battle, block, ...ahead);

  const from: Point = [block.x, block.y];
  // only who can be in the way: from any further off every point of the step is clear (a metre to spare for rounding)
  const reach = NEAR * battle.field.front + distance + 1;
  const nearby = others.filter(other => Math.abs(other.x - from[0]) <= reach && Math.abs(other.y - from[1]) <= reach);
  const works = battle.field.works.length ? battle.field.works.filter(work => bars(work, block)) : NO_WORKS;
  /** How far the block goes before its front meets works that bar it */
  const short = (cos: number, sin: number): number => {
    if (!works.length) return distance;
    const front = block.depth / 2;
    const to: Point = [from[0] + cos * (distance + front), from[1] + sin * (distance + front)];
    const share = getCrossing(works, from, to);
    return share === null ? distance : Math.min(Math.max(share * (distance + front) - front - 0.5, 0), distance);
  };
  let friend = false; // a friend stands in the way straight on
  /** How far the way runs open, sampled along it up to its end */
  const walk = (angle: number, swing: number): number => {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const end = short(cos, sin);
    const samples = Math.max(Math.ceil(end / SAMPLE), 1);
    let open = 0;
    for (let i = 1; i <= samples; i++) {
      const along = (end * i) / samples;
      const [x, y] = [from[0] + cos * along, from[1] + sin * along];
      const inWay = getInWay(battle, block, x, y, nearby);
      if (inWay) {
        if (!swing) friend = inWay.side === block.side;
        break;
      }
      if (!wading && shuns(battle, block, x, y)) break;
      if (swing && !midstream && isWet(battle, block, x, y)) break;
      // nor by a gate when it turns off its way: it would only go back where it came from
      if (Math.abs(swing) > ASKEW && getWallsBetween(battle.field, from, [x, y]).length) break;
      if (isBarred(battle, block, from, [x, y])) break;
      open = along;
    }
    return open;
  };

  // straight on, as far as it is open, to close up; then round what is in the way: by the side it took last, further and
  // further, but round a friend by the walls no further than askew: there it waits its turn rather than wander off
  const side = block.detour || 1;
  const byWalls = battle.field.walls.length > 0 && getWays(battle).walls[nodeAt(battle.field, ...from)] === 1;
  for (const off of swings) {
    if (friend && byWalls && Math.abs(off) > ASKEW) break;
    const swing = off * side;
    const open = walk(heading + swing, swing);
    if (swing ? open < distance : open < distance / 4) continue;
    block.x = from[0] + Math.cos(heading + swing) * open;
    block.y = from[1] + Math.sin(heading + swing) * open;
    block.vx = Math.cos(heading + swing) * pace;
    block.vy = Math.sin(heading + swing) * pace;
    block.detour = swing ? Math.sign(swing) : open === distance ? 0 : block.detour;
    return true;
  }
  return false;
}

const SWINGS = [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2]; // radians off the way a step tries, by the side it took last
const STRAIGHT = [0];
const ASKEW = 1; // radians off its way past which a step turns aside, not on

/** Metres the block covers in a tick the way it heads, on the ground and the slope where it stands */
export function getStride(battle: Battle, block: Block, heading: number, haste = 1): number {
  const terrain = terrainAt(battle.field, block.x, block.y);
  const climb = isAfloat(battle, block, terrain)
    ? 1
    : getClimb(getSlope(battle.field, block.x, block.y, heading, isClimbing(battle, block)));
  const ditch = isInDitch(battle, block, heading) ? FORDING : 1;
  return getPace(battle, block, terrain) * haste * getGoing(battle, block, terrain) * climb * ditch;
}

/** Share of its pace a block keeps on the ground: soaked ground slows all but fliers, open ground the most; frozen ground all */
export function getGoing(battle: Battle, block: Block, terrain: Terrain): number {
  const ground = block.type !== "aviation";
  const mud = ground && battle.mud;
  const ice = ground && battle.ice ? ICE : 1;
  if (terrain.rampart === 3) return RUBBLE * ice;
  if (terrain.road) return 1.2 * (mud ? MUD.road : 1) * ice;
  if (terrain.water) return isAfloat(battle, block, terrain) ? 1 : terrain.ford || terrain.shallow ? FORDING : WADING;
  if (terrain.wood) return (block.type === "mounted" ? 0.4 : 0.65) * (mud ? MUD.cover : 1) * ice;
  return (terrain.marsh ? 0.5 * (mud ? MUD.cover : 1) : mud ? MUD.open : 1) * ice;
}

/**
 * Share of its pace a block keeps on a slope: Tobler's hiking function cubed, 1.7 times the pace 3° downhill,
 * a third of it 6° uphill, a tenth from 12° uphill and 18° downhill
 */
export const getClimb = (slope: number): number => Math.max(Math.exp(-10.5 * Math.abs(slope + 0.05) + 0.525), 0.1);

/**
 * How far a block shoots at a target, as a missile flies: further from above, shorter from below, not at all half its range up;
 * shorter in rain and fog
 */
export function getRange(battle: Battle, block: Block, target: Block): number {
  const { field } = battle;
  const above = getElevation(field, block.x, block.y) - getElevation(field, target.x, target.y);
  return block.range * SKIES[battle.weather].range * Math.sqrt(Math.max(1 + (2 * above) / block.range, 0));
}

/** In range and not too close to load and aim */
export function canShoot(battle: Battle, block: Block, target: Block): boolean {
  if (!block.range) return false;
  const distance = Math.hypot(target.x - block.x, target.y - block.y);
  // beyond the longest range there are no heights to read
  const longest = block.range * Math.sqrt(1 + (2 * (battle.field.relief + WALL_HEIGHT)) / block.range);
  if (distance > longest || distance > getRange(battle, block, target)) return false;
  return getGap(block, target)[0] >= (block.kind === "engine" ? POINT_BLANK.engine : POINT_BLANK.shooter);
}

type Waters = Pick<Terrain, "water" | "shallow">;

/** Ships carry the attackers of a landing to the shallows; from there they wade ashore */
const isShipped = (battle: Battle, block: Block, { water, shallow }: Waters): boolean =>
  battle.type === "landing" && block.side === "attackers" && water === 1 && !shallow;

/** Attackers of a landing still in their boats where they are: they fight nobody hand to hand */
export const isAboard = (battle: Battle, block: Block): boolean =>
  battle.type === "landing" &&
  block.side === "attackers" &&
  isShipped(battle, block, terrainAt(battle.field, block.x, block.y));

/** Water is no trouble for those who fly, sail or are shipped */
export const isAfloat = (battle: Battle, block: Block, terrain: Waters): boolean =>
  block.type === "aviation" || block.type === "naval" || isShipped(battle, block, terrain);

/** Water under the feet of troops that neither fly, sail nor are shipped */
export function isWet(battle: Battle, block: Block, x: number, y: number): boolean {
  const terrain = terrainAt(battle.field, x, y);
  return Boolean(terrain.water) && !isAfloat(battle, block, terrain);
}

/** Ships on the ground of a land battle: they keep to the water, on the run too */
export const isMoored = (battle: Battle, block: Block): boolean => block.type === "naval" && !battle.field.open;

/**
 * Troops in order keep out of lakes, the sea and a river out of its fords, and out of the shallows but in a landing;
 * at a ford, a bridge and a beach a side that does not advance holds its bank
 */
export function shuns(battle: Battle, block: Block, x: number, y: number): boolean {
  const terrain = terrainAt(battle.field, x, y);
  const { water, ford, deck } = terrain;
  if (isMoored(battle, block)) return !water;
  if ((!water && !deck) || isRunning(block) || isAfloat(battle, block, terrain)) return false;
  const shallow = terrain.shallow && battle.type === "landing";
  return (!ford && !shallow && !deck) || !battle[block.side].advancing;
}

/** Metres a tick; all but the fliers go as fast as their ships on the open sea and when shipped */
export function getPace(battle: Battle, block: Block, terrain?: Waters): number {
  const sailing = battle.field.open === "sea" || (terrain !== undefined && isShipped(battle, block, terrain));
  if (sailing && block.type !== "aviation" && block.type !== "naval") return getShipPace(battle.units) ?? block.speed;
  return block.speed;
}

const shipPaces = new WeakMap<MilitaryUnit[], number | null>();

/** Metres a tick of the ships that carry troops: the slowest naval unit of the map's, none when it has no ships */
function getShipPace(units: MilitaryUnit[]): number | null {
  if (!shipPaces.has(units)) {
    const speeds = units.filter(unit => unit.type === "naval").map(unit => unit.speed);
    shipPaces.set(units, speeds.length ? toMetresPerTick(Math.min(...speeds)) : null);
  }
  return shipPaces.get(units)!;
}

/** Share of its strength a block has on the ground it stands on, in attack and in defence */
export function getFooting(battle: Battle, block: Block, terrain: Terrain): number {
  if (terrain.rampart && terrain.rampart < 3 && isClimbing(battle, block)) return 0.5;
  if (terrain.water) return isAfloat(battle, block, terrain) ? 1 : terrain.water === 1 && !terrain.shallow ? 0.25 : 0.5;
  if (block.type === "aviation") return 1;
  const slope = Math.max(1 - getGrade(battle.field, block.x, block.y), SLOPE_FOOTING);
  return (terrain.marsh ? 0.75 : 1) * slope * (battle.mud ? MUD.footing : 1);
}

const SLOPE_FOOTING = 0.5; // the least of its strength a block keeps on a steep slope

/** A siege of a burg that has walls */
export const hasWalls = (battle: Battle): boolean =>
  battle.field.held !== null && battle.field.burgs[battle.field.held].walled;

/** Besiegers go over the walls while they storm the burg or loot it */
export const isStorming = (battle: Battle): boolean =>
  battle.field.held !== null && (battle.attackers.phase === "storming" || battle.attackers.phase === "looting");

/** A besieger on its way over the walls or out of them: slowed at their foot and weak there */
export const isClimbing = (battle: Battle, block: Block): boolean =>
  battle.field.held !== null &&
  block.side === "attackers" &&
  block.type !== "aviation" &&
  (isStorming(battle) || isRunning(block));

export function canCross(battle: Battle, block: Block, wall: FieldWall): boolean {
  if (block.type === "aviation") return true;
  if (wall.burg !== battle.field.held || block.side === "defenders") return wall.gate;
  return isStorming(battle) || isRunning(block);
}

const NO_WORKS: FieldWork[] = [];

/** Whether a wall, a shut gate or works of the foe stand between two points for the block */
export function isBarred(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
  const walls = getWallsBetween(battle.field, from, to);
  if (walls.length > 0 && walls.some(wall => !canCross(battle, block, wall))) return true;
  return isBarredByWorks(battle, block, from, to);
}

// Ways round the water, the walls and the works that bar. Troops go straight while nothing but open dry ground lies
// ahead, so a field without them plays as it did; where they are in the way troops take the cheapest way over the grid.

interface Ways {
  rough: boolean; // the field has water or walls at all
  wet: boolean; // it has water
  wagons: Side[]; // the sides holding wagons: the ways are rough for their foes
  staked: Side[]; // and holding stakes: rough for their foes' riders
  near: Uint8Array; // nodes by walls and by works that bar somebody
  walls: Uint8Array; // within a front of walls

  costs: Map<string, Float32Array>; // what a kind of troops pays for a node, by the kind
  closed: Map<string, Uint16Array>; // the steps walls shut to a kind of troops
  reach: Map<number, { node: number; kind: string; reach: Reach }>; // the field as a block last saw it from where it stood
  routes: Map<number, { target: number; made: number; points: [number, number][] }>;
  flight: Map<string, Reach>; // the ways off the field, by the kind and the side
  shared: Map<string, Reach>; // the ways to a point many go to, by the kind and the point
  from: Map<string, Reach>; // the ways from a node, by the kind and the node
}

const ways = new WeakMap<Battlefield, Ways>();
const groundCosts = new WeakMap<Battlefield, Ways["costs"]>(); // the ground is the same whatever works rise or fall

/** The ground changed or the troops are drawn up anew; when only works did, what the ground costs is kept */
export const forgetWays = (field: Battlefield, works = false): void => {
  ways.delete(field);
  if (!works) groundCosts.delete(field);
};

/** The turns of the way a block follows round water and walls, for diagnostics; none while it goes straight */
export const getWay = (battle: Battle, block: Block): [number, number][] =>
  ways.get(battle.field)?.routes.get(block.id)?.points ?? [];

function getWays(battle: Battle): Ways {
  let known = ways.get(battle.field);
  if (!known) {
    const { field } = battle;
    const barring = field.works.filter(work => isStanding(work) && work.kind !== "ditch");
    const holders = (kind: FieldWork["kind"]): Side[] => [
      ...new Set(barring.filter(work => work.kind === kind).map(work => work.side))
    ];
    known = {
      rough: field.water.some(Boolean) || field.walls.length > 0,
      wet: field.water.some(Boolean),
      wagons: holders("wagons"),
      staked: holders("stakes"),
      near: markStretches(field, [...field.walls, ...barring]),
      walls: markStretches(field, field.walls, Math.ceil(field.front / field.cell)),
      costs: groundCosts.get(field) ?? new Map(),
      closed: new Map(),
      reach: new Map(),
      routes: new Map(),
      flight: new Map(),
      shared: new Map(),
      from: new Map()
    };
    ways.set(battle.field, known);
    groundCosts.set(battle.field, known.costs);
  }
  return known;
}

/** Nodes about the stretches, so many nodes out: the steps between them are the ones walls and works may shut */
function markStretches(field: Battlefield, stretches: { a: Point; b: Point }[], reach = 1): Uint8Array {
  const near = new Uint8Array(COLS * ROWS);
  for (const { a, b } of stretches) {
    const samples = Math.max(Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (field.cell / 2)), 1);
    for (let i = 0; i <= samples; i++) {
      const node = nodeAt(field, a[0] + ((b[0] - a[0]) * i) / samples, a[1] + ((b[1] - a[1]) * i) / samples);
      const col = node % COLS;
      const row = (node - col) / COLS;
      for (let y = Math.max(row - reach, 0); y <= Math.min(row + reach, ROWS - 1); y++)
        for (let x = Math.max(col - reach, 0); x <= Math.min(col + reach, COLS - 1); x++) near[y * COLS + x] = 1;
    }
  }
  return near;
}

/** Whether the block needs ways over the grid: water or walls anywhere, wagons of its foe, or its stakes when it rides */
const isRough = (battle: Battle, block: Block): boolean => {
  const known = getWays(battle);
  if (known.rough) return true;
  const foe = (side: Side): boolean => side !== block.side;
  return known.wagons.some(foe) || (isRider(block) && known.staked.some(foe));
};

/** All that the going, the water, the walls and the works mean differently for: the unit, its side, whether it runs, the battle */
const getKind = (battle: Battle, block: Block): string =>
  `${block.type}|${block.kind}|${block.side}|${isRunning(block)}|${battle.type}|${battle[block.side].advancing}|${isStorming(battle)}|${battle.field.breaches.length}`;

/** The steps from node to node that walls shut to the block: a bit a neighbour */
function getClosed(battle: Battle, block: Block, kind = getKind(battle, block)): Uint16Array {
  const known = getWays(battle);
  let closed = known.closed.get(kind);
  if (!closed) {
    const { field } = battle;
    const marked = (node: number): boolean => known.near[node] === 1; // a wall or works by it
    const shut = (from: number, to: number, bit: number): void => {
      if (isBarred(battle, block, nodeCentre(field, from), nodeCentre(field, to))) {
        closed ??= new Uint16Array(COLS * ROWS);
        closed[from] |= bit;
      }
    };
    // only the steps from or to a node with a wall or works near can be shut
    for (let node = 0; node < COLS * ROWS; node++) {
      if (!marked(node)) continue;
      const col = node % COLS;
      const row = (node - col) / COLS;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = col + dx;
          const y = row + dy;
          if ((!dx && !dy) || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          const next = y * COLS + x;
          shut(node, next, getStepBit(dx, dy));
          if (!marked(next)) shut(next, node, getStepBit(-dx, -dy)); // the step back, once
        }
      }
    }
    closed ??= OPEN_STEPS;
    known.closed.set(kind, closed);
  }
  return closed;
}

const OPEN_STEPS = new Uint16Array(COLS * ROWS); // no step is shut: never written to

/** What a node's width of the way costs the block, node by node: the slower the going the dearer, no way where it keeps out */
function getCosts(battle: Battle, block: Block, kind = getKind(battle, block)): Float32Array {
  const known = getWays(battle);
  let costs = known.costs.get(kind);
  if (!costs) {
    costs = new Float32Array(COLS * ROWS);
    for (let node = 0; node < costs.length; node++) {
      const [x, y] = nodeCentre(battle.field, node);
      costs[node] = shuns(battle, block, x, y) ? Infinity : 1 / getGoing(battle, block, terrainAt(battle.field, x, y));
    }
    known.costs.set(kind, costs);
  }
  return costs;
}

const WET = 3; // a node's cost from which it is water to wade through or to keep out of

/** Whether the block can walk straight from one point to another: no water to wet its feet, no wall in the way */
export function isDry(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
  if (!getWays(battle).wet) return !isBarred(battle, block, from, to); // nothing to wade through or keep out of
  const costs = getCosts(battle, block);
  if (isWading(costs) && !isClear(COLS, ROWS, battle.field.cell, from, to, node => costs[node] > WET)) return false;
  return !isBarred(battle, block, from, to);
}

/** Whether there is a node to wade through or keep out of at all */
function isWading(costs: Float32Array): boolean {
  let wet = wading.get(costs);
  if (wet === undefined) {
    wet = costs.some(cost => cost > WET);
    wading.set(costs, wet);
  }
  return wet;
}

const wading = new WeakMap<Float32Array, boolean>();

/**
 * The node the ways of the block start or end at for a point: the point's own, or by a wall or works the nearest one on
 * the point's side of them. A point a metre outside the wall may lie in a node whose middle is within it
 */
function getNodeAt(battle: Battle, block: Block, x: number, y: number): number {
  const { field } = battle;
  const node = nodeAt(field, x, y);
  if (!getWays(battle).near[node]) return node;
  const col = node % COLS;
  const row = (node - col) / COLS;
  let best = node;
  let least = Infinity;
  for (let ny = Math.max(row - 1, 0); ny <= Math.min(row + 1, ROWS - 1); ny++) {
    for (let nx = Math.max(col - 1, 0); nx <= Math.min(col + 1, COLS - 1); nx++) {
      const near = ny * COLS + nx;
      const centre = nodeCentre(field, near);
      const distance = Math.hypot(centre[0] - x, centre[1] - y);
      if (distance < least && !isBarred(battle, block, [x, y], centre)) [best, least] = [near, distance];
    }
  }
  return best;
}

/** The field from where the block stands; for distances it is kept while the block stays within a few nodes of the place */
function getReach(battle: Battle, block: Block): Reach {
  const known = getWays(battle);
  const kind = getKind(battle, block);
  const node = getNodeAt(battle, block, block.x, block.y);
  const last = known.reach.get(block.id);
  const row = (at: number): number => Math.floor(at / COLS);
  const moved = last
    ? Math.max(Math.abs((last.node % COLS) - (node % COLS)), Math.abs(row(last.node) - row(node)))
    : Infinity;
  if (last && last.kind === kind && moved < KEPT) return last.reach;
  const reach = spreadFrom(battle, block, node);
  known.reach.set(block.id, { node, kind, reach });
  return reach;
}

const KEPT = 5; // nodes a block goes before the distances from where it was are found anew

/** The field from a node for troops like the block: found once for all of them standing there */
function spreadFrom(battle: Battle, block: Block, node: number): Reach {
  const known = getWays(battle);
  const kind = getKind(battle, block);
  const key = `${kind}|${node}`;
  let reach = known.from.get(key);
  if (!reach) {
    if (known.from.size >= 128) known.from.clear();
    reach = spread(COLS, ROWS, [node], getCosts(battle, block, kind), getClosed(battle, block, kind), true);
    known.from.set(key, reach);
  }
  return reach;
}

/** The node by a foe the block can come to, when there is one: a foe may stand where the block does not go */
function getGoal(battle: Battle, block: Block, reach: Reach, foe: Spot): number | null {
  const node = getNodeAt(battle, block, foe.x, foe.y);
  if (reach.costTo(node) !== Infinity) return node;
  let best: number | null = null;
  const col = node % COLS;
  const row = (node - col) / COLS;
  for (let y = Math.max(row - 2, 0); y <= Math.min(row + 2, ROWS - 1); y++) {
    for (let x = Math.max(col - 2, 0); x <= Math.min(col + 2, COLS - 1); x++) {
      const near = y * COLS + x;
      if (reach.costTo(near) < (best === null ? Infinity : reach.cost[best])) best = near;
    }
  }
  return best;
}

/** How far a foe is: as the block would walk, round the water or through it; straight when there is no way at all */
export function getDistance(battle: Battle, block: Block, foe: Spot): number {
  const straight = Math.hypot(foe.x - block.x, foe.y - block.y);
  // besiegers pick their foes as the crow flies: the way over the walls is much the same to all of the garrison
  if (battle.field.held !== null && block.side === "attackers") return straight;
  if (!isRough(battle, block) || isDry(battle, block, [block.x, block.y], [foe.x, foe.y])) return straight;
  const reach = getReach(battle, block);
  const goal = getGoal(battle, block, reach, foe);
  return goal === null ? straight : Math.max(reach.costTo(goal) * battle.field.cell, straight);
}

/** Where to step to come to the target: the target itself, or the next turn of the way round the water */
export function getHeading(battle: Battle, block: Block, target: Spot, key: number): [number, number] {
  const known = getWays(battle);
  if (!isRough(battle, block)) return [target.x, target.y];
  let route = known.routes.get(block.id);
  // a foe moves, so the way to it is found anew every round; the way to a point of the field, five times as seldom
  const stale = route !== undefined && battle.tick - route.made >= (key < 0 ? ROUND_TICKS * 5 : ROUND_TICKS);
  if (!route || route.target !== key || stale) {
    route = { target: key, made: battle.tick, points: findWay(battle, block, target) };
    known.routes.set(block.id, route);
  }
  const here: [number, number] = [block.x, block.y];
  // a turn is done with once the block stands on it or can walk straight to the next one
  const reached = (): void => {
    const { points } = route!;
    while (
      points.length &&
      (Math.hypot(points[0][0] - block.x, points[0][1] - block.y) < ARRIVED * battle.field.front ||
        (points.length > 1 && isDry(battle, block, here, points[1])))
    )
      points.shift();
  };
  reached();
  // pushed off its way, with water now between it and the next turn: the way is found anew
  const [next] = route.points;
  if (next && route.made !== battle.tick && !isWet(battle, block, ...here) && !isWet(battle, block, ...next)) {
    if (!isDry(battle, block, here, next)) {
      route = { target: key, made: battle.tick, points: findWay(battle, block, target) };
      known.routes.set(block.id, route);
      reached();
    }
  }
  return route.points[0] ?? [target.x, target.y];
}

/**
 * The way for troops like the block from one point to another, sought toward it first; when the point cannot be come to,
 * to the nearest node by it that can. The node it ends at, if any
 */
function seekWay(battle: Battle, like: Block, from: Point, to: Point): [Reach, number | null] {
  const kind = getKind(battle, like);
  const [start, end] = [getNodeAt(battle, like, ...from), getNodeAt(battle, like, ...to)];
  const toward = spread(COLS, ROWS, [start], getCosts(battle, like, kind), getClosed(battle, like, kind), true, end);
  if (toward.costTo(end) !== Infinity) return [toward, end];
  const reach = spreadFrom(battle, like, start);
  return [reach, getGoal(battle, like, reach, { x: to[0], y: to[1] })];
}

/** Where troops like the block would turn first on their way from one point to another: the goal itself over open ground */
export function getTurn(battle: Battle, like: Block, from: Point, to: Point): Point {
  if (!isRough(battle, like) || isDry(battle, like, from, to)) return to;
  const { field } = battle;
  const reach = spreadFrom(battle, like, getNodeAt(battle, like, ...from));
  const goal = getGoal(battle, like, reach, { x: to[0], y: to[1] });
  if (goal === null) return to;
  const nodes = trace(reach, goal)
    .slice(1)
    .map(node => nodeCentre(field, node));
  let next = 0;
  while (next + 1 < nodes.length && isDry(battle, like, from, nodes[next + 1])) next++;
  return nodes[next] ?? to;
}

/** The field as troops like the block would cross it to a node, found once for all of them and kept */
function getSharedReach(battle: Battle, block: Block, goal: number): Reach {
  const known = getWays(battle);
  const kind = getKind(battle, block);
  const key = `${kind}|${goal}`;
  let reach = known.shared.get(key);
  if (!reach) {
    if (known.shared.size > 200) known.shared.clear(); // of walls and phases long gone
    reach = spread(COLS, ROWS, [goal], getCosts(battle, block, kind), getClosed(battle, block, kind), true);
    known.shared.set(key, reach);
  }
  return reach;
}

/**
 * Where to step on the way to a point many go to, as stormers to the middle of a burg: the ways are found once from the
 * point for all troops of a kind, not from every battalion apart
 */
export function getSharedHeading(battle: Battle, block: Block, to: Spot): Point {
  const here: Point = [block.x, block.y];
  if (!isRough(battle, block) || isDry(battle, block, here, [to.x, to.y])) return [to.x, to.y];
  const reach = getSharedReach(battle, block, nodeAt(battle.field, to.x, to.y));
  // down the way to the point, as far as the block can walk straight
  let node = getNodeAt(battle, block, block.x, block.y);
  if (reach.costTo(node) === Infinity) return [to.x, to.y];
  let next: Point = [to.x, to.y];
  for (let i = 0; i < 12 && reach.from[node] !== -1; i++) {
    node = reach.from[node];
    const turn = nodeCentre(battle.field, node);
    if (i && !isDry(battle, block, here, turn)) break;
    next = turn;
  }
  return next;
}

/** The turns of the way to the target; none when the block can walk straight to it or cannot come to it at all */
function findWay(battle: Battle, block: Block, target: Spot): [number, number][] {
  if (isDry(battle, block, [block.x, block.y], [target.x, target.y])) return [];
  const [reach, goal] = seekWay(battle, block, [block.x, block.y], [target.x, target.y]);
  if (goal === null) return [];
  const nodes = trace(reach, goal)
    .slice(1)
    .map(node => nodeCentre(battle.field, node));

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

/** The ground open to a side's troops this tick, and the edge nodes they get off by: shared while its foes stay as they are */
interface Exits {
  tick: number;
  out: Map<string, Uint8Array>; // the ground that leads off the field, by the kind
  ground: Map<Side, { foes: number[]; open: Uint8Array; edges: number[]; out: Map<Uint16Array, Uint8Array> }>;
}

const exits = new WeakMap<Battle, Exits>();
const EDGES = Array.from({ length: COLS * ROWS }, (_, node) => node).filter(node => {
  const col = node % COLS;
  const row = (node - col) / COLS;
  return !col || !row || col === COLS - 1 || row === ROWS - 1;
});

/**
 * Whether a block can get off the field by any edge: round deep water and walls, past no foe in order.
 * The ground open to it is found once a tick for troops like it, from the edges in: it is out when it stands on it or
 * can step onto it
 */
export function hasWayOut(battle: Battle, block: Block): boolean {
  if (block.type === "aviation" || isMoored(battle, block)) return true; // nothing on the ground bars fliers and ships
  const { field } = battle;
  let known = exits.get(battle);
  if (known?.tick !== battle.tick) {
    known = { tick: battle.tick, out: new Map(), ground: new Map() };
    exits.set(battle, known);
  }
  const kind = getKind(battle, block);
  const closed = getClosed(battle, block, kind);
  let out = known.out.get(kind);
  if (!out) {
    const ground = getOpenGround(battle, known, block.side);
    out = ground.out.get(closed);
    if (!out) {
      out = flood(COLS, ROWS, ground.edges, ground.open, closed);
      ground.out.set(closed, out);
    }
    known.out.set(kind, out);
  }
  const node = nodeAt(field, block.x, block.y);
  if (out[node]) return true;
  const col = node % COLS;
  const row = (node - col) / COLS;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const [x, y] = [col + dx, row + dy];
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS || closed[node] & getStepBit(dx, dy)) continue;
      if (out[y * COLS + x]) return true;
    }
  }
  return false;
}

/** The ground a side's troops can enter: no deep water, nothing a foe in order stands on and holds */
function getOpenGround(battle: Battle, known: Exits, side: Side) {
  const { field } = battle;
  const ready = battle.blocks.filter(foe => foe.side !== side && foe.status === "ready");
  const foes = ready.flatMap(foe => [foe.id, foe.x, foe.y, foe.width, foe.depth]);
  const last = known.ground.get(side);
  if (last && last.foes.length === foes.length && last.foes.every((value, i) => value === foes[i])) return last;

  const open = new Uint8Array(COLS * ROWS);
  for (let node = 0; node < open.length; node++) {
    const water = field.water[node];
    open[node] = water === 1 || (water === 2 && !isFordable(field, node) && !field.deck[node]) ? 0 : 1;
  }
  for (const foe of ready) {
    const reach = Math.max(foe.width, foe.depth) / 2 + CONTACT; // the ground it stands on and holds
    const [col, row] = [Math.floor(foe.x / field.cell), Math.floor(foe.y / field.cell)];
    const span = Math.ceil(reach / field.cell);
    for (let y = Math.max(row - span, 0); y <= Math.min(row + span, ROWS - 1); y++) {
      for (let x = Math.max(col - span, 0); x <= Math.min(col + span, COLS - 1); x++) {
        const [nx, ny] = nodeCentre(field, y * COLS + x);
        if (Math.hypot(nx - foe.x, ny - foe.y) <= reach) open[y * COLS + x] = 0;
      }
    }
  }
  const edges = EDGES.filter(node => open[node]);
  const ground = { foes, open, edges, out: new Map<Uint16Array, Uint8Array>() };
  known.ground.set(side, ground);
  return ground;
}

/** The way off the field for troops on the run: to the nearest edge behind their side, round the water */
export function getFlight(battle: Battle, block: Block): number | null {
  const known = getWays(battle);
  const { field } = battle;
  if (!isRough(battle, block)) return null;
  const kind = getKind(battle, block);
  let reach = known.flight.get(kind);
  if (!reach) {
    const away = block.side === "attackers" ? battle.axis + Math.PI : battle.axis;
    const edge: number[] = [];
    for (let node = 0; node < COLS * ROWS; node++) {
      const col = node % COLS;
      const row = (node - col) / COLS;
      if (col && row && col < COLS - 1 && row < ROWS - 1) continue;
      const [x, y] = nodeCentre(field, node);
      if ((x - field.width / 2) * Math.cos(away) + (y - field.height / 2) * Math.sin(away) > 0) edge.push(node);
    }
    reach = spread(COLS, ROWS, edge, getCosts(battle, block, kind), getClosed(battle, block, kind));
    known.flight.set(kind, reach);
  }

  const node = getNodeAt(battle, block, block.x, block.y);
  const col = node % COLS;
  const row = (node - col) / COLS;
  if (!reach.cost[node]) {
    // on the edge: straight out of the field
    const out = [col, COLS - 1 - col, row, ROWS - 1 - row];
    return [Math.PI, 0, -Math.PI / 2, Math.PI / 2][out.indexOf(Math.min(...out))];
  }
  // the node nearer the edge about it that the block can step to: not one over a wall it cannot cross
  let best = node;
  for (let y = Math.max(row - 2, 0); y <= Math.min(row + 2, ROWS - 1); y++) {
    for (let x = Math.max(col - 2, 0); x <= Math.min(col + 2, COLS - 1); x++) {
      const near = y * COLS + x;
      if (reach.cost[near] >= reach.cost[best]) continue;
      if (!isBarred(battle, block, [block.x, block.y], nodeCentre(field, near))) best = near;
    }
  }
  if (best === node) return null;
  const [x, y] = nodeCentre(field, best);
  return Math.atan2(y - block.y, x - block.x);
}

/** Sides that water keeps apart get a crossing where it is narrowest for them: a ford on a river, shallows in a lake */
export function openCrossing(battle: Battle, attackers: Point, defenders: Point): void {
  const { field } = battle;
  if (field.open || isFromSea(battle.type) || !field.water.some(Boolean)) return;
  const from = nodeAt(field, ...attackers);
  const to = nodeAt(field, ...defenders);
  const size = COLS * ROWS;
  const deep = (node: number): boolean => field.water[node] === 2 && !isFordable(field, node);
  const still = (node: number): boolean => field.water[node] === 1;
  const dry = Float32Array.from({ length: size }, (_, node) => (deep(node) || still(node) ? Infinity : 1));
  if (spread(COLS, ROWS, [from], dry).cost[to] !== Infinity && dry[to] === 1) return;

  // the way with the least water on it; a river is easier forded than a lake
  const wet = Float32Array.from({ length: size }, (_, node) => (still(node) ? 60 : deep(node) ? 20 : 1));
  for (const node of trace(spread(COLS, ROWS, [from], wet), to)) {
    if (!deep(node) && !still(node)) continue;
    const col = node % COLS;
    const row = (node - col) / COLS;
    for (let y = Math.max(row - 1, 0); y <= Math.min(row + 1, ROWS - 1); y++) {
      for (let x = Math.max(col - 1, 0); x <= Math.min(col + 1, COLS - 1); x++) {
        const near = y * COLS + x;
        if (deep(near)) field.ford[near] = 1;
        else if (still(near)) {
          field.water[near] = 0;
          field.marsh[near] = 1; // shallows: slow going and poor footing
        }
      }
    }
  }
}

export const CONTACT = 12; // gap at which blocks fight
// in battalion fronts
const CLEARANCE = 0.11; // gap blocks keep from each other
export const ARRIVED = 0.07; // how near a place or a turn of its way a block has come to it
const NEAR = 2.5; // within which blocks are worth measuring the gap to

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

/** The least space there can be between two blocks at these points: their discs reach no further than this from the middle */
const getLeastGap = (a: Block, b: Block, x = a.x, y = a.y): number =>
  Math.hypot(b.x - x, b.y - y) - Math.max(a.width, a.depth) / 2 - Math.max(b.width, b.depth) / 2;

/** The discs of a block where it stands, kept till it moves, turns or changes its shape */
function getStandingDiscs(block: Block): [number, number][] {
  const last = discs.get(block);
  const { x, y, facing, width, depth } = block;
  if (last && last.x === x && last.y === y && last.facing === facing && last.width === width && last.depth === depth)
    return last.discs;
  const made = getDiscs(block);
  discs.set(block, { x, y, facing, width, depth, discs: made });
  return made;
}

const discs = new WeakMap<
  Block,
  Pick<Block, "x" | "y" | "facing" | "width" | "depth"> & { discs: [number, number][] }
>();

/** Space between two blocks, negative when they overlap, and the way from the first to the second there */
export function getGap(
  a: Block,
  b: Block,
  discsA = getStandingDiscs(a),
  discsB = getStandingDiscs(b)
): [number, number, number] {
  const reach = (a.depth + b.depth) / 2;
  let least = Infinity;
  let dx = 0;
  let dy = 0;
  let distance = 1;
  for (const [ax, ay] of discsA) {
    for (const [bx, by] of discsB) {
      const between = Math.hypot(bx - ax, by - ay);
      if (between - reach < least) {
        least = between - reach;
        dx = bx - ax;
        dy = by - ay;
        distance = between || 1;
      }
    }
  }
  return [least, dx / distance, dy / distance];
}

/** Troops on the run are no obstacle and nobody holds them up */
export const isRunning = (block: Block): boolean => block.status === "routed" || block.action === "flee";

export const isNear = (battle: Battle, a: Block, b: Block): boolean => {
  const near = NEAR * battle.field.front;
  return Math.abs(a.x - b.x) < near && Math.abs(a.y - b.y) < near && a !== b;
};

/** Ships keep to the water of a land battle: hand to hand they fight only ships */
export const canGrip = (battle: Battle, a: Block, b: Block): boolean => isMoored(battle, a) === isMoored(battle, b);

/** Close enough to fight, with no wall between that neither of them can cross, nor stakes against riders */
export const inContact = (battle: Battle, a: Block, b: Block): boolean =>
  canGrip(battle, a, b) &&
  isNear(battle, a, b) &&
  getLeastGap(a, b) <= CONTACT &&
  getGap(a, b)[0] <= CONTACT &&
  !getWallsBetween(battle.field, [a.x, a.y], [b.x, b.y]).some(
    wall => !canCross(battle, a, wall) && !canCross(battle, b, wall)
  ) &&
  !isStaked(battle, a, b) &&
  !isAboard(battle, a) &&
  !isAboard(battle, b);

/** The first of the others the block would stand on at the point */
function getInWay(
  battle: Battle,
  block: Block,
  x: number,
  y: number,
  others: Block[],
  filing = isFiling(battle, block)
): Block | undefined {
  if (isRunning(block)) return undefined;
  const near = NEAR * battle.field.front;
  let discs: [number, number][] | null = null;
  const getOwnDiscs = (): [number, number][] => {
    discs ??= getDiscs(block, x, y);
    return discs;
  };
  let towns: number[] | null = null;
  // friends packed within the walls it stands in or steps into are not in its way: or nobody would get out by a gate
  const packed = (other: Block): boolean => {
    const town = terrainAt(battle.field, other.x, other.y).walled;
    if (!town || other.side !== block.side) return false;
    towns ??= [terrainAt(battle.field, x, y).walled, terrainAt(battle.field, block.x, block.y).walled];
    return towns.includes(town);
  };
  return others.find(
    other =>
      Math.abs(other.x - x) <= near &&
      Math.abs(other.y - y) <= near &&
      other !== block &&
      !isRunning(other) &&
      !(filing && other.side === block.side) &&
      getLeastGap(block, other, x, y) < 1 &&
      !packed(other) &&
      getGap(block, other, getOwnDiscs())[0] < 1 &&
      !isWalledOff(battle.field, [x, y], [other.x, other.y])
  );
}

/** A stretch of wall, not a gate, between two points: who stands on either side of it is not in the other's way */
const isWalledOff = (field: Battlefield, from: Point, to: Point): boolean =>
  getWallsBetween(field, from, to).some(wall => !wall.gate);

/** Friends within the walls of one burg: packed in its streets, they keep no lines and do not stand in each other's way */
function isPacked(battle: Battle, a: Block, b: Block): boolean {
  if (a.side !== b.side) return false;
  const town = terrainAt(battle.field, a.x, a.y).walled;
  return town > 0 && terrainAt(battle.field, b.x, b.y).walled === town;
}

/** Push overlapping blocks apart; those in a fight give less ground */
export function separate(battle: Battle, blocks: Block[]): void {
  const clearance = CLEARANCE * battle.field.front;
  const near = NEAR * battle.field.front;
  // what pushing does not change: as `getLeastGap` and `isRunning` read it
  const radius = blocks.map(block => Math.max(block.width, block.depth) / 2);
  const running = blocks.map(isRunning);
  const filing = blocks.map(block => isFiling(battle, block));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < blocks.length; i++) {
      const a = blocks[i];
      for (let j = i + 1; j < blocks.length; j++) {
        const b = blocks[j];
        if (!(Math.abs(a.x - b.x) < near && Math.abs(a.y - b.y) < near) || a === b) continue; // as `isNear`
        if (Math.hypot(b.x - a.x, b.y - a.y) - radius[i] - radius[j] >= clearance) continue;
        if (running[i] || running[j] || isPacked(battle, a, b)) continue;
        if (a.side === b.side && (filing[i] || filing[j])) continue;
        const [gap, dx, dy] = getGap(a, b);
        if (gap >= clearance || isWalledOff(battle.field, [a.x, a.y], [b.x, b.y])) continue;
        const heavyA = a.action === "fight" ? 3 : 1;
        const heavyB = b.action === "fight" ? 3 : 1;
        const push = clearance - gap;
        a.x -= (dx * push * heavyB) / (heavyA + heavyB);
        a.y -= (dy * push * heavyB) / (heavyA + heavyB);
        b.x += (dx * push * heavyA) / (heavyA + heavyB);
        b.y += (dy * push * heavyA) / (heavyA + heavyB);
      }
    }
  }
}

// Giving way. A battalion held up by a friend in its way asks it to give way. The friend keeps out of its way, a step
// aside or standing, till the asker is by it: if it stands idle, comes to the same opening further from it, crosses the
// asker's way or has waited for its own way less long; never when it is ahead in the same queue. A gate, a bridge or a
// ford is passed in the order battalions come to it. One held up by friends for two rounds all the same files through
// them till it is clear.

/** A battalion's try to move this tick: where from, the way and how far it meant to go */
export interface Move {
  block: Block;
  from: Point;
  to: Point; // the next turn of its way, or its goal
  leg: number;
}

interface Ask {
  by: number;
  since: number; // the tick the asker was first held up
  from: Point;
  to: Point; // where the asker makes for
  heading: number;
}

/** A battalion that gave way to the asker: it keeps out of the way till the asker is by, a round at most */
interface Yielding {
  by: number;
  heading: number;
  until: number;
}

interface Traffic {
  tick: number; // noted at the end of
  heading: Map<number, number>; // the way each battalion that moved tried to go
  turn: Map<number, Point>; // and the point it made for
  since: Map<number, number>; // the battalions held up, since when
  asks: Map<number, Ask>; // by the friend asked to give way
  filing: Set<number>; // the battalions that file through friends
  giving: Map<number, Yielding>; // who keeps out of whose way
  gave: Map<number, Yielding>; // and who does so this tick, for the next
}

const traffic = new WeakMap<Battle, Traffic>();

/** What the last tick left to this one; nothing after a replay from the start */
function getTraffic(battle: Battle): Traffic | undefined {
  const known = traffic.get(battle);
  return known?.tick === battle.tick - 1 ? known : undefined;
}

const HELD_UP = 0.25; // a battalion that comes no further than this share of its leg is held up
const PATIENCE = ROUND_TICKS * 2; // ticks a battalion is held up by friends before it files through them

/** Keep out of the way of a friend: step aside when asked, else stand while it comes by; false when it goes its own way */
export function giveWay(battle: Battle, block: Block, others: Block[]): boolean {
  const known = getTraffic(battle);
  if (!known) return false;
  const ask = known.asks.get(block.id);
  if (ask) {
    if (!yields(battle, known, block, ask)) return false;
    known.gave.set(block.id, { by: ask.by, heading: ask.heading, until: battle.tick + ROUND_TICKS });
    stepAside(battle, block, ask.from, ask.heading, others);
    return true;
  }
  const given = known.giving.get(block.id);
  if (!given || battle.tick > given.until || !known.heading.has(given.by)) return false;
  const asker = battle.blocks.find(other => other.id === given.by);
  if (asker?.status !== "ready" || !isNear(battle, block, asker)) return false;
  const ahead = (block.x - asker.x) * Math.cos(given.heading) + (block.y - asker.y) * Math.sin(given.heading);
  if (ahead <= 0) return false; // the asker is by
  known.gave.set(block.id, given);
  return true;
}

/** Whether the block gives way to the asker */
function yields(battle: Battle, known: Traffic, block: Block, ask: Ask): boolean {
  const own = known.heading.get(block.id);
  if (own === undefined) return true; // it stands idle
  // both make for the same opening: who is nearer to it goes first
  const turn = known.turn.get(block.id)!;
  if (Math.hypot(turn[0] - ask.to[0], turn[1] - ask.to[1]) < battle.field.front)
    return Math.hypot(block.x - turn[0], block.y - turn[1]) > Math.hypot(ask.from[0] - turn[0], ask.from[1] - turn[1]);
  if (Math.cos(own - ask.heading) > SAME_WAY) return false; // ahead in the same queue
  const since = known.since.get(block.id);
  return since === undefined || since > ask.since || (since === ask.since && block.id > ask.by);
}

/** Off the asker's way on the side the block stands, or on ahead of it, or off by the other side; never back at it */
function stepAside(battle: Battle, block: Block, from: Point, heading: number, others: Block[]): void {
  const side = Math.cos(heading) * (block.y - from[1]) - Math.sin(heading) * (block.x - from[0]) < 0 ? -1 : 1;
  ASIDE.some(off => {
    const away = heading + off * side;
    return step(battle, block, Math.cos(away), Math.sin(away), Infinity, others, 1, STRAIGHT);
  });
}

const ASIDE = [1.1, 1.6, 0.5, 0, -0.5, -1.1, -1.6]; // radians off the asker's way a friend giving way tries, its own side first
const SAME_WAY = 0.5; // cosine of the angle within which two go the same way

/** Whether the block files through its friends this tick: they are not in its way, nor it in theirs */
const isFiling = (battle: Battle, block: Block): boolean => getTraffic(battle)?.filing.has(block.id) === true;

/** After the moves: who was held up, since when, which friend in its way it asks to give way and who files through */
export function noteTraffic(battle: Battle, moves: Move[], others: Block[]): void {
  const last = getTraffic(battle);
  const known: Traffic = {
    tick: battle.tick,
    heading: new Map(),
    turn: new Map(),
    since: new Map(),
    asks: new Map(),
    filing: new Set(),
    giving: last?.gave ?? new Map(),
    gave: new Map()
  };
  const ahead = (CLEARANCE + NEAR_ENOUGH) * battle.field.front;
  for (const { block, from, to, leg } of moves) {
    const heading = Math.atan2(to[1] - from[1], to[0] - from[0]);
    known.heading.set(block.id, heading);
    known.turn.set(block.id, to);
    if (last?.filing.has(block.id) && getFriendUnder(battle, block, others)) known.filing.add(block.id); // till clear
    const [cos, sin] = [Math.cos(heading), Math.sin(heading)];
    const stride = Math.min(leg, getStride(battle, { ...block, x: from[0], y: from[1] }, heading));
    if (stride < 1 || (block.x - from[0]) * cos + (block.y - from[1]) * sin >= stride * HELD_UP) continue;
    const since = last?.since.get(block.id) ?? battle.tick;
    known.since.set(block.id, since);
    if (isRough(battle, block) && !isDry(battle, block, [block.x, block.y], to)) continue; // water or a wall holds it, not a friend

    // the first friend it would walk into straight on
    const reach = stride + ahead;
    const samples = Math.max(Math.ceil(reach / SAMPLE), 1);
    let blocker: Block | undefined;
    for (let i = 1; i <= samples && !blocker; i++) {
      const along = (reach * i) / samples;
      blocker = getInWay(battle, block, block.x + cos * along, block.y + sin * along, others);
    }
    if (!blocker || blocker.side !== block.side) continue;
    if (battle.tick - since >= PATIENCE) known.filing.add(block.id);
    const asked = known.asks.get(blocker.id);
    if (asked && (asked.since < since || (asked.since === since && asked.by < block.id))) continue;
    known.asks.set(blocker.id, { by: block.id, since, from: [block.x, block.y], to, heading });
  }
  traffic.set(battle, known);
}

/** A friend the block stands on, when there is one */
const getFriendUnder = (battle: Battle, block: Block, others: Block[]): Block | undefined =>
  getInWay(
    battle,
    block,
    block.x,
    block.y,
    others.filter(other => other.side === block.side),
    false
  );

const NEAR_ENOUGH = 0.1; // in fronts beyond the clearance: a friend so near ahead is in the way

export function normalize(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function turn(from: number, to: number, limit: number): number {
  const diff = normalize(to - from);
  return from + Math.min(Math.max(diff, -limit), limit);
}

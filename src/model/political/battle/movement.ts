import { FOOT_SPEED } from "@/model/political/military-units";
import type { Battle, Block } from "./battle";
import {
  type Battlefield,
  FIELD,
  type FieldWall,
  getWallsBetween,
  nodeAt,
  nodeCentre,
  type Terrain,
  terrainAt
} from "./battlefield";
import { getStepBit, isClear, type Reach, spread, trace } from "./pathfinding";

export type Point = [number, number];

/** A point of the field to go to */
export interface Spot {
  x: number;
  y: number;
}

export const ROUND_TICKS = 6;

// field units a tick
export const PACE = FOOT_SPEED; // of troops on foot
const WADING = 0.12; // share of the pace kept in deep water
const FORDING = 0.4; // and in a ford
const SCALING = 0.25; // share of the pace kept climbing a wall or forcing a gate
const RUBBLE = 0.5; // and over the rubble of a breach
const SHIPPED = 5; // pace of troops carried over water

/** Move towards the point at the block's pace, around whoever stands in the way; false when hemmed in */
export function step(
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

  // straight on, a shorter step to close up, then round what is in the way: by the side it took last, further and further
  const side = block.detour || 1;
  for (const [swing, share] of [
    [0, 1],
    [0, 0.5],
    [0, 0.25],
    [0.7 * side, 1],
    [-0.7 * side, 1],
    [1.4 * side, 1],
    [-1.4 * side, 1],
    [2.2 * side, 1],
    [-2.2 * side, 1]
  ]) {
    const x = block.x + Math.cos(heading + swing) * distance * share;
    const y = block.y + Math.sin(heading + swing) * distance * share;
    if (!isFree(battle, block, x, y, others) || (!wading && shuns(battle, block, x, y))) continue;
    if (isBarred(battle, block, [block.x, block.y], [x, y])) continue;
    if (swing && !midstream && isWet(battle, block, x, y)) continue;
    block.x = x;
    block.y = y;
    block.detour = swing ? Math.sign(swing) : share === 1 ? 0 : block.detour;
    return true;
  }
  return false;
}

/** Share of its pace a block keeps on the ground */
export function getGoing(battle: Battle, block: Block, terrain: Terrain): number {
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
export const isAfloat = (battle: Battle, block: Block, water: number): boolean =>
  block.type === "aviation" || block.type === "naval" || isShipped(battle, block, water);

/** Water under the feet of troops that neither fly, sail nor are shipped */
export function isWet(battle: Battle, block: Block, x: number, y: number): boolean {
  const { water } = terrainAt(battle.field, x, y);
  return Boolean(water) && !isAfloat(battle, block, water);
}

/**
 * Troops in order keep out of lakes, the sea and a river out of its fords;
 * at a ford and at a bridge a side that does not advance holds its bank
 */
export function shuns(battle: Battle, block: Block, x: number, y: number): boolean {
  const { water, ford, deck } = terrainAt(battle.field, x, y);
  if ((!water && !deck) || isRunning(block) || isAfloat(battle, block, water || 2)) return false;
  return (!ford && !deck) || !battle[block.side].advancing;
}

/** Field units a tick; all but the fliers go as fast as their ships on the open sea and when shipped */
export function getPace(battle: Battle, block: Block, water = 0): number {
  const sailing = battle.field.open === "sea" || isShipped(battle, block, water);
  if (sailing && block.type !== "aviation" && block.type !== "naval") return SHIPPED;
  return block.speed;
}

/** Share of its strength a block has on the ground it stands on, in attack and in defence */
export function getFooting(battle: Battle, block: Block, terrain: Terrain): number {
  if (terrain.rampart && terrain.rampart < 3 && isClimbing(battle, block)) return 0.5;
  if (terrain.water && !isAfloat(battle, block, terrain.water)) return terrain.water === 1 ? 0.25 : 0.5;
  return terrain.marsh ? 0.75 : 1;
}

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

/** Whether a wall or a shut gate stands between two points for the block */
export function isBarred(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
  const walls = getWallsBetween(battle.field, from, to);
  return walls.length > 0 && walls.some(wall => !canCross(battle, block, wall));
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

/** The ground changed or the troops are drawn up anew */
export const forgetWays = (field: Battlefield): void => void ways.delete(field);

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
  `${block.type}|${block.side}|${isRunning(block)}|${battle.type}|${battle[block.side].advancing}|${isStorming(battle)}|${battle.field.breaches.length}`;

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
export function isDry(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
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
function getGoal(reach: Reach, foe: Spot): number | null {
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
export function getDistance(battle: Battle, block: Block, foe: Spot): number {
  const straight = Math.hypot(foe.x - block.x, foe.y - block.y);
  if (!getWays(battle).rough || isDry(battle, block, [block.x, block.y], [foe.x, foe.y])) return straight;
  const reach = getReach(battle, block);
  const goal = getGoal(reach, foe);
  return goal === null ? straight : Math.max(reach.cost[goal] * FIELD.cell, straight);
}

/** Where to step to come to the target: the target itself, or the next turn of the way round the water */
export function getHeading(battle: Battle, block: Block, target: Spot, key: number): [number, number] {
  const known = getWays(battle);
  if (!known.rough) return [target.x, target.y];
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
      route = { target: key, made: battle.tick, points: findWay(battle, block, target) };
      known.routes.set(block.id, route);
      reached();
    }
  }
  return route.points[0] ?? [target.x, target.y];
}

/** Where troops like the block would turn first on their way from one point to another: the goal itself over open ground */
export function getTurn(battle: Battle, like: Block, from: Point, to: Point): Point {
  if (!getWays(battle).rough || isDry(battle, like, from, to)) return to;
  const reach = spread(FIELD.cols, FIELD.rows, [nodeAt(...from)], getCosts(battle, like), getClosed(battle, like));
  const goal = getGoal(reach, { x: to[0], y: to[1] });
  if (goal === null) return to;
  const nodes = trace(reach, goal).slice(1).map(nodeCentre);
  let next = 0;
  while (next + 1 < nodes.length && isDry(battle, like, from, nodes[next + 1])) next++;
  return nodes[next] ?? to;
}

/** The turns of the way to the target; none when the block can walk straight to it or cannot come to it at all */
function findWay(battle: Battle, block: Block, target: Spot): [number, number][] {
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
export function getFlight(battle: Battle, block: Block): number | null {
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

/** Sides that water keeps apart get a crossing where it is narrowest for them: a ford on a river, shallows in a lake */
export function openCrossing(battle: Battle, attackers: Point, defenders: Point): void {
  const { field } = battle;
  if (field.open || battle.type === "landing" || !field.water.some(Boolean)) return;
  const from = nodeAt(...attackers);
  const to = nodeAt(...defenders);
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

export const CONTACT = 9; // gap at which blocks fight
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
export function getGap(a: Block, b: Block, discsA = getDiscs(a), discsB = getDiscs(b)): [number, number, number] {
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
export const isRunning = (block: Block): boolean => block.status === "routed" || block.action === "flee";

export const isNear = (a: Block, b: Block): boolean =>
  Math.abs(a.x - b.x) < 110 && Math.abs(a.y - b.y) < 110 && a !== b;

/** Close enough to fight, with no wall between that neither of them can cross */
export const inContact = (battle: Battle, a: Block, b: Block): boolean =>
  isNear(a, b) &&
  getGap(a, b)[0] <= CONTACT &&
  !getWallsBetween(battle.field, [a.x, a.y], [b.x, b.y]).some(
    wall => !canCross(battle, a, wall) && !canCross(battle, b, wall)
  );

/** Whether the block would stand clear of all the others at the point */
function isFree(battle: Battle, block: Block, x: number, y: number, others: Block[]): boolean {
  if (isRunning(block)) return true;
  const discs = getDiscs(block, x, y);
  // friends packed within the walls it stands in or steps into are not in its way: or nobody would get out by a gate
  const towns = [terrainAt(battle.field, x, y).walled, terrainAt(battle.field, block.x, block.y).walled];
  const packed = (other: Block): boolean => {
    const town = terrainAt(battle.field, other.x, other.y).walled;
    return town > 0 && other.side === block.side && towns.includes(town);
  };
  return others.every(
    other =>
      Math.abs(other.x - x) > 110 ||
      Math.abs(other.y - y) > 110 ||
      other === block ||
      isRunning(other) ||
      packed(other) ||
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
export function separate(battle: Battle, blocks: Block[]): void {
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

export function normalize(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function turn(from: number, to: number, limit: number): number {
  const diff = normalize(to - from);
  return from + Math.min(Math.max(diff, -limit), limit);
}

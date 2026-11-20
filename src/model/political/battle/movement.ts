import { FOOT_SPEED } from "@/model/political/military-units";
import type { MilitaryUnit } from "@/types/military";
import type { Battle, Block } from "./battle";
import {
  CONTACT,
  FORDING,
  LADDER_ROUNDS,
  POINT_BLANK,
  RUBBLE,
  SLOPE_FOOTING,
  STORM_FOOTING,
  THROWN,
  WADING
} from "./battle-balance";
import { BattleRules, type Side } from "./battle-rules";
import { BattleScale, COLS, ROWS } from "./battle-scale";
import {
  type Battlefield,
  Battlefields,
  type FieldCliff,
  type FieldLadders,
  type FieldWall,
  type FieldWork,
  type Terrain,
  WALL_HEIGHT
} from "./battlefield";
import { Pathfinding, type Reach } from "./pathfinding";
import { Sight } from "./sight";
import { ICE, MUD } from "./weather";
import { Works } from "./works";

export type Point = [number, number];

/** A point of the field to go to */
export interface Spot {
  x: number;
  y: number;
}

export const ROUND_TICKS = 6;

export const PACE = BattleScale.toMetresPerTick(FOOT_SPEED); // of troops on foot
const SAMPLE = 11; // the way of a step is checked this often, under the contact gap: a charge ends at contact

const SWINGS = [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2]; // radians off the way a step tries, by the side it took last
const STRAIGHT = [0];
const ASKEW = 1; // radians off its way past which a step turns aside, not on

type Waters = Pick<Terrain, "water" | "shallow">;

const NO_WORKS: FieldWork[] = [];

// Ways round the water, the walls, the cliffs and the works that bar. Troops go straight while nothing but open dry ground lies
// ahead, so a field without them plays as it did; where they are in the way troops take the cheapest way over the grid.

interface Ways {
  rough: boolean; // the field has water, walls or cliffs at all
  wet: boolean; // it has water
  wagons: Side[]; // the sides holding wagons: the ways are rough for their foes
  staked: Side[]; // and holding stakes: rough for their foes' riders
  near: Uint8Array; // nodes by walls, cliffs and works that bar somebody
  shut: Uint8Array; // by walls and works: the steps they shut depend on the troops, those cliffs shut do not
  walls: Uint8Array; // within a front of walls

  costs: Map<string, Float32Array>; // what a kind of troops pays for a node, by the kind
  closed: Map<string, Uint16Array>; // the steps walls shut to a kind of troops
  reach: Map<number, { node: number; kind: string }>; // where a block's distances are measured from
  nodes: Map<string, number>; // the node a point by walls or works is on, for its side of them, by the kind and the point
  routes: Map<number, { target: number; made: number; points: [number, number][] }>;
  flight: Map<string, Reach>; // the ways off the field, by the kind and the side
  shared: Map<string, Reach>; // the ways to a point many go to, by the kind and the point
}

const OPEN_STEPS = new Uint16Array(COLS * ROWS); // no step is shut: never written to

// a node's cost from which it is water to wade through or to keep out of: over the worst dry going, 4.4 for riders in a soaked, frozen wood
const WET = 6;

const KEPT = 5; // nodes a block goes before the distances from where it was are found anew

/** The ground open to a side's troops this tick, and the edge nodes they get off by: shared while its foes stay as they are */
interface Exits {
  tick: number;
  out: Map<string, Uint8Array>; // the ground that leads off the field, by the kind
  ground: Map<Side, { foes: number[]; open: Uint8Array; edges: number[]; out: Map<Uint16Array, Uint8Array> }>;
}

const EDGES = Array.from({ length: COLS * ROWS }, (_, node) => node).filter(node => {
  const col = node % COLS;
  const row = (node - col) / COLS;
  return !col || !row || col === COLS - 1 || row === ROWS - 1;
});

// in battalion fronts
const CLEARANCE = 0.11; // gap blocks keep from each other
export const ARRIVED = 0.07; // how near a place or a turn of its way a block has come to it
const NEAR = 2.5; // within which blocks are worth measuring the gap to
const FURTHER = 1 + 1e-9; // a square of a distance so much larger is of a larger distance, whatever the rounding

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

const HELD_UP = 0.25; // a battalion that comes no further than this share of its leg is held up
const PATIENCE = ROUND_TICKS * 2; // ticks a battalion is held up by friends before it files through them

const ASIDE = [1.1, 1.6, 0.5, 0, -0.5, -1.1, -1.6]; // radians off the asker's way a friend giving way tries, its own side first
const SAME_WAY = 0.5; // cosine of the angle within which two go the same way

const NEAR_ENOUGH = 0.1; // in fronts beyond the clearance: a friend so near ahead is in the way

class MovementModule {
  private readonly shipPaces = new WeakMap<MilitaryUnit[], number | null>();
  private readonly ways = new WeakMap<Battlefield, Ways>();
  private readonly groundCosts = new WeakMap<Battlefield, Ways["costs"]>(); // the ground is the same whatever works rise or fall
  private readonly cliffSteps = new WeakMap<FieldCliff[], { length: number; steps: Uint16Array }>();
  private readonly wading = new WeakMap<Float32Array, boolean>();
  private readonly exits = new WeakMap<Battle, Exits>();
  private readonly discs = new WeakMap<
    Block,
    Pick<Block, "x" | "y" | "facing" | "width" | "depth"> & { discs: [number, number][] }
  >();
  private readonly traffic = new WeakMap<Battle, Traffic>();
  private readonly ownNodes = new WeakMap<Block, { tick: number; ways: Ways; x: number; y: number; node: number }>();

  /**
   * Move towards the point at the block's pace, around whoever stands in the way; false when hemmed in.
   * The whole way is checked: straight on, the step ends short of the first block or ground in the way
   */
  step(
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
    const pace = this.getStride(battle, block, heading, haste);
    const distance = Math.min(pace, limit);
    const wading = !this.isMoored(battle, block) && this.shuns(battle, block, block.x, block.y); // may wade out; a ship aground stays
    const ashore = wading && !this.isDeep(battle, block, block.x, block.y); // off a ford or a bridge, but not into the deep
    const inOrder = !this.isRunning(block); // those in order keep to the field
    // a step aside ends in the water only midstream, when the way ahead is water too
    const ahead: [number, number] = [block.x + Math.cos(heading) * distance, block.y + Math.sin(heading) * distance];
    const midstream = this.isWet(battle, block, block.x, block.y) && this.isWet(battle, block, ...ahead);

    const from: Point = [block.x, block.y];
    // only who can be in the way: from any further off every point of the step is clear (a metre to spare for rounding)
    const reach = NEAR * battle.field.front + distance + 1;
    const nearby = others.filter(other => Math.abs(other.x - from[0]) <= reach && Math.abs(other.y - from[1]) <= reach);
    const works = battle.field.works.length ? battle.field.works.filter(work => Works.bars(work, block)) : NO_WORKS;
    /** How far the block goes before its front meets works that bar it, or a wall it has no ladders up against */
    const short = (cos: number, sin: number): number => {
      const front = block.depth / 2;
      const to: Point = [from[0] + cos * (distance + front), from[1] + sin * (distance + front)];
      const bars = [...works, ...this.getBareWalls(battle, block, from, to)];
      const share = bars.length ? Battlefields.getCrossing(bars, from, to) : null;
      return share === null ? distance : Math.min(Math.max(share * (distance + front) - front - 0.5, 0), distance);
    };
    let friend = false; // a friend stands in the way straight on
    // on a wet field the water is checked node by node between the samples: no slipping through a diagonal chain
    const costs = !wading && this.getWays(battle).wet ? this.getCosts(battle, block) : null;
    const shunned = (node: number): boolean => costs![node] === Infinity;
    /** How far the way runs open, sampled along it up to its end */
    const walk = (angle: number, swing: number): number => {
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      const end = short(cos, sin);
      const samples = Math.max(Math.ceil(end / Math.min(SAMPLE, block.depth)), 1); // nor over a battalion thinner than a sample
      let open = 0;
      let last = from;
      for (let i = 1; i <= samples; i++) {
        const along = (end * i) / samples;
        const [x, y] = [from[0] + cos * along, from[1] + sin * along];
        const inWay = this.getInWay(battle, block, x, y, nearby);
        if (inWay) {
          if (!swing) friend = inWay.side === block.side;
          break;
        }
        if (
          costs
            ? !Pathfinding.isClear(COLS, ROWS, battle.field.cell, last, [x, y], shunned)
            : !wading && this.shuns(battle, block, x, y)
        )
          break;
        if (ashore && this.isDeep(battle, block, x, y)) break;
        if (inOrder && this.isOff(battle.field, x, y) && !this.isOff(battle.field, ...from)) break;
        last = [x, y];
        if (swing && !midstream && this.isWet(battle, block, x, y)) break;
        // nor by a gate when it turns off its way: it would only go back where it came from
        if (Math.abs(swing) > ASKEW && Battlefields.getWallsBetween(battle.field, from, [x, y]).length) break;
        if (this.isBarred(battle, block, from, [x, y]) || this.isLadderless(battle, block, from, [x, y])) break;
        open = along;
      }
      return open;
    };

    if (this.raiseLadders(battle, block, from, heading)) {
      [block.vx, block.vy] = [0, 0];
      return true;
    }

    // straight on, as far as it is open, to close up; then round what is in the way: by the side it took last, further and
    // further, but round a friend by the walls no further than askew: there it waits its turn rather than wander off
    const side = block.detour || 1;
    const byWalls =
      battle.field.walls.length > 0 && this.getWays(battle).walls[Battlefields.nodeAt(battle.field, ...from)] === 1;
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
      this.leaveLadders(battle, block, from);
      return true;
    }
    return false;
  }

  /** Metres the block covers in a tick the way it heads, on the ground and the slope where it stands */
  getStride(battle: Battle, block: Block, heading: number, haste = 1): number {
    const terrain = Battlefields.terrainAt(battle.field, block.x, block.y);
    const climb = this.isAfloat(battle, block, terrain)
      ? 1
      : this.getClimb(Battlefields.getSlope(battle.field, block.x, block.y, heading, this.isClimbing(battle, block)));
    const ditch = Works.isInDitch(battle, block, heading) ? FORDING : 1;
    return this.getPace(battle, block, terrain) * haste * this.getGoing(battle, block, terrain) * climb * ditch;
  }

  /** Share of its pace a block keeps on the ground: soaked ground slows all but fliers, open ground the most; frozen ground all */
  getGoing(battle: Battle, block: Block, terrain: Terrain): number {
    const ground = block.type !== "aviation";
    const mud = ground && battle.mud;
    const ice = ground && battle.ice ? ICE : 1;
    if (terrain.rampart === 3) return RUBBLE * ice;
    if (terrain.road) return 1.2 * (mud ? MUD.road : 1) * ice;
    if (terrain.water)
      return this.isAfloat(battle, block, terrain) ? 1 : terrain.ford || terrain.shallow ? FORDING : WADING;
    if (terrain.wood) return (block.type === "mounted" ? 0.4 : 0.65) * (mud ? MUD.cover : 1) * ice;
    if (terrain.marsh) return 0.5 * (mud ? MUD.cover : 1) * ice;
    const horse = block.type === "mounted" ? MUD.riders : 1; // hooves sink deeper than feet
    return (mud ? MUD.open * horse : 1) * ice;
  }

  /**
   * Share of its pace a block keeps on a slope: Tobler's hiking function cubed, 1.7 times the pace 3° downhill,
   * a third of it 6° uphill, a tenth from 12° uphill and 18° downhill
   */
  getClimb(slope: number): number {
    return Math.max(Math.exp(-10.5 * Math.abs(slope + 0.05) + 0.525), 0.1);
  }

  /**
   * How far a block shoots at a target, as a missile flies: further from above, shorter from below, not at all half its range up;
   * never further than it sees the target
   */
  getRange(battle: Battle, block: Block, target: Block): number {
    if (!block.range) return 0;
    const { field } = battle;
    const above =
      Battlefields.getElevation(field, block.x, block.y) - Battlefields.getElevation(field, target.x, target.y);
    const range = block.range * Math.sqrt(Math.max(1 + (2 * above) / block.range, 0));
    return Sight.isLimited(battle) ? Math.min(range, Sight.getSeenAt(battle, target)) : range; // nobody shoots at what he does not see
  }

  /** In range and not too close to load and aim */
  canShoot(battle: Battle, block: Block, target: Block): boolean {
    if (!block.range) return this.canThrow(battle, block, target);
    const distance = Math.hypot(target.x - block.x, target.y - block.y);
    // beyond the longest range there are no heights to read
    const longest = block.range * Math.sqrt(1 + (2 * (battle.field.relief + WALL_HEIGHT)) / block.range);
    if (distance > longest || distance > this.getRange(battle, block, target)) return false;
    return this.getGap(block, target)[0] >= (block.kind === "machinery" ? POINT_BLANK.engine : POINT_BLANK.shooter);
  }

  /**
   * Who holds a post on the walls with nothing to shoot throws stones and spears at foes below: so far from its front,
   * further from above, never further than it sees
   */
  private canThrow(battle: Battle, block: Block, target: Block): boolean {
    if (!this.holdsWall(battle, block)) return false;
    const { field } = battle;
    const above =
      Battlefields.getElevation(field, block.x, block.y) - Battlefields.getElevation(field, target.x, target.y);
    const reach = THROWN.reach * Math.sqrt(Math.max(1 + (2 * above) / THROWN.reach, 0));
    const seen = Sight.isLimited(battle) ? Sight.getSeenAt(battle, target) : Infinity;
    const gap = this.getGap(block, target)[0];
    return gap >= POINT_BLANK.shooter && gap <= Math.min(reach, seen);
  }

  /** A garrison battalion at its post on the walls */
  holdsWall(battle: Battle, block: Block): boolean {
    const { field } = battle;
    const { order } = block;
    if (block.side !== "defenders" || field.held === null || block.task || order.sent) return false;
    if (Math.hypot(order.x - block.x, order.y - block.y) >= ARRIVED * field.front) return false;
    return Battlefields.getWallPosts(field, field.held).some(spot => {
      const at = Battlefields.toPost(field, block, spot);
      return at !== null && Math.hypot(at[0] - order.x, at[1] - order.y) < 1;
    });
  }

  /** Ships carry the attackers of a landing to the shallows; from there they wade ashore */
  private isShipped(battle: Battle, block: Block, { water, shallow }: Waters): boolean {
    return battle.type === "landing" && block.side === "attackers" && water === 1 && !shallow;
  }

  /** Attackers of a landing still in their boats where they are: they fight nobody hand to hand */
  isAboard(battle: Battle, block: Block): boolean {
    return (
      battle.type === "landing" &&
      block.side === "attackers" &&
      this.isShipped(battle, block, Battlefields.terrainAt(battle.field, block.x, block.y))
    );
  }

  /** Water is no trouble for those who fly, sail or are shipped */
  private isAfloat(battle: Battle, block: Block, terrain: Waters): boolean {
    return block.type === "aviation" || block.type === "naval" || this.isShipped(battle, block, terrain);
  }

  /** Water under the feet of troops that neither fly, sail nor are shipped */
  isWet(battle: Battle, block: Block, x: number, y: number): boolean {
    const terrain = Battlefields.terrainAt(battle.field, x, y);
    return Boolean(terrain.water) && !this.isAfloat(battle, block, terrain);
  }

  /** Water troops in order never go into, whoever advances: out of a ford, off a bridge, beyond the shallows of a landing */
  isDeep(battle: Battle, block: Block, x: number, y: number): boolean {
    const terrain = Battlefields.terrainAt(battle.field, x, y);
    if (!terrain.water || terrain.ford || terrain.deck || this.isAfloat(battle, block, terrain)) return false;
    return !(terrain.shallow && battle.type === "landing");
  }

  /** Ships on the ground of a land battle: they keep to the water, on the run too */
  isMoored(battle: Battle, block: Block): boolean {
    return block.type === "naval" && !battle.field.open;
  }

  /** Water a ship sails: the sea, a lake, a river too deep to wade; not a ford or a brook */
  private isSailable(field: Battlefield, node: number): boolean {
    return field.water[node] > 0 && !Battlefields.isFordable(field, node);
  }

  /** Whether ships have water to keep to on the field */
  hasShipWater(field: Battlefield): boolean {
    return field.open !== null || field.water.some((_, node) => this.isSailable(field, node));
  }

  /**
   * Troops in order keep out of lakes, the sea and a river out of its fords, and out of the shallows but in a landing;
   * at a ford, a bridge and a beach a side that does not advance holds its bank
   */
  shuns(battle: Battle, block: Block, x: number, y: number): boolean {
    const terrain = Battlefields.terrainAt(battle.field, x, y);
    const { water, ford, deck } = terrain;
    if (this.isMoored(battle, block)) return !water || ford;
    if ((!water && !deck) || this.isRunning(block) || this.isAfloat(battle, block, terrain)) return false;
    const shallow = terrain.shallow && battle.type === "landing";
    return (!ford && !shallow && !deck) || !battle[block.side].advancing;
  }

  /** Metres a tick; all but the fliers go as fast as their ships on the open sea and when shipped */
  getPace(battle: Battle, block: Block, terrain?: Waters): number {
    const sailing = battle.field.open === "sea" || (terrain !== undefined && this.isShipped(battle, block, terrain));
    if (sailing && block.type !== "aviation" && block.type !== "naval")
      return this.getShipPace(battle.units) ?? block.speed;
    return block.speed;
  }

  /** Metres a tick of the ships that carry troops: the slowest naval unit of the map's, none when it has no ships */
  private getShipPace(units: MilitaryUnit[]): number | null {
    if (!this.shipPaces.has(units)) {
      const speeds = units.filter(unit => unit.type === "naval").map(unit => unit.speed);
      this.shipPaces.set(units, speeds.length ? BattleScale.toMetresPerTick(Math.min(...speeds)) : null);
    }
    return this.shipPaces.get(units)!;
  }

  /** Share of its strength a block has on the ground it stands on, in attack and in defence */
  getFooting(battle: Battle, block: Block, terrain: Terrain): number {
    if (terrain.rampart && terrain.rampart < 3 && this.isClimbing(battle, block))
      return terrain.rampart === 1 ? STORM_FOOTING.wall : STORM_FOOTING.gate;
    if (terrain.water)
      return this.isAfloat(battle, block, terrain) ? 1 : terrain.water === 1 && !terrain.shallow ? 0.25 : 0.5;
    if (block.type === "aviation") return 1;
    const slope = Math.max(1 - Battlefields.getGrade(battle.field, block.x, block.y), SLOPE_FOOTING);
    return (terrain.marsh ? 0.75 : 1) * slope * (battle.mud ? MUD.footing : 1);
  }

  /** A siege of a burg that has walls */
  hasWalls(battle: Battle): boolean {
    return battle.field.held !== null && battle.field.burgs[battle.field.held].walled;
  }

  /** The besiegers' engines in order that have the walls of the burg in range */
  getBatterers(battle: Battle): Block[] {
    const { field } = battle;
    if (!this.hasWalls(battle)) return [];
    const burg = field.burgs[field.held!];
    return battle.blocks.filter(
      block =>
        block.side === "attackers" &&
        block.status === "ready" &&
        block.type === "machinery" &&
        Battlefields.getEdgeGap(burg, [block.x, block.y]) <= Sight.getReach(battle, block, true) // the wall before it
    );
  }

  /** Besiegers go over the walls while they storm the burg or loot it */
  isStorming(battle: Battle): boolean {
    return (
      battle.field.held !== null && (battle.attackers.phase === "storming" || battle.attackers.phase === "looting")
    );
  }

  /** A besieger on its way over the walls or out of them: slowed at their foot and weak there */
  private isClimbing(battle: Battle, block: Block): boolean {
    return (
      battle.field.held !== null &&
      block.side === "attackers" &&
      this.canClimb(block) &&
      (this.isStorming(battle) || this.isRunning(block))
    );
  }

  /** Foot goes up ladders; riders and engines get in by the breaches only */
  canClimb(block: Block): boolean {
    return block.kind === "melee" || block.kind === "ranged";
  }

  private canCross(battle: Battle, block: Block, wall: FieldWall): boolean {
    if (block.type === "aviation") return true;
    if (wall.burg !== battle.field.held || block.side === "defenders") return wall.gate;
    // a gate is shut to the besiegers till their engines batter it down: a breach then
    return (this.isStorming(battle) || this.isRunning(block)) && !wall.gate && this.canClimb(block);
  }

  /** The ladders raised or being raised against a stretch of wall, by where the block meets it */
  private findLadders(battle: Battle, block: Block, { a, b }: FieldWall): FieldLadders | null {
    const [x, y] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const near = (ladders: FieldLadders): boolean =>
      Math.hypot(ladders.x - x, ladders.y - y) < Math.max(ladders.width, block.width) / 2;
    return battle.field.ladders.find(near) ?? null;
  }

  /** The stretches of wall between two points a stormer goes over only by ladders and has none up against */
  private getBareWalls(battle: Battle, block: Block, from: Point, to: Point): FieldWall[] {
    if (this.isRunning(block) || !this.isClimbing(battle, block)) return [];
    return Battlefields.getWallsBetween(battle.field, from, to).filter(
      wall => !wall.gate && !((this.findLadders(battle, block, wall)?.raised ?? 0) >= 1)
    );
  }

  /** A stormer goes over a wall only by ladders up: it raises them where its front meets the wall */
  private isLadderless(battle: Battle, block: Block, from: Point, to: Point): boolean {
    return this.getBareWalls(battle, block, from, to).length > 0;
  }

  /** Work the ladders at the wall the block's front is up against: true while they are not up yet and it stands */
  private raiseLadders(battle: Battle, block: Block, from: Point, heading: number): boolean {
    const reach = block.depth / 2 + 1;
    const [wall] = this.getBareWalls(battle, block, from, [
      from[0] + Math.cos(heading) * reach,
      from[1] + Math.sin(heading) * reach
    ]);
    if (!wall) return false;
    const found = this.findLadders(battle, block, wall);
    const ladders = found ?? {
      x: (wall.a[0] + wall.b[0]) / 2,
      y: (wall.a[1] + wall.b[1]) / 2,
      burg: wall.burg,
      width: block.width,
      raised: 0,
      tick: -1
    };
    if (!found) battle.field.ladders.push(ladders);
    if (ladders.tick !== battle.tick) {
      ladders.tick = battle.tick;
      ladders.raised = Math.min(ladders.raised + 1 / (LADDER_ROUNDS * ROUND_TICKS), 1);
    }
    return ladders.raised < 1;
  }

  /** Who goes over a wall on the run leaves ladders where none stood */
  private leaveLadders(battle: Battle, block: Block, from: Point): void {
    if (!this.isRunning(block) || !this.isClimbing(battle, block)) return;
    const wall = Battlefields.getWallsBetween(battle.field, from, [block.x, block.y]).find(wall => !wall.gate);
    if (!wall || this.findLadders(battle, block, wall)) return;
    const { a, b, burg } = wall;
    const [x, y] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    battle.field.ladders.push({ x, y, burg, width: block.width, raised: 1, tick: battle.tick });
  }

  /** A garrison in order holds its walls while they are stormed: it fights from them, not out of the gates */
  private isKeptIn(battle: Battle, block: Block, from: Point, to: Point): boolean {
    const { field } = battle;
    if (block.side !== "defenders" || !this.isStorming(battle) || this.isRunning(block)) return false;
    const within = ([x, y]: Point): boolean => Battlefields.terrainAt(field, x, y).walled === field.held! + 1;
    return within(from) && !within(to);
  }

  /** Whether a wall, a shut gate, a cliff or works of the foe stand between two points for the block */
  private isBarred(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
    const walls = Battlefields.getWallsBetween(battle.field, from, to);
    if (walls.length > 0 && walls.some(wall => !this.canCross(battle, block, wall))) return true;
    if (this.isKeptIn(battle, block, from, to)) return true;
    return this.isCliffed(battle, block, from, to) || Works.isBarredByWorks(battle, block, from, to);
  }

  /** Beyond the edge of the field: only those on the run go there */
  isOff(field: Battlefield, x: number, y: number): boolean {
    return x < 0 || y < 0 || x > field.width || y > field.height;
  }

  /** A cliff between two points: nobody but fliers crosses it */
  isCliffed(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
    return block.type !== "aviation" && Battlefields.getCliffsBetween(battle.field, from, to).length > 0;
  }

  /** The ground changed or the troops are drawn up anew; when only works did, what the ground costs is kept */
  forgetWays(field: Battlefield, works = false): void {
    this.ways.delete(field);
    if (!works) this.groundCosts.delete(field);
  }

  /** The turns of the way a block follows round water and walls, for diagnostics; none while it goes straight */
  getWay(battle: Battle, block: Block): [number, number][] {
    return this.ways.get(battle.field)?.routes.get(block.id)?.points ?? [];
  }

  private getWays(battle: Battle): Ways {
    let known = this.ways.get(battle.field);
    if (!known) {
      const { field } = battle;
      const barring = field.works.filter(work => Battlefields.isStanding(work) && work.kind !== "ditch");
      const holders = (kind: FieldWork["kind"]): Side[] => [
        ...new Set(barring.filter(work => work.kind === kind).map(work => work.side))
      ];
      known = {
        rough: Battlefields.isRoughField(field),
        wet: field.water.some(Boolean),
        wagons: holders("wagons"),
        staked: holders("stakes"),
        near: this.markStretches(field, [...field.walls, ...field.cliffs, ...barring]),
        shut: field.cliffs.length ? this.markStretches(field, [...field.walls, ...barring]) : new Uint8Array(0),
        walls: this.markStretches(field, field.walls, Math.ceil(field.front / field.cell)),
        costs: this.groundCosts.get(field) ?? new Map(),
        closed: new Map(),
        reach: new Map(),
        routes: new Map(),
        flight: new Map(),
        shared: new Map(),
        nodes: new Map()
      };
      this.ways.set(battle.field, known);
      this.groundCosts.set(battle.field, known.costs);
    }
    return known;
  }

  /** Nodes about the stretches, so many nodes out: the steps between them are the ones walls and works may shut */
  private markStretches(field: Battlefield, stretches: { a: Point; b: Point }[], reach = 1): Uint8Array {
    const near = new Uint8Array(COLS * ROWS);
    for (const { a, b } of stretches) {
      const samples = Math.max(Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (field.cell / 2)), 1);
      for (let i = 0; i <= samples; i++) {
        const node = Battlefields.nodeAt(
          field,
          a[0] + ((b[0] - a[0]) * i) / samples,
          a[1] + ((b[1] - a[1]) * i) / samples
        );
        const col = node % COLS;
        const row = (node - col) / COLS;
        for (let y = Math.max(row - reach, 0); y <= Math.min(row + reach, ROWS - 1); y++)
          for (let x = Math.max(col - reach, 0); x <= Math.min(col + reach, COLS - 1); x++) near[y * COLS + x] = 1;
      }
    }
    return near;
  }

  /** Whether the block needs ways over the grid: water, walls or cliffs anywhere, wagons of its foe, or its stakes when it rides */
  private isRough(battle: Battle, block: Block): boolean {
    const known = this.getWays(battle);
    if (known.rough) return true;
    const foe = (side: Side): boolean => side !== block.side;
    return known.wagons.some(foe) || (Works.isRider(block) && known.staked.some(foe));
  }

  /** All that the going, the water, the walls and the works mean differently for: the unit, its side, whether it runs, the battle, the mud */
  private getKind(battle: Battle, block: Block): string {
    return `${block.type}|${block.kind}|${block.side}|${this.isRunning(block)}|${battle.type}|${battle[block.side].advancing}|${this.isStorming(battle)}|${battle.field.breaches.length}|${battle.mud}`;
  }

  /** The steps from node to node that walls shut to the block: a bit a neighbour */
  private getClosed(battle: Battle, block: Block, kind = this.getKind(battle, block)): Uint16Array {
    const known = this.getWays(battle);
    let closed = known.closed.get(kind);
    if (!closed) {
      const { field } = battle;
      // cliffs shut the same steps to all but fliers; walls and works the steps by them, by who they bar
      if (field.cliffs.length && block.type !== "aviation") closed = this.getCliffSteps(field).slice();
      const marks = field.cliffs.length ? known.shut : known.near;
      const marked = (node: number): boolean => marks[node] === 1; // a wall or works by it
      const shut = (from: number, to: number, bit: number): void => {
        if (this.isBarred(battle, block, Battlefields.nodeCentre(field, from), Battlefields.nodeCentre(field, to))) {
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
            shut(node, next, Pathfinding.getStepBit(dx, dy));
            if (!marked(next)) shut(next, node, Pathfinding.getStepBit(-dx, -dy)); // the step back, once
          }
        }
      }
      closed ??= OPEN_STEPS;
      known.closed.set(kind, closed);
    }
    return closed;
  }

  /** The steps from node to node a field's cliffs shut, found once: they never change */
  private getCliffSteps(field: Battlefield): Uint16Array {
    const known = this.cliffSteps.get(field.cliffs);
    if (known?.length === field.cliffs.length) return known.steps;
    const steps = new Uint16Array(COLS * ROWS);
    const near = this.markStretches(field, field.cliffs);
    for (let node = 0; node < COLS * ROWS; node++) {
      if (!near[node]) continue;
      const col = node % COLS;
      const row = (node - col) / COLS;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [x, y] = [col + dx, row + dy];
          if ((!dx && !dy) || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          const next = y * COLS + x;
          if (
            !Battlefields.getCliffsBetween(
              field,
              Battlefields.nodeCentre(field, node),
              Battlefields.nodeCentre(field, next)
            ).length
          )
            continue;
          steps[node] |= Pathfinding.getStepBit(dx, dy);
          steps[next] |= Pathfinding.getStepBit(-dx, -dy);
        }
      }
    }
    this.cliffSteps.set(field.cliffs, { length: field.cliffs.length, steps });
    return steps;
  }

  /** What a node's width of the way costs the block, node by node: the slower the going the dearer, no way where it keeps out */
  private getCosts(battle: Battle, block: Block, kind = this.getKind(battle, block)): Float32Array {
    const known = this.getWays(battle);
    let costs = known.costs.get(kind);
    if (!costs) {
      costs = new Float32Array(COLS * ROWS);
      for (let node = 0; node < costs.length; node++) {
        const [x, y] = Battlefields.nodeCentre(battle.field, node);
        costs[node] = this.shuns(battle, block, x, y)
          ? Infinity
          : 1 / this.getGoing(battle, block, Battlefields.terrainAt(battle.field, x, y));
      }
      known.costs.set(kind, costs);
    }
    return costs;
  }

  /** Whether the block can walk straight from one point to another: no water to wet its feet, no wall in the way */
  private isDry(battle: Battle, block: Block, from: [number, number], to: [number, number]): boolean {
    if (!this.getWays(battle).wet) return !this.isBarred(battle, block, from, to); // nothing to wade through or keep out of
    const costs = this.getCosts(battle, block);
    if (
      this.isWading(costs) &&
      !Pathfinding.isClear(COLS, ROWS, battle.field.cell, from, to, node => costs[node] > WET)
    )
      return false;
    return !this.isBarred(battle, block, from, to);
  }

  /** Whether there is a node to wade through or keep out of at all */
  private isWading(costs: Float32Array): boolean {
    let wet = this.wading.get(costs);
    if (wet === undefined) {
      wet = costs.some(cost => cost > WET);
      this.wading.set(costs, wet);
    }
    return wet;
  }

  /**
   * The node the ways of the block start or end at for a point: the point's own, or by a wall or works the nearest one on
   * the point's side of them. A point a metre outside the wall may lie in a node whose middle is within it
   */
  private getNodeAt(battle: Battle, block: Block, x: number, y: number): number {
    const { field } = battle;
    const node = Battlefields.nodeAt(field, x, y);
    const known = this.getWays(battle);
    if (!known.near[node]) return node;
    const key = `${this.getKind(battle, block)}|${x}|${y}`; // walls and works stand as they did while the ways are kept
    const found = known.nodes.get(key);
    if (found !== undefined) return found;
    const col = node % COLS;
    const row = (node - col) / COLS;
    let best = node;
    let least = Infinity;
    for (let ny = Math.max(row - 1, 0); ny <= Math.min(row + 1, ROWS - 1); ny++) {
      for (let nx = Math.max(col - 1, 0); nx <= Math.min(col + 1, COLS - 1); nx++) {
        const near = ny * COLS + nx;
        const centre = Battlefields.nodeCentre(field, near);
        const distance = Math.hypot(centre[0] - x, centre[1] - y);
        if (distance < least && !this.isBarred(battle, block, [x, y], centre)) [best, least] = [near, distance];
      }
    }
    if (known.nodes.size >= 4096) known.nodes.clear(); // points of moves long made
    known.nodes.set(key, best);
    return best;
  }

  /** The node the block stands in for its ways, found once a tick while it stays put: works change only after the moves */
  private getOwnNode(battle: Battle, block: Block, known: Ways): number {
    const last = this.ownNodes.get(block);
    if (last?.tick === battle.tick && last.ways === known && last.x === block.x && last.y === block.y) return last.node;
    const node = this.getNodeAt(battle, block, block.x, block.y);
    this.ownNodes.set(block, { tick: battle.tick, ways: known, x: block.x, y: block.y, node });
    return node;
  }

  /** The node the block's distances are measured from: where it stood, kept while it stays within a few nodes of it */
  private getSource(battle: Battle, block: Block, kind: string): number {
    const known = this.getWays(battle);
    const node = this.getOwnNode(battle, block, known);
    const last = known.reach.get(block.id);
    const row = (at: number): number => Math.floor(at / COLS);
    const moved = last
      ? Math.max(Math.abs((last.node % COLS) - (node % COLS)), Math.abs(row(last.node) - row(node)))
      : Infinity;
    if (last && last.kind === kind && moved < KEPT) return last.node;
    known.reach.set(block.id, { node, kind });
    return node;
  }

  /** How far a foe is: as the block would walk, round the water or through it; straight when there is no way at all */
  getDistance(battle: Battle, block: Block, foe: Spot): number {
    const straight = Math.hypot(foe.x - block.x, foe.y - block.y);
    // besiegers pick their foes as the crow flies: the way over the walls is much the same to all of the garrison
    if (battle.field.held !== null && block.side === "attackers") return straight;
    if (!this.isRough(battle, block) || this.isDry(battle, block, [block.x, block.y], [foe.x, foe.y])) return straight;
    const kind = this.getKind(battle, block);
    const start = this.getSource(battle, block, kind);
    const end = this.getNodeAt(battle, block, foe.x, foe.y); // a foe may stand where the block does not go
    const costs = this.getCosts(battle, block, kind);
    const { goal, cost } = Pathfinding.findNearest(COLS, ROWS, start, end, costs, this.getClosed(battle, block, kind));
    return goal === null ? straight : Math.max(cost * battle.field.cell, straight);
  }

  /** The way for troops like the block from one point to the nearest node by another it can come to; null when there is none */
  private findNearestWay(battle: Battle, like: Block, from: Point, to: Point): number[] | null {
    const kind = this.getKind(battle, like);
    const [start, end] = [this.getNodeAt(battle, like, ...from), this.getNodeAt(battle, like, ...to)];
    const costs = this.getCosts(battle, like, kind);
    return Pathfinding.findNearestWay(COLS, ROWS, start, end, costs, this.getClosed(battle, like, kind));
  }

  /**
   * The shortest way from any of the battalions to a foe, as troops like the first would walk it round water, walls and
   * cliffs: one spread from the foes for all of them
   */
  getWalkGap(battle: Battle, own: Block[], foes: Block[]): number {
    const like = own[0];
    if (!like || !foes.length) return Infinity;
    const kind = this.getKind(battle, like);
    const sources = foes.map(foe => this.getNodeAt(battle, like, foe.x, foe.y));
    const reach = Pathfinding.spread(
      COLS,
      ROWS,
      sources,
      this.getCosts(battle, like, kind),
      this.getClosed(battle, like, kind),
      true
    );
    let least = Infinity;
    for (const block of own) least = Math.min(least, reach.costTo(this.getNodeAt(battle, like, block.x, block.y)));
    return least * battle.field.cell;
  }

  /** Where to step to come to the target: the target itself, or the next turn of the way round the water */
  getHeading(battle: Battle, block: Block, target: Spot, key: number): [number, number] {
    const known = this.getWays(battle);
    if (!this.isRough(battle, block)) return [target.x, target.y];
    let route = known.routes.get(block.id);
    // a foe moves, so the way to it is found anew every round; the way to a point of the field, five times as seldom
    const stale = route !== undefined && battle.tick - route.made >= (key < 0 ? ROUND_TICKS * 5 : ROUND_TICKS);
    if (!route || route.target !== key || stale) {
      route = { target: key, made: battle.tick, points: this.findWay(battle, block, target) };
      known.routes.set(block.id, route);
    }
    const here: [number, number] = [block.x, block.y];
    // a turn is done with once the block stands on it or can walk straight to the next one
    const reached = (): void => {
      const { points } = route!;
      while (
        points.length &&
        (Math.hypot(points[0][0] - block.x, points[0][1] - block.y) < ARRIVED * battle.field.front ||
          (points.length > 1 && this.isDry(battle, block, here, points[1])))
      )
        points.shift();
    };
    reached();
    // pushed off its way, with water now between it and the next turn: the way is found anew
    const [next] = route.points;
    if (
      next &&
      route.made !== battle.tick &&
      !this.isWet(battle, block, ...here) &&
      !this.isWet(battle, block, ...next)
    ) {
      if (!this.isDry(battle, block, here, next)) {
        route = { target: key, made: battle.tick, points: this.findWay(battle, block, target) };
        known.routes.set(block.id, route);
        reached();
      }
    }
    return route.points[0] ?? [target.x, target.y];
  }

  /**
   * The nodes of the way for troops like the block from one point to another, sought toward it first; when the point
   * cannot be come to, to the nearest node by it that can. Null when there is none
   */
  private seekWay(battle: Battle, like: Block, from: Point, to: Point): number[] | null {
    const kind = this.getKind(battle, like);
    const [start, end] = [this.getNodeAt(battle, like, ...from), this.getNodeAt(battle, like, ...to)];
    const costs = this.getCosts(battle, like, kind);
    const way = Pathfinding.findWay(COLS, ROWS, start, end, costs, this.getClosed(battle, like, kind));
    return way ?? this.findNearestWay(battle, like, from, to);
  }

  /** Where troops like the block would turn first on their way from one point to another: the goal itself over open ground */
  getTurn(battle: Battle, like: Block, from: Point, to: Point): Point {
    if (!this.isRough(battle, like) || this.isDry(battle, like, from, to)) return to;
    const way = this.findNearestWay(battle, like, from, to);
    if (!way) return to;
    const nodes = this.getWayNodes(battle, like, way, from);
    let next = 0;
    while (next + 1 < nodes.length && this.isDry(battle, like, from, nodes[next + 1])) next++;
    return nodes[next] ?? to;
  }

  /** The field as troops like the block would cross it to a node, found once for all of them and kept */
  private getSharedReach(battle: Battle, block: Block, goal: number): Reach {
    const known = this.getWays(battle);
    const kind = this.getKind(battle, block);
    const key = `${kind}|${goal}`;
    let reach = known.shared.get(key);
    if (!reach) {
      if (known.shared.size > 200) known.shared.clear(); // of walls and phases long gone
      reach = Pathfinding.spread(
        COLS,
        ROWS,
        [goal],
        this.getCosts(battle, block, kind),
        this.getClosed(battle, block, kind),
        true
      );
      known.shared.set(key, reach);
    }
    return reach;
  }

  /**
   * Where to step on the way to a point many go to, as stormers to the middle of a burg: the ways are found once from the
   * point for all troops of a kind, not from every battalion apart
   */
  getSharedHeading(battle: Battle, block: Block, to: Spot): Point {
    const here: Point = [block.x, block.y];
    if (!this.isRough(battle, block) || this.isDry(battle, block, here, [to.x, to.y])) return [to.x, to.y];
    const reach = this.getSharedReach(battle, block, Battlefields.nodeAt(battle.field, to.x, to.y));
    // down the way to the point, as far as the block can walk straight
    const start = this.getNodeAt(battle, block, block.x, block.y);
    if (reach.costTo(start) === Infinity) return [to.x, to.y];
    let next: Point = [to.x, to.y];
    for (let i = 0, node = start; i < 12 && reach.from[node] !== -1; i++) {
      node = reach.from[node];
      const turn = Battlefields.nodeCentre(battle.field, node);
      if (!this.isDry(battle, block, here, turn)) {
        if (i) break;
        if (battle.field.cliffs.length) {
          next = Battlefields.nodeCentre(battle.field, start); // round a cliff's corner by its own node first
          break;
        }
      }
      next = turn;
    }
    return next;
  }

  /** The turns of the way to the target; none when the block can walk straight to it or cannot come to it at all */
  private findWay(battle: Battle, block: Block, target: Spot): [number, number][] {
    if (this.isDry(battle, block, [block.x, block.y], [target.x, target.y])) return [];
    const way = this.seekWay(battle, block, [block.x, block.y], [target.x, target.y]);
    if (!way) return [];
    const nodes = this.getWayNodes(battle, block, way, [block.x, block.y]);

    // only the turns are kept: from each the block walks straight to the farthest node it can
    const turns: [number, number][] = [];
    let from: [number, number] = [block.x, block.y];
    for (let i = 0; i < nodes.length; ) {
      let next = i;
      while (next + 1 < nodes.length && this.isDry(battle, block, from, nodes[next + 1])) next++;
      turns.push(nodes[next]);
      from = nodes[next];
      i = next + 1;
    }
    return turns;
  }

  /**
   * The nodes of a way from a point to its goal. Its first node, the one the point stands in, is left out, but by a cliff
   * when the next cannot be walked to straight from the point: the way goes round the cliff's corner by it
   */
  private getWayNodes(battle: Battle, like: Block, way: number[], from: Point): Point[] {
    const nodes = way.map(node => Battlefields.nodeCentre(battle.field, node));
    const corner = battle.field.cliffs.length > 0 && nodes.length > 1 && !this.isDry(battle, like, from, nodes[1]);
    if (!corner) nodes.shift();
    return nodes;
  }

  /**
   * Whether a block can get off the field by any edge: round deep water and walls, past no foe in order.
   * The ground open to it is found once a tick for troops like it, from the edges in: it is out when it stands on it or
   * can step onto it
   */
  hasWayOut(battle: Battle, block: Block): boolean {
    if (block.type === "aviation" || this.isMoored(battle, block)) return true; // nothing on the ground bars fliers and ships
    const { field } = battle;
    let known = this.exits.get(battle);
    if (known?.tick !== battle.tick) {
      known = { tick: battle.tick, out: new Map(), ground: new Map() };
      this.exits.set(battle, known);
    }
    const kind = this.getKind(battle, block);
    const closed = this.getClosed(battle, block, kind);
    let out = known.out.get(kind);
    if (!out) {
      const ground = this.getOpenGround(battle, known, block.side);
      out = ground.out.get(closed);
      if (!out) {
        out = Pathfinding.flood(COLS, ROWS, ground.edges, ground.open, closed);
        ground.out.set(closed, out);
      }
      known.out.set(kind, out);
    }
    const node = Battlefields.nodeAt(field, block.x, block.y);
    if (out[node]) return true;
    const col = node % COLS;
    const row = (node - col) / COLS;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [x, y] = [col + dx, row + dy];
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS || closed[node] & Pathfinding.getStepBit(dx, dy)) continue;
        if (out[y * COLS + x]) return true;
      }
    }
    return false;
  }

  /** The ground a side's troops can enter: no deep water, nothing a foe in order stands on and holds */
  private getOpenGround(battle: Battle, known: Exits, side: Side) {
    const { field } = battle;
    const ready = battle.blocks.filter(foe => foe.side !== side && foe.status === "ready");
    const foes = ready.flatMap(foe => [foe.id, foe.x, foe.y, foe.width, foe.depth]);
    const last = known.ground.get(side);
    if (last && last.foes.length === foes.length && last.foes.every((value, i) => value === foes[i])) return last;

    const open = new Uint8Array(COLS * ROWS);
    for (let node = 0; node < open.length; node++) {
      const water = field.water[node];
      open[node] = water === 1 || (water === 2 && !Battlefields.isFordable(field, node) && !field.deck[node]) ? 0 : 1;
    }
    for (const foe of ready) {
      const reach = Math.max(foe.width, foe.depth) / 2 + CONTACT; // the ground it stands on and holds
      const [col, row] = [Math.floor(foe.x / field.cell), Math.floor(foe.y / field.cell)];
      const span = Math.ceil(reach / field.cell);
      for (let y = Math.max(row - span, 0); y <= Math.min(row + span, ROWS - 1); y++) {
        for (let x = Math.max(col - span, 0); x <= Math.min(col + span, COLS - 1); x++) {
          const [nx, ny] = Battlefields.nodeCentre(field, y * COLS + x);
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
  getFlight(battle: Battle, block: Block): number | null {
    const { field } = battle;
    const moored = this.isMoored(battle, block);
    if (!moored && !this.isRough(battle, block)) return null;
    const reach = moored ? this.getSailing(battle, block) : this.getFlightReach(battle, block);

    const node = this.getNodeAt(battle, block, block.x, block.y);
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
        if (!this.isBarred(battle, block, [block.x, block.y], Battlefields.nodeCentre(field, near))) best = near;
      }
    }
    if (best === node) return null;
    const [x, y] = Battlefields.nodeCentre(field, best);
    return Math.atan2(y - block.y, x - block.x);
  }

  /** Ships leave by water, off whichever edge of the field it reaches */
  isLandlocked(battle: Battle, block: Block): boolean {
    const reach = this.getSailing(battle, block);
    return !Number.isFinite(reach.cost[this.getNodeAt(battle, block, block.x, block.y)]);
  }

  private getSailing(battle: Battle, block: Block): Reach {
    const known = this.getWays(battle);
    const kind = `${this.getKind(battle, block)}|sail`;
    let reach = known.flight.get(kind);
    if (!reach) {
      const costs = this.getCosts(battle, block);
      const edge = EDGES.filter(node => Number.isFinite(costs[node]));
      reach = Pathfinding.spread(COLS, ROWS, edge, costs, this.getClosed(battle, block));
      known.flight.set(kind, reach);
    }
    return reach;
  }

  /** The ways to the edge of the field behind the block's side */
  private getFlightReach(battle: Battle, block: Block): Reach {
    const known = this.getWays(battle);
    const { field } = battle;
    const kind = this.getKind(battle, block);
    let reach = known.flight.get(kind);
    if (!reach) {
      const away = block.side === "attackers" ? battle.axis + Math.PI : battle.axis;
      const behind = (node: number): boolean => {
        const [x, y] = Battlefields.nodeCentre(field, node);
        return (x - field.width / 2) * Math.cos(away) + (y - field.height / 2) * Math.sin(away) > 0;
      };
      reach = Pathfinding.spread(
        COLS,
        ROWS,
        EDGES.filter(behind),
        this.getCosts(battle, block, kind),
        this.getClosed(battle, block, kind)
      );
      known.flight.set(kind, reach);
    }
    return reach;
  }

  /** Sides that water keeps apart get a crossing where it is narrowest for them: a ford on a river, shallows in a lake */
  openCrossing(battle: Battle, attackers: Point, defenders: Point): void {
    const { field } = battle;
    if (field.open || BattleRules.isFromSea(battle.type) || !field.water.some(Boolean)) return;
    const from = Battlefields.nodeAt(field, ...attackers);
    const to = Battlefields.nodeAt(field, ...defenders);
    const size = COLS * ROWS;
    const deep = (node: number): boolean => field.water[node] === 2 && !Battlefields.isFordable(field, node);
    const still = (node: number): boolean => field.water[node] === 1;
    const dry = Float32Array.from({ length: size }, (_, node) => (deep(node) || still(node) ? Infinity : 1));
    if (Pathfinding.spread(COLS, ROWS, [from], dry).cost[to] !== Infinity && dry[to] === 1) return;

    // the way with the least water on it; a river is easier forded than a lake
    const wet = Float32Array.from({ length: size }, (_, node) => (still(node) ? 60 : deep(node) ? 20 : 1));
    for (const node of Pathfinding.trace(Pathfinding.spread(COLS, ROWS, [from], wet), to)) {
      if (!deep(node) && !still(node)) continue;
      const col = node % COLS;
      const row = (node - col) / COLS;
      for (let y = Math.max(row - 1, 0); y <= Math.min(row + 1, ROWS - 1); y++) {
        for (let x = Math.max(col - 1, 0); x <= Math.min(col + 1, COLS - 1); x++) {
          const near = y * COLS + x;
          // on the ground drawn round the field too
          const grounds = battle.scene ? [field, battle.scene] : [field];
          const at = (ground: Battlefield): number =>
            ground === field ? near : Battlefields.toSceneNode(ground, near);
          if (deep(near)) for (const ground of grounds) ground.ford[at(ground)] = 1;
          else if (still(near))
            for (const ground of grounds) {
              ground.water[at(ground)] = 0;
              ground.marsh[at(ground)] = 1; // shallows: slow going and poor footing
            }
        }
      }
    }
  }

  /** A block as discs across its width: they keep blocks apart whatever way each faces */
  private getDiscs(block: Block, x = block.x, y = block.y): [number, number][] {
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
  private getLeastGap(a: Block, b: Block, x = a.x, y = a.y): number {
    return Math.hypot(b.x - x, b.y - y) - Math.max(a.width, a.depth) / 2 - Math.max(b.width, b.depth) / 2;
  }

  /** The discs of a block where it stands, kept till it moves, turns or changes its shape */
  private getStandingDiscs(block: Block): [number, number][] {
    const last = this.discs.get(block);
    const { x, y, facing, width, depth } = block;
    if (last && last.x === x && last.y === y && last.facing === facing && last.width === width && last.depth === depth)
      return last.discs;
    const made = this.getDiscs(block);
    this.discs.set(block, { x, y, facing, width, depth, discs: made });
    return made;
  }

  /** Space between two blocks, negative when they overlap, and the way from the first to the second there */
  getGap(
    a: Block,
    b: Block,
    discsA = this.getStandingDiscs(a),
    discsB = this.getStandingDiscs(b)
  ): [number, number, number] {
    const reach = (a.depth + b.depth) / 2;
    let least = Infinity;
    let dx = 0;
    let dy = 0;
    let distance = 1;
    let nearest = Infinity; // the square of the distance between the nearest discs so far
    for (const [ax, ay] of discsA) {
      for (const [bx, by] of discsB) {
        const x = bx - ax;
        const y = by - ay;
        const square = x * x + y * y;
        if (square > nearest * FURTHER) continue; // further for sure: no need of the exact distance
        const between = Math.hypot(x, y);
        if (between - reach < least) {
          least = between - reach;
          dx = x;
          dy = y;
          distance = between || 1;
          nearest = square;
        }
      }
    }
    if (!dx && !dy && least !== Infinity) {
      // on each other: apart across the facing of the lower id, the same way whichever is asked first
      const [low, sign] = a.id <= b.id ? [a, 1] : [b, -1];
      return [least, -Math.sin(low.facing) * sign, Math.cos(low.facing) * sign];
    }
    return [least, dx / distance, dy / distance];
  }

  /** Troops on the run are no obstacle and nobody holds them up */
  isRunning(block: Block): boolean {
    return block.status === "routed" || block.action === "flee";
  }

  private isNear(battle: Battle, a: Block, b: Block): boolean {
    const near = NEAR * battle.field.front;
    return Math.abs(a.x - b.x) < near && Math.abs(a.y - b.y) < near && a !== b;
  }

  /** Ships keep to the water of a land battle: hand to hand they fight only ships */
  canGrip(battle: Battle, a: Block, b: Block): boolean {
    return this.isMoored(battle, a) === this.isMoored(battle, b);
  }

  /** Close enough to fight, with no wall between that neither of them can cross, no cliff but for fliers, nor stakes against riders */
  inContact(battle: Battle, a: Block, b: Block): boolean {
    return (
      this.canGrip(battle, a, b) &&
      this.isNear(battle, a, b) &&
      this.getLeastGap(a, b) <= CONTACT &&
      this.getGap(a, b)[0] <= CONTACT &&
      !Battlefields.getWallsBetween(battle.field, [a.x, a.y], [b.x, b.y]).some(
        wall => !this.canCross(battle, a, wall) && !this.canCross(battle, b, wall)
      ) &&
      !(this.isCliffed(battle, a, [a.x, a.y], [b.x, b.y]) && this.isCliffed(battle, b, [a.x, a.y], [b.x, b.y])) &&
      !Works.isStaked(battle, a, b) &&
      !this.isAboard(battle, a) &&
      !this.isAboard(battle, b)
    );
  }

  /** The first of the others the block would stand on at the point */
  private getInWay(
    battle: Battle,
    block: Block,
    x: number,
    y: number,
    others: Block[],
    filing = this.isFiling(battle, block)
  ): Block | undefined {
    if (this.isRunning(block)) return undefined;
    const near = NEAR * battle.field.front;
    let discs: [number, number][] | null = null;
    const getOwnDiscs = (): [number, number][] => {
      discs ??= this.getDiscs(block, x, y);
      return discs;
    };
    let burgs: number[] | null = null;
    // friends packed within the walls it stands in or steps into are not in its way: or nobody would get out by a gate
    const packed = (other: Block): boolean => {
      const burg = Battlefields.terrainAt(battle.field, other.x, other.y).walled;
      if (!burg || other.side !== block.side) return false;
      burgs ??= [
        Battlefields.terrainAt(battle.field, x, y).walled,
        Battlefields.terrainAt(battle.field, block.x, block.y).walled
      ];
      return burgs.includes(burg);
    };
    return others.find(
      other =>
        Math.abs(other.x - x) <= near &&
        Math.abs(other.y - y) <= near &&
        other !== block &&
        !this.isRunning(other) &&
        !(filing && other.side === block.side) &&
        this.getLeastGap(block, other, x, y) < 1 &&
        !packed(other) &&
        this.getGap(block, other, getOwnDiscs())[0] < 1 &&
        !this.isWalledOff(battle.field, [x, y], [other.x, other.y])
    );
  }

  /** A stretch of wall, not a gate, or a cliff between two points: who stands on either side of it is not in the other's way */
  private isWalledOff(field: Battlefield, from: Point, to: Point): boolean {
    return (
      Battlefields.getWallsBetween(field, from, to).some(wall => !wall.gate) ||
      Battlefields.getCliffsBetween(field, from, to).length > 0
    );
  }

  /** Friends within the walls of one burg: packed in its streets, they keep no lines and do not stand in each other's way */
  private isPacked(battle: Battle, a: Block, b: Block): boolean {
    if (a.side !== b.side) return false;
    const burg = Battlefields.terrainAt(battle.field, a.x, a.y).walled;
    return burg > 0 && Battlefields.terrainAt(battle.field, b.x, b.y).walled === burg;
  }

  /** Push overlapping blocks apart; those in a fight give less ground */
  separate(battle: Battle, blocks: Block[]): void {
    const clearance = CLEARANCE * battle.field.front;
    const room = (a: Block, b: Block): number => (a.side === b.side ? clearance : Math.min(clearance, CONTACT * 0.9)); // foes within reach of a blow
    const near = NEAR * battle.field.front;
    // what pushing does not change: as `getLeastGap` and `isRunning` read it
    const radius = blocks.map(block => Math.max(block.width, block.depth) / 2);
    const running = blocks.map(block => this.isRunning(block));
    const filing = blocks.map(block => this.isFiling(battle, block));
    const bounded = battle.field.works.length > 0 || this.getWays(battle).rough; // something a push may not go over
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < blocks.length; i++) {
        const a = blocks[i];
        for (let j = i + 1; j < blocks.length; j++) {
          const b = blocks[j];
          if (!(Math.abs(a.x - b.x) < near && Math.abs(a.y - b.y) < near) || a === b) continue; // as `isNear`
          const [x, y] = [b.x - a.x, b.y - a.y];
          const apart = clearance + radius[i] + radius[j];
          if (x * x + y * y > apart * apart * FURTHER) continue; // as below, without the exact distance
          const keep = room(a, b);
          if (Math.hypot(x, y) - radius[i] - radius[j] >= keep) continue;
          if (running[i] || running[j] || this.isPacked(battle, a, b)) continue;
          if (a.side === b.side && (filing[i] || filing[j])) continue;
          const [gap, dx, dy] = this.getGap(a, b);
          if (gap >= keep || this.isWalledOff(battle.field, [a.x, a.y], [b.x, b.y])) continue;
          const heavyA = a.action === "fight" ? 3 : 1;
          const heavyB = b.action === "fight" ? 3 : 1;
          const push = keep - gap;
          // a block that may not be pushed so far leaves the push to the other
          let shareA = heavyB / (heavyA + heavyB);
          if (bounded) {
            const okA = this.canShift(battle, a, -dx * push * shareA, -dy * push * shareA);
            const okB = this.canShift(battle, b, dx * push * (1 - shareA), dy * push * (1 - shareA));
            if (!okA && !okB) continue;
            if (!okA || !okB) {
              shareA = okA ? 1 : 0;
              const [mover, sign] = okA ? [a, -1] : [b, 1];
              if (!this.canShift(battle, mover, sign * dx * push, sign * dy * push)) continue;
            }
          }
          a.x -= dx * push * shareA;
          a.y -= dy * push * shareA;
          b.x += dx * push * (1 - shareA);
          b.y += dy * push * (1 - shareA);
        }
      }
    }
  }

  /** Whether a push may move the block so far: over no wall, cliff or works that bar it, into no water it keeps out of */
  private canShift(battle: Battle, block: Block, dx: number, dy: number): boolean {
    const to: Point = [block.x + dx, block.y + dy];
    if (this.isBarred(battle, block, [block.x, block.y], to)) return false;
    if (this.isDeep(battle, block, ...to) && !this.isDeep(battle, block, block.x, block.y)) return false; // not off a ford
    return !this.shuns(battle, block, ...to) || this.shuns(battle, block, block.x, block.y);
  }

  /** What the last tick left to this one; nothing after a replay from the start */
  private getTraffic(battle: Battle): Traffic | undefined {
    const known = this.traffic.get(battle);
    return known?.tick === battle.tick - 1 ? known : undefined;
  }

  /** Keep out of the way of a friend: step aside when asked, else stand while it comes by; false when it goes its own way */
  giveWay(battle: Battle, block: Block, others: Block[]): boolean {
    const known = this.getTraffic(battle);
    if (!known) return false;
    const ask = known.asks.get(block.id);
    if (ask) {
      if (!this.yields(battle, known, block, ask)) return false;
      known.gave.set(block.id, { by: ask.by, heading: ask.heading, until: battle.tick + ROUND_TICKS });
      this.stepAside(battle, block, ask.from, ask.heading, others);
      return true;
    }
    const given = known.giving.get(block.id);
    if (!given || battle.tick > given.until || !known.heading.has(given.by)) return false;
    const asker = battle.blocks.find(other => other.id === given.by);
    if (asker?.status !== "ready" || !this.isNear(battle, block, asker)) return false;
    const ahead = (block.x - asker.x) * Math.cos(given.heading) + (block.y - asker.y) * Math.sin(given.heading);
    if (ahead <= 0) return false; // the asker is by
    known.gave.set(block.id, given);
    return true;
  }

  /** Whether the block gives way to the asker */
  private yields(battle: Battle, known: Traffic, block: Block, ask: Ask): boolean {
    const own = known.heading.get(block.id);
    if (own === undefined) return true; // it stands idle
    // both make for the same opening: who is nearer to it goes first
    const turn = known.turn.get(block.id)!;
    if (Math.hypot(turn[0] - ask.to[0], turn[1] - ask.to[1]) < battle.field.front)
      return (
        Math.hypot(block.x - turn[0], block.y - turn[1]) > Math.hypot(ask.from[0] - turn[0], ask.from[1] - turn[1])
      );
    if (Math.cos(own - ask.heading) > SAME_WAY) return false; // ahead in the same queue
    const since = known.since.get(block.id);
    return since === undefined || since > ask.since || (since === ask.since && block.id > ask.by);
  }

  /** Off the asker's way on the side the block stands, or on ahead of it, or off by the other side; never back at it */
  private stepAside(battle: Battle, block: Block, from: Point, heading: number, others: Block[]): void {
    const side = Math.cos(heading) * (block.y - from[1]) - Math.sin(heading) * (block.x - from[0]) < 0 ? -1 : 1;
    ASIDE.some(off => {
      const away = heading + off * side;
      return this.step(battle, block, Math.cos(away), Math.sin(away), Infinity, others, 1, STRAIGHT);
    });
  }

  /** Whether the block files through its friends this tick: they are not in its way, nor it in theirs */
  isFiling(battle: Battle, block: Block): boolean {
    return this.getTraffic(battle)?.filing.has(block.id) === true;
  }

  /** After the moves: who was held up, since when, which friend in its way it asks to give way and who files through */
  noteTraffic(battle: Battle, moves: Move[], others: Block[]): void {
    const last = this.getTraffic(battle);
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
    // who files through its friends does so till it stands clear, moving or not: or they would be thrown apart
    for (const block of last ? others : [])
      if (last!.filing.has(block.id) && this.getFriendUnder(battle, block, others)) known.filing.add(block.id);
    for (const { block, from, to, leg } of moves) {
      const heading = Math.atan2(to[1] - from[1], to[0] - from[0]);
      known.heading.set(block.id, heading);
      known.turn.set(block.id, to);
      const [cos, sin] = [Math.cos(heading), Math.sin(heading)];
      const stride = Math.min(leg, this.getStride(battle, { ...block, x: from[0], y: from[1] }, heading));
      if (stride < 1 || (block.x - from[0]) * cos + (block.y - from[1]) * sin >= stride * HELD_UP) continue;
      const since = last?.since.get(block.id) ?? battle.tick;
      known.since.set(block.id, since);
      if (this.isRough(battle, block) && !this.isDry(battle, block, [block.x, block.y], to)) continue; // water or a wall holds it, not a friend

      // the first friend it would walk into straight on
      const reach = stride + ahead;
      const samples = Math.max(Math.ceil(reach / SAMPLE), 1);
      let blocker: Block | undefined;
      for (let i = 1; i <= samples && !blocker; i++) {
        const along = (reach * i) / samples;
        blocker = this.getInWay(battle, block, block.x + cos * along, block.y + sin * along, others);
      }
      if (!blocker || blocker.side !== block.side) continue;
      if (battle.tick - since >= PATIENCE) known.filing.add(block.id);
      const asked = known.asks.get(blocker.id);
      if (asked && (asked.since < since || (asked.since === since && asked.by < block.id))) continue;
      known.asks.set(blocker.id, { by: block.id, since, from: [block.x, block.y], to, heading });
    }
    this.traffic.set(battle, known);
  }

  /** A friend the block stands on, when there is one */
  private getFriendUnder(battle: Battle, block: Block, others: Block[]): Block | undefined {
    return this.getInWay(
      battle,
      block,
      block.x,
      block.y,
      others.filter(other => other.side === block.side),
      false
    );
  }

  normalize(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  turn(from: number, to: number, limit: number): number {
    const diff = this.normalize(to - from);
    return from + Math.min(Math.max(diff, -limit), limit);
  }
}

export const Movement = new MovementModule();

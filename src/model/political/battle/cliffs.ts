// Cliffs: lines nobody on the ground crosses, where the map says the ground is broken. All their laying is here, on
// the grid alone. See docs/domain/battles.md#cliffs.

import type { Point } from "@/types/global";
import { COLS, ROWS } from "./battle-scale";
import type { FieldCliff } from "./battlefield";
import { flood, getStepBit } from "./pathfinding";

/** Cliffs are part of the ground; tests switch them off to compare with the field without them */
export const CLIFFS = { on: true };

const SEA_CLIFF_ROUGHNESS = 10; // metres of the field's roughness from which its coast is cliffed in stretches
const ESCARPMENT_ROUGHNESS = 15; // and its high ground is
const HEIGHT_SHARE = 0.5; // of the roughness, a cliff is so high
const [LOWEST, HIGHEST] = [6, 40]; // metres
const LEAST = 3; // metres: a lower step is a bank anybody walks over
const CLIFFED = 0.5; // beach noise over which a stretch of coast is cliff
const TOP = 0.58; // top noise over which the ground is high
const GAP: [number, number] = [0.25, 0.65]; // gap noise over which a cliff's height fades in, gently: no terraces
const PIECE = 2; // fronts: a shorter piece of cliff is none
const BEACH = 1.5; // fronts about the shore point nearest the field's middle that stay a beach
const GULLY = 2; // fronts across a gully cut through a cliff that closes ground off
const CLEAR = [0.5, 1.5]; // fronts from a road, a river, a burg or the sea over which a step fades in
const ROUNDS = 24; // of cutting short pieces and gullies before a field gives up its escarpments

type Noise = (x: number, y: number) => number;

/** What the cliffs are laid on: the grid and what the map draws on it */
export interface CliffGround {
  cell: number;
  front: number;
  water: number[]; // 1 sea or lake, 2 river
  open: Uint8Array; // nodes troops on foot can enter
  clearance: number[]; // metres from a node to the nearest road, river or burg: no cliff stands within a front of them
}

/** On a rugged coast, the shore cliffed in stretches between beaches; the beach nearest the middle stays */
export function laySeaCliffs(ground: CliffGround, roughness: number, beach: Noise): FieldCliff[] {
  if (!CLIFFS.on || roughness < SEA_CLIFF_ROUGHNESS) return [];
  const { water, front, clearance } = ground;
  const edges = traceEdges(node => water[node] !== 1, ground.cell);
  if (!edges.length) return [];
  const middle: Point = [(COLS * ground.cell) / 2, (ROWS * ground.cell) / 2];
  const nearest = edges.reduce((best, edge) => (distance(edge.mid, middle) < distance(best.mid, middle) ? edge : best));
  const keep = edges.map(
    edge =>
      edge.inner.every(node => !water[node]) &&
      beach(...edge.mid) > CLIFFED &&
      distance(edge.mid, nearest.mid) > BEACH * front &&
      edge.corners.every(node => clearance[node] > front)
  );
  const height = getHeight(roughness);
  return getPieces(edges, keep, PIECE * front).flatMap(piece => toCliffs(piece, () => height, ground.cell));
}

/** High ground with cliffs along its edges where the map is rugged: the cliffs, the ground on top and its step */
export interface Escarpments {
  cliffs: FieldCliff[];
  top: number[]; // 1 on the high ground
  step: number[]; // metres the high ground rises, a smooth field over all nodes: what the top adds where it is
}

/**
 * Escarpments of a rugged field: ground over a pattern of the place is high by a step that fades along its edge, a
 * cliff where it is higher than a bank, a slope elsewhere. Short pieces are cut down to banks, and so is a gully
 * through any cliff that closes ground off, so troops can go everywhere they could without cliffs. Null on a field
 * that is not rugged or whose cliffs could not be opened in time
 */
export function raiseEscarpments(
  ground: CliffGround,
  roughness: number,
  topNoise: Noise,
  gapNoise: Noise
): Escarpments | null {
  if (!CLIFFS.on || roughness < ESCARPMENT_ROUGHNESS) return null;
  const { water, cell, front, open, clearance } = ground;
  const centre = (node: number): Point => [((node % COLS) + 0.5) * cell, (Math.floor(node / COLS) + 0.5) * cell];
  const top = water.map((w, node) => +(w !== 1 && topNoise(...centre(node)) > TOP));
  if (!top.some(Boolean)) return null;

  const full = getHeight(roughness);
  const [near, far] = CLEAR.map(share => share * front);
  const shore = getDistances(node => water[node] === 1, cell);
  const step = water.map((_, node) => {
    const fade = smoothstep(near, far, clearance[node]) * smoothstep(near, far, shore[node]);
    return fade && full * smoothstep(GAP[0], GAP[1], gapNoise(...centre(node))) * fade;
  });
  /** The step faded to nothing about a point, smoothly over three nodes beyond the radius */
  const cut = (at: Point, radius: number): void => {
    const reach = radius + 3 * cell;
    const [c0, c1] = [Math.floor((at[0] - reach) / cell), Math.ceil((at[0] + reach) / cell)];
    const [r0, r1] = [Math.floor((at[1] - reach) / cell), Math.ceil((at[1] + reach) / cell)];
    for (let row = Math.max(r0, 0); row <= Math.min(r1, ROWS - 1); row++)
      for (let col = Math.max(c0, 0); col <= Math.min(c1, COLS - 1); col++) {
        const node = row * COLS + col;
        step[node] *= smoothstep(radius, reach, distance(at, centre(node)));
      }
  };

  const edges = traceEdges(node => top[node] === 1, cell);
  const whole = getParts(open); // the pieces of ground without cliffs: they stay one
  const heightOf = (edge: Edge): number => Math.min(...edge.inner.map(node => step[node]));
  for (let round = 0; round < ROUNDS; round++) {
    const keep = edges.map(edge => edge.corners.every(node => water[node] !== 1) && heightOf(edge) >= LEAST);
    const pieces = getPieces(edges, keep, 0);
    const short = pieces.filter(piece => getLength(piece) < PIECE * front);
    for (const piece of short) cut(piece[Math.floor(piece.length / 2)].mid, getLength(piece) / 2 + cell);
    if (short.length) continue;
    const gully = findGully(open, whole, pieces.flat(), heightOf);
    if (gully) {
      cut(gully, Math.max((GULLY * front) / 2, cell));
      continue;
    }
    return { cliffs: pieces.flatMap(piece => toCliffs(piece, heightOf, cell)), top, step };
  }
  return null;
}

const getHeight = (roughness: number): number => Math.min(Math.max(roughness * HEIGHT_SHARE, LOWEST), HIGHEST);

/** A side of a grid square between a node within and a node without, the one within on its left of `a` → `b` */
interface Edge {
  a: Point;
  b: Point;
  mid: Point;
  from: number; // keys of its ends: where pieces join
  to: number;
  corners: number[]; // of the square
  inner: number[]; // the corners within
  outer: number[]; // the corners on its other side: a step from one of them to another corner crosses it
}

// the corners of a grid square clockwise from the top left, and the sides between them: side k from corner k to k + 1
const CORNERS: Point[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1]
];
const SIDES: Point[] = [
  [1, 0], // the middles of the sides in half nodes from the corner
  [2, 1],
  [1, 2],
  [0, 1]
];

/**
 * The edge of the nodes `inside` marks, square by square (marching squares): through the middles of the sides between
 * a node within and one without. Where two within stand corner to corner they are joined
 */
export function traceEdges(inside: (node: number) => boolean, cell: number): Edge[] {
  const edges: Edge[] = [];
  for (let row = 0; row < ROWS - 1; row++) {
    for (let col = 0; col < COLS - 1; col++) {
      const corners = CORNERS.map(([dx, dy]) => (row + dy) * COLS + col + dx);
      const within = corners.map(inside);
      const count = within.filter(Boolean).length;
      if (!count || count === 4) continue;
      const crossed = [0, 1, 2, 3].filter(k => within[k] !== within[(k + 1) % 4]);
      // a corner without and the two sides by it; with one corner within, its two sides
      const pairs: [number, number][] =
        crossed.length === 4
          ? [0, 1, 2, 3].filter(k => !within[k]).map(k => [(k + 3) % 4, k])
          : [[crossed[0], crossed[1]]];
      for (const [s, t] of pairs) {
        const key = (side: number): number => (2 * row + SIDES[side][1]) * (2 * COLS + 1) + 2 * col + SIDES[side][0];
        const point = (side: number): Point => [
          (col + SIDES[side][0] / 2 + 0.5) * cell,
          (row + SIDES[side][1] / 2 + 0.5) * cell
        ];
        let [a, b, from, to] = [point(s), point(t), key(s), key(t)];
        const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const inner = corners.filter((_, k) => within[k]);
        const outer = crossed.length === 4 ? [corners[t]] : corners.filter((_, k) => !within[k]);
        const [nx, ny] = [((inner[0] % COLS) + 0.5) * cell, (Math.floor(inner[0] / COLS) + 0.5) * cell];
        // within on the left: the side ahead turned a quarter to the left, as works have their front
        const [ux, uy] = [b[0] - a[0], b[1] - a[1]];
        if ((nx - mid[0]) * uy - (ny - mid[1]) * ux < 0) [a, b, from, to] = [b, a, to, from];
        edges.push({ a, b, mid, from, to, corners, inner, outer });
      }
    }
  }
  return edges;
}

/** The edges kept, in pieces end to end along the edge they lie on; pieces shorter than so much are left out */
function getPieces(edges: Edge[], keep: boolean[], least: number): Edge[][] {
  const next = new Map(edges.map((edge, i) => [edge.from, i]));
  const ends = new Set(edges.map(edge => edge.to));
  const seen = new Uint8Array(edges.length);
  const lines: number[][] = [];
  const walk = (start: number): number[] => {
    const line: number[] = [];
    for (let i: number | undefined = start; i !== undefined && !seen[i]; i = next.get(edges[i].to)) {
      seen[i] = 1;
      line.push(i);
    }
    return line;
  };
  edges.forEach((edge, i) => {
    if (!ends.has(edge.from)) lines.push(walk(i)); // runs off the field
  });
  edges.forEach((_, i) => {
    if (!seen[i]) lines.push(walk(i)); // closed
  });

  const pieces: Edge[][] = [];
  for (const line of lines) {
    const runs: number[][] = [];
    let run: number[] = [];
    for (const i of line) {
      if (keep[i]) run.push(i);
      else if (run.length) [runs[runs.length], run] = [run, []];
    }
    if (run.length) runs.push(run);
    const closed = line.length > 1 && edges[line.at(-1)!].to === edges[line[0]].from;
    if (closed && runs.length > 1 && keep[line[0]] && keep[line.at(-1)!]) runs[0] = [...runs.pop()!, ...runs[0]];
    for (const indices of runs) {
      const piece = indices.map(i => edges[i]);
      if (getLength(piece) >= least) pieces.push(piece);
    }
  }
  return pieces;
}

const getLength = (piece: Edge[]): number => piece.reduce((sum, edge) => sum + distance(edge.a, edge.b), 0);

/**
 * Where to cut a gully: by the lowest stretch of cliff on the edge of ground the cliffs close off from ground it was
 * one with; null when they close nothing off
 */
function findGully(open: Uint8Array, whole: Int32Array, kept: Edge[], heightOf: (edge: Edge) => number): Point | null {
  if (!kept.length) return null;
  const closed = new Uint16Array(COLS * ROWS);
  for (const edge of kept) {
    for (const p of edge.outer) {
      for (const q of edge.corners) {
        if (edge.outer.includes(q)) continue;
        const [dx, dy] = [(q % COLS) - (p % COLS), Math.floor(q / COLS) - Math.floor(p / COLS)];
        closed[p] |= getStepBit(dx, dy);
        closed[q] |= getStepBit(-dx, -dy);
      }
    }
  }
  const parts = getParts(open, closed);
  // of the parts of one piece of ground, all but its largest are closed off
  const largest = new Map<number, number>();
  const sizes = new Map<number, number>();
  for (let node = 0; node < open.length; node++) {
    if (!open[node]) continue;
    sizes.set(parts[node], (sizes.get(parts[node]) ?? 0) + 1);
  }
  for (let node = 0; node < open.length; node++) {
    if (!open[node]) continue;
    const best = largest.get(whole[node]);
    if (best === undefined || sizes.get(parts[node])! > sizes.get(best)!) largest.set(whole[node], parts[node]);
  }
  const shut = (node: number): boolean => open[node] === 1 && largest.get(whole[node]) !== parts[node];
  let lowest: Edge | null = null;
  for (const edge of kept) {
    const [inside, outside] = [edge.corners.filter(shut), edge.corners.filter(node => !shut(node) && open[node])];
    if (!inside.length || !outside.length) continue;
    if (!lowest || heightOf(edge) < heightOf(lowest)) lowest = edge;
  }
  return lowest?.mid ?? null;
}

/** Each open node's part: the nodes it can come to, by the steps left open */
function getParts(open: Uint8Array, closed?: Uint16Array): Int32Array {
  const parts = new Int32Array(COLS * ROWS).fill(-1);
  for (let node = 0; node < parts.length; node++) {
    if (!open[node] || parts[node] >= 0) continue;
    const reached = flood(COLS, ROWS, [node], open, closed);
    for (let i = 0; i < reached.length; i++) if (reached[i]) parts[i] = node;
  }
  return parts;
}

/** Metres from each node to the nearest of the nodes marked, node by node: far off where none is */
export function getDistances(marked: (node: number) => boolean, cell: number): number[] {
  const reach = new Array<number>(COLS * ROWS).fill(Infinity);
  const queue: number[] = [];
  for (let node = 0; node < reach.length; node++) if (marked(node)) [reach[node], queue[queue.length]] = [0, node];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    const [col, row] = [node % COLS, Math.floor(node / COLS)];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [x, y] = [col + dx, row + dy];
        if ((!dx && !dy) || x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const near = y * COLS + x;
        const far = reach[node] + Math.hypot(dx, dy) * cell;
        if (far < reach[near]) [reach[near], queue[queue.length]] = [far, near];
      }
    }
  }
  return reach;
}

/** A piece as stretches of cliff; one that ends at the edge of the field runs on past it, so nobody slips round its end */
function toCliffs(piece: Edge[], heightOf: (edge: Edge) => number, cell: number): FieldCliff[] {
  const cliffs = piece.map(edge => ({ a: edge.a, b: edge.b, height: heightOf(edge) }));
  const [first, last] = [cliffs[0], cliffs.at(-1)!];
  first.a = beyond(first.a, cell);
  last.b = beyond(last.b, cell);
  return cliffs;
}

/** A point on the outermost nodes' middles moved out past the edge of the field; any other as it is */
function beyond([x, y]: Point, cell: number): Point {
  const out = (value: number, count: number): number =>
    value <= cell / 2 ? -cell : value >= (count - 0.5) * cell ? (count + 1) * cell : value;
  return [out(x, COLS), out(y, ROWS)];
}

const distance = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

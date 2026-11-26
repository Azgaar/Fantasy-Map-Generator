// Cliffs: lines nobody on the ground crosses, where the map says the ground is broken. All their laying is here, on
// the grid alone. See docs/domain/battles.md#cliffs.

import type { Point } from "@/types/global";
import type { FieldCliff } from "./battlefield";
import { Pathfinding } from "./pathfinding";

/** Cliffs are part of the ground; tests switch them off to compare with the field without them */
export const CLIFFS = { on: true };

const SEA_CLIFF_ROUGHNESS = 30; // metres of the field's roughness from which its coast is cliffed in stretches
const ESCARPMENT_ROUGHNESS = 50; // and its high ground is: a cell 500 m above or below a neighbour, mountain country
const HEIGHT_SHARE = 0.5; // of the roughness, a cliff is so high
const [LOWEST, HIGHEST] = [6, 40]; // metres
const CLIFFED = 0.5; // beach noise over which a stretch of coast is cliff
const TOP = 0.5; // of the land's rise, the ground over it is high: its edge runs along the hillsides
const STEEP = 0.12; // rise over run of the ground across an edge, 6.8°, from which it may be a cliff: where it falls anyway
const GAP = 0.4; // gap noise over which the hillside may be a cliff: pieces with ends, not one along every hill
const PIECE = 2; // fronts: a shorter piece of cliff is none
const LONGEST = 6; // fronts a cliff runs at most without a gap
const GAP_WIDTH = 1.5; // fronts across such a gap
const BEACH = 1.5; // fronts about the shore point nearest the field's middle that stay a beach
const GULLY = 2; // fronts across a gully cut through a cliff that closes ground off
const RAMP = 3; // fronts from a cliff over which the ground it raises or lowers comes back to its own lie
const TAPER = 1; // fronts from its ends over which a cliff comes down to nothing
const ROUNDS = 24; // of cutting gullies before a field gives up its escarpments

type Noise = (x: number, y: number) => number;

/** A grid of nodes so many metres apart */
export interface Grid {
  cols: number;
  rows: number;
  cell: number;
}

/** What the cliffs are laid on: the grid and what the map draws on it */
export interface CliffGround extends Grid {
  front: number;
  water: number[]; // 1 sea or lake, 2 river
  open: Uint8Array; // nodes troops on foot can enter
  clearance: number[]; // metres from a node to the nearest road, river or burg: no cliff stands within a front of them
  height: number[]; // metres of the ground at the nodes, of the land
}

/** Cliffs on the hillsides of a rugged field, and the ground about them: the cliffs, the side of each node and its step */
export interface Escarpments {
  cliffs: FieldCliff[];
  top: number[]; // 1 on the top side of the nearest cliff
  step: number[]; // metres the top side stands over the foot at the nearest cliff, fading off it: a smooth field
}

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
export const CORNERS: Point[] = [
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

class CliffsModule {
  /** Whether a field so rough may have cliffs at all */
  isRugged(roughness: number): boolean {
    return CLIFFS.on && roughness >= Math.min(SEA_CLIFF_ROUGHNESS, ESCARPMENT_ROUGHNESS);
  }

  /** On a rugged coast, the shore cliffed in stretches between beaches; the beach nearest the middle stays */
  laySeaCliffs(ground: CliffGround, roughness: number, beach: Noise): FieldCliff[] {
    if (!CLIFFS.on || roughness < SEA_CLIFF_ROUGHNESS) return [];
    const { water, front, clearance } = ground;
    const edges = this.traceEdges(node => water[node] !== 1, ground);
    if (!edges.length) return [];
    const middle: Point = [(ground.cols * ground.cell) / 2, (ground.rows * ground.cell) / 2];
    const nearest = edges.reduce((best, edge) =>
      this.distance(edge.mid, middle) < this.distance(best.mid, middle) ? edge : best
    );
    const keep = edges.map(
      edge =>
        edge.inner.every(node => !water[node]) &&
        beach(...edge.mid) > CLIFFED &&
        this.distance(edge.mid, nearest.mid) > BEACH * front &&
        edge.corners.every(node => clearance[node] > front)
    );
    const height = this.getHeight(roughness);
    return this.getPieces(edges, keep, 0)
      .flatMap(piece => this.splitLong(piece, LONGEST * front, GAP_WIDTH * front))
      .filter(piece => this.getLength(piece) >= PIECE * front)
      .flatMap(piece => this.toCliffs(piece, () => height, ground));
  }

  /**
   * Escarpments of a rugged field: cliffs where the hillside is steep at half the land's height, in pieces no shorter
   * than two fronts and no longer than six, with a gully cut into any that closes ground off, so troops can go everywhere
   * they could without cliffs. The ground about a cliff is raised on its top side and lowered at its foot by half its
   * height each, the less the further off and toward its ends: it jumps at the cliff alone. Null on a field that is not
   * rugged or whose cliffs could not be opened in time
   */
  raiseEscarpments(ground: CliffGround, roughness: number, gapNoise: Noise): Escarpments | null {
    if (!CLIFFS.on || roughness < ESCARPMENT_ROUGHNESS) return null;
    const { water, cell, front, open, clearance, height } = ground;
    const land = height.filter((_, node) => water[node] !== 1);
    if (!land.length) return null;
    const [low, high] = [Math.min(...land), Math.max(...land)];
    const level = low + (high - low) * TOP;
    const edges = this.traceEdges(node => water[node] !== 1 && height[node] > level, ground);
    // the ground falls across the edge steeply of itself: the cliff is the hillside at its steepest
    const mean = (nodes: number[]): number => nodes.reduce((sum, node) => sum + height[node], 0) / nodes.length;
    const fall = new Map(edges.map(edge => [edge, (mean(edge.inner) - mean(edge.outer)) / cell]));
    const keep = edges.map(
      edge =>
        fall.get(edge)! >= STEEP &&
        edge.corners.every(node => !water[node] && clearance[node] > front) &&
        gapNoise(...edge.mid) > GAP
    );

    const whole = this.getParts(ground, open); // the pieces of ground without cliffs: they stay one
    const gully = Math.max((GULLY * front) / 2, cell);
    for (let round = 0; round < ROUNDS; round++) {
      const runs = this.getPieces(edges, keep, 0).flatMap((piece, line) =>
        this.splitLong(piece, LONGEST * front, GAP_WIDTH * front).map(edges => ({ edges, line }))
      );
      const pieces = this.thin(
        runs.filter(run => this.getLength(run.edges) >= PIECE * front),
        2 * RAMP * front
      );
      // a gully where the hillside is gentlest
      const at = this.findGully(ground, open, whole, pieces.flat(), edge => fall.get(edge)!);
      if (!at)
        return {
          cliffs: pieces.flatMap(piece => this.toCliffs(piece, () => this.getHeight(roughness), ground)),
          ...this.raiseGround(ground, pieces, this.getHeight(roughness))
        };
      edges.forEach((edge, i) => {
        if (this.distance(edge.mid, at) <= gully) keep[i] = false;
      });
    }
    return null;
  }

  /**
   * The pieces, but none within so much of a longer one: the ground about a cliff is its own. Pieces of one line, cut
   * apart by gaps, meet only by their ends, where they come down to nothing
   */
  private thin(runs: { edges: Edge[]; line: number }[], apart: number): Edge[][] {
    const kept: typeof runs = [];
    for (const run of [...runs].sort((a, b) => this.getLength(b.edges) - this.getLength(a.edges))) {
      const near = (other: (typeof runs)[number]): boolean =>
        other.line !== run.line &&
        run.edges.some(edge => other.edges.some(by => this.distance(edge.mid, by.mid) < apart));
      if (!kept.some(near)) kept.push(run);
    }
    return kept.map(run => run.edges);
  }

  /**
   * The ground about the cliffs: the step a node stands by and its side. The step is the cliff's height, fading with the
   * distance from it and toward its ends, measured straight along its end stretches, so it is smooth everywhere but
   * across the cliff: the side flips there, and past its ends, where there is no step left
   */
  private raiseGround(ground: CliffGround, pieces: Edge[][], height: number): Omit<Escarpments, "cliffs"> {
    const { cols, rows, cell, front } = ground;
    const top = new Array<number>(cols * rows).fill(0);
    const step = new Array<number>(cols * rows).fill(0);
    const closest = new Array<number>(cols * rows).fill(Infinity);
    const [reach, taper] = [RAMP * front, TAPER * front];
    for (const piece of pieces) {
      const spans = piece.map(({ a, b }) => this.distance(a, b) || 1);
      const ways = piece.map(({ a, b }, k): Point => [(b[0] - a[0]) / spans[k], (b[1] - a[1]) / spans[k]]);
      const left = (k: number): Point => [ways[k][1], -ways[k][0]]; // toward the top side
      const [first, last] = [piece[0].a, piece.at(-1)!.b];
      const [into, out] = [ways[0], ways.at(-1)!];
      // a cliff that runs off the field does not end there
      const [start, end] = [!this.isOnEdge(first, ground), !this.isOnEdge(last, ground)];
      const xs = piece.flatMap(({ a, b }) => [a[0], b[0]]);
      const ys = piece.flatMap(({ a, b }) => [a[1], b[1]]);
      const [c0, c1] = [Math.floor((Math.min(...xs) - reach) / cell), Math.ceil((Math.max(...xs) + reach) / cell)];
      const [r0, r1] = [Math.floor((Math.min(...ys) - reach) / cell), Math.ceil((Math.max(...ys) + reach) / cell)];
      for (let row = Math.max(r0, 0); row <= Math.min(r1, rows - 1); row++) {
        for (let col = Math.max(c0, 0); col <= Math.min(c1, cols - 1); col++) {
          const node = row * cols + col;
          const p: Point = [(col + 0.5) * cell, (row + 0.5) * cell];
          const ends =
            (start ? this.smoothstep(0, taper, (p[0] - first[0]) * into[0] + (p[1] - first[1]) * into[1]) : 1) *
            (end ? this.smoothstep(0, taper, (last[0] - p[0]) * out[0] + (last[1] - p[1]) * out[1]) : 1);
          // the nearest point of the cliff, and its side there: at a joint, by both stretches by it
          let [least, side] = [Infinity, 0];
          piece.forEach(({ a }, k) => {
            const t = (p[0] - a[0]) * ways[k][0] + (p[1] - a[1]) * ways[k][1];
            const at = Math.min(Math.max(t, 0), spans[k]);
            const foot: Point = [a[0] + ways[k][0] * at, a[1] + ways[k][1] * at];
            const off = this.distance(p, foot);
            if (off >= least) return;
            const joint = t <= 0 ? Math.max(k - 1, 0) : t >= spans[k] ? Math.min(k + 1, piece.length - 1) : k;
            const [nx, ny] = [left(k)[0] + left(joint)[0], left(k)[1] + left(joint)[1]];
            [least, side] = [off, (p[0] - foot[0]) * nx + (p[1] - foot[1]) * ny];
          });
          if (least >= reach) continue;
          // the cliff that raises the node most, or the nearest where none does: a node by it has its side even with no step
          const raised = height * ends * (1 - this.smoothstep(0, reach, least));
          if (raised < step[node] || (raised === step[node] && least >= closest[node])) continue;
          [step[node], closest[node], top[node]] = [raised, least, +(side > 0)];
        }
      }
    }
    return { top, step };
  }

  private getHeight(roughness: number): number {
    return Math.min(Math.max(roughness * HEIGHT_SHARE, LOWEST), HIGHEST);
  }

  /**
   * The edge of the nodes `inside` marks, square by square (marching squares): through the middles of the sides between
   * a node within and one without. Where two within stand corner to corner they are joined
   */
  traceEdges(inside: (node: number) => boolean, { cols, rows, cell }: Grid): Edge[] {
    const edges: Edge[] = [];
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const corners = CORNERS.map(([dx, dy]) => (row + dy) * cols + col + dx);
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
          const key = (side: number): number => (2 * row + SIDES[side][1]) * (2 * cols + 1) + 2 * col + SIDES[side][0];
          const point = (side: number): Point => [
            (col + SIDES[side][0] / 2 + 0.5) * cell,
            (row + SIDES[side][1] / 2 + 0.5) * cell
          ];
          let [a, b, from, to] = [point(s), point(t), key(s), key(t)];
          const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const inner = corners.filter((_, k) => within[k]);
          const outer = crossed.length === 4 ? [corners[t]] : corners.filter((_, k) => !within[k]);
          const [nx, ny] = [((inner[0] % cols) + 0.5) * cell, (Math.floor(inner[0] / cols) + 0.5) * cell];
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
  private getPieces(edges: Edge[], keep: boolean[], least: number): Edge[][] {
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
        if (this.getLength(piece) >= least) pieces.push(piece);
      }
    }
    return pieces;
  }

  private getLength(piece: Edge[]): number {
    return piece.reduce((sum, edge) => sum + this.distance(edge.a, edge.b), 0);
  }

  /** A piece cut into runs no longer than so much, with a gap of so much between them */
  private splitLong(piece: Edge[], longest: number, gap: number): Edge[][] {
    if (this.getLength(piece) <= longest) return [piece];
    const runs: Edge[][] = [[]];
    let [walked, skipped] = [0, 0];
    for (const edge of piece) {
      const length = this.distance(edge.a, edge.b);
      if (!skipped && walked + length <= longest) {
        runs.at(-1)!.push(edge);
        walked += length;
      } else {
        skipped += length;
        if (skipped < gap) continue;
        [walked, skipped] = [0, 0];
        runs.push([]);
      }
    }
    return runs.filter(run => run.length);
  }

  /**
   * Where to cut a gully: by the stretch of cliff ranked lowest on the edge of ground the cliffs close off from ground it
   * was one with; null when they close nothing off
   */
  private findGully(
    grid: Grid,
    open: Uint8Array,
    whole: Int32Array,
    kept: Edge[],
    rank: (edge: Edge) => number
  ): Point | null {
    if (!kept.length) return null;
    const { cols } = grid;
    const closed = new Uint16Array(open.length);
    for (const edge of kept) {
      for (const p of edge.outer) {
        for (const q of edge.corners) {
          if (edge.outer.includes(q)) continue;
          const [dx, dy] = [(q % cols) - (p % cols), Math.floor(q / cols) - Math.floor(p / cols)];
          closed[p] |= Pathfinding.getStepBit(dx, dy);
          closed[q] |= Pathfinding.getStepBit(-dx, -dy);
        }
      }
    }
    const parts = this.getParts(grid, open, closed);
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
      if (!lowest || rank(edge) < rank(lowest)) lowest = edge;
    }
    return lowest?.mid ?? null;
  }

  /** Each open node's part: the nodes it can come to, by the steps left open */
  private getParts({ cols, rows }: Grid, open: Uint8Array, closed?: Uint16Array): Int32Array {
    const parts = new Int32Array(cols * rows).fill(-1);
    for (let node = 0; node < parts.length; node++) {
      if (!open[node] || parts[node] >= 0) continue;
      const reached = Pathfinding.flood(cols, rows, [node], open, closed);
      for (let i = 0; i < reached.length; i++) if (reached[i]) parts[i] = node;
    }
    return parts;
  }

  /** Metres from each node to the nearest of the nodes marked, node by node: far off where none is */
  getDistances(marked: (node: number) => boolean, { cols, rows, cell }: Grid): number[] {
    const reach = new Array<number>(cols * rows).fill(Infinity);
    const queue: number[] = [];
    for (let node = 0; node < reach.length; node++) if (marked(node)) [reach[node], queue[queue.length]] = [0, node];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      const [col, row] = [node % cols, Math.floor(node / cols)];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const [x, y] = [col + dx, row + dy];
          if ((!dx && !dy) || x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const near = y * cols + x;
          const far = reach[node] + Math.hypot(dx, dy) * cell;
          if (far < reach[near]) [reach[near], queue[queue.length]] = [far, near];
        }
      }
    }
    return reach;
  }

  /** A piece as stretches of cliff; one that ends at the edge of the field runs on past it, so nobody slips round its end */
  private toCliffs(piece: Edge[], heightOf: (edge: Edge) => number, grid: Grid): FieldCliff[] {
    const cliffs = piece.map(edge => ({ a: edge.a, b: edge.b, height: heightOf(edge) }));
    const [first, last] = [cliffs[0], cliffs.at(-1)!];
    first.a = this.beyond(first.a, grid);
    last.b = this.beyond(last.b, grid);
    return cliffs;
  }

  /** A point on the outermost nodes' middles: where a line traced over the grid runs off the field */
  private isOnEdge(point: Point, grid: Grid): boolean {
    return this.beyond(point, grid).some((value, i) => value !== point[i]);
  }

  /** A point on the outermost nodes' middles moved out past the edge of the field; any other as it is */
  private beyond([x, y]: Point, { cols, rows, cell }: Grid): Point {
    const out = (value: number, count: number): number =>
      value <= cell / 2 ? -cell : value >= (count - 0.5) * cell ? (count + 1) * cell : value;
    return [out(x, cols), out(y, rows)];
  }

  private distance(a: Point, b: Point): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  }

  private smoothstep(from: number, to: number, value: number): number {
    const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
    return t * t * (3 - 2 * t);
  }
}

export const Cliffs = new CliffsModule();

import { describe, expect, it } from "vitest";
import type { Point } from "@/types/global";
import { COLS, ROWS } from "./battle-scale";
import { Battlefields, type FieldCliff } from "./battlefield";
import { type CliffGround, Cliffs, type Escarpments } from "./cliffs";

const CELL = 10;
const FRONT = 40;
const centre = (node: number): Point => [((node % COLS) + 0.5) * CELL, (Math.floor(node / COLS) + 0.5) * CELL];
const inBox = (node: number, [c0, r0, c1, r1]: number[]): boolean => {
  const [col, row] = [node % COLS, Math.floor(node / COLS)];
  return col >= c0 && col < c1 && row >= r0 && row < r1;
};

/** A field of open land, with the sea where `sea` says */
function ground(
  sea: (node: number) => boolean = () => false,
  clear: (point: Point) => number = () => Infinity
): CliffGround {
  const water = Array.from({ length: COLS * ROWS }, (_, node) => (sea(node) ? 1 : 0));
  const clearance = water.map((_, node) => clear(centre(node)));
  const height = water.map(() => 0);
  return {
    cols: COLS,
    rows: ROWS,
    cell: CELL,
    front: FRONT,
    water,
    open: Uint8Array.from(water, w => +!w),
    clearance,
    height
  };
}

/** Escarpments of a field whose land is 100 m higher where `high` says, its edge a sheer drop */
const escarp = (field: CliffGround, high: (node: number) => boolean) => {
  field.height = field.height.map((_, node) => (high(node) ? 100 : 0));
  return Cliffs.raiseEscarpments(field, 60, () => 1);
};

/**
 * Borders of nodes the ground jumps at with no cliff between them: where the side changes, by the step about the border.
 * The ground is smooth but across a cliff
 */
function getJumps({ cliffs, top, step }: Escarpments): number[][] {
  const field = { ...Battlefields.createEmpty(), cell: CELL, cliffs };
  const jumps: number[][] = [];
  for (let node = 0; node < COLS * ROWS; node++) {
    for (const next of [node % COLS < COLS - 1 ? node + 1 : -1, node + COLS < COLS * ROWS ? node + COLS : -1]) {
      if (next < 0 || top[node] === top[next]) continue;
      const jump = (step[node] + step[next]) / 2;
      if (jump > 1 && !Battlefields.getCliffsBetween(field, centre(node), centre(next)).length)
        jumps.push([node, next, jump]);
    }
  }
  return jumps;
}

/** The pieces of cliff, as laid end to end */
function getPieces(cliffs: FieldCliff[]): FieldCliff[][] {
  const pieces: FieldCliff[][] = [];
  for (const cliff of cliffs) {
    const last = pieces.at(-1)?.at(-1);
    if (last && last.b[0] === cliff.a[0] && last.b[1] === cliff.a[1]) pieces.at(-1)!.push(cliff);
    else pieces.push([cliff]);
  }
  return pieces;
}

const crosses = (a: Point, b: Point, c: Point, d: Point): boolean => {
  const side = (p: Point, q: Point, r: Point): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

/** The open nodes troops can come to from a node without crossing a cliff */
function reach(open: Uint8Array, cliffs: FieldCliff[], start: number): Set<number> {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const node = queue.pop()!;
    const [col, row] = [node % COLS, Math.floor(node / COLS)];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const [x, y] = [col + dx, row + dy];
        if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
        const next = y * COLS + x;
        if (seen.has(next) || !open[next]) continue;
        if (cliffs.some(cliff => crosses(centre(node), centre(next), cliff.a, cliff.b))) continue;
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

const length = (cliffs: { a: Point; b: Point }[]): number =>
  cliffs.reduce((sum, { a, b }) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);

describe("cliffs", () => {
  it("traces the edge of a block of nodes all round, the block on the left of every stretch", () => {
    const box = [20, 10, 30, 25];
    const edges = Cliffs.traceEdges(node => inBox(node, box), { cols: COLS, rows: ROWS, cell: CELL });
    expect(length(edges)).toBeCloseTo(2 * (10 + 15) * CELL - 4 * (2 - Math.SQRT2) * (CELL / 2), 5); // corners cut
    for (const edge of edges) {
      const [ux, uy] = [edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]];
      const left: Point = [edge.mid[0] + uy, edge.mid[1] - ux]; // the side ahead turned a quarter to the left
      const [col, row] = [Math.floor(left[0] / CELL - 0.5 + 0.5), Math.floor(left[1] / CELL - 0.5 + 0.5)];
      expect(inBox(row * COLS + col, box)).toBe(true);
    }
    // one closed line: every stretch begins where another ends
    const ends = new Set(edges.map(edge => edge.to));
    expect(edges.every(edge => ends.has(edge.from))).toBe(true);
  });

  it("cliffs a rugged coast in stretches and keeps the shore nearest the middle a beach", () => {
    const sea = (node: number): boolean => Math.floor(node / COLS) < 20; // the sea in the north
    const cliffs = Cliffs.laySeaCliffs(ground(sea), 40, () => 1);
    expect(cliffs.length).toBeGreaterThan(0);
    for (const cliff of cliffs) expect(cliff.a[1]).toBeCloseTo(20 * CELL); // on the shore, between the rows
    const middle = (COLS * CELL) / 2;
    const atMiddle = cliffs.filter(({ a, b }) => Math.abs((a[0] + b[0]) / 2 - middle) < 1.5 * FRONT);
    expect(atMiddle).toEqual([]);
    expect(length(cliffs)).toBeGreaterThan(((COLS - 1) * CELL - 3 * FRONT) * 0.7); // all but the beach and gaps
    for (const piece of getPieces(cliffs)) expect(length(piece)).toBeLessThanOrEqual(6 * FRONT + 2 * CELL); // and its run past the edge
    expect(Cliffs.laySeaCliffs(ground(sea), 5, () => 1)).toEqual([]); // a gentle coast has none
    expect(Cliffs.laySeaCliffs(ground(sea), 40, () => 0)).toEqual([]); // nor a coast all beaches
  });

  it("leaves no cliff by a road", () => {
    const sea = (node: number): boolean => Math.floor(node / COLS) < 20;
    const road = 200; // a road coming down to the shore at x = 200
    const cliffs = Cliffs.laySeaCliffs(
      ground(sea, ([x]: Point) => Math.abs(x - road)),
      40,
      () => 1
    );
    expect(cliffs.some(({ a, b }) => Math.abs((a[0] + b[0]) / 2 - road) < FRONT)).toBe(false);
  });

  it("cliffs the steep edge of a plateau in pieces, its top side raised, and cuts a gully where they close it all round", () => {
    const box = [30, 15, 60, 40];
    const field = ground();
    const scarps = escarp(field, node => inBox(node, box))!;
    expect(scarps).not.toBeNull();
    // the top side of every cliff is the plateau's, and the step at a cliff is up to half the roughness
    expect(scarps.top.every((top, node) => !top || scarps.step[node] < 0.5 || inBox(node, box))).toBe(true);
    expect(getJumps(scarps)).toEqual([]);
    expect(Math.max(...scarps.step)).toBeGreaterThan(20);
    expect(Math.max(...scarps.step)).toBeLessThanOrEqual(30);
    expect(length(scarps.cliffs)).toBeGreaterThan(50 * CELL); // much of the way round
    expect(length(scarps.cliffs)).toBeLessThan(100 * CELL); // but for the gaps
    for (const cliff of scarps.cliffs) expect(cliff.height).toBeGreaterThanOrEqual(3);
    for (const piece of getPieces(scarps.cliffs)) expect(length(piece)).toBeLessThanOrEqual(6 * FRONT + 2 * CELL); // and its run past the edge
    // the plateau is reached from the plain
    const inside = 27 * COLS + 45;
    expect(reach(field.open, scarps.cliffs, 0).has(inside)).toBe(true);
  });

  it("opens every piece of ground a ring of cliffs would close off, a hollow within a plateau too", () => {
    const outer = [20, 10, 70, 50];
    const hollow = [35, 22, 55, 38];
    const high = (node: number): boolean => inBox(node, outer) && !inBox(node, hollow);
    const field = ground();
    const scarps = escarp(field, high)!;
    const reached = reach(field.open, scarps.cliffs, 0);
    expect(reached.size).toBe(COLS * ROWS);
  });

  it("has no cliff by a road, nor one shorter than two fronts", () => {
    const field = ground(undefined, ([x]: Point) => Math.abs(x - 450));
    const box = [30, 15, 60, 40];
    const knoll = [10, 50, 12, 52]; // too small for a cliff
    const high = (node: number): boolean => inBox(node, box) || inBox(node, knoll);
    const scarps = escarp(field, high)!;
    expect(scarps.cliffs.some(({ a, b }) => Math.abs((a[0] + b[0]) / 2 - 450) < FRONT)).toBe(false);
    expect(scarps.cliffs.some(({ a }) => a[0] < 15 * CELL)).toBe(false);
  });

  it("finds every stretch a way crosses, short or long, on the field or off it, through a node's corner too", () => {
    const field = Battlefields.createEmpty();
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const { cell } = field;
    const point = (): Point => {
      const corner = random() < 0.2; // on a node's corner exactly
      const [x, y] = [random() * (COLS + 4) - 2, random() * (ROWS + 4) - 2];
      return corner ? [Math.round(x) * cell, Math.round(y) * cell] : [x * cell, y * cell];
    };
    field.cliffs = Array.from({ length: 300 }, () => {
      const a = point();
      const length = random() < 0.8 ? cell * 2 : cell * 40;
      const angle = random() * Math.PI * 2;
      return { a, b: [a[0] + Math.cos(angle) * length, a[1] + Math.sin(angle) * length] as Point, height: 10 };
    });
    for (let i = 0; i < 2000; i++) {
      const from = point();
      const reach = random() < 0.5 ? cell * 3 : cell * 120;
      const angle = random() * Math.PI * 2;
      const to: Point = [from[0] + Math.cos(angle) * reach, from[1] + Math.sin(angle) * reach];
      const found = new Set(Battlefields.getCliffsBetween(field, from, to));
      for (const cliff of field.cliffs) if (crosses(from, to, cliff.a, cliff.b)) expect(found.has(cliff)).toBe(true);
    }
  });

  it("raises and lowers the ground about cliffs on hills so it jumps across a cliff alone", () => {
    for (const [fx, fy] of [
      [9, 7],
      [14, 11],
      [6, 13]
    ]) {
      const field = ground();
      field.height = field.height.map((_, node) => {
        const [x, y] = [node % COLS, Math.floor(node / COLS)];
        return 150 * (Math.sin(x / fx) + Math.cos(y / fy) + Math.sin((x + y) / (fx + fy)));
      });
      const scarps = Cliffs.raiseEscarpments(field, 60, () => 1)!;
      expect(scarps.cliffs.length).toBeGreaterThan(0);
      expect(getJumps(scarps)).toEqual([]);
    }
  });

  it("lays nothing on gentle ground, nor on a hillside that is not steep", () => {
    expect(Cliffs.raiseEscarpments(ground(), 40, () => 1)).toBeNull();
    const hillside = ground();
    hillside.height = hillside.height.map((_, node) => (node % COLS) * CELL * 0.08); // 4.6°
    expect(Cliffs.raiseEscarpments(hillside, 60, () => 1)!.cliffs).toEqual([]);
    hillside.height = hillside.height.map((_, node) => (node % COLS) * CELL * 0.2); // 11°
    expect(Cliffs.raiseEscarpments(hillside, 60, () => 1)!.cliffs.length).toBeGreaterThan(0);
  });
});

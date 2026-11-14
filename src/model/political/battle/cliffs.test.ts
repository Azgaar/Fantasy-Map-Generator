import { describe, expect, it } from "vitest";
import type { Point } from "@/types/global";
import { COLS, ROWS } from "./battle-scale";
import type { FieldCliff } from "./battlefield";
import { type CliffGround, laySeaCliffs, raiseEscarpments, traceEdges } from "./cliffs";

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
  clearance: (point: Point) => number = () => Infinity
): CliffGround {
  const water = Array.from({ length: COLS * ROWS }, (_, node) => (sea(node) ? 1 : 0));
  return { cell: CELL, front: FRONT, water, open: Uint8Array.from(water, w => +!w), clearance };
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
    const edges = traceEdges(node => inBox(node, box), CELL);
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
    const cliffs = laySeaCliffs(ground(sea), 20, () => 1);
    expect(cliffs.length).toBeGreaterThan(0);
    for (const cliff of cliffs) expect(cliff.a[1]).toBeCloseTo(20 * CELL); // on the shore, between the rows
    const middle = (COLS * CELL) / 2;
    const atMiddle = cliffs.filter(({ a, b }) => Math.abs((a[0] + b[0]) / 2 - middle) < 1.5 * FRONT);
    expect(atMiddle).toEqual([]);
    expect(length(cliffs)).toBeGreaterThan((COLS - 1) * CELL - 3 * FRONT - 2 * CELL); // all but the beach
    expect(laySeaCliffs(ground(sea), 5, () => 1)).toEqual([]); // a gentle coast has none
    expect(laySeaCliffs(ground(sea), 20, () => 0)).toEqual([]); // nor a coast all beaches
  });

  it("leaves no cliff by a road", () => {
    const sea = (node: number): boolean => Math.floor(node / COLS) < 20;
    const road = 200; // a road coming down to the shore at x = 200
    const cliffs = laySeaCliffs(
      ground(sea, ([x]: Point) => Math.abs(x - road)),
      20,
      () => 1
    );
    expect(cliffs.some(({ a, b }) => Math.abs((a[0] + b[0]) / 2 - road) < FRONT)).toBe(false);
  });

  it("raises high ground with cliffs on its edges and cuts a gully into a plateau they close all round", () => {
    const box = [30, 15, 60, 40];
    const field = ground();
    const scarps = raiseEscarpments(
      field,
      40,
      (x: number, y: number) => +inBox(Math.floor(y / CELL) * COLS + Math.floor(x / CELL), box),
      () => 1
    )!;
    expect(scarps).not.toBeNull();
    expect(scarps.top.filter(Boolean).length).toBe(30 * 25);
    expect(Math.max(...scarps.step)).toBe(20); // half the roughness
    expect(length(scarps.cliffs)).toBeGreaterThan(80 * CELL); // nearly all round
    expect(length(scarps.cliffs)).toBeLessThan(110 * CELL); // but for the gully
    for (const cliff of scarps.cliffs) expect(cliff.height).toBeGreaterThanOrEqual(3);
    // the plateau is reached from the plain
    const inside = 27 * COLS + 45;
    expect(reach(field.open, scarps.cliffs, 0).has(inside)).toBe(true);
  });

  it("opens every piece of ground a ring of cliffs would close off, a hollow within a plateau too", () => {
    const outer = [20, 10, 70, 50];
    const hollow = [35, 22, 55, 38];
    const high = (node: number): boolean => inBox(node, outer) && !inBox(node, hollow);
    const field = ground();
    const scarps = raiseEscarpments(
      field,
      40,
      (x: number, y: number) => +high(Math.floor(y / CELL) * COLS + Math.floor(x / CELL)),
      () => 1
    )!;
    const reached = reach(field.open, scarps.cliffs, 0);
    expect(reached.size).toBe(COLS * ROWS);
  });

  it("brings the edge down to a bank by a road, and has no cliff shorter than two fronts", () => {
    const field = ground(undefined, ([x]: Point) => Math.abs(x - 450));
    const box = [30, 15, 60, 40];
    const knoll = [10, 50, 12, 52]; // too small for a cliff
    const high = (node: number): boolean => inBox(node, box) || inBox(node, knoll);
    const scarps = raiseEscarpments(
      field,
      40,
      (x: number, y: number) => +high(Math.floor(y / CELL) * COLS + Math.floor(x / CELL)),
      () => 1
    )!;
    expect(scarps.cliffs.some(({ a, b }) => Math.abs((a[0] + b[0]) / 2 - 450) < FRONT)).toBe(false);
    expect(scarps.step[45 * COLS + 45]).toBe(0); // on the road
    expect(scarps.cliffs.some(({ a }) => a[0] < 15 * CELL)).toBe(false);
  });

  it("lays nothing on gentle ground", () => {
    expect(
      raiseEscarpments(
        ground(),
        10,
        () => 1,
        () => 1
      )
    ).toBeNull();
  });
});

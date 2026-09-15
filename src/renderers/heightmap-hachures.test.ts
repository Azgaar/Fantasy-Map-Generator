import Delaunator from "delaunator";
import { describe, expect, test } from "vitest";
import type { Point } from "@/types/global";
import { getHachures, getSlopeGradients } from "./heightmap-hachures";

// a 20x20 square grid with 10px spacing, neighbours are the 4 orthogonal cells
const SIZE = 20;
const SPACING = 10;
const points: Point[] = Array.from({ length: SIZE * SIZE }, (_, i) => [
  (i % SIZE) * SPACING + SPACING / 2,
  Math.floor(i / SIZE) * SPACING + SPACING / 2
]);
const neighbors = points.map((_, i) => {
  const x = i % SIZE;
  const y = Math.floor(i / SIZE);
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1]
  ]
    .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE)
    .map(([nx, ny]) => ny * SIZE + nx);
});
const indices = Delaunator.from(points).triangles;
const triangles = Array.from({ length: indices.length / 3 }, (_, i) => Array.from(indices.slice(i * 3, i * 3 + 3)));

const params = (heights: number[], seed = "seed") => ({
  points,
  heights,
  neighbors,
  triangles,
  spacing: SPACING,
  cellsX: SIZE,
  cellsY: SIZE,
  inBand: (h: number) => h >= 20,
  thresholds: [23, 26, 29, 32, 35, 38, 41, 44, 47, 50, 53, 56, 59, 62, 65, 68, 71, 74, 77, 80],
  density: 1,
  length: 1,
  width: 1,
  seed
});

const slope = (perCell: number) => points.map(([x]) => 20 + (x / SPACING) * perCell);
const strokesOf = (path: string) => path.split("M").filter(Boolean);

/** how far the stroke runs, root to tip, along x */
const run = (stroke: string) => {
  const moves = stroke.replace("Z", "").split("l");
  const [rootX] = moves[0].split(",").map(Number);
  let x = rootX;
  const tipIndex = Math.floor(moves.length / 2); // the outline turns back at the tip
  for (let i = 1; i <= tipIndex; i++) x += Number(moves[i].split(",")[0]);
  return x - rootX;
};

describe("heightmap hachures", () => {
  test("gradients recover a planar slope", () => {
    const gradients = getSlopeGradients(points, slope(2), neighbors);
    const inner = SIZE * 10 + 10; // away from the edges
    expect(gradients[inner * 2]).toBeCloseTo(0.2);
    expect(gradients[inner * 2 + 1]).toBeCloseTo(0);
  });

  test("a plateau draws nothing", () => {
    expect(getHachures(params(new Array(points.length).fill(50)))).toBe("");
  });

  test("ground gentler than the minimum slope draws nothing", () => {
    expect(getHachures(params(slope(1)))).toBe("");
  });

  test("a slope draws closed strokes running downhill", () => {
    const strokes = strokesOf(getHachures(params(slope(3))));
    expect(strokes.length).toBeGreaterThan(50);
    for (const stroke of strokes) {
      expect(stroke.endsWith("Z")).toBe(true);
      expect(run(stroke)).toBeLessThan(0); // downhill is west
    }
  });

  test("steeper ground packs more strokes", () => {
    expect(strokesOf(getHachures(params(slope(4)))).length).toBeGreaterThan(
      strokesOf(getHachures(params(slope(2)))).length
    );
  });

  test("strokes stop where the slope levels off", () => {
    // a hill on the west, flat ground from x = 100 on: no stroke reaches deep into the plain
    const heights = points.map(([x]) => (x < 100 ? 20 + ((100 - x) / SPACING) * 4 : 20));
    const path = getHachures(params(heights));
    expect(path).not.toBe("");
    for (const stroke of strokesOf(path)) {
      const [rootX] = stroke.split(",").map(Number);
      expect(rootX + run(stroke)).toBeLessThan(100 + SPACING * 1.5);
    }
  });

  test("the seed decides the strokes", () => {
    const heights = slope(3);
    expect(getHachures(params(heights))).toBe(getHachures(params(heights)));
    expect(getHachures(params(heights, "other"))).not.toBe(getHachures(params(heights)));
  });
});

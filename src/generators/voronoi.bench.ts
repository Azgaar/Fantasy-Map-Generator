import Delaunator from "delaunator";
import { bench, describe } from "vitest";
import type { Point } from "./voronoi";
import { Voronoi } from "./voronoi";

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePoints(count: number): Point[] {
  const random = mulberry32(42);
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push([random() * 1000, random() * 1000]);
  }
  return points;
}

describe("Voronoi construction", () => {
  for (const count of [1_000, 10_000, 50_000]) {
    const points = generatePoints(count);
    const delaunay = Delaunator.from(points);

    bench(`${count} points`, () => {
      new Voronoi(delaunay, points, points.length);
    });
  }
});

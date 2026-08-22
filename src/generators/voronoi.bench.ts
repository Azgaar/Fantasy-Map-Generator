import Delaunator from "delaunator";
import { bench, describe } from "vitest";
import type { Point } from "./voronoi";
import { Voronoi } from "./voronoi";

function generatePoints(count: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    points.push([Math.random() * 1000, Math.random() * 1000]);
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

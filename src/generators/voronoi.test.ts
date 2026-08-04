import Delaunator from "delaunator";
import { describe, expect, it } from "vitest";
import { type Point, Voronoi } from "./voronoi";

describe("Voronoi", () => {
  // A Voronoi vertex is the circumcenter of its Delaunay triangle: equidistant from
  // all three of the triangle's points. Quantizing vertex coordinates (the old
  // Math.floor in circumcenter) breaks this and makes cells visibly blocky once cell
  // spacing approaches the quantization step (high cell counts).
  it("places each vertex at the exact circumcenter of its triangle (no rounding)", () => {
    const points: Point[] = [
      [3.17, 4.93],
      [11.61, 2.27],
      [7.44, 9.81],
      [14.02, 8.66],
      [10.35, 15.49],
      [2.71, 12.08]
    ];
    const boundary: Point[] = [
      [-50, -50],
      [70, -50],
      [70, 66],
      [-50, 66]
    ];
    const allPoints = points.concat(boundary);

    const { vertices } = new Voronoi(Delaunator.from(allPoints), allPoints, points.length);

    let checked = 0;
    vertices.p.forEach((vertex, t) => {
      const dist = (p: Point) => Math.hypot(vertex[0] - p[0], vertex[1] - p[1]);
      const [ra, rb, rc] = vertices.c[t].map(pointId => dist(allPoints[pointId]));
      expect(Math.abs(ra - rb), `vertex ${t} not equidistant from its triangle points`).toBeLessThan(1e-6);
      expect(Math.abs(ra - rc), `vertex ${t} not equidistant from its triangle points`).toBeLessThan(1e-6);
      checked++;
    });
    expect(checked).toBeGreaterThan(0);
  });
});

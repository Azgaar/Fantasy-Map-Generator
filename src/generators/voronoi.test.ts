import Alea from "alea";
import { polygonArea } from "d3";
import Delaunator from "delaunator";
import { describe, expect, it } from "vitest";
import { calculateVoronoi, type Point, Voronoi } from "./voronoi";

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

describe("calculateVoronoi with a wrapped width", () => {
  const width = 400;
  const height = 200;
  const spacing = 10;
  const random = Alea("wrapped");

  const points: Point[] = [];
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      points.push([x + (random() - 0.5) * spacing * 0.9, y + (random() - 0.5) * spacing * 0.9]);
    }
  }
  const boundary: Point[] = [];
  for (let i = 0; i < width / spacing / 2; i++) {
    boundary.push([(i + 0.5) * spacing * 2, -spacing], [(i + 0.5) * spacing * 2, height + spacing]);
  }
  const { cells, vertices } = calculateVoronoi(points, boundary, width);

  it("links the cells across the seam and keeps the links mutual", () => {
    let acrossSeam = 0;
    points.forEach(([x], cellId) => {
      for (const neighborId of cells.c[cellId]) {
        expect(cells.c[neighborId].includes(cellId)).toBe(true);
        if (Math.abs(points[neighborId][0] - x) > width / 2) acrossSeam++;
      }
    });
    expect(acrossSeam).toBeGreaterThan(0);
  });

  it("leaves only the north and south rows on the border", () => {
    points.forEach(([, y], cellId) => {
      if (y > spacing * 2 && y < height - spacing * 2) expect(cells.b[cellId]).toBe(0);
    });
  });

  it("keeps vertices in the map and their adjacency mutual", () => {
    vertices.p.forEach(([x], vertexId) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(width);
      for (const neighborId of vertices.v[vertexId]) {
        if (neighborId !== -1) expect(vertices.v[neighborId].includes(vertexId)).toBe(true);
      }
    });
  });

  // a seam gap or overlap would cost about a cell; the edge pseudo-points take a sliver of the north and south rows
  it("tiles the map: unwrapped cell polygons cover its area", () => {
    const clip = (polygon: Point[], y0: number, keepAbove: boolean): Point[] => {
      const inside = ([, y]: Point) => (keepAbove ? y >= y0 : y <= y0);
      return polygon.flatMap((a, i) => {
        const b = polygon[(i + 1) % polygon.length];
        const out: Point[] = inside(a) ? [a] : [];
        if (inside(a) !== inside(b)) out.push([a[0] + ((y0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), y0]);
        return out;
      });
    };

    const total = points.reduce((sum, [cx], cellId) => {
      const polygon = cells.v[cellId].map(vertexId => vertices.p[vertexId]);
      const unwrapped = polygon.map(([x, y]): Point => [x - Math.round((x - cx) / width) * width, y]);
      return sum + Math.abs(polygonArea(clip(clip(unwrapped, 0, true), height, false)));
    }, 0);
    expect(Math.abs(total - width * height)).toBeLessThan(spacing ** 2 / 10);
  });
});

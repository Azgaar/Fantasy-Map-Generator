import Alea from "alea";
import { describe, expect, it } from "vitest";
import type { Point } from "@/types/global";
import { rn } from "@/utils/number-utils";
import { Lattice, MAX_JITTER, SAMPLINGS, type Sampling } from "./lattice";
import { calculateVoronoi } from "./voronoi";

const WIDTH = 1280;
const HEIGHT = 800;
const getSpacing = (points: number, width = WIDTH, height = HEIGHT) => rn(Math.sqrt((width * height) / points), 2);
const place = (sampling: Sampling, jitter: number, points = 10000, width = WIDTH, height = HEIGHT) =>
  Lattice.placePoints({ sampling, width, height, spacing: getSpacing(points, width, height), jitter }, Alea("lattice"));

// the grid generator before samplings, kept verbatim: the default lattice must reproduce it
function placeLegacy(width: number, height: number, spacing: number, random: () => number) {
  const radius = spacing / 2;
  const jittering = radius * 0.9;
  const doubleJittering = jittering * 2;
  const jitter = () => random() * doubleJittering - jittering;
  const points: Point[] = [];
  for (let y = radius; y < height; y += spacing) {
    for (let x = radius; x < width; x += spacing) {
      points.push([Math.min(rn(x + jitter(), 2), width), Math.min(rn(y + jitter(), 2), height)]);
    }
  }
  const count = (size: number) => Math.floor((size + 0.5 * spacing - 1e-10) / spacing);

  const offset = rn(-1 * spacing);
  const bSpacing = spacing * 2;
  const w = width - offset * 2;
  const h = height - offset * 2;
  const numberX = Math.ceil(w / bSpacing) - 1;
  const numberY = Math.ceil(h / bSpacing) - 1;
  const boundary: Point[] = [];
  for (let i = 0.5; i < numberX; i++) {
    const x = Math.ceil((w * i) / numberX + offset);
    boundary.push([x, offset], [x, h + offset]);
  }
  for (let i = 0.5; i < numberY; i++) {
    const y = Math.ceil((h * i) / numberY + offset);
    boundary.push([offset, y], [w + offset, y]);
  }

  return { cellsX: count(width), cellsY: count(height), points, boundary };
}

describe("Lattice.placePoints", () => {
  it("reproduces the legacy jittered square grid", () => {
    for (const [width, height, cells] of [
      [1280, 800, 10000],
      [1920, 1080, 10000],
      [1000, 1000, 1000],
      [1366, 641, 100000],
      [777, 1333, 30000]
    ]) {
      const spacing = getSpacing(cells, width, height);
      const legacy = placeLegacy(width, height, spacing, Alea(`seed-${cells}`));
      const lattice = Lattice.placePoints(
        { sampling: "square", width, height, spacing, jitter: 0.9 },
        Alea(`seed-${cells}`)
      );
      expect(lattice).toEqual(legacy);
    }
  });

  // whole rows and columns round the count, as on the classic grid: within 1.5% at 10,000 points
  it.each(SAMPLINGS)("%s gives the requested cell count, off by less than a row and a column", sampling => {
    for (const [width, height] of [
      [1280, 800],
      [1920, 1080],
      [1000, 1000],
      [777, 1333]
    ]) {
      for (const cells of [1000, 10000, 100000]) {
        const { points, cellsX, cellsY } = place(sampling, 0, cells, width, height);
        expect(Math.abs(points.length - cells)).toBeLessThan(cellsX + cellsY);
        if (cells >= 10000) expect(Math.abs(points.length - cells) / cells).toBeLessThan(0.015);
      }
    }
  });

  it.each(SAMPLINGS)("%s stores full rows inside the map", sampling => {
    const { points, cellsX, cellsY } = place(sampling, 0.9);
    expect(points).toHaveLength(cellsX * cellsY);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(WIDTH);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(HEIGHT);
    }
  });

  it.each([
    ["square", 4],
    ["hexPointy", 6],
    ["hexFlat", 6],
    ["diamond", 4],
    ["triangle", 3]
  ] as const)("%s cells have %i sides at zero jitter", (sampling, sides) => {
    const { points, boundary, cellsX, cellsY } = place(sampling, 0);
    const { cells, vertices } = calculateVoronoi(points, boundary);
    const tolerance = getSpacing(10000) * 0.05; // points are rounded to 0.01, which splits a corner by a hair

    for (const cellId of cells.i) {
      const row = Math.floor(cellId / cellsX);
      const col = cellId % cellsX;
      if (row < 2 || col < 2 || row >= cellsY - 2 || col >= cellsX - 2) continue; // the map edge cuts lattices that don't tile it evenly
      const corners: Point[] = [];
      for (const vertexId of cells.v[cellId]) {
        const [x, y] = vertices.p[vertexId];
        if (!corners.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < tolerance)) corners.push([x, y]);
      }
      expect(corners).toHaveLength(sides);
    }
  });

  it.each(SAMPLINGS)("%s leaves no boundary point inside the map", sampling => {
    for (const jitter of [0, 0.9]) {
      for (const [x, y] of place(sampling, jitter).boundary) {
        expect(x <= 0 || y <= 0 || x >= WIDTH || y >= HEIGHT).toBe(true);
      }
    }
  });

  it.each(SAMPLINGS)("%s keeps neighbours apart at the highest jitter", sampling => {
    const { points, boundary } = place(sampling, MAX_JITTER, 30000);
    const { cells } = calculateVoronoi(points, boundary);
    const { neighborDistance } = Lattice.getSteps(sampling, getSpacing(30000));
    let closest = Infinity;
    for (const cellId of cells.i) {
      for (const neighborId of cells.c[cellId]) {
        const [x, y] = points[cellId];
        const [nx, ny] = points[neighborId];
        closest = Math.min(closest, Math.hypot(x - nx, y - ny));
      }
    }
    expect(closest / neighborDistance).toBeGreaterThan(1 - MAX_JITTER - 0.01); // 0.01 for the rounding
  });

  it("rolls the same random stream at any jitter", () => {
    for (const sampling of SAMPLINGS) {
      const calls = [0, 0.3, 0.9].map(jitter => {
        let count = 0;
        const random = Alea("count");
        Lattice.placePoints({ sampling, width: WIDTH, height: HEIGHT, spacing: getSpacing(10000), jitter }, () => {
          count++;
          return random();
        });
        return count;
      });
      expect(new Set(calls).size).toBe(1);
    }
  });
});

describe("Lattice.findSlot", () => {
  it("matches the legacy square cell formula", () => {
    const spacing = getSpacing(10000);
    const { cellsX, cellsY } = place("square", 0.9);
    const graph = { sampling: "square" as const, spacing, cellsX, cellsY };
    const random = Alea("probe");
    for (let i = 0; i < 1000; i++) {
      const x = random() * WIDTH;
      const y = random() * HEIGHT;
      const legacy =
        Math.floor(Math.min(y / spacing, cellsY - 1)) * cellsX + Math.floor(Math.min(x / spacing, cellsX - 1));
      expect(Lattice.findSlot(x, y, graph)).toBe(legacy);
    }
  });

  it.each(SAMPLINGS)("%s returns a slot within the grid for any point, outside the map included", sampling => {
    const { cellsX, cellsY } = place(sampling, 0);
    const graph = { sampling, spacing: getSpacing(10000), cellsX, cellsY };
    for (const [x, y] of [
      [-50, -50],
      [WIDTH + 50, HEIGHT + 50],
      [WIDTH / 2, -10],
      [-10, HEIGHT / 2]
    ]) {
      const slot = Lattice.findSlot(x, y, graph);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(cellsX * cellsY);
    }
  });

  it.each(SAMPLINGS)("%s slot holds the point placed in it at zero jitter", sampling => {
    const { points, cellsX, cellsY } = place(sampling, 0);
    const graph = { sampling, spacing: getSpacing(10000), cellsX, cellsY };
    expect(points.map(([x, y]) => Lattice.findSlot(x, y, graph))).toEqual(points.map((_, cellId) => cellId));
  });
});

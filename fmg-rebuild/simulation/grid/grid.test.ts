import { describe, it, expect } from "vitest";
import { generateJitteredGrid, circumcenter } from "./grid-generator";

describe("Grid Generator & Voronoi Builder", () => {
  it("should compute the correct circumcenter for a triangle", () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [4, 0];
    const c: [number, number] = [0, 4];
    // Right triangle circumcenter is the midpoint of the hypotenuse: (2, 2)
    const center = circumcenter(a, b, c);
    expect(center).toEqual([2, 2]);
  });

  it("should produce deterministic grid layouts given the same seed", () => {
    const grid1 = generateJitteredGrid(800, 600, 1000, "test-seed-xyz");
    const grid2 = generateJitteredGrid(800, 600, 1000, "test-seed-xyz");

    expect(grid1.spacing).toBe(grid2.spacing);
    expect(grid1.cellsX).toBe(grid2.cellsX);
    expect(grid1.cellsY).toBe(grid2.cellsY);
    expect(grid1.points.length).toBe(grid2.points.length);
    expect(grid1.points).toEqual(grid2.points);
  });

  it("should generate distinct grid layouts given different seeds", () => {
    const grid1 = generateJitteredGrid(800, 600, 1000, "test-seed-1");
    const grid2 = generateJitteredGrid(800, 600, 1000, "test-seed-2");

    expect(grid1.points).not.toEqual(grid2.points);
  });

  it("should set border flags correctly for cells at the edge", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "border-test");
    const cells = grid.cells;

    // Verify cell indexes array matches size of generated points
    expect(cells.i.length).toBe(grid.points.length);
    
    // There must be at least some cells flagged as border cells (1)
    const borderCellsCount = cells.b.reduce((sum, val) => sum + val, 0);
    expect(borderCellsCount).toBeGreaterThan(0);
    expect(borderCellsCount).toBeLessThan(grid.points.length);
  });

  it("should populate adjacency lists with valid indices", () => {
    const grid = generateJitteredGrid(800, 600, 1000, "adjacency-test");
    const cells = grid.cells;

    // Verify cell adjacency contains indices within [0, pointsN)
    for (let i = 0; i < grid.points.length; i++) {
      const neighbors = cells.c[i];
      expect(neighbors).toBeDefined();
      expect(neighbors.length).toBeGreaterThan(0);
      for (const neighbor of neighbors) {
        expect(neighbor).toBeLessThan(grid.points.length);
        expect(neighbor).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

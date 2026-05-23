import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import "./setup.js"; // Ensure our headless browser mocks are active
import { generateGrid } from "../utils/graphUtils.js";
import { defaultTestSetup, isPointInPolygon } from "./test.utils.js";

// Define the TypeScript interfaces matching our JSON dumps
interface PointsRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  ExpectedPointsCount: number;
  ActualPointsCount: number;
  Spacing: number;
  CellsCountX: number;
  CellsCountY: number;
  Points: [number, number][]; // Array of [x, y] coordinates
}

interface BoundaryRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  BoundaryPoints: [number, number][]; // Array of [x, y] coordinates
}

interface VoronoiRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  Cells: {
    v: number[][]; // Vertices of cell
    c: number[][]; // Adjacent cells
    b: number[]; // Boundary flag
    i: number[]; // Cell indices
  };
  Vertices: {
    p: [number, number][]; // Vertex coordinates
    v: number[][]; // Vertex-to-vertex
    c: number[][]; // Adjacent cells
  };
}

describe("Grid Generator Regression", () => {
  const dataDir = path.join(process.cwd(), "tests", "regression_data");

  it("Grid points regression test", () => {
    // 1. Load Regression Data
    const jsonPath = path.join(dataDir, "grid_points_regression.json");
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Regression data missing. Run 'npm run dump:grid' first. Path: ${jsonPath}`);
    }
    const expected: PointsRegressionData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // 2. Setup Deterministic State
    defaultTestSetup();

    // 3. Act
    const grid = generateGrid(expected.Seed, expected.Width, expected.Height);

    // 4. Meta-Asserts: Verify the FMG setup matches our dump options
    expect(grid.points.length).toBeGreaterThan(0);

    // 5. State-Asserts: Verify spacing and grid dimensions match
    expect(grid.spacing).toBe(expected.Spacing);
    expect(grid.cellsX).toBe(expected.CellsCountX);
    expect(grid.cellsY).toBe(expected.CellsCountY);

    // 6. Count-Assert: The generated array length must match the dump actual count
    expect(grid.points.length).toBe(expected.ActualPointsCount);

    // 7. Parity-Assert: Coordinate check
    // Using a standard for-loop instead of .toEqual() on the whole array prevents
    // the IDE/terminal from crashing if 10,000 items mismatch and it tries to print the diff.
    for (let i = 0; i < expected.ActualPointsCount; i++) {
      // Points[i][0] is X, Points[i][1] is Y
      expect(grid.points[i][0]).toBe(expected.Points[i][0]);
      expect(grid.points[i][1]).toBe(expected.Points[i][1]);
    }
  });

  it("Grid boundaries regression test", () => {
    // 1. Load Regression Data
    const jsonPath = path.join(dataDir, "grid_boundary_regression.json");
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Regression data missing. Run 'npm run dump:grid' first. Path: ${jsonPath}`);
    }
    const expected: BoundaryRegressionData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // 2. Setup Deterministic State
    defaultTestSetup();

    // 3. Act
    const grid = generateGrid(expected.Seed, expected.Width, expected.Height);

    // 4. Count-Assert
    expect(grid.boundary.length).toBe(expected.BoundaryPoints.length);

    // 5. Parity-Assert: Coordinate check
    for (let i = 0; i < expected.BoundaryPoints.length; i++) {
      expect(grid.boundary[i][0]).toBe(expected.BoundaryPoints[i][0]);
      expect(grid.boundary[i][1]).toBe(expected.BoundaryPoints[i][1]);
    }
  });

  it("Voronoi graph topology and geometry regression test", () => {
    // 1. Load the JS dump
    const jsonPath = path.join(dataDir, "grid_voronoi_regression.json");
    const expected: VoronoiRegressionData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // 2. Setup Deterministic State
    defaultTestSetup();

    const mapData = generateGrid(expected.Seed, expected.Width, expected.Height);

    // 3. Verify Global Properties
    expect(mapData.cells.i.length).toBe(expected.Cells.i.length);

    // 4. Verify Cell Topology and Boundary Flags
    for (let i = 0; i < mapData.cells.i.length; i++) {
      // Verify adjacent cells (c)
      expect(Array.from(mapData.cells.c[i])).toEqual(expected.Cells.c[i]);

      // Verify cell vertices (v)
      expect(Array.from(mapData.cells.v[i])).toEqual(expected.Cells.v[i]);

      // Verify boundary flag (b)
      expect(mapData.cells.b[i]).toBe(expected.Cells.b[i]);
    }

    // 5. Verify Vertex Geometry and Topology
    expect(mapData.vertices.p.length).toBe(expected.Vertices.p.length);

    for (let i = 0; i < mapData.vertices.p.length; i++) {
      const actualP = mapData.vertices.p[i];
      const expectedP = expected.Vertices.p[i];

      // Geometry (Coordinates)
      expect(actualP[0]).toBe(expectedP[0]); // X
      expect(actualP[1]).toBe(expectedP[1]); // Y

      // Topology: Vertex-to-cell and Vertex-to-vertex
      expect(Array.from(mapData.vertices.c[i])).toEqual(expected.Vertices.c[i]);
      expect(Array.from(mapData.vertices.v[i])).toEqual(expected.Vertices.v[i]);
    }
  });

  it("Voronoi Cell point is strictly inside its generated polygon regression test", () => {
    defaultTestSetup();

    const mapData = generateGrid(seed, graphWidth, graphHeight);

    for (let i = 0; i < mapData.cells.i.length; i++) {
      const vertexIndices = mapData.cells.v[i];

      // Skip invalid polygons
      if (vertexIndices.length < 3) continue;

      const cellCenterPoint = mapData.points[i];

      // Map the vertex indices back to their actual [X, Y] coordinates
      const polygonPerimeter = Array.from(vertexIndices).map((vIdx: number) => mapData.vertices.p[vIdx]);

      // Algorithmic Check
      const isInside = isPointInPolygon(cellCenterPoint, polygonPerimeter);

      expect(isInside, `Cell ${i} center point is outside its own perimeter!`).toBe(true);
    }
  });
});

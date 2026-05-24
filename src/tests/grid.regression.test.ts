import { describe, expect, it } from "vitest";

import "./regression.setup.js";
import { generateGrid } from "../utils/graphUtils.js";
// Import the Runner and Interfaces
import {
  type BoundaryRegressionData,
  GridRegressionRunner,
  type PointsRegressionData,
  type VoronoiRegressionData
} from "./grid.regression.js";
import { defaultTestSetup, isPointInPolygon, loadRegressionData } from "./regression.utils.js";

describe("Grid Generator Regression", () => {
  it("Grid points, boundary, and Voronoi graph match JS output exactly", async () => {
    // 1. Load Expected Data via our new Generic Helper
    const expectedPoints = loadRegressionData<PointsRegressionData>("grid_points_regression.json");
    const expectedBoundary = loadRegressionData<BoundaryRegressionData>("grid_boundary_regression.json");
    const expectedVoronoi = loadRegressionData<VoronoiRegressionData>("grid_voronoi_regression.json");

    // 2. Execute Generator
    const runner = new GridRegressionRunner();
    const actual = await runner.execute();

    // 3. Top-Level Hybrid Asserts
    // Check array lengths first for fast-failing
    expect(actual.Points.Points.length).toBe(expectedPoints.Points.length);
    expect(actual.Boundary.BoundaryPoints.length).toBe(expectedBoundary.BoundaryPoints.length);
    expect(actual.Voronoi.Cells.v.length).toBe(expectedVoronoi.Cells.v.length);
    expect(actual.Voronoi.Vertices.p.length).toBe(expectedVoronoi.Vertices.p.length);

    // Deep equality on the exact semantic buckets
    expect(actual.Points).toEqual(expectedPoints);
    expect(actual.Boundary).toEqual(expectedBoundary);
    expect(actual.Voronoi).toEqual(expectedVoronoi);
  });

  // Your mathematical validation test remains untouched
  it("Voronoi Cell point is strictly inside its generated polygon", () => {
    defaultTestSetup();
    const mapData = generateGrid(globalThis.seed, globalThis.graphWidth, globalThis.graphHeight);

    for (let i = 0; i < mapData.cells.i.length; i++) {
      const vertexIndices = mapData.cells.v[i];

      if (vertexIndices.length < 3) continue;

      const cellCenterPoint = mapData.points[i];
      const polygonPerimeter = Array.from(vertexIndices).map((vIdx: number) => mapData.vertices.p[vIdx]);

      const isInside = isPointInPolygon(cellCenterPoint, polygonPerimeter);
      expect(isInside).toBe(true);
    }
  });
});

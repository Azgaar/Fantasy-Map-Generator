import { describe, expect, it } from "vitest";

import "./regression.setup.js";
import { generateGrid } from "../utils/graphUtils.js";

import {
  type BoundaryRegressionData,
  GridBoundaryRunner,
  GridPointsRunner,
  GridVoronoiRunner,
  type PointsRegressionData,
  type VoronoiRegressionData
} from "./grid.regression.js";
import { defaultTestSetup, isPointInPolygon, loadRegressionData } from "./regression.utils.js";

describe("Grid Generator Regression Test", () => {
  it("Grid points match regression", async () => {
    const runner = new GridPointsRunner();
    const expected = loadRegressionData<PointsRegressionData>(runner.filename);
    const actual = await runner.execute();

    expect(actual.Seed).toBe(expected.Seed);
    expect(actual.Width).toBe(expected.Width);
    expect(actual.Height).toBe(expected.Height);

    expect(actual.ExpectedPointsCount).toBe(expected.ExpectedPointsCount);
    expect(actual.ActualPointsCount).toBe(expected.ActualPointsCount);
    expect(actual.ActualPointsCount).toBe(expected.ActualPointsCount);

    expect(actual.Spacing).toBe(expected.Spacing);
    expect(actual.CellsCountX).toBe(expected.CellsCountX);
    expect(actual.CellsCountY).toBe(expected.CellsCountY);

    expect(actual.Points.length).toBeGreaterThan(0);
    expect(actual.Points.length).toBe(expected.ActualPointsCount);

    for (let i = 0; i < expected.ActualPointsCount; i++) {
      // Points[i][0] is X, Points[i][1] is Y
      expect(actual.Points[i][0]).toBe(expected.Points[i][0]);
      expect(actual.Points[i][1]).toBe(expected.Points[i][1]);
    }

    //expect(actual).toEqual(expected);
  });

  it("Boundary points match regression", async () => {
    const runner = new GridBoundaryRunner();
    const expected = loadRegressionData<BoundaryRegressionData>(runner.filename);
    const actual = await runner.execute();

    expect(actual.Seed).toBe(expected.Seed);
    expect(actual.Width).toBe(expected.Width);
    expect(actual.Height).toBe(expected.Height);

    expect(actual.BoundaryPoints.length).toBeGreaterThan(0);
    expect(actual.BoundaryPoints.length).toBe(expected.BoundaryPoints.length);

    for (let i = 0; i < expected.BoundaryPoints.length; i++) {
      expect(actual.BoundaryPoints[i][0]).toBe(expected.BoundaryPoints[i][0]);
      expect(actual.BoundaryPoints[i][1]).toBe(expected.BoundaryPoints[i][1]);
    }

    //expect(actual).toEqual(expected);
  });

  it("Voronoi matches regression", async () => {
    const runner = new GridVoronoiRunner();
    const expected = loadRegressionData<VoronoiRegressionData>(runner.filename);
    const actual = await runner.execute();

    expect(actual.Seed).toBe(expected.Seed);
    expect(actual.Width).toBe(expected.Width);
    expect(actual.Height).toBe(expected.Height);

    // 3. Verify Global Properties
    expect(actual.Cells.i.length).toBe(expected.Cells.i.length);

    // 4. Verify Cell Topology and Boundary Flags
    for (let i = 0; i < actual.Cells.i.length; i++) {
      // Verify adjacent cells (c)
      expect(Array.from(actual.Cells.c[i])).toEqual(expected.Cells.c[i]);

      // Verify cell vertices (v)
      expect(Array.from(actual.Cells.v[i])).toEqual(expected.Cells.v[i]);

      // Verify boundary flag (b)
      expect(actual.Cells.b[i]).toBe(expected.Cells.b[i]);
    }

    // 5. Verify Vertex Geometry and Topology
    expect(actual.Vertices.p.length).toBe(expected.Vertices.p.length);

    for (let i = 0; i < actual.Vertices.p.length; i++) {
      // Geometry (Coordinates)
      expect(actual.Vertices.p[i][0]).toBe(expected.Vertices.p[i][0]); // X
      expect(actual.Vertices.p[i][1]).toBe(expected.Vertices.p[i][1]); // Y

      // Topology: Vertex-to-cell and Vertex-to-vertex
      expect(Array.from(actual.Vertices.c[i])).toEqual(expected.Vertices.c[i]);
      expect(Array.from(actual.Vertices.v[i])).toEqual(expected.Vertices.v[i]);
    }

    //expect(actual).toEqual(expected);
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

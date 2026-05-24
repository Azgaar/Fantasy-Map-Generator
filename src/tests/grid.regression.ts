import "./regression.setup.js";
import { generateGrid } from "../utils/graphUtils.js";
import type { IRegressionRunner, RegressionDumpPayload } from "./regression.interface.js";
import { defaultTestSetup, typedArrayReplacer } from "./regression.utils.js"; // Adjust to test.utils.js if needed

// --- INTERFACES ---
export interface PointsRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  ExpectedPointsCount: number;
  ActualPointsCount: number;
  Spacing: number;
  CellsCountX: number;
  CellsCountY: number;
  Points: [number, number][];
}

export interface BoundaryRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  BoundaryPoints: [number, number][];
}

export interface VoronoiRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  Cells: { v: number[][]; c: number[][]; b: number[]; i: number[] };
  Vertices: { p: [number, number][]; v: number[][]; c: number[][] };
}

// Wrapper for the Test Execution
export interface GridRegressionResult {
  Points: PointsRegressionData;
  Boundary: BoundaryRegressionData;
  Voronoi: VoronoiRegressionData;
}

// --- RUNNER CLASS ---
export class GridRegressionRunner implements IRegressionRunner {
  public name = "Grid Generator";

  public async generateDumps(): Promise<RegressionDumpPayload[]> {
    const data = await this.execute();

    // The interface beautifully handles returning multiple dump files!
    return [
      { filename: "grid_points_regression.json", data: data.Points },
      { filename: "grid_boundary_regression.json", data: data.Boundary },
      { filename: "grid_voronoi_regression.json", data: data.Voronoi }
    ];
  }

  public async execute(): Promise<GridRegressionResult> {
    const pointCount = 2000;
    defaultTestSetup({ points: pointCount });

    // 1. Execute Generator
    const grid = generateGrid(globalThis.seed, globalThis.graphWidth, globalThis.graphHeight);

    // 2. Format Voronoi (re-using the typed array replacer for deeply nested arrays)
    const voronoiCells = JSON.parse(JSON.stringify(grid.cells, typedArrayReplacer));
    const voronoiVertices = JSON.parse(JSON.stringify(grid.vertices, typedArrayReplacer));

    // 3. Construct and return the DTOs
    return {
      Points: {
        Seed: globalThis.seed,
        Width: globalThis.graphWidth,
        Height: globalThis.graphHeight,
        ExpectedPointsCount: pointCount,
        ActualPointsCount: grid.points.length,
        Spacing: grid.spacing,
        CellsCountX: grid.cellsX,
        CellsCountY: grid.cellsY,
        Points: Array.from(grid.points) as [number, number][]
      },
      Boundary: {
        Seed: globalThis.seed,
        Width: globalThis.graphWidth,
        Height: globalThis.graphHeight,
        BoundaryPoints: Array.from(grid.boundary) as [number, number][]
      },
      Voronoi: {
        Seed: globalThis.seed,
        Width: globalThis.graphWidth,
        Height: globalThis.graphHeight,
        Cells: voronoiCells,
        Vertices: voronoiVertices
      }
    };
  }
}

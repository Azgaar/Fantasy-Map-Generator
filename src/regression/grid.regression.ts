import "./regression.setup.js";
import { generateGrid } from "../utils/graphUtils.js";
import type { IRegressionRunner, IRegressionSuite } from "./regression.interface.js";
import { defaultTestSetup } from "./regression.utils.js";

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

// --- GENERATION SEQUENCE ---
const pointCount = 2000;
const executeGenerateGrid = () => {
  defaultTestSetup({ points: pointCount });
  globalThis.grid = generateGrid(globalThis.seed, globalThis.graphWidth, globalThis.graphHeight);
};

// --- RUNNER CLASSES ---
export class GridPointsRunner implements IRegressionRunner<PointsRegressionData> {
  public name = "Grid Points";
  public filename = "grid_points_regression.json";
  public async execute(): Promise<PointsRegressionData> {
    executeGenerateGrid();
    return {
      Seed: globalThis.seed,
      Width: globalThis.graphWidth,
      Height: globalThis.graphHeight,
      ExpectedPointsCount: pointCount,
      ActualPointsCount: globalThis.grid.points.length,
      Spacing: globalThis.grid.spacing,
      CellsCountX: globalThis.grid.cellsX,
      CellsCountY: globalThis.grid.cellsY,
      Points: Array.from(globalThis.grid.points) as [number, number][]
    };
  }
}

export class GridBoundaryRunner implements IRegressionRunner<BoundaryRegressionData> {
  public name = "Grid Boundary";
  public filename = "grid_boundary_regression.json";
  public async execute(): Promise<BoundaryRegressionData> {
    executeGenerateGrid();
    return {
      Seed: globalThis.seed,
      Width: globalThis.graphWidth,
      Height: globalThis.graphHeight,
      BoundaryPoints: Array.from(globalThis.grid.boundary) as [number, number][]
    };
  }
}

export class GridVoronoiRunner implements IRegressionRunner<VoronoiRegressionData> {
  public name = "Voronoi Graph";
  public filename = "grid_voronoi_regression.json";

  public async execute(): Promise<VoronoiRegressionData> {
    executeGenerateGrid(); // Assuming this is defined in your scope

    const grid = globalThis.grid;

    return {
      Seed: globalThis.seed,
      Width: globalThis.graphWidth,
      Height: globalThis.graphHeight,

      Cells: {
        v: Array.from(grid.cells.v as any[]).map(arr => Array.from(arr as number[])),
        c: Array.from(grid.cells.c as any[]).map(arr => Array.from(arr as number[])),
        b: Array.from(grid.cells.b as number[]),
        i: Array.from(grid.cells.i as number[])
      },

      Vertices: {
        p: Array.from(grid.vertices.p as any[]).map((pt: any) => [pt[0], pt[1]] as [number, number]),
        v: Array.from(grid.vertices.v as any[]).map(arr => Array.from(arr as number[])),
        c: Array.from(grid.vertices.c as any[]).map(arr => Array.from(arr as number[]))
      }
    };
  }
}

export const gridSuite: IRegressionSuite = {
  name: "Grid Regression",
  runners: [new GridPointsRunner(), new GridBoundaryRunner(), new GridVoronoiRunner()]
};

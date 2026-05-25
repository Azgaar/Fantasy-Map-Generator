import "./regression.setup.js";
import { FeatureModule } from "../modules/features.js";
import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import type { IRegressionRunner, IRegressionSuite } from "./regression.interface.js";
import { defaultTestSetup } from "./regression.utils.js";

export interface FeatureRegressionItem {
  i: number;
  type: string;
  land: boolean;
}

export interface GridFeatureRegressionData {
  CellFeatures: number[];
  CellDistances: number[];
  Features: FeatureRegressionItem[];
}

export class GridFeatureRegressionRunner implements IRegressionRunner<GridFeatureRegressionData> {
  public name = "Feature Generator";
  public filename = "feature_grid_regression.json";

  public async execute(): Promise<GridFeatureRegressionData> {
    defaultTestSetup();

    globalThis.grid = generateGrid(globalThis.seed, globalThis.graphWidth, globalThis.graphHeight);
    globalThis.grid.cells.h = await new HeightmapModule().generate(globalThis.grid);
    new FeatureModule().markupGrid();

    const validFeatures = globalThis.grid.features
      .filter((f: any) => f)
      .map((f: any) => ({
        i: f.i,
        type: f.type.toLowerCase(),
        land: f.land
      }));

    return {
      CellFeatures: Array.from(globalThis.grid.cells.f),
      CellDistances: Array.from(globalThis.grid.cells.t),
      Features: validFeatures
    };
  }
}

export const featureSuite: IRegressionSuite = {
  name: "Feature Regression",
  runners: [new GridFeatureRegressionRunner()]
};

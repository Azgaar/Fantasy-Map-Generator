import "./regression.setup.js";
import { FeatureModule } from "../modules/features.js";
import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import type { IRegressionRunner, RegressionDumpPayload } from "./regression.interface.js";
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

export class FeatureRegressionRunner implements IRegressionRunner {
  public name = "Feature Generator";

  public async generateDumps(): Promise<RegressionDumpPayload[]> {
    const data = await this.execute();
    return [
      {
        filename: "feature_grid_regression.json",
        data: data
      }
    ];
  }

  public async execute(): Promise<GridFeatureRegressionData> {
    defaultTestSetup({ points: 2000, templateId: "continents" });

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

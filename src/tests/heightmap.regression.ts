import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import type { IRegressionRunner, RegressionDumpPayload } from "./regression.interface.js";
import { defaultTestSetup } from "./regression.utils.js";

export interface HeightmapTestCase {
  name: string;
  recipe: string;
  isTemplate?: boolean;
}

export interface HeightmapRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  Heights: number[];
}

export const heightmapTestCases: HeightmapTestCase[] = [
  { name: "hill", recipe: "Hill 1 90-100 44-56 40-60" },
  { name: "add", recipe: "Add 30 0-100" },
  { name: "mult", recipe: "Add 20 all\nHill 1 50 50 50\nMultiply 1.5 land\nMultiply 0.5 0-20" },
  { name: "pit", recipe: "Add 50 0-100\nPit 1 30 50 50" },
  { name: "pit_shallow", recipe: "Add 50 0-100\nPit 1 5 50 50" },
  { name: "smooth", recipe: "Add 20 all\nHill 1 60 50 50\nSmooth 2 0\nSmooth 1.5 1" },
  { name: "invert", recipe: "Add 20 all\nHill 1 60 20 20\nInvert 1 x" },
  { name: "range", recipe: "Add 15 all\nRange 1 60 10-20 10-20\nSmooth 2" },
  { name: "trough", recipe: "Add 70 all\nTrough 1 40 40-60 5-10\nSmooth 1.5" },
  { name: "strait", recipe: "Add 50 all\nStrait 15 vertical\nStrait 15 horizontal" },
  { name: "template_highIsland", recipe: "highIsland", isTemplate: true },
  { name: "template_archipelago", recipe: "archipelago", isTemplate: true },
  { name: "template_shattered", recipe: "shattered", isTemplate: true },
  { name: "template_volcano", recipe: "volcano", isTemplate: true },
  { name: "template_fractious", recipe: "fractious", isTemplate: true },
  { name: "template_continents", recipe: "continents", isTemplate: true }
];

export class HeightmapRegressionRunner implements IRegressionRunner {
  public name = "Heightmap Generator";

  public async generateDumps(): Promise<RegressionDumpPayload[]> {
    const payloads: RegressionDumpPayload[] = [];
    for (const testCase of heightmapTestCases) {
      payloads.push({
        filename: `heightmap_${testCase.name}_regression.json`,
        data: await this.execute(testCase)
      });
    }
    return payloads;
  }

  // Now returns the typed interface instead of an anonymous object
  public async execute(testCase: HeightmapTestCase): Promise<HeightmapRegressionData> {
    defaultTestSetup({
      templateId: testCase.isTemplate ? testCase.recipe : undefined,
      templateCustomRecipe: !testCase.isTemplate ? testCase.recipe : undefined
    });

    const grid = generateGrid(globalThis.seed, globalThis.graphWidth, globalThis.graphHeight);
    const heightsArray = await new HeightmapModule().generate(grid);

    return {
      Seed: globalThis.seed,
      Width: globalThis.graphWidth,
      Height: globalThis.graphHeight,
      Heights: Array.from(heightsArray)
    };
  }
}

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import "./setup.js";
import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import { heightmapTestCases } from "./heightmap.cases.js";
import { defaultTestSetup } from "./test.utils.js";

interface HeightmapRegressionData {
  Seed: string;
  Width: number;
  Height: number;
  Heights: number[];
}

describe("Heightmap Generator Parameterized Regression", () => {
  const dataDir = path.join(process.cwd(), "tests", "regression_data");

  // it.each takes our array and runs the test block for every single case
  it.each(heightmapTestCases)("Heightmap regression: $name", async testCase => {
    // 1. Load the specific heightmap dump
    const jsonPath = path.join(dataDir, `heightmap_${testCase.name}_regression.json`);
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Regression data missing. Run dump script. Path: ${jsonPath}`);
    }
    const expected: HeightmapRegressionData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // 2. Setup Deterministic MapData (Voronoi Graph)
    defaultTestSetup({
      templateId: testCase.isTemplate ? testCase.recipe : undefined,
      templateCustomRecipe: !testCase.isTemplate ? testCase.recipe : undefined
    });

    globalThis.grid = generateGrid(expected.Seed, expected.Width, expected.Height);

    // 3. Execute
    const generator = new HeightmapModule();
    const actualHeights = await generator.generate(globalThis.grid);

    // 4. Verify Parity (Length and Data)
    expect(actualHeights.length).toBe(expected.Heights.length);

    for (let i = 0; i < expected.Heights.length; i++) {
      // 0 tolerance byte comparison, exactly like C#
      expect(actualHeights[i]).toBe(expected.Heights[i]);
    }
  });
});

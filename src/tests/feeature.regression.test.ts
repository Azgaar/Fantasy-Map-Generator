import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import "./setup.js";
import { FeatureModule } from "../modules/features.js";
import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import { defaultTestSetup } from "./test.utils.js";

interface FeatureRegressionItem {
  i: number;
  type: string;
  land: boolean;
}

interface GridFeatureRegressionData {
  CellFeatures: number[];
  CellDistances: number[];
  Features: FeatureRegressionItem[];
}

describe("Grid Feature Generator Regression", () => {
  const dataDir = path.join(process.cwd(), "tests", "regression_data");

  it("MarkupGrid matches JS output exactly", async () => {
    // 1. Load the specific feature dump
    const jsonPath = path.join(dataDir, "feature_grid_regression.json");
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Regression data missing. Run dump script. Path: ${jsonPath}`);
    }
    const expected: GridFeatureRegressionData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // 2. Setup MapData with the exact topology
    defaultTestSetup({ points: 2000, templateId: "continents" });

    globalThis.grid = generateGrid(globalThis.seed, globalThis.graphWidth, globalThis.graphHeight);
    globalThis.grid.cells.h = await new HeightmapModule().generate(grid);
    new FeatureModule().markupGrid();

    // 5. Assert: Cell-level Data
    // Array.from() projects the Uint16Array and Int8Array back to standard JS Arrays to match the JSON
    expect(Array.from(grid.cells.f)).toEqual(expected.CellFeatures);
    expect(Array.from(grid.cells.t)).toEqual(expected.CellDistances);

    // 6. Assert: Feature-level Metadata
    const actualFeatures = grid.features.filter((f: any) => f);

    expect(actualFeatures.length).toBe(expected.Features.length);

    for (let i = 0; i < expected.Features.length; i++) {
      const exp = expected.Features[i];
      const act = actualFeatures[i];

      expect(act.i).toBe(exp.i);
      expect(act.land).toBe(exp.land);
      expect(act.type.toLowerCase()).toBe(exp.type);
    }
  });
});

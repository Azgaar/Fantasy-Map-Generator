import * as fs from "node:fs";
import * as path from "node:path";

import "./setup.js";
import { FeatureModule } from "../modules/features.js";
import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import { defaultTestSetup, typedArrayReplacer } from "./test.utils.js";

const dumpDir = path.join(process.cwd(), "tests", "regression_data");

if (!fs.existsSync(dumpDir)) {
  fs.mkdirSync(dumpDir, { recursive: true });
}

const generateFeatureDump = async () => {
  console.log("Generating feature data...");

  // 1. Define Deterministic State
  // We use the "continents" template so we get a good mix of land, oceans, and lakes.
  defaultTestSetup({ points: 2000, templateId: "continents" });

  // 2. Execute sequence
  globalThis.grid = generateGrid(globalThis.seed, globalThis.graphWidth, globalThis.graphHeight);
  globalThis.grid.cells.h = await new HeightmapModule().generate(grid);
  new FeatureModule().markupGrid();

  // 5. Format Features (Filter out nulls/0-index elements just like C#.Where(f => f != null))
  const validFeatures = globalThis.grid.features
    .filter((f: any) => f)
    .map((f: any) => ({
      i: f.i,
      type: f.type.toLowerCase(),
      land: f.land
    }));

  // 6. Format and Dump Data
  const featureData = {
    CellFeatures: JSON.parse(JSON.stringify(globalThis.grid.cells.f, typedArrayReplacer)),
    CellDistances: JSON.parse(JSON.stringify(globalThis.grid.cells.t, typedArrayReplacer)),
    Features: validFeatures
  };

  const dumpPath = path.join(dumpDir, "feature_grid_regression.json");
  fs.writeFileSync(dumpPath, JSON.stringify(featureData, null, 2));

  console.log(`✅ Dumped: ${dumpPath}`);
};

generateFeatureDump();

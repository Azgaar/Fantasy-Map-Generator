import * as fs from "node:fs";
import * as path from "node:path";
import "./regression.setup.js";

import { GridFeatureRegressionRunner } from "./feature.regression.ts";
import { gridRunners } from "./grid.regression.js";
import { heightmapRunners } from "./heightmap.regression.js";
import type { IRegressionRunner } from "./regression.interface.ts";

// Register all runners here (The TypeScript equivalent of C# Reflection)
const runners: IRegressionRunner[] = [new GridFeatureRegressionRunner(), ...gridRunners, ...heightmapRunners];

const dumpDir = path.join(process.cwd(), "tests", "regression_data");
if (!fs.existsSync(dumpDir)) {
  fs.mkdirSync(dumpDir, { recursive: true });
}

const executeMasterDump = async () => {
  console.log(`🚀 Starting Master Dump Sequence (${runners.length} suites)...`);

  for (const runner of runners) {
    try {
      // Fetch all dump payloads from the runner
      const dump = await runner.execute();
      const dumpPath = path.join(dumpDir, runner.filename);
      fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2));
      console.log(`  ✅ Dumped:  ${runner.name} into ${runner.filename}`);
    } catch (error) {
      console.error(`  ❌ Critical Failure in ${runner.name} dump sequence:`, error);
      process.exit(1);
    }
  }

  console.log("\n🎉 All regression data generated successfully.");
};

executeMasterDump();

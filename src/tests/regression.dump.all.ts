import * as fs from "node:fs";
import * as path from "node:path";
import "./regression.setup.js";

import { FeatureRegressionRunner } from "./feature.regression.ts";
import { GridRegressionRunner } from "./grid.regression.js";
import { HeightmapRegressionRunner } from "./heightmap.regression.js";
import type { IRegressionRunner } from "./regression.interface.ts";

// Register all runners here (The TypeScript equivalent of C# Reflection)
const runners: IRegressionRunner[] = [
  new GridRegressionRunner(),
  new HeightmapRegressionRunner(),
  new FeatureRegressionRunner()
];

const dumpDir = path.join(process.cwd(), "tests", "regression_data");
if (!fs.existsSync(dumpDir)) {
  fs.mkdirSync(dumpDir, { recursive: true });
}

const executeMasterDump = async () => {
  console.log(`🚀 Starting Master Dump Sequence (${runners.length} suites)...`);

  for (const runner of runners) {
    console.log(`\n--- Executing Suite: ${runner.name} ---`);

    try {
      // Fetch all dump payloads from the runner
      const dumps = await runner.generateDumps();

      // Write each payload to the file system
      for (const dump of dumps) {
        const dumpPath = path.join(dumpDir, dump.filename);
        fs.writeFileSync(dumpPath, JSON.stringify(dump.data, null, 2));
        console.log(`  ✅ Dumped: ${dump.filename}`);
      }
    } catch (error) {
      console.error(`  ❌ Critical Failure in ${runner.name} dump sequence:`, error);
      process.exit(1);
    }
  }

  console.log("\n🎉 All regression data generated successfully.");
};

executeMasterDump();

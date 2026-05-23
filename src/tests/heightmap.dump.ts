// src/tests/heightmap.dump.ts
import * as fs from "node:fs";
import * as path from "node:path";

import "./setup.js";
import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import { heightmapTestCases } from "./heightmap.cases.js";
import { defaultTestSetup } from "./test.utils.js";

const dumpDir = path.join(process.cwd(), "tests", "regression_data");
if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

const generateAllDumps = async () => {
  console.log(`Starting Heightmap Dumps (${heightmapTestCases.length} cases)...`);

  for (const testCase of heightmapTestCases) {
    // 1. Deterministic state
    defaultTestSetup({
      templateId: testCase.isTemplate ? testCase.recipe : undefined,
      customRecipe: !testCase.isTemplate ? testCase.recipe : undefined
    });

    globalThis.grid = generateGrid(seed, 1024, 768);

    // 2. Execute exactly as FMG does
    const generator = new HeightmapModule();
    const heightsArray = await generator.generate(grid);

    // 3. Dump to JSON matching your C# structure
    const data = {
      Seed: seed,
      Width: 1024,
      Height: 768,
      Heights: Array.from(heightsArray)
    };

    const filename = `heightmap_${testCase.name}_regression.json`;
    const filepath = path.join(dumpDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

    console.log(`✅ Dumped: ${filename}`);
  }
};

generateAllDumps();

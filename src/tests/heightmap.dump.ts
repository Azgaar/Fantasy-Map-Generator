// src/tests/heightmap.dump.ts
import * as fs from "node:fs";
import * as path from "node:path";
import Alea from "alea";

import "./setup.js";
import { HeightmapModule } from "../modules/heightmap-generator.js";
import { generateGrid } from "../utils/graphUtils.js";
import { heightmapTestCases, injectRecipeToGlobals } from "./heightmap.cases.js";

const dumpDir = path.join(process.cwd(), "tests", "regression_data");
if (!fs.existsSync(dumpDir)) fs.mkdirSync(dumpDir, { recursive: true });

const generateAllDumps = async () => {
  console.log(`Starting Heightmap Dumps (${heightmapTestCases.length} cases)...`);

  for (const testCase of heightmapTestCases) {
    // 1. Deterministic state
    const seed = "12345";
    globalThis.seed = seed;
    globalThis.graphWidth = 1024;
    globalThis.graphHeight = 768;

    Math.random = Alea(seed);
    const grid = generateGrid(seed, 1024, 768);
    globalThis.grid = grid;

    // 2. Inject the recipe so FMG finds it
    injectRecipeToGlobals(testCase);

    // 3. Execute exactly as FMG does
    const generator = new HeightmapModule();
    const heightsArray = await generator.generate(grid);

    // 4. Dump to JSON matching your C# structure
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

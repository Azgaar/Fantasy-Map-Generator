import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Alea from 'alea';

import './setup.js';
import { generateGrid } from '../utils/graphUtils.js';
import { HeightmapModule } from '../modules/heightmap-generator.js';
import { heightmapTestCases, injectRecipeToGlobals } from './heightmap.cases.js';

interface HeightmapRegressionData {
    Seed: string;
    Width: number;
    Height: number;
    Heights: number[];
}

describe('Heightmap Generator Parameterized Regression', () => {
    const dataDir = path.join(process.cwd(), 'tests', 'regression_data');

    // it.each takes our array and runs the test block for every single case
    it.each(heightmapTestCases)('Heightmap regression: $name', async (testCase) => {

        // 1. Load the specific heightmap dump
        const jsonPath = path.join(dataDir, `heightmap_${testCase.name}_regression.json`);
        if (!fs.existsSync(jsonPath)) {
            throw new Error(`Regression data missing. Run dump script. Path: ${jsonPath}`);
        }
        const expected: HeightmapRegressionData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        // 2. Setup Deterministic MapData (Voronoi Graph)
        globalThis.seed = expected.Seed;
        globalThis.graphWidth = expected.Width;
        globalThis.graphHeight = expected.Height;
        
        Math.random = Alea(expected.Seed);
        globalThis.grid = generateGrid(expected.Seed, expected.Width, expected.Height);

        // 3. Inject Recipe & Execute
        injectRecipeToGlobals(testCase);
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
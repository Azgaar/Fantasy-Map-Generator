import { describe, expect, it } from "vitest";
import { type HeightmapRegressionData, HeightmapRegressionRunner, heightmapTestCases } from "./heightmap.regression.js";
import { loadRegressionData } from "./regression.utils.js";

describe("Heightmap Generator Parameterized Regression", () => {
  it.each(heightmapTestCases)("Heightmap regression: $name", async testCase => {
    // 1. Load Expected Data
    const expected = loadRegressionData<HeightmapRegressionData>(`heightmap_${testCase.name}_regression.json`);

    // 2. Execute same logic as dumper
    const runner = new HeightmapRegressionRunner();
    const actual = await runner.execute(testCase);

    // 3. Assert parity
    expect(actual.Seed).toEqual(expected.Seed);
    expect(actual.Width).toEqual(expected.Width);
    expect(actual.Height).toEqual(expected.Height);
    expect(actual.Heights).toEqual(expected.Heights);
  });
});

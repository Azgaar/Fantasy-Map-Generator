import { describe, expect, it } from "vitest";
import { type HeightmapRegressionData, heightmapSuite } from "./heightmap.regression.js";
import { loadRegressionData } from "./regression.utils.js";

describe("Heightmap Generator Parameterized Regression", () => {
  it.each(heightmapSuite.runners.map(r => [r]))("Heightmap regression: $name", async runner => {
    const expected = loadRegressionData<HeightmapRegressionData>(runner.filename);
    const actual = await runner.execute();

    // 3. Assert parity
    expect(actual.Seed).toBe(expected.Seed);
    expect(actual.Width).toBe(expected.Width);
    expect(actual.Height).toBe(expected.Height);
    expect(actual.Heights).toEqual(expected.Heights);
  });
});

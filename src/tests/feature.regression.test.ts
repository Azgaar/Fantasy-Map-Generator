import { describe, expect, it } from "vitest";
import { FeatureRegressionRunner, type GridFeatureRegressionData } from "./feature.regression.js";
import { loadRegressionData } from "./regression.utils.js";

describe("Feature Regression Tests", () => {
  it("MarkupGrid regression test", async () => {
    // 1. Load Expected Data
    const expected = loadRegressionData<GridFeatureRegressionData>("feature_grid_regression.json");

    // 2. Execute Generator
    const runner = new FeatureRegressionRunner();
    const actual = await runner.execute();

    // 3. Assert: Top-Level Hybrid approach
    // We check array lengths first so a massive length mismatch doesn't try to diff 10,000 items
    expect(actual.CellFeatures.length).toBe(expected.CellFeatures.length);
    expect(actual.CellDistances.length).toBe(expected.CellDistances.length);
    expect(actual.Features.length).toBe(expected.Features.length);

    // Deep equality on the specific semantic buckets.
    // This is vastly superior to a manual `for` loop in TS!
    expect(actual.CellFeatures).toEqual(expected.CellFeatures);
    expect(actual.CellDistances).toEqual(expected.CellDistances);
    expect(actual.Features).toEqual(expected.Features);
  });
});

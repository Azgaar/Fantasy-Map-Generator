import { describe, expect, it } from "vitest";
import { type GridFeatureRegressionData, GridFeatureRegressionRunner } from "./feature.regression.js";
import { loadRegressionData } from "./regression.utils.js";

describe("Feature Regression Tests", () => {
  it("MarkupGrid regression test", async () => {
    const runner = new GridFeatureRegressionRunner();
    const expected = loadRegressionData<GridFeatureRegressionData>(runner.filename);
    const actual = await runner.execute();

    expect(actual.CellFeatures.length).toBe(expected.CellFeatures.length);
    expect(actual.CellDistances.length).toBe(expected.CellDistances.length);
    expect(actual.Features.length).toBe(expected.Features.length);

    expect(actual.CellFeatures).toEqual(expected.CellFeatures);
    expect(actual.CellDistances).toEqual(expected.CellDistances);
    expect(actual.Features).toEqual(expected.Features);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { getStateExpansionSettings } from "./state-generation-settings";

const originalGetElementById = document.getElementById;

afterEach(() => {
  document.getElementById = originalGetElementById;
});

describe("getStateExpansionSettings", () => {
  it("defaults the editor-only growth rate when the states editor is closed", () => {
    document.getElementById = ((id: string) =>
      id === "growthRate" ? { valueAsNumber: 1.5 } : null) as typeof document.getElementById;

    expect(getStateExpansionSettings()).toEqual({ globalGrowthRate: 1.5, statesGrowthRate: 1 });
  });

  it("reads the editor growth rate when the states editor is open", () => {
    document.getElementById = ((id: string) => ({
      valueAsNumber: id === "growthRate" ? 1.5 : 2
    })) as unknown as typeof document.getElementById;

    expect(getStateExpansionSettings()).toEqual({ globalGrowthRate: 1.5, statesGrowthRate: 2 });
  });
});

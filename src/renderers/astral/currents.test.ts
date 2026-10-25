import { describe, expect, it } from "vitest";
import { currentPath, currentWidth } from "./currents";

describe("currentWidth", () => {
  it("reads small discharge as a hairline and grows by decade", () => {
    expect(currentWidth(0)).toBe(0.4);
    expect(currentWidth(1)).toBe(0.4);
    expect(currentWidth(10)).toBe(1.05);
    expect(currentWidth(100)).toBe(1.7);
    expect(currentWidth(1000)).toBe(2.35);
  });

  it("clamps the top of the ladder and stays finite", () => {
    expect(currentWidth(10_000)).toBe(3);
    expect(currentWidth(1e9)).toBe(3);
    expect(currentWidth(Number.NaN)).toBe(0.4);
  });
});

describe("currentPath", () => {
  it("walks the course as one M/L polyline, rounded to map units", () => {
    expect(
      currentPath([
        [10.49, 20.51],
        [30, 40],
        [50.04, 60.96]
      ])
    ).toBe("M10.5 20.5L30 40L50 61");
  });

  it("draws nothing for a course shorter than two points", () => {
    expect(currentPath([])).toBe("");
    expect(currentPath([[1, 2]])).toBe("");
  });
});

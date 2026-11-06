import { describe, expect, it } from "vitest";
import { getPercentile } from "./number-utils";

describe("getPercentile", () => {
  it("picks the value a share of the way up the sorted values", () => {
    expect(getPercentile([5, 1, 3], 0.5)).toBe(3);
    expect(getPercentile([5, 1, 3], 1)).toBe(5);
  });

  it("has no value without values", () => {
    expect(getPercentile([], 0.9)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { buildDustBands } from "./dust-bands";

describe("dust bands", () => {
  it("buckets land elevation evenly over the land range and leaves the void at 0", () => {
    const bands = buildDustBands([0, 19, 20, 39, 40, 100], 4);
    expect([...bands]).toEqual([0, 0, 1, 1, 2, 4]);
  });

  it("clamps the peak into the top band and honours a single band", () => {
    expect([...buildDustBands([100, 20], 6)]).toEqual([6, 1]);
    expect([...buildDustBands([55, 100], 1)]).toEqual([1, 1]);
  });
});

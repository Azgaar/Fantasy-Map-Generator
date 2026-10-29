import { describe, expect, test } from "vitest";
import type { Burg } from "@/model/political/burgs-generator";
import { buildDensityField } from "./star-density-field";

/** a row of cells along x, spaced 100 apart, each 100 wide */
function row(heights: number[]) {
  return {
    i: heights.map((_, index) => index),
    c: heights.map((_, index) => [index - 1, index + 1].filter(id => id >= 0 && id < heights.length)),
    p: heights.map((_, index) => [(index + 0.5) * 100, 50] as [number, number]),
    h: Float64Array.from(heights)
  };
}

const burg = (i: number, cell: number, x: number, population: number): Burg =>
  ({ i, cell, x, y: 50, population }) as Burg;
const SIZE = { width: 1000, height: 100 }; // the smaller side is 100, so reach 150 gives a radius of 150
const FIELD = { reach: 150, levels: 5, populationWeight: 0.5 };

describe("star density field", () => {
  test("spreads a system inside the kernel reach and bands the peak at the top level", () => {
    const cells = row([50, 50, 50, 50, 50]);
    const bands = buildDensityField(cells, [burg(1, 1, 150, 100)], SIZE, FIELD);

    expect(bands[1]).toBe(5); // the system's own cell is the peak
    expect(bands[0]).toBe(1); // 100 away, a third of the peak value
    expect(bands[2]).toBe(bands[0]);
    expect(bands[3]).toBe(0); // 200 away, beyond the reach
    expect(bands[4]).toBe(0);
  });

  test("leaves water cells blank", () => {
    const cells = row([50, 50, 10, 50, 50]);
    const bands = buildDensityField(cells, [burg(1, 1, 150, 100)], SIZE, FIELD);
    expect(bands[2]).toBe(0);
    expect(bands[3]).toBe(0); // the kernel never crosses the water
  });

  test("population weight makes a rich system denser than a poor one", () => {
    const systems = [burg(1, 1, 150, 100), burg(2, 3, 350, 10)];
    const even = buildDensityField(row([50, 50, 50, 50, 50]), systems, SIZE, { ...FIELD, populationWeight: 0 });
    const weighted = buildDensityField(row([50, 50, 50, 50, 50]), systems, SIZE, { ...FIELD, populationWeight: 1 });

    expect(even[3]).toBe(5); // ignoring population, the poor system's cell is a full peak too
    expect(weighted[3]).toBe(0); // weighted, its kernel is a tenth of the rich one's: below the first threshold
    expect(weighted[1]).toBe(5);
  });

  test("is empty on a map with no burgs", () => {
    const bands = buildDensityField(row([50, 50, 50]), [], SIZE, FIELD);
    expect([...bands]).toEqual([0, 0, 0]);
  });

  test("is deterministic for the same input", () => {
    const cells = row([50, 50, 50, 50, 50]);
    const systems = [burg(1, 1, 150, 100), burg(2, 3, 350, 40)];
    expect(buildDensityField(cells, systems, SIZE, FIELD)).toEqual(buildDensityField(cells, systems, SIZE, FIELD));
  });
});

import { describe, expect, it } from "vitest";
import type { StarSystem } from "@/generators/astral-naming";
import { groupByClass, STAR_CLASSES, starRadiusEm } from "./system-markers";

describe("star sizes", () => {
  it("grows the radius with the population, on a log scale", () => {
    expect(starRadiusEm(500)).toBeLessThan(starRadiusEm(50_000));
    expect(starRadiusEm(50_000)).toBeLessThan(starRadiusEm(2_000_000));
  });

  it("clamps at both ends of the ladder", () => {
    expect(starRadiusEm(1)).toBe(starRadiusEm(2_000));
    expect(starRadiusEm(10_000_000)).toBe(starRadiusEm(100_000_000));
  });
});

describe("grouping by class", () => {
  it("keys the systems by class, with every class present in render order", () => {
    const system = (cls: string): StarSystem => ({ class: cls }) as StarSystem;
    const groups = groupByClass([system("M"), system("G"), system("G")]);

    expect(Object.keys(groups)).toEqual(STAR_CLASSES);
    expect(groups.G).toHaveLength(2);
    expect(groups.M).toEqual([system("M")]);
    expect(groups.F).toEqual([]);
  });
});

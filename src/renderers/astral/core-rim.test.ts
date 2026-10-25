import { describe, expect, it } from "vitest";
import type { Point } from "@/types/global";
import { coreRimAxis } from "./core-rim";

describe("coreRimAxis", () => {
  it("runs from the warm edge to the cold edge on a banded map", () => {
    // grid y grows downward: equator at the bottom edge, pole at the top
    const points: Point[] = [
      [10, 90],
      [10, 60],
      [10, 30],
      [10, 0]
    ];
    const temp = [30, 20, 0, -30];
    expect(coreRimAxis(points, temp)).toEqual({ hot: [10, 90], cold: [10, 0] });
  });

  it("finds both ends on a whole-globe map, never an axis error", () => {
    // U-shaped: cold poles top and bottom, warm equator in the middle
    const points: Point[] = [
      [0, 0],
      [50, 0],
      [0, 50],
      [50, 50],
      [0, 100],
      [50, 100]
    ];
    const temp = [-30, -30, 30, 30, -30, -30];
    const axis = coreRimAxis(points, temp);
    expect(axis?.hot).toEqual([0, 50]); // the first equator point wins the tie
    expect(axis?.cold).toEqual([0, 0]); // the first polar point wins
    expect(Number.isFinite(axis!.hot[0] + axis!.cold[1])).toBe(true);
  });

  it("returns null for a flat field", () => {
    expect(
      coreRimAxis(
        [
          [0, 0],
          [1, 1]
        ],
        [5, 5]
      )
    ).toBeNull();
  });
});

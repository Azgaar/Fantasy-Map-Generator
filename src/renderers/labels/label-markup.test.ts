import { describe, expect, test } from "vitest";
import "@/model/styles/styles";
import type { Point } from "@/types/global";
import { estimateLabelLength } from "./label-arc";
import { getLabelPath } from "./label-markup";

const label = (pathPoints: Point[], text = "Protectorate of Aga") =>
  ({ text, type: "state", group: "state", pathPoints }) as const;

const ends = (d: string): number[] => {
  const n = d.match(/-?\d*\.?\d+/g)!.map(Number);
  return [n[0], n[1], n.at(-2)!, n.at(-1)!];
};

describe("getLabelPath", () => {
  test("a path with room for its text is left as drawn", () => {
    const pathPoints: Point[] = [
      [0, 50],
      [5000, 50]
    ];
    expect(getLabelPath(label(pathPoints))).toBe("M0,50L5000,50");
  });

  test("a path too short for its text gets equal straight tails", () => {
    const [x0, y0, x1, y1] = ends(
      getLabelPath(
        label([
          [100, 50],
          [110, 50]
        ])
      )
    );
    expect([y0, y1]).toEqual([50, 50]);
    expect(100 - x0).toBeCloseTo(x1 - 110, 1);
    expect(x1 - x0).toBeGreaterThan(estimateLabelLength(label([])));
  });

  test("a path collapsed into one point becomes a level line through it", () => {
    const pole: Point = [428, 465];
    const [x0, y0, x1, y1] = ends(getLabelPath(label([pole, pole, pole])));
    expect([y0, y1]).toEqual([465, 465]);
    expect(428 - x0).toBeCloseTo(x1 - 428, 1);
    expect(x1 - x0).toBeGreaterThan(estimateLabelLength(label([])));
  });
});

import { describe, expect, it } from "vitest";
import { ensureMeasurerIds, getNextMeasurerId, type Measurer } from "./measurers-generator";

describe("measurer identities", () => {
  it("normalizes legacy measurers without changing existing stable IDs", () => {
    const measurers = [
      {
        i: 7,
        points: [
          [0, 0],
          [1, 1]
        ],
        type: "Ruler"
      },
      {
        points: [
          [2, 2],
          [3, 3]
        ],
        type: "Opisometer"
      }
    ] as Measurer[];
    ensureMeasurerIds(measurers);
    expect(measurers.map(({ i }) => i)).toEqual([7, 8]);
    expect(getNextMeasurerId(measurers)).toBe(9);
  });
});

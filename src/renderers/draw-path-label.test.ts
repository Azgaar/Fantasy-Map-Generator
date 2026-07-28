import { describe, expect, test } from "vitest";
import { getLabelPath, getLabelTextMarkup } from "./draw-path-label";

const label = {
  id: "stateLabel1",
  text: "North",
  pathPoints: [
    [0, 0],
    [10, 0]
  ] as [number, number][]
};

describe("path label markup", () => {
  test("generates path data shared by rendering and measurement", () => {
    expect(getLabelPath(label)).toBe("M0,0L10,0");
  });

  test("omits letter spacing when it is not set", () => {
    expect(getLabelTextMarkup(label).includes("letter-spacing")).toBe(false);
  });
});

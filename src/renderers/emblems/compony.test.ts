import { describe, expect, it } from "vitest";
import { pathSegments } from "./compony";
import { shieldShapes } from "./shields";

describe("pathSegments", () => {
  it("expands implicit repeats and reads packed arc flags", () => {
    expect(pathSegments("m0,0 10,10 a9 9 0 003.1-4.6z")).toEqual([
      { type: "m", values: [0, 0] },
      { type: "l", values: [10, 10] },
      { type: "a", values: [9, 9, 0, 0, 0, 3.1, -4.6] },
      { type: "z", values: [] }
    ]);
  });

  it("splits every shield outline into the edges its compony data expects", () => {
    for (const [name, { path, segments }] of Object.entries(shieldShapes)) {
      const drawn = pathSegments(path).length - 2; // all but the move and the close, which may count as an edge
      const edges = segments?.reduce((a, b) => a + b, 0);
      if (edges) expect(edges === drawn || edges === drawn + 1, name).toBe(true);
    }
  });
});

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CapturedFeature, Feature } from "./features";

const EMPTY = undefined; // pack.features holds a 0 placeholder and gaps where a feature id is unused

// pack cells 0-5 sit on grid cells 10-15; the feature ids per pack cell change when the graph is rebuilt
function setPack(featureIds: number[], features: (Partial<Feature> | undefined)[]): void {
  globalThis.pack = {
    cells: { f: Uint16Array.from(featureIds), g: [10, 11, 12, 13, 14, 15] },
    features
  } as unknown as typeof pack;
}

describe("feature user data across a re-markup", () => {
  beforeAll(async () => {
    await import("./features");
  });

  beforeEach(() => {
    setPack(
      [1, 1, 1, 2, 2, 2],
      [EMPTY, { i: 1, name: "Mirror Lake", note: "Deep and cold" }, { i: 2, name: "Ald Sea" }]
    );
  });

  function capture(): CapturedFeature[] {
    return Features.captureUserData();
  }

  it("captures the grid cells a named or noted feature covered", () => {
    const captured = capture();

    expect(captured).toHaveLength(2);
    expect(captured[0]).toMatchObject({ name: "Mirror Lake", note: "Deep and cold" });
    expect([...captured[0].gridCells]).toEqual([10, 11, 12]);
  });

  it("hands the name and note to the new feature covering the same ground", () => {
    const captured = capture();

    // the graph is rebuilt: the lake is now feature 3 and lost a cell, the sea is feature 4
    setPack([3, 3, 0, 4, 4, 4], [EMPTY, EMPTY, EMPTY, { i: 3, name: "Generated" }, { i: 4, name: "Renamed" }]);
    Features.restoreUserData(captured);

    expect(pack.features[3]).toMatchObject({ name: "Mirror Lake", note: "Deep and cold" });
    expect(pack.features[4].name).toBe("Ald Sea");
  });

  it("drops the data when most of the old feature is gone", () => {
    const captured = capture();

    // only one of the lake's three grid cells is still a lake
    setPack([5, 0, 0, 4, 4, 4], [EMPTY, EMPTY, EMPTY, EMPTY, { i: 4 }, { i: 5, name: "Generated" }]);
    Features.restoreUserData(captured);

    expect(pack.features[5]).toMatchObject({ name: "Generated" });
    expect(pack.features[5].note).toBeUndefined();
  });

  it("gives one old feature to one new feature, best overlap first", () => {
    const captured = capture();

    // both old features now fall inside a single merged body of water
    setPack([3, 3, 3, 3, 3, 3], [EMPTY, EMPTY, EMPTY, { i: 3, name: "Generated" }]);
    Features.restoreUserData(captured);

    expect(pack.features[3].name).toBe("Mirror Lake");
    expect(pack.features[3].note).toBe("Deep and cold");
  });

  it("does not hand a lake's data to the island that replaced it", () => {
    setPack(
      [1, 1, 1, 2, 2, 2],
      [
        EMPTY,
        { i: 1, name: "Mirror Lake", note: "Deep and cold", type: "lake" },
        { i: 2, name: "Ald Sea", type: "ocean" }
      ]
    );
    const captured = capture();

    // the lake bed was raised, so the same ground is now part of an island
    setPack(
      [3, 3, 3, 4, 4, 4],
      [EMPTY, EMPTY, EMPTY, { i: 3, name: "Generated", type: "island" }, { i: 4, name: "Renamed", type: "ocean" }]
    );
    Features.restoreUserData(captured);

    expect(pack.features[3]).toMatchObject({ name: "Generated" });
    expect(pack.features[3].note).toBeUndefined();
    expect(pack.features[4].name).toBe("Ald Sea");
  });

  it("does nothing without a capture", () => {
    expect(() => Features.restoreUserData([])).not.toThrow();
  });
});

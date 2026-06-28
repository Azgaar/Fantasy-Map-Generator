import { beforeEach, describe, expect, it } from "vitest";
import { removeCultureCascade } from "./cultures-cascade";

// Minimal world: 3 real cultures (+ neutral 0).
//   culture 1 owns burgs 1 & 2, state 1, origin [0]
//   culture 2 owns burg 3, state 2, origin [1]    (origin cleared when 1 removed)
//   culture 3 owns burg 4, origins [1, 2]         (keeps 2 when 1 removed)
function makeWorld() {
  return {
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Alpha", origins: [0] },
      { i: 2, name: "Beta", origins: [1] },
      { i: 3, name: "Gamma", origins: [1, 2] }
    ],
    burgs: [0, { i: 1, culture: 1 }, { i: 2, culture: 1 }, { i: 3, culture: 2 }, { i: 4, culture: 3 }],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "State A", culture: 1 },
      { i: 2, name: "State B", culture: 2 }
    ],
    cells: { culture: [0, 1, 1, 2, 3, 0] }
  };
}

describe("removeCultureCascade", () => {
  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
  });

  it("reassigns the culture's burgs and states to the neutral culture", () => {
    removeCultureCascade(1);
    const { burgs, states } = (globalThis as any).pack;
    expect(burgs[1].culture).toBe(0);
    expect(burgs[2].culture).toBe(0);
    expect(burgs[3].culture).toBe(2); // untouched
    expect(states[1].culture).toBe(0);
    expect(states[2].culture).toBe(2); // untouched
  });

  it("releases the culture's cells and marks the culture removed", () => {
    removeCultureCascade(1);
    const { cells, cultures } = (globalThis as any).pack;
    expect(cells.culture).toEqual([0, 0, 0, 2, 3, 0]);
    expect(cultures[1].removed).toBe(true);
  });

  it("drops the removed culture from other cultures' origin lists", () => {
    removeCultureCascade(1);
    const { cultures } = (globalThis as any).pack;
    expect(cultures[2].origins).toEqual([0]); // only origin removed -> defaults to [0]
    expect(cultures[3].origins).toEqual([2]); // keeps the surviving origin
  });

  it("deleting multiple cultures leaves pack in the expected aggregate state", () => {
    removeCultureCascade(1);
    removeCultureCascade(2);
    const { cultures, burgs, cells } = (globalThis as any).pack;
    expect(cultures[1].removed).toBe(true);
    expect(cultures[2].removed).toBe(true);
    expect(cultures[3].removed).toBeUndefined();
    // all burgs of cultures 1 & 2 are now neutral; culture 3's burg untouched
    expect(burgs.slice(1).map((b: any) => b.culture)).toEqual([0, 0, 0, 3]);
    expect(cells.culture).toEqual([0, 0, 0, 0, 3, 0]);
    expect(cultures[3].origins).toEqual([0]); // both removed origins gone -> defaults to [0]
  });

  it("ignores the neutral culture and already-removed cultures", () => {
    const before = JSON.stringify((globalThis as any).pack);
    removeCultureCascade(0);
    removeCultureCascade(99);
    expect(JSON.stringify((globalThis as any).pack)).toBe(before);
  });
});

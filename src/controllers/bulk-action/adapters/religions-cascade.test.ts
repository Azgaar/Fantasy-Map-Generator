import { beforeEach, describe, expect, it } from "vitest";
import { removeReligionCascade } from "./religions-cascade";

// Minimal world: 3 real religions (+ "No religion" 0).
//   religion 1 origin [0]
//   religion 2 origin [1]      (origin cleared when 1 removed)
//   religion 3 origins [1, 2]  (keeps 2 when 1 removed)
function makeWorld() {
  return {
    religions: [
      { i: 0, name: "No religion" },
      { i: 1, name: "Alpha", origins: [0] },
      { i: 2, name: "Beta", origins: [1] },
      { i: 3, name: "Gamma", origins: [1, 2] }
    ],
    cells: { religion: [0, 1, 1, 2, 3, 0] }
  };
}

describe("removeReligionCascade", () => {
  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
  });

  it("releases the religion's cells and marks the religion removed", () => {
    removeReligionCascade(1);
    const { cells, religions } = (globalThis as any).pack;
    expect(cells.religion).toEqual([0, 0, 0, 2, 3, 0]);
    expect(religions[1].removed).toBe(true);
  });

  it("drops the removed religion from other religions' origin lists", () => {
    removeReligionCascade(1);
    const { religions } = (globalThis as any).pack;
    expect(religions[2].origins).toEqual([0]); // only origin removed -> defaults to [0]
    expect(religions[3].origins).toEqual([2]); // keeps the surviving origin
  });

  it("deleting multiple religions leaves pack in the expected aggregate state", () => {
    removeReligionCascade(1);
    removeReligionCascade(2);
    const { religions, cells } = (globalThis as any).pack;
    expect(religions[1].removed).toBe(true);
    expect(religions[2].removed).toBe(true);
    expect(religions[3].removed).toBeUndefined();
    expect(cells.religion).toEqual([0, 0, 0, 0, 3, 0]);
    expect(religions[3].origins).toEqual([0]); // both removed origins gone -> defaults to [0]
  });

  it("ignores the neutral religion and already-removed religions", () => {
    const before = JSON.stringify((globalThis as any).pack);
    removeReligionCascade(0);
    removeReligionCascade(99);
    expect(JSON.stringify((globalThis as any).pack)).toBe(before);
  });
});

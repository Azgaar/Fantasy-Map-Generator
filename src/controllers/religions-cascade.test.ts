import { beforeEach, describe, expect, it } from "vitest";
import {
  describeReligionsCascade,
  isReligionDeletable,
  isReligionLocked,
  removeReligionCascade
} from "./religions-cascade";

// Minimal world: 3 real religions (+ "No religion" 0).
//   religion 1 origin [0]
//   religion 2 origin [1]      (origin cleared when 1 removed)
//   religion 3 origins [1, 2]  (keeps 2 when 1 removed); locked
function makeWorld() {
  return {
    religions: [
      { i: 0, name: "No religion" },
      { i: 1, name: "Alpha", origins: [0], lock: false },
      { i: 2, name: "Beta", origins: [1], lock: false },
      { i: 3, name: "Gamma", origins: [1, 2], lock: true }
    ],
    cells: { religion: [0, 1, 1, 2, 3, 0] }
  };
}

beforeEach(() => {
  (globalThis as any).pack = makeWorld();
});

describe("removeReligionCascade", () => {
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
    expect(religions[3].removed).toBe(undefined);
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

describe("religions bulk predicates and summary", () => {
  it("treats the neutral religion and removed religions as non-deletable", () => {
    expect(isReligionDeletable(0)).toBe(false);
    expect(isReligionDeletable(1)).toBe(true);
    expect(isReligionDeletable(99)).toBe(false);
  });

  it("reports lock status", () => {
    expect(isReligionLocked(1)).toBe(false);
    expect(isReligionLocked(3)).toBe(true);
  });

  it("describeReligionsCascade counts religions and reassigned cells", () => {
    const summary = describeReligionsCascade([1, 2]);
    const text = summary.lines.join(" ");
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(text.includes("2 religions")).toBe(true);
    expect(text.includes("3 cells")).toBe(true); // cells of religion 1 (2) + religion 2 (1)
  });

  it("describeReligionsCascade excludes the neutral religion and reports locked rows as skipped", () => {
    const summary = describeReligionsCascade([0, 1, 3]); // 0 not deletable, 3 locked
    expect(summary.deletable).toBe(1); // only religion 1
    expect(summary.skippedLocked).toBe(1); // religion 3
  });
});

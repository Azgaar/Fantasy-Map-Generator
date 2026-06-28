import { beforeEach, describe, expect, it } from "vitest";
import { describeStatesCascade, isStateDeletable, isStateLocked, removeStateCascade } from "./states-cascade";

// Minimal world: 3 real states (+ neutral 0).
//   state 1 owns burgs 1 (capital) & 2, province 1, regiment, neighbor 2
//   state 2 owns burg 3, province 2, neighbors 1 & 3
//   state 3 owns burg 4, neighbor 2  (kept, used to check neighbor cleanup); locked
function makeWorld() {
  return {
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Alpha", provinces: [1], military: [{ i: 0 }], neighbors: [2], lock: false },
      { i: 2, name: "Beta", provinces: [2], neighbors: [1, 3], lock: false },
      { i: 3, name: "Gamma", neighbors: [2], lock: true }
    ],
    burgs: [
      0,
      { i: 1, state: 1, capital: 1, cell: 1 },
      { i: 2, state: 1, capital: 0, cell: 2 },
      { i: 3, state: 2, capital: 0, cell: 3 },
      { i: 4, state: 3, capital: 0, cell: 4 }
    ],
    provinces: [0, { i: 1, state: 1 }, { i: 2, state: 2 }],
    cells: {
      state: [0, 1, 1, 2, 3, 0],
      province: [0, 1, 1, 2, 0, 0],
      burg: [0, 1, 2, 3, 4, 0]
    }
  };
}

beforeEach(() => {
  (globalThis as any).pack = makeWorld();
  (globalThis as any).notes = [{ id: "regiment1-0" }, { id: "note-keep" }];
});

describe("removeStateCascade", () => {
  it("reassigns the state's burgs to neutral and clears capital flag", () => {
    removeStateCascade(1);
    const { burgs } = (globalThis as any).pack;
    expect(burgs[1].state).toBe(0);
    expect(burgs[1].capital).toBe(0);
    expect(burgs[2].state).toBe(0);
    expect(burgs[3].state).toBe(2); // untouched
  });

  it("releases the state's cells and removes its provinces", () => {
    removeStateCascade(1);
    const { cells, provinces } = (globalThis as any).pack;
    expect(cells.state).toEqual([0, 0, 0, 2, 3, 0]);
    expect(cells.province).toEqual([0, 0, 0, 2, 0, 0]);
    expect(provinces[1]).toEqual({ i: 1, removed: true });
  });

  it("removes the state's military notes and marks the state removed", () => {
    removeStateCascade(1);
    expect((globalThis as any).notes).toEqual([{ id: "note-keep" }]);
    expect((globalThis as any).pack.states[1]).toEqual({ i: 1, removed: true });
  });

  it("drops the removed state from other states' neighbor lists", () => {
    removeStateCascade(1);
    expect((globalThis as any).pack.states[2].neighbors).toEqual([3]);
  });

  it("deleting multiple states leaves pack in the expected aggregate state", () => {
    removeStateCascade(1);
    removeStateCascade(2);
    const { states, burgs, provinces, cells } = (globalThis as any).pack;
    expect(states[1].removed).toBe(true);
    expect(states[2].removed).toBe(true);
    expect(states[3].removed).toBeUndefined();
    expect(burgs.slice(1).map((b: any) => b.state)).toEqual([0, 0, 0, 3]);
    expect(provinces[1].removed).toBe(true);
    expect(provinces[2].removed).toBe(true);
    expect(cells.state).toEqual([0, 0, 0, 0, 3, 0]);
    expect(states[3].neighbors).toEqual([]); // both removed neighbors gone
  });

  it("with deleteChildren, removes the state's burgs instead of reassigning them to neutral", () => {
    removeStateCascade(1, { deleteChildren: true });
    const { burgs, cells } = (globalThis as any).pack;
    expect(burgs[1].removed).toBe(true);
    expect(burgs[2].removed).toBe(true);
    expect(cells.burg).toEqual([0, 0, 0, 3, 4, 0]); // burgs 1 & 2 released from their cells
    expect(burgs[3].state).toBe(2); // other state's burg untouched
    expect(burgs[3].removed).toBeUndefined();
  });

  it("ignores the neutral state and already-removed states", () => {
    const before = JSON.stringify((globalThis as any).pack);
    removeStateCascade(0);
    removeStateCascade(99);
    expect(JSON.stringify((globalThis as any).pack)).toBe(before);
  });
});

describe("states bulk predicates and summary", () => {
  it("treats the neutral state and removed states as non-deletable", () => {
    expect(isStateDeletable(0)).toBe(false);
    expect(isStateDeletable(1)).toBe(true);
    expect(isStateDeletable(99)).toBe(false);
  });

  it("reports lock status", () => {
    expect(isStateLocked(1)).toBe(false);
    expect(isStateLocked(3)).toBe(true);
  });

  it("describeStatesCascade counts states, reassigned burgs and removed provinces", () => {
    const summary = describeStatesCascade([1, 2]);
    const text = summary.lines.join(" ");
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(text.includes("2 states")).toBe(true);
    expect(text.includes("3 burgs")).toBe(true); // burgs 1,2 (state1) + 3 (state2)
    expect(text.includes("2 provinces")).toBe(true);
  });

  it("describeStatesCascade excludes the neutral state and reports locked rows as skipped", () => {
    const summary = describeStatesCascade([0, 1, 3]); // 0 not deletable, 3 locked
    expect(summary.deletable).toBe(1); // only state 1
    expect(summary.skippedLocked).toBe(1); // state 3
  });

  it("describeStatesCascade reflects the deleteChildren option", () => {
    const reassign = describeStatesCascade([1, 2]);
    expect(reassign.lines.join(" ").includes("reassigned to neutral")).toBe(true);

    const withChildren = describeStatesCascade([1, 2], { deleteChildren: true });
    const text = withChildren.lines.join(" ");
    expect(text.includes("3 burgs")).toBe(true);
    expect(text.includes("removed")).toBe(true);
    expect(text.includes("reassigned to neutral")).toBe(false);
  });
});

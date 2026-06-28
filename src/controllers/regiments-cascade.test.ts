import { beforeEach, describe, expect, it } from "vitest";
import {
  decodeId,
  describeRegimentsCascade,
  encodeId,
  isRegimentDeletable,
  removeRegimentData
} from "./regiments-cascade";

// Minimal world: 2 real states (+ neutral 0). Regiment `i` is per-state (each
// state numbers its regiments from 0), so ids repeat across states.
//   state 1 owns regiments 0 & 1
//   state 2 owns regiment 0
function makeWorld() {
  return {
    states: [
      { i: 0, name: "Neutrals" },
      {
        i: 1,
        name: "Alpha",
        military: [
          { i: 0, name: "1st" },
          { i: 1, name: "2nd" }
        ]
      },
      { i: 2, name: "Beta", military: [{ i: 0, name: "1st" }] }
    ]
  };
}

const STATE_ID_MULTIPLIER = 100000;
const compositeId = (stateId: number, regimentId: number): number => stateId * STATE_ID_MULTIPLIER + regimentId;

describe("regiments composite id", () => {
  it("encodes a (stateId, regimentId) pair into one number", () => {
    expect(encodeId(2, 0)).toBe(compositeId(2, 0));
    expect(encodeId(1, 1)).toBe(compositeId(1, 1));
  });

  it("decodes a composite id back into its state and regiment ids", () => {
    expect(decodeId(compositeId(2, 0))).toEqual({ stateId: 2, regimentId: 0 });
    expect(decodeId(compositeId(1, 1))).toEqual({ stateId: 1, regimentId: 1 });
  });
});

describe("isRegimentDeletable", () => {
  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
  });

  it("treats existing regiments as deletable and missing ones as not", () => {
    expect(isRegimentDeletable(compositeId(1, 0))).toBe(true);
    expect(isRegimentDeletable(compositeId(1, 1))).toBe(true);
    expect(isRegimentDeletable(compositeId(2, 0))).toBe(true);
    expect(isRegimentDeletable(compositeId(2, 5))).toBe(false); // no such regiment
    expect(isRegimentDeletable(compositeId(99, 0))).toBe(false); // no such state
  });
});

describe("describeRegimentsCascade", () => {
  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
  });

  it("counts deletable regiments with no locked skips", () => {
    const summary = describeRegimentsCascade([compositeId(1, 0), compositeId(1, 1), compositeId(2, 0)]);
    expect(summary.deletable).toBe(3);
    expect(summary.skippedLocked).toBe(0);
    expect(summary.lines.join(" ").includes("3 regiments")).toBe(true);
  });

  it("excludes non-existent ids and singularizes one regiment", () => {
    const summary = describeRegimentsCascade([compositeId(1, 0), compositeId(99, 0)]);
    expect(summary.deletable).toBe(1);
    expect(summary.lines.join(" ").includes("1 regiment will be removed")).toBe(true);
  });
});

describe("removeRegimentData", () => {
  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    (globalThis as any).notes = [
      { id: "regiment1-0" },
      { id: "regiment1-1" },
      { id: "regiment2-0" },
      { id: "note-keep" }
    ];
  });

  it("splices the regiment from its state's military and removes its note", () => {
    removeRegimentData(1, 0);
    const { military } = (globalThis as any).pack.states[1];
    expect(military.map((r: any) => r.i)).toEqual([1]); // regiment 0 gone, 1 remains
    expect((globalThis as any).notes.map((n: any) => n.id)).toEqual(["regiment1-1", "regiment2-0", "note-keep"]);
  });

  it("removes only the matching state's regiment when ids repeat across states", () => {
    removeRegimentData(2, 0);
    expect((globalThis as any).pack.states[1].military.map((r: any) => r.i)).toEqual([0, 1]); // untouched
    expect((globalThis as any).pack.states[2].military).toEqual([]);
    expect((globalThis as any).notes.map((n: any) => n.id)).toEqual(["regiment1-0", "regiment1-1", "note-keep"]);
  });

  it("removes multiple regiments across states", () => {
    removeRegimentData(1, 0);
    removeRegimentData(1, 1);
    removeRegimentData(2, 0);
    expect((globalThis as any).pack.states[1].military).toEqual([]);
    expect((globalThis as any).pack.states[2].military).toEqual([]);
    expect((globalThis as any).notes.map((n: any) => n.id)).toEqual(["note-keep"]);
  });

  it("removes the correct regiment via decoded composite id", () => {
    const { stateId, regimentId } = decodeId(compositeId(1, 0));
    removeRegimentData(stateId, regimentId);
    expect((globalThis as any).pack.states[1].military.map((r: any) => r.i)).toEqual([1]);
    expect((globalThis as any).notes.map((n: any) => n.id)).toEqual(["regiment1-1", "regiment2-0", "note-keep"]);
  });

  it("ignores a missing state or regiment without mutating pack/notes", () => {
    const before = JSON.stringify((globalThis as any).pack);
    const notesBefore = JSON.stringify((globalThis as any).notes);
    removeRegimentData(99, 0); // no such state
    removeRegimentData(1, 99); // no such regiment
    expect(JSON.stringify((globalThis as any).pack)).toBe(before);
    expect(JSON.stringify((globalThis as any).notes)).toBe(notesBefore);
  });
});

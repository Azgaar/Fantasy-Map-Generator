import { beforeEach, describe, expect, it } from "vitest";
import { createRegimentsAdapter } from "./regiments-adapter";

// Regiment `i` is per-state, so the adapter keys rows by a composite id
// (stateId * 100000 + regimentId).
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

describe("regimentsAdapter", () => {
  let adapter: ReturnType<typeof createRegimentsAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    (globalThis as any).notes = [
      { id: "regiment1-0" },
      { id: "regiment1-1" },
      { id: "regiment2-0" },
      { id: "note-keep" }
    ];
    adapter = createRegimentsAdapter(() => {});
  });

  it("encodes the composite id from the row's state and regiment data attributes", () => {
    const row = { dataset: { s: "2", id: "0" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(compositeId(2, 0));
  });

  it("returns null for rows without state/regiment data (e.g. the total line)", () => {
    const row = { dataset: {} } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBeNull();
  });

  it("treats existing regiments as deletable and missing ones as not", () => {
    expect(adapter.isDeletable(compositeId(1, 0))).toBe(true);
    expect(adapter.isDeletable(compositeId(1, 1))).toBe(true);
    expect(adapter.isDeletable(compositeId(2, 0))).toBe(true);
    expect(adapter.isDeletable(compositeId(2, 5))).toBe(false); // no such regiment
    expect(adapter.isDeletable(compositeId(99, 0))).toBe(false); // no such state
  });

  it("offers neither lock nor color", () => {
    expect(adapter.supportsColor).toBe(false);
    expect(adapter.setLock).toBeUndefined();
    expect(adapter.setColor).toBeUndefined();
    expect(adapter.isLocked(compositeId(1, 0))).toBe(false);
  });

  it("describeCascade counts deletable regiments with no locked skips", () => {
    const summary = adapter.describeCascade([compositeId(1, 0), compositeId(1, 1), compositeId(2, 0)]);
    expect(summary.deletable).toBe(3);
    expect(summary.skippedLocked).toBe(0);
    expect(summary.lines.join(" ").includes("3 regiments")).toBe(true);
  });

  it("describeCascade excludes non-existent ids and singularizes one regiment", () => {
    const summary = adapter.describeCascade([compositeId(1, 0), compositeId(99, 0)]);
    expect(summary.deletable).toBe(1);
    expect(summary.lines.join(" ").includes("1 regiment will be removed")).toBe(true);
  });

  it("deleteEntity resolves the owning state and removes the regiment via the cascade", () => {
    adapter.deleteEntity(compositeId(1, 0));
    expect((globalThis as any).pack.states[1].military.map((r: any) => r.i)).toEqual([1]);
    expect((globalThis as any).notes.map((n: any) => n.id)).toEqual(["regiment1-1", "regiment2-0", "note-keep"]);
  });

  it("deleteEntity removes the correct regiment when ids repeat across states", () => {
    adapter.deleteEntity(compositeId(2, 0));
    expect((globalThis as any).pack.states[1].military.map((r: any) => r.i)).toEqual([0, 1]); // untouched
    expect((globalThis as any).pack.states[2].military).toEqual([]);
  });

  it("invokes the injected redraw", () => {
    let redrawn = 0;
    const a = createRegimentsAdapter(() => {
      redrawn += 1;
    });
    a.redraw();
    expect(redrawn).toBe(1);
  });
});

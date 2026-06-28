import { beforeEach, describe, expect, it } from "vitest";
import { createMarkersAdapter } from "./markers-adapter";

// Markers live in a plain array keyed by `.i` (not array position): removal filters
// the marker out, so a "missing" marker is one no longer in the array.
function makeWorld() {
  return {
    markers: [
      { i: 0, type: "volcano" },
      { i: 1, type: "cave", lock: true }, // locked
      { i: 2, type: "ruins" }
    ]
  };
}

describe("markersAdapter", () => {
  let adapter: ReturnType<typeof createMarkersAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    adapter = createMarkersAdapter(() => {});
  });

  it("treats present markers as deletable and missing ones as not", () => {
    expect(adapter.isDeletable(0)).toBe(true);
    expect(adapter.isDeletable(2)).toBe(true);
    expect(adapter.isDeletable(99)).toBe(false); // missing
  });

  it("does not offer color or children", () => {
    expect(adapter.supportsColor).toBe(false);
    expect(adapter.childKind).toBeUndefined();
  });

  it("reads row ids from data-i", () => {
    const row = { dataset: { i: "2" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(2);
  });

  it("reports and sets lock", () => {
    expect(adapter.isLocked(1)).toBe(true);
    expect(adapter.isLocked(0)).toBe(false);
    adapter.setLock?.(0, true);
    expect((globalThis as any).pack.markers.find((m: any) => m.i === 0).lock).toBe(true);
    adapter.setLock?.(0, false);
    expect((globalThis as any).pack.markers.find((m: any) => m.i === 0).lock).toBeUndefined();
  });

  it("describeCascade counts deletable markers and reports locked rows as skipped", () => {
    const summary = adapter.describeCascade([0, 1, 2]); // 1 is locked
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(1);
    expect(summary.lines.join(" ").includes("2 markers")).toBe(true);
  });
});

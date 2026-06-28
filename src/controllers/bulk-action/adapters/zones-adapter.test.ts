import { beforeEach, describe, expect, it } from "vitest";
import { createZonesAdapter } from "./zones-adapter";

// Zones live in a plain array keyed by `.i` (data-id holds the `.i`). Removal filters
// the zone out; zones have NO lock concept.
function makeWorld() {
  return {
    zones: [
      { i: 0, name: "Invasion", type: "Invasion", color: "#aaa", cells: [] },
      { i: 1, name: "Rebels", type: "Rebels", color: "#bbb", cells: [] }
    ]
  };
}

describe("zonesAdapter", () => {
  let adapter: ReturnType<typeof createZonesAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    adapter = createZonesAdapter(() => {});
  });

  it("treats present zones as deletable and missing ones as not", () => {
    expect(adapter.isDeletable(0)).toBe(true);
    expect(adapter.isDeletable(1)).toBe(true);
    expect(adapter.isDeletable(99)).toBe(false); // missing
  });

  it("offers color but no lock or children", () => {
    expect(adapter.supportsColor).toBe(true);
    expect(adapter.childKind).toBeUndefined();
    expect(adapter.setLock).toBeUndefined();
  });

  it("reads row ids from data-id", () => {
    const row = { dataset: { id: "1" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(1);
  });

  it("never reports a zone as locked", () => {
    expect(adapter.isLocked(0)).toBe(false);
    expect(adapter.isLocked(1)).toBe(false);
  });

  it("sets color", () => {
    adapter.setColor?.(0, "#123456");
    expect((globalThis as any).pack.zones.find((z: any) => z.i === 0).color).toBe("#123456");
  });

  it("describeCascade counts deletable zones with no locked skipping", () => {
    const summary = adapter.describeCascade([0, 1]);
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(summary.lines.join(" ").includes("2 zones")).toBe(true);
  });
});

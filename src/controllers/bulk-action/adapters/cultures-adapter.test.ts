import { beforeEach, describe, expect, it } from "vitest";
import { createCulturesAdapter } from "./cultures-adapter";

function makeWorld() {
  return {
    cultures: [
      { i: 0, name: "Wildlands" },
      { i: 1, name: "Alpha", origins: [0], lock: false },
      { i: 2, name: "Beta", origins: [1], lock: false },
      { i: 3, name: "Gamma", origins: [1, 2], lock: true }
    ],
    burgs: [0, { i: 1, culture: 1 }, { i: 2, culture: 1 }, { i: 3, culture: 2 }, { i: 4, culture: 3 }],
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, culture: 1 },
      { i: 2, culture: 2 }
    ],
    cells: { culture: [0, 1, 1, 2, 3, 0] }
  };
}

describe("culturesAdapter", () => {
  let adapter: ReturnType<typeof createCulturesAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    adapter = createCulturesAdapter(() => {});
  });

  it("treats the neutral culture and removed cultures as non-deletable", () => {
    expect(adapter.isDeletable(0)).toBe(false);
    expect(adapter.isDeletable(1)).toBe(true);
    expect(adapter.isDeletable(99)).toBe(false);
  });

  it("reports lock status", () => {
    expect(adapter.isLocked(1)).toBe(false);
    expect(adapter.isLocked(3)).toBe(true);
  });

  it("supports color and reads row ids from data-id", () => {
    expect(adapter.supportsColor).toBe(true);
    const row = { dataset: { id: "2" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(2);
  });

  it("describeCascade counts cultures and reassigned cells", () => {
    const summary = adapter.describeCascade([1, 2]);
    const text = summary.lines.join(" ");
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(text.includes("2 cultures")).toBe(true);
    expect(text.includes("3 cells")).toBe(true); // cells of culture 1 (2) + culture 2 (1)
  });

  it("describeCascade excludes the neutral culture and reports locked rows as skipped", () => {
    const summary = adapter.describeCascade([0, 1, 3]); // 0 not deletable, 3 locked
    expect(summary.deletable).toBe(1); // only culture 1
    expect(summary.skippedLocked).toBe(1); // culture 3
  });

  it("deleteEntity over a multi-culture selection mutates pack like single-delete", () => {
    adapter.deleteEntity(1);
    adapter.deleteEntity(2);
    const { cultures, burgs, cells } = (globalThis as any).pack;
    expect(cultures[1].removed).toBe(true);
    expect(cultures[2].removed).toBe(true);
    expect(burgs.slice(1).map((b: any) => b.culture)).toEqual([0, 0, 0, 3]);
    expect(cells.culture).toEqual([0, 0, 0, 0, 3, 0]);
  });

  it("setLock locks and unlocks a culture", () => {
    adapter.setLock?.(1, true);
    expect((globalThis as any).pack.cultures[1].lock).toBe(true);
    expect(adapter.isLocked(1)).toBe(true);
    adapter.setLock?.(1, false);
    expect((globalThis as any).pack.cultures[1].lock).toBe(false);
  });

  it("a culture locked via setLock then resists bulk delete (counted as skipped)", () => {
    adapter.setLock?.(1, true);
    const summary = adapter.describeCascade([1, 2]);
    expect(summary.deletable).toBe(1); // only culture 2
    expect(summary.skippedLocked).toBe(1); // culture 1 now locked
  });

  it("setColor sets a culture's color", () => {
    adapter.setColor?.(2, "#abcdef");
    expect((globalThis as any).pack.cultures[2].color).toBe("#abcdef");
  });

  it("invokes the injected redraw", () => {
    let redrawn = 0;
    const a = createCulturesAdapter(() => {
      redrawn += 1;
    });
    a.redraw();
    expect(redrawn).toBe(1);
  });
});

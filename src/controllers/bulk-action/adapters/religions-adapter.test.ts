import { beforeEach, describe, expect, it } from "vitest";
import { createReligionsAdapter } from "./religions-adapter";

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

describe("religionsAdapter", () => {
  let adapter: ReturnType<typeof createReligionsAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    adapter = createReligionsAdapter(() => {});
  });

  it("treats the neutral religion and removed religions as non-deletable", () => {
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

  it("describeCascade counts religions and reassigned cells", () => {
    const summary = adapter.describeCascade([1, 2]);
    const text = summary.lines.join(" ");
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(text.includes("2 religions")).toBe(true);
    expect(text.includes("3 cells")).toBe(true); // cells of religion 1 (2) + religion 2 (1)
  });

  it("describeCascade excludes the neutral religion and reports locked rows as skipped", () => {
    const summary = adapter.describeCascade([0, 1, 3]); // 0 not deletable, 3 locked
    expect(summary.deletable).toBe(1); // only religion 1
    expect(summary.skippedLocked).toBe(1); // religion 3
  });

  it("deleteEntity over a multi-religion selection mutates pack like single-delete", () => {
    adapter.deleteEntity(1);
    adapter.deleteEntity(2);
    const { religions, cells } = (globalThis as any).pack;
    expect(religions[1].removed).toBe(true);
    expect(religions[2].removed).toBe(true);
    expect(cells.religion).toEqual([0, 0, 0, 0, 3, 0]);
  });

  it("setLock locks and unlocks a religion", () => {
    adapter.setLock?.(1, true);
    expect((globalThis as any).pack.religions[1].lock).toBe(true);
    expect(adapter.isLocked(1)).toBe(true);
    adapter.setLock?.(1, false);
    expect((globalThis as any).pack.religions[1].lock).toBe(false);
  });

  it("a religion locked via setLock then resists bulk delete (counted as skipped)", () => {
    adapter.setLock?.(1, true);
    const summary = adapter.describeCascade([1, 2]);
    expect(summary.deletable).toBe(1); // only religion 2
    expect(summary.skippedLocked).toBe(1); // religion 1 now locked
  });

  it("setColor sets a religion's color", () => {
    adapter.setColor?.(2, "#abcdef");
    expect((globalThis as any).pack.religions[2].color).toBe("#abcdef");
  });

  it("invokes the injected redraw", () => {
    let redrawn = 0;
    const a = createReligionsAdapter(() => {
      redrawn += 1;
    });
    a.redraw();
    expect(redrawn).toBe(1);
  });
});

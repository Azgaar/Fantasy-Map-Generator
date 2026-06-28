import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRiversAdapter } from "./rivers-adapter";

// Rivers live in a plain array keyed by `.i`; removal is delegated to Rivers.remove.
function makeWorld() {
  return {
    rivers: [
      { i: 1, name: "Alpha", basin: 1 },
      { i: 2, name: "Beta", basin: 1, parent: 1 },
      { i: 3, name: "Gamma", basin: 3 }
    ]
  };
}

describe("riversAdapter", () => {
  let adapter: ReturnType<typeof createRiversAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    (globalThis as any).Rivers = { remove: vi.fn() };
    adapter = createRiversAdapter(() => {});
  });

  it("treats present rivers as deletable and missing ones as not", () => {
    expect(adapter.isDeletable(1)).toBe(true);
    expect(adapter.isDeletable(3)).toBe(true);
    expect(adapter.isDeletable(99)).toBe(false); // missing
  });

  it("offers neither lock nor color (select + delete only)", () => {
    expect(adapter.supportsColor).toBe(false);
    expect(adapter.setLock).toBeUndefined();
    expect(adapter.setColor).toBeUndefined();
    expect(adapter.isLocked(1)).toBe(false);
    expect(adapter.childKind).toBeUndefined();
  });

  it("reads row ids from data-id", () => {
    const row = { dataset: { id: "2" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(2);
  });

  it("describeCascade ignores missing ids and never skips (no lock)", () => {
    const summary = adapter.describeCascade([2, 99]); // 99 missing; 2 is a leaf tributary
    expect(summary.deletable).toBe(1); // only river 2 selected
    expect(summary.skippedLocked).toBe(0);
    expect(summary.lines.join(" ").includes("1 river")).toBe(true);
  });

  it("describeCascade counts the whole basin a selected main river will purge", () => {
    // river 2 has parent/basin 1, so removing river 1 also removes river 2.
    const summary = adapter.describeCascade([1]);
    expect(summary.deletable).toBe(1); // one row selected/acted on
    const text = summary.lines.join(" ");
    expect(text.includes("2 rivers")).toBe(true); // but two rivers actually removed
    expect(text.includes("1 auto-removed")).toBe(true);
  });

  it("deleteEntity delegates to the global Rivers.remove(id)", () => {
    adapter.deleteEntity(2);
    expect((globalThis as any).Rivers.remove).toHaveBeenCalledWith(2);
  });
});

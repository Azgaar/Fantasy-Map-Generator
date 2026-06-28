import { beforeEach, describe, expect, it } from "vitest";
import { createBurgsAdapter } from "./burgs-adapter";

function makeWorld() {
  return {
    burgs: [
      0,
      { i: 1, state: 1, capital: 1, lock: false }, // capital — not deletable
      { i: 2, state: 1, capital: 0, lock: false },
      { i: 3, state: 1, capital: 0, lock: true }, // locked
      { i: 4, state: 2, capital: 0, lock: false },
      { i: 5, state: 0, capital: 0, lock: false, removed: true } // already removed
    ]
  };
}

describe("burgsAdapter", () => {
  let adapter: ReturnType<typeof createBurgsAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    adapter = createBurgsAdapter(() => {});
  });

  it("excludes the placeholder, capitals and removed burgs from deletion", () => {
    expect(adapter.isDeletable(0)).toBe(false); // placeholder
    expect(adapter.isDeletable(1)).toBe(false); // capital
    expect(adapter.isDeletable(2)).toBe(true);
    expect(adapter.isDeletable(5)).toBe(false); // removed
    expect(adapter.isDeletable(99)).toBe(false);
  });

  it("does not offer color", () => {
    expect(adapter.supportsColor).toBe(false);
  });

  it("reads row ids from data-id", () => {
    const row = { dataset: { id: "4" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(4);
  });

  it("reports and sets lock", () => {
    expect(adapter.isLocked(3)).toBe(true);
    expect(adapter.isLocked(2)).toBe(false);
    adapter.setLock?.(2, true);
    expect((globalThis as any).pack.burgs[2].lock).toBe(true);
  });

  it("describeCascade counts deletable burgs and reports locked rows as skipped", () => {
    const summary = adapter.describeCascade([1, 2, 3, 4]); // 1 capital (excluded), 3 locked
    expect(summary.deletable).toBe(2); // burgs 2 & 4
    expect(summary.skippedLocked).toBe(1); // burg 3
    expect(summary.lines.join(" ").includes("2 burgs")).toBe(true);
  });
});

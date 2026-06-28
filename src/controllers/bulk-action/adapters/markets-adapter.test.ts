import { beforeEach, describe, expect, it } from "vitest";
import { createMarketsAdapter } from "./markets-adapter";

function makeWorld() {
  return {
    markets: [
      { i: 1, color: "#aaa" },
      { i: 2, color: "#bbb" },
      { i: 3, color: "#ccc" }
    ]
  };
}

describe("marketsAdapter", () => {
  let adapter: ReturnType<typeof createMarketsAdapter>;

  beforeEach(() => {
    (globalThis as any).pack = makeWorld();
    (globalThis as any).Markets = { removeMarket: () => {} };
    adapter = createMarketsAdapter(() => {});
  });

  it("excludes the 'No market' row (id 0) and missing markets from deletion", () => {
    expect(adapter.isDeletable(0)).toBe(false);
    expect(adapter.isDeletable(1)).toBe(true);
    expect(adapter.isDeletable(99)).toBe(false);
  });

  it("offers color but not lock", () => {
    expect(adapter.supportsColor).toBe(true);
    expect(adapter.setLock).toBeUndefined();
    expect(adapter.isLocked(1)).toBe(false);
  });

  it("reads row ids from data-id", () => {
    const row = { dataset: { id: "2" } } as unknown as HTMLElement;
    expect(adapter.getRowId(row)).toBe(2);
  });

  it("setColor sets a market's color", () => {
    adapter.setColor?.(2, "#123456");
    expect((globalThis as any).pack.markets.find((m: any) => m.i === 2).color).toBe("#123456");
  });

  it("describeCascade counts deletable markets (no locked-skip, no children)", () => {
    const summary = adapter.describeCascade([0, 1, 2]); // 0 excluded
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(summary.lines.join(" ").includes("2 markets")).toBe(true);
  });

  it("deleteEntity delegates to Markets.removeMarket with the id", () => {
    const removed: number[] = [];
    (globalThis as any).Markets = { removeMarket: (id: number) => removed.push(id) };
    adapter.deleteEntity(2);
    expect(removed).toEqual([2]);
  });
});

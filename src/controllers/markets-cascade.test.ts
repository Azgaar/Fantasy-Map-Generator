import { beforeEach, describe, expect, it } from "vitest";
import { describeMarketsCascade, isMarketDeletable } from "./markets-cascade";

function makeWorld() {
  return {
    markets: [
      { i: 1, color: "#aaa" },
      { i: 2, color: "#bbb" },
      { i: 3, color: "#ccc" }
    ]
  };
}

beforeEach(() => {
  (globalThis as any).pack = makeWorld();
});

describe("markets bulk predicates and summary", () => {
  it("excludes the 'No market' row (id 0) and missing markets from deletion", () => {
    expect(isMarketDeletable(0)).toBe(false);
    expect(isMarketDeletable(1)).toBe(true);
    expect(isMarketDeletable(99)).toBe(false);
  });

  it("describeMarketsCascade counts deletable markets (no locked-skip, no children)", () => {
    const summary = describeMarketsCascade([0, 1, 2]); // 0 excluded
    expect(summary.deletable).toBe(2);
    expect(summary.skippedLocked).toBe(0);
    expect(summary.lines.join(" ").includes("2 markets")).toBe(true);
  });
});

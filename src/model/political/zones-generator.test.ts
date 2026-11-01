import { afterEach, describe, expect, it, vi } from "vitest";
import { Zones } from "./zones-generator";

// a strip of cells 0-5, each next to the cells beside it
const strip = (prosperity: number[]) => ({
  i: prosperity.map((_, i) => i),
  c: prosperity.map((_, i) => [i - 1, i + 1].filter(c => c >= 0 && c < prosperity.length)),
  pop: prosperity.map(() => 5),
  prosperity: Uint8Array.from(prosperity),
  state: prosperity.map(() => 1),
  culture: prosperity.map(() => 1)
});

describe("Zones famine", () => {
  it("breaks out in the poorest countryside and spreads through poor land only", () => {
    globalThis.pack = {
      cells: strip([60, 25, 10, 28, 15, 50]),
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "Varia" }
      ],
      zones: []
    } as any;
    (Zones as any).addFamine(new Uint8Array(6));
    const [famine] = pack.zones;
    expect(famine.type).toBe("Famine");
    expect(famine.cells.toSorted()).toEqual([1, 2, 3, 4]);
    expect(famine.note).toContain("The poorest countryside of Varia");
  });

  it("needs land poor enough to start", () => {
    globalThis.pack = { cells: strip([60, 25, 40]), states: [], zones: [] } as any;
    (Zones as any).addFamine(new Uint8Array(3));
    expect(pack.zones).toEqual([]);
  });
});

describe("Zones flood", () => {
  afterEach(() => vi.restoreAllMocks());

  it("spreads up and down the river from its burg and over the low banks only", () => {
    // river cells 0-4 in a line, the burg on 2; banks 5 (low) and 6 (high) beside 2, and 7 beyond the low bank
    const c = [[1], [0, 2], [1, 3, 5, 6], [2, 4], [3], [2, 7], [2], [5]];
    globalThis.pack = {
      cells: {
        i: c.map((_, i) => i),
        c,
        h: [24, 23, 22, 21, 20, 24, 40, 22],
        r: [1, 1, 1, 1, 1, 0, 0, 0],
        fl: [900, 950, 1000, 1050, 1100, 5, 5, 5],
        burg: [0, 0, 1, 0, 0, 0, 0, 0]
      },
      burgs: [{}, { i: 1, name: "Riverton" }],
      rivers: [{ i: 1, name: "Swift", type: "River" }],
      zones: []
    } as any;
    vi.spyOn(Math, "random").mockReturnValue(0.99); // the largest flood
    (Zones as any).addFlood(new Uint8Array(8));
    const [flood] = pack.zones;
    expect(flood.cells.toSorted()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(flood.note).toContain("The Swift river has burst its banks at Riverton");
  });
});

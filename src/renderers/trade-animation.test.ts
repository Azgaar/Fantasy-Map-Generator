import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./draw-trade-animation", () => ({
  draw: vi.fn(),
  clear: vi.fn(),
  highlight: vi.fn(),
  clearHighlight: vi.fn()
}));

import * as drawTrade from "./draw-trade-animation";
import { TradeAnimationModule } from "./trade-animation";

// ─── helpers ────────────────────────────────────────────────────────────────

// cellRoutes: pack.cells.routes  — Record<cellId, Record<neighborCellId, routeId>>
// routeData:  pack.routes        — array of route objects with i and group
function makePack(
  cellRoutes: Record<number, Record<number, number>> = {},
  routeData: Array<{ i: number; group: "roads" | "trails" | "searoutes" }> = []
) {
  return {
    cells: {
      h: [20, 20, 10, 10], // 0,1 = land (≥20); 2,3 = water (<20)
      burg: [0, 0, 0, 0],
      p: [
        [0, 0],
        [10, 0],
        [20, 0],
        [30, 0]
      ] as [number, number][],
      routes: cellRoutes
    },
    burgs: [
      null,
      { i: 1, name: "Alpha", cell: 0, x: 0, y: 0, port: 0 },
      { i: 2, name: "Beta", cell: 1, x: 10, y: 0, port: 0 }
    ],
    routes: routeData
  };
}

// ─── shared setup ───────────────────────────────────────────────────────────

let ta: TradeAnimationModule;

// Minimal FlatQueue polyfill (correct, not optimised — tests only).
class TestFlatQueue {
  private items: Array<{ id: number; value: number }> = [];
  get length() {
    return this.items.length;
  }
  push(id: number, value: number) {
    this.items.push({ id, value });
    this.items.sort((a, b) => a.value - b.value);
  }
  pop() {
    return this.items.shift()?.id;
  }
  peek() {
    return this.items[0]?.id;
  }
  peekValue() {
    return this.items[0]?.value;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  ta = new TradeAnimationModule();
  globalThis.pack = makePack() as any;
  globalThis.layerIsOn = vi.fn(() => true);
  (globalThis as any).FlatQueue = TestFlatQueue;
  globalThis.Markets = {
    get: vi.fn((id: number) => {
      if (id === 1) return { centerBurgId: 1 } as any;
      if (id === 2) return { centerBurgId: 2 } as any;
      return undefined;
    })
  } as any;
  // Trade animation calls Routes.addMeandering for water spans. In these tests
  // there are no rivers, so we just pass anchors through with their cellIds.
  globalThis.Routes = {
    addMeandering: (cells: number[], anchors: [number, number][]) =>
      cells.map((c, i) => [anchors[i][0], anchors[i][1], c])
  } as any;
});

// ─── getPathCost ─────────────────────────────────────────────────────────────

describe("getPathCost", () => {
  it("returns 1 for a sea-route segment", () => {
    globalThis.pack = makePack({ 0: { 1: 7 } }, [{ i: 7, group: "searoutes" }]) as any;
    expect(ta.getPathCost(0, 1)).toBe(1);
  });

  it("returns 5 for a roads segment", () => {
    globalThis.pack = makePack({ 0: { 1: 3 } }, [{ i: 3, group: "roads" }]) as any;
    expect(ta.getPathCost(0, 1)).toBe(5);
  });

  it("returns 5 for a trails segment", () => {
    globalThis.pack = makePack({ 0: { 1: 4 } }, [{ i: 4, group: "trails" }]) as any;
    expect(ta.getPathCost(0, 1)).toBe(5);
  });

  it("defaults to 5 (land) when the route is not found", () => {
    globalThis.pack = makePack({ 0: { 1: 99 } }, []) as any;
    expect(ta.getPathCost(0, 1)).toBe(5);
  });
});

// ─── getDealBatches ───────────────────────────────────────────────────────────

describe("getDealBatches", () => {
  it("returns an empty array for no deals", () => {
    expect(ta.getDealBatches([])).toEqual([]);
  });

  it("groups multiple deals between the same burg pair into one batch", () => {
    const deals: any[] = [
      { seller: 2, sellerType: "burg", buyer: 1, buyerType: "market" },
      { seller: 2, sellerType: "burg", buyer: 1, buyerType: "market" }
    ];
    const batches = ta.getDealBatches(deals);
    expect(batches).toHaveLength(1);
    expect(batches[0].deals).toHaveLength(2);
    expect(batches[0].startBurgId).toBe(2);
    expect(batches[0].endBurgId).toBe(1);
  });

  it("creates separate batches for swapped seller/buyer on the same pair", () => {
    const deals: any[] = [
      { seller: 2, sellerType: "burg", buyer: 1, buyerType: "market" },
      { seller: 1, sellerType: "market", buyer: 2, buyerType: "burg" }
    ];
    expect(ta.getDealBatches(deals)).toHaveLength(2);
  });

  it("skips deals whose market cannot be resolved", () => {
    const deals: any[] = [{ seller: 2, sellerType: "burg", buyer: 99, buyerType: "market" }];
    expect(ta.getDealBatches(deals)).toHaveLength(0);
  });
});

// ─── getPath ─────────────────────────────────────────────────────────────────

describe("getPath", () => {
  it("returns null when a burg does not exist", () => {
    expect(ta.getPath({ id: "1-99", deals: [], startBurgId: 1, endBurgId: 99, type: "local" })).toBeNull();
  });

  it("returns null when no route exists between the two burgs", () => {
    // cellRoutes = {} — no connections
    expect(ta.getPath({ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" })).toBeNull();
  });

  it("returns points and a land segment when a roads route connects the burgs", () => {
    // cell 0 (burg 1) ↔ cell 1 (burg 2) via road route 0
    globalThis.pack = makePack({ 0: { 1: 0 }, 1: { 0: 0 } }, [{ i: 0, group: "roads" }]) as any;
    const result = ta.getPath({ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" });
    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(2);
    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0].type).toBe("land");
  });

  it("routes through a land↔sea boundary at a non-port cell (sea routes run up navigable rivers)", () => {
    // route 0 = searoute (0→1→2), route 1 = roads (2→3); cell 2 has no port burg.
    // The route network only links genuinely connected cells, so this crossing must be traversable —
    // sea routes legitimately meet land routes at non-port river cells.
    globalThis.pack = {
      cells: {
        h: [20, 20, 20, 20],
        burg: [0, 0, 0, 0], // no port burg anywhere
        p: [
          [0, 0],
          [10, 0],
          [20, 0],
          [30, 0]
        ] as [number, number][],
        routes: { 0: { 1: 0 }, 1: { 0: 0, 2: 0 }, 2: { 1: 0, 3: 1 }, 3: { 2: 1 } }
      },
      burgs: [null, { i: 1, cell: 0, x: 0, y: 0, port: 0 }, { i: 2, cell: 3, x: 30, y: 0, port: 0 }],
      routes: [
        { i: 0, group: "searoutes" },
        { i: 1, group: "roads" }
      ]
    } as any;
    const result = ta.getPath({ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" });
    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0].type).toBe("water");
    expect(result!.segments[1].type).toBe("land");
  });

  it("routes through a land↔sea boundary when the crossing cell has a port burg", () => {
    // same topology but cell 2 now has port burg 3 → transition allowed
    globalThis.pack = {
      cells: {
        h: [20, 20, 20, 20],
        burg: [0, 0, 3, 0], // cell 2 → burg 3 (port)
        p: [
          [0, 0],
          [10, 0],
          [20, 0],
          [30, 0]
        ] as [number, number][],
        routes: { 0: { 1: 0 }, 1: { 0: 0, 2: 0 }, 2: { 1: 0, 3: 1 }, 3: { 2: 1 } }
      },
      burgs: [
        null,
        { i: 1, cell: 0, x: 0, y: 0, port: 0 },
        { i: 2, cell: 3, x: 30, y: 0, port: 0 },
        { i: 3, cell: 2, x: 20, y: 0, port: 1 } // port burg at the crossing cell
      ],
      routes: [
        { i: 0, group: "searoutes" },
        { i: 1, group: "roads" }
      ]
    } as any;
    const result = ta.getPath({ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" });
    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0].type).toBe("water");
    expect(result!.segments[1].type).toBe("land");
  });
});

// ─── trigger ─────────────────────────────────────────────────────────────────

describe("trigger", () => {
  it("does nothing when given an empty batch list", () => {
    ta.trigger([]);
    expect(drawTrade.draw).not.toHaveBeenCalled();
  });

  it("clears animations and returns when the layer is disabled", () => {
    vi.mocked(globalThis.layerIsOn).mockReturnValue(false);
    ta.trigger([{ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" }]);
    expect(drawTrade.clear).toHaveBeenCalled();
    expect(drawTrade.draw).not.toHaveBeenCalled();
  });

  it("draws animation when the layer is active and a route path exists", () => {
    globalThis.pack = makePack({ 0: { 1: 0 }, 1: { 0: 0 } }, [{ i: 0, group: "roads" }]) as any;
    const batch = { id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" as const };
    ta.trigger([batch]);
    expect(drawTrade.draw).toHaveBeenCalledWith(batch, expect.any(Array));
  });

  it("does not draw when no route path can be found", () => {
    // cellRoutes = {} — no connections
    ta.trigger([{ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" }]);
    expect(drawTrade.draw).not.toHaveBeenCalled();
  });
});

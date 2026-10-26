import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./draw-trade-animation", () => ({
  draw: vi.fn(),
  clear: vi.fn(),
  highlight: vi.fn(),
  clearHighlight: vi.fn()
}));

import { DEAL_KINDS, type Deal, Markets } from "@/model/economy/markets-generator";
import { Routes } from "@/model/economy/routes-generator";
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

let isTradeLayerOn = true;

vi.mock("@/renderers/layers", () => ({
  Layers: { isOn: (id: string) => id === "trade" && isTradeLayerOn }
}));

beforeEach(() => {
  vi.clearAllMocks();
  ta = new TradeAnimationModule();
  globalThis.pack = makePack() as any;
  isTradeLayerOn = true;
  Object.assign(Markets, {
    get: vi.fn((id: number) => {
      if (id === 1) return { centerBurgId: 1 } as any;
      if (id === 2) return { centerBurgId: 2 } as any;
      return undefined;
    })
  });
  // Trade animation calls Routes.addMeandering for water spans. In these tests
  // there are no rivers, so we just pass anchors through with their cellIds.
  Object.assign(Routes, {
    addMeandering: (cells: number[], anchors: [number, number][]) =>
      cells.map((c, i) => [anchors[i][0], anchors[i][1], c])
  });
});

// burg 2 trades with market 1, centered at burg 1
const purchase: Deal = [2, 1, 0, DEAL_KINDS.input, 1, 1, 0, 0, 0];
const sale: Deal = [2, 1, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0];

// ─── getEnds ─────────────────────────────────────────────────────────────────

describe("getEnds", () => {
  it("runs a purchase from the market's center to the burg", () => {
    expect(ta.getEnds(purchase)).toEqual({ startBurgId: 1, endBurgId: 2 });
  });

  it("runs a sale from the burg to the market's center", () => {
    expect(ta.getEnds(sale)).toEqual({ startBurgId: 2, endBurgId: 1 });
  });

  it("skips deals whose market or burg cannot be resolved", () => {
    expect(ta.getEnds([2, 99, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0])).toBeNull();
    expect(ta.getEnds([99, 1, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0])).toBeNull();
  });
});

// ─── getPath ─────────────────────────────────────────────────────────────────

describe("getPath", () => {
  it("returns null when a burg does not exist", () => {
    expect(ta.getPath([99, 1, 0, DEAL_KINDS.input, 1, 1, 0, 0, 0])).toBeNull();
  });

  it("returns null when no route exists between the two burgs", () => {
    // cellRoutes = {} — no connections
    expect(ta.getPath(purchase)).toBeNull();
  });

  it("returns points and a land segment when a roads route connects the burgs", () => {
    // cell 0 (burg 1) ↔ cell 1 (burg 2) via road route 0
    globalThis.pack = makePack({ 0: { 1: 0 }, 1: { 0: 0 } }, [{ i: 0, group: "roads" }]) as any;
    const result = ta.getPath(purchase);
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
    const result = ta.getPath(purchase);
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
    const result = ta.getPath(purchase);
    expect(result).not.toBeNull();
    expect(result!.segments).toHaveLength(2);
    expect(result!.segments[0].type).toBe("water");
    expect(result!.segments[1].type).toBe("land");
  });
});

// ─── trigger ─────────────────────────────────────────────────────────────────

describe("trigger", () => {
  it("does nothing when given no deals", () => {
    ta.trigger([]);
    expect(drawTrade.draw).not.toHaveBeenCalled();
  });

  it("clears animations and returns when the layer is disabled", () => {
    isTradeLayerOn = false;
    ta.trigger([purchase]);
    expect(drawTrade.clear).toHaveBeenCalled();
    expect(drawTrade.draw).not.toHaveBeenCalled();
  });

  it("draws animation when the layer is active and a route path exists", () => {
    globalThis.pack = makePack({ 0: { 1: 0 }, 1: { 0: 0 } }, [{ i: 0, group: "roads" }]) as any;
    ta.trigger([purchase]);
    expect(drawTrade.draw).toHaveBeenCalledWith(purchase, expect.any(Array));
  });

  it("does not draw when no route path can be found", () => {
    // cellRoutes = {} — no connections
    ta.trigger([purchase]);
    expect(drawTrade.draw).not.toHaveBeenCalled();
  });
});

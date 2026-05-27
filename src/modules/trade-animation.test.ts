import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../renderers/draw-trade-animation", () => ({
  draw: vi.fn(),
  clear: vi.fn(),
  drawHighlight: vi.fn(),
  clearHighlight: vi.fn()
}));

vi.mock("../utils/pathUtils", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/pathUtils")>();
  return { ...actual, findPath: vi.fn() };
});

import * as drawTrade from "../renderers/draw-trade-animation";
import { findPath } from "../utils/pathUtils";
import { TradeAnimationModule } from "./trade-animation";

// ─── helpers ────────────────────────────────────────────────────────────────

function makePack() {
  return {
    cells: {
      h: [20, 20, 10, 10], // 0,1 = land (≥20); 2,3 = water (<20)
      burg: [0, 0, 0, 0],
      p: [
        [0, 0],
        [10, 0],
        [20, 0],
        [30, 0]
      ] as [number, number][]
    },
    burgs: [
      null,
      { i: 1, name: "Alpha", cell: 0, x: 0, y: 0, port: 0 },
      { i: 2, name: "Beta", cell: 1, x: 10, y: 0, port: 0 }
    ]
  };
}

// ─── shared setup ───────────────────────────────────────────────────────────

let ta: TradeAnimationModule;

beforeEach(() => {
  vi.clearAllMocks();
  ta = new TradeAnimationModule();
  globalThis.pack = makePack() as any;
  globalThis.layerIsOn = vi.fn(() => true);
  globalThis.Routes = {
    getLandPathCost: vi.fn(() => 5),
    getWaterPathCost: vi.fn(() => 3)
  };
  globalThis.Markets = {
    get: vi.fn((id: number) => {
      if (id === 1) return { centerBurgId: 1 } as any;
      if (id === 2) return { centerBurgId: 2 } as any;
      return undefined;
    })
  } as any;
});

// ─── getPathCost ─────────────────────────────────────────────────────────────

describe("getPathCost", () => {
  it("delegates to getLandPathCost for land-to-land", () => {
    expect(ta.getPathCost(0, 1)).toBe(5);
    expect(globalThis.Routes.getLandPathCost).toHaveBeenCalledWith(0, 1);
  });

  it("delegates to getWaterPathCost for water-to-water", () => {
    expect(ta.getPathCost(2, 3)).toBe(3);
    expect(globalThis.Routes.getWaterPathCost).toHaveBeenCalledWith(2, 3);
  });

  it("returns Infinity for land↔water without a port", () => {
    expect(ta.getPathCost(0, 2)).toBe(Infinity);
    expect(ta.getPathCost(2, 0)).toBe(Infinity);
  });

  it("allows land↔water transition when a port burg is on the boundary cell", () => {
    globalThis.pack.cells.burg[0] = 1;
    globalThis.pack.burgs[1].port = 1;
    expect(ta.getPathCost(0, 2)).not.toBe(Infinity);
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

  it("returns null when no path is found", () => {
    vi.mocked(findPath).mockReturnValue(null);
    expect(ta.getPath({ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" })).toBeNull();
  });

  it("returns points and segments when a path is found", () => {
    vi.mocked(findPath).mockReturnValue([0, 1]); // both land cells
    const result = ta.getPath({ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" });
    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(2);
    expect(result!.segments).toHaveLength(1);
    expect(result!.segments[0].type).toBe("land");
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

  it("draws animation when the layer is active and a path exists", () => {
    vi.mocked(findPath).mockReturnValue([0, 1]);
    const batch = { id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" as const };
    ta.trigger([batch]);
    expect(drawTrade.draw).toHaveBeenCalledWith(batch, expect.any(Array), expect.any(Array));
  });

  it("does not draw when no path can be found", () => {
    vi.mocked(findPath).mockReturnValue(null);
    ta.trigger([{ id: "1-2", deals: [], startBurgId: 1, endBurgId: 2, type: "local" }]);
    expect(drawTrade.draw).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Pre-mock D3 and other globals needed for modules to load without throwing
(globalThis as any).viewbox = {
  select: () => ({
    empty: () => true,
    append: () => ({ attr: () => ({ append: () => ({ attr: () => ({ attr: () => ({ attr: () => ({}) }) }) }) }) })
  })
};
(globalThis as any).layerIsOn = () => true;

import { getTradeDealBatches, getTradePathCost, triggerTradeAnimation } from "./trade-animation";

// Mock draw-trade-animation module
vi.mock("../renderers/draw-trade-animation", () => ({
  animateTradeBatch: vi.fn(),
  clearAllTradeAnimations: vi.fn()
}));

// Mock pathUtils to avoid calling standard Dijkstra inside vitest or check it works
vi.mock("../utils/pathUtils", async () => {
  const actual = await vi.importActual<typeof import("../utils/pathUtils")>("../utils/pathUtils");
  return {
    ...actual,
    findPath: vi.fn((start, isExit, getCost) => {
      const end = [0, 1, 2, 3].find(cellId => isExit(cellId));
      if (end === undefined) return null;

      // Return a dummy path of 2 cells if passable, else null
      if (getCost(start, end) === Infinity) {
        return null;
      }
      return [start, end];
    })
  };
});

import { clearTradeAnimations, drawTradeAnimation } from "../renderers/draw-trade-animation";
import { findPath } from "../utils/pathUtils";

describe("trade-animation module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("document", { getElementById: (id: string) => (id === "toggleTradeAnimation" ? {} : null) });

    // Reset globals
    globalThis.pack = {
      cells: {
        h: [20, 20, 15, 15], // cells 0, 1 are land (>=20), cells 2, 3 are ocean (<20)
        burg: [0, 0, 0, 0], // no burgs by default
        p: [
          [10, 10],
          [20, 10],
          [30, 10],
          [40, 10]
        ],
        biome: [1, 1, 1, 1],
        g: [0, 1, 2, 3],
        routes: {}
      },
      burgs: [
        { i: 0 },
        { i: 1, name: "Burg A", cell: 0, x: 10, y: 10, port: 0 },
        { i: 2, name: "Burg B", cell: 1, x: 20, y: 10, port: 0 }
      ],
      goods: [
        { i: 0, name: "Salt", color: "#ccc", icon: "salt-icon" },
        { i: 1, name: "Iron", color: "#999", icon: "iron-icon" }
      ],
      deals: []
    } as any;

    globalThis.grid = {
      cells: {
        temp: [20, 20, 20, 20] // sea temp = 20 (warm) by default
      }
    } as any;

    globalThis.biomesData = {
      habitability: [0, 100, 100, 100] // biome 1 has habitability 100
    } as any;

    globalThis.Goods = {
      get: vi.fn(id => globalThis.pack.goods[id]),
      getStroke: vi.fn(() => "#000")
    } as any;

    globalThis.Markets = {
      get: vi.fn(id => {
        if (id === 1) return { i: 1, centerBurgId: 1 };
        if (id === 2) return { i: 2, centerBurgId: 2 };
        return null;
      })
    } as any;

    globalThis.layerIsOn = vi.fn(() => true);
  });

  describe("getTradePathCost", () => {
    it("should calculate standard Euclidean distance cost for land-to-land travel", () => {
      // Cell 0 and 1 are land (height 20), dist = 10
      const cost = getTradePathCost(0, 1);
      expect(cost).toBeCloseTo(10 * 1.0 * 2.0 * 1.0 * 1.2, 1);
    });

    it("should restrict transition between land and water if no port exists", () => {
      // Cell 1 is land, Cell 2 is water. Neither has a port burg.
      const cost = getTradePathCost(1, 2);
      expect(cost).toBe(Infinity);
    });

    it("should allow transition between land and water if a port exists on the land cell", () => {
      // Set port to Burg 1 which is on cell 0
      globalThis.pack.cells.burg[0] = 1;
      globalThis.pack.burgs[1].port = 1;

      // Cell 0 is land (height 20) with a port, Cell 2 is water (height 15).
      // Transition is allowed.
      const cost = getTradePathCost(0, 2);
      expect(cost).not.toBe(Infinity);
      expect(cost).toBeCloseTo(Math.hypot(10 - 30, 10 - 10) * 1.0, 1); // Water cost is dist * modifier
    });

    it("should apply discount for cells connected by a route", () => {
      // Connect cell 0 and 1 via route
      globalThis.pack.cells.routes = {
        0: { 1: 5 } // routeId = 5
      };

      const normalCost = getTradePathCost(0, 1);
      // Clean routes and calculate again
      globalThis.pack.cells.routes = {};
      const baseCost = getTradePathCost(0, 1);

      expect(normalCost).toBeLessThan(baseCost);
      expect(normalCost).toBeCloseTo(baseCost * 0.3, 1);
    });

    it("should return Infinity for impassable ice water (sea temp < -4)", () => {
      // Cell 0 to Cell 2 transition (add port to cell 0 to bypass transition block)
      globalThis.pack.cells.burg[0] = 1;
      globalThis.pack.burgs[1].port = 1;

      // Make grid cell temp on cell 2 very cold (-10)
      globalThis.grid.cells.temp[2] = -10;

      const cost = getTradePathCost(0, 2);
      expect(cost).toBe(Infinity);
    });
  });

  describe("triggerRandomTradeAnimation", () => {
    it("should do nothing if pack or deals are empty", () => {
      globalThis.pack.deals = [];
      triggerTradeAnimation();
      expect(drawTradeAnimation).not.toHaveBeenCalled();
    });

    it("should clear animations and return if the Trade layer is disabled", () => {
      globalThis.layerIsOn = vi.fn(layer => {
        if (layer === "toggleTradeAnimation") return false;
        return true;
      });
      globalThis.pack.deals = [
        { i: 1, market: 1, client: 2, clientType: "burg", good: 0, direction: "in", units: 10, price: 1.5 }
      ];

      triggerTradeAnimation();
      expect(clearTradeAnimations).toHaveBeenCalled();
      expect(drawTradeAnimation).not.toHaveBeenCalled();
    });

    it("should batch deals between the same endpoints", () => {
      globalThis.pack.deals = [
        { i: 1, market: 1, client: 2, clientType: "burg", good: 0, direction: "in", units: 10, price: 1.5 },
        { i: 2, market: 1, client: 2, clientType: "burg", good: 1, direction: "in", units: 4, price: 3 }
      ];

      const batches = getTradeDealBatches();

      expect(batches).toHaveLength(1);
      expect(batches[0]).toMatchObject({ id: "2-1", startBurgId: 2, endBurgId: 1 });
      expect(batches[0].deals).toHaveLength(2);
    });

    it("should find the path and trigger animateTradeBatch if layer is active and path exists", () => {
      globalThis.pack.deals = [
        { i: 1, market: 1, client: 2, clientType: "burg", good: 0, direction: "in", units: 10, price: 1.5 }
      ];

      // Burg 1 (center of Market 1) is at cell 0
      // Burg 2 (Client 2) is at cell 1
      // Deal direction is "in" (import), so start is client (cell 1) and end is market (cell 0)
      triggerTradeAnimation();

      expect(findPath).toHaveBeenCalledWith(1, expect.any(Function), expect.any(Function), globalThis.pack);
      expect(drawTradeAnimation).toHaveBeenCalledWith(
        expect.objectContaining({ id: "2-1", deals: [globalThis.pack.deals[0]], startBurgId: 2, endBurgId: 1 }),
        [
          [20, 10], // Burg 2 (start) x, y
          [20, 10], // Cell 1 (path cell 0) p
          [10, 10], // Cell 0 (path cell 1) p
          [10, 10] // Burg 1 (end) x, y
        ],
        expect.objectContaining({ maxSpawn: 5, interval: 3000, speed: 1, dotSize: 4, pathOpacity: 0.35 })
      );
    });

    it("should animate export deals from market to client", () => {
      globalThis.pack.deals = [
        { i: 1, market: 1, client: 2, clientType: "burg", good: 0, direction: "out", units: 10, price: 1.5 }
      ];

      triggerTradeAnimation();

      expect(findPath).toHaveBeenCalledWith(0, expect.any(Function), expect.any(Function), globalThis.pack);
      expect(drawTradeAnimation).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1-2", startBurgId: 1, endBurgId: 2 }),
        [
          [10, 10],
          [10, 10],
          [20, 10],
          [20, 10]
        ],
        expect.any(Object)
      );
    });
  });
});

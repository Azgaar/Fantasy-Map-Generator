import { beforeEach, describe, expect, it } from "vitest";
import type { Burg } from "@/model/political/burgs-generator";
import { type Market, MarketsModule } from "./markets-generator";
import { DEAL_KINDS } from "./trade";

describe("MarketsModule", () => {
  describe("editing and lookup", () => {
    let marketsModule: MarketsModule;
    beforeEach(() => {
      marketsModule = new MarketsModule();
      globalThis.pack = { cells: {}, markets: [], burgs: [], deals: [] } as any;
    });

    it("addMarket() should claim only the center burg's cell and preserve existing borders", () => {
      // Two cells already owned by market 1, plus a manual edit to be preserved.
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      globalThis.pack.markets = [market1];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1];

      const centerBurg: Burg = { i: 2, cell: 3 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, cell: 0 } as any, centerBurg];
      // cell 3 currently belongs to market 1; all four cells are owned by market 1.
      globalThis.pack.cells = { i: [0, 1, 2, 3], market: Uint16Array.from([1, 1, 1, 1]) } as any;

      const newMarket = marketsModule.addMarket(2);

      expect(newMarket).not.toBeNull();
      expect(newMarket!.i).toBe(2);
      // Only the center burg's own cell changed owner.
      expect(Array.from(globalThis.pack.cells.market)).toEqual([1, 1, 1, 2]);
      expect(centerBurg.plaza).toBe(1);
      // The new market is reachable through the index used by buy/sell/overview.
      expect(marketsModule.get(2)).toBe(newMarket);
    });

    it("addMarket() should reject a burg that already centers a market", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      globalThis.pack.markets = [market1];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [market1];
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, cell: 0 } as any];
      globalThis.pack.cells = { i: [0], market: Uint16Array.from([1]) } as any;

      expect(marketsModule.addMarket(1)).toBeNull();
      expect(globalThis.pack.markets).toHaveLength(1);
    });

    it("removeMarket() should drop only the removed market's deals, cells and burg link", () => {
      const market1: Market = { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} };
      const market2: Market = { i: 2, centerBurgId: 2, color: "#00ff00", goods: {} };
      globalThis.pack.markets = [market1, market2];
      // biome-ignore lint/complexity/useLiteralKeys: private access for testing
      marketsModule["marketById"] = [undefined as any, market1, market2];

      const burg1: Burg = { i: 1, cell: 0, plaza: 1 } as any;
      const burg2: Burg = { i: 2, cell: 1, plaza: 1 } as any;
      globalThis.pack.burgs = [{ i: 0 } as any, burg1, burg2];
      globalThis.pack.cells = { i: [0, 1], market: Uint16Array.from([1, 2]) } as any;
      globalThis.pack.deals = [
        [1, 1, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0],
        [2, 2, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0]
      ];

      marketsModule.removeMarket(1);

      expect(globalThis.pack.markets).toEqual([market2]);
      // Only market 1's deal is dropped; market 2's deal survives.
      expect(globalThis.pack.deals).toEqual([[2, 2, 0, DEAL_KINDS.demand, 1, 1, 0, 0, 0]]);
      // Only market 1's cell is unassigned.
      expect(Array.from(globalThis.pack.cells.market)).toEqual([0, 2]);
      expect(burg1.plaza).toBe(0);
      expect(burg2.plaza).toBe(1);
    });

    it("getName() should prefer a custom name, fall back to the center burg, then to a generic label", () => {
      globalThis.pack.burgs = [{ i: 0 } as any, { i: 1, name: "Riverton" } as any];

      const named: Market = { i: 1, centerBurgId: 1, color: "#fff", goods: {}, name: "Grand Bazaar" };
      expect(marketsModule.getName(named)).toBe("Grand Bazaar");

      const derived: Market = { i: 1, centerBurgId: 1, color: "#fff", goods: {} };
      expect(marketsModule.getName(derived)).toBe("Riverton");

      const blank: Market = { i: 2, centerBurgId: 1, color: "#fff", goods: {}, name: "" };
      expect(marketsModule.getName(blank)).toBe("Riverton");

      const orphan: Market = { i: 7, centerBurgId: 99, color: "#fff", goods: {} };
      expect(marketsModule.getName(orphan)).toBe("Market 7");
    });

    it("sync() should rebuild the id index so get() resolves markets after a load", () => {
      // Simulate a freshly loaded map: pack.markets is populated but marketById was never built.
      const market3: Market = { i: 3, centerBurgId: 30, color: "#fff", goods: {} };
      const market7: Market = { i: 7, centerBurgId: 70, color: "#fff", goods: {} };
      globalThis.pack.markets = [market3, market7];
      expect(marketsModule.get(3)).toBeUndefined();

      marketsModule.sync();

      expect(marketsModule.get(3)).toBe(market3);
      expect(marketsModule.get(7)).toBe(market7);
      expect(marketsModule.get(99)).toBeUndefined();
    });

    it("sync() should tolerate holes in pack.markets", () => {
      const market2: Market = { i: 2, centerBurgId: 20, color: "#fff", goods: {} };
      globalThis.pack.markets = [null as any, market2];
      expect(() => marketsModule.sync()).not.toThrow();
      expect(marketsModule.get(2)).toBe(market2);
    });
  });
});

describe("market placement", () => {
  it("gives a portless landmass a market and lets a market across the water stand closer", () => {
    options.map.graph = { width: 1000, height: 800, points: 10000, sampling: "square", jitter: 0.9 };
    const burg = (i: number, x: number, feature: number, population: number, port = 0) =>
      ({ i, x, y: 0, feature, population, port }) as Burg;
    // all burgs crowd alike, so the spacing is the base, about 1,700 here: one market on the mainland, half that across the water
    globalThis.pack = {
      cells: { routes: {} },
      burgs: [
        { i: 0 } as Burg,
        burg(1, 0, 1, 100, 9),
        burg(2, 100, 1, 1), // never outscores the first, whatever the noise
        burg(3, 300, 2, 1), // a portless island next to the mainland
        burg(4, 400, 3, 1, 9), // a port island within half the spacing
        burg(5, 1200, 4, 1, 9) // a port island beyond it
      ]
    } as typeof pack;

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const markets: Market[] = new MarketsModule()["createMarkets"]();
    const centers = markets.map(market => market.centerBurgId).sort();

    expect(centers).toEqual([1, 3, 5]);
  });

  it("moves a market to the best burg it serves on its center's landmass", () => {
    const burg = (i: number, feature: number, population: number) => ({ i, cell: i, feature, population }) as Burg;
    globalThis.pack = {
      burgs: [{ i: 0 } as Burg, burg(1, 1, 0.9), burg(2, 1, 23.6), burg(3, 2, 50)],
      markets: [{ i: 1, centerBurgId: 1, color: "", goods: {} }]
    } as unknown as typeof pack;
    const markets = new MarketsModule();
    markets.sync();
    const scored = [3, 2, 1].map(i => ({ burg: pack.burgs[i], score: pack.burgs[i].population! }));

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    markets["recenter"](pack.markets, scored, Uint16Array.from([0, 1, 1, 1]));

    expect(pack.markets[0].centerBurgId).toBe(2); // the hamlet's city, not the bigger burg across the water
  });

  it("spaces markets closer where burgs crowd and wider where the license is dear", () => {
    options.map.graph = { width: 1000, height: 800, points: 10000, sampling: "square", jitter: 0.9 };
    const burgs = [0, 10, 20, 30, 40, 50, 5000].map((x, index) => ({ i: index + 1, x, y: 0 }) as Burg);
    globalThis.pack = { burgs: [{ i: 0 } as Burg, ...burgs] } as typeof pack;
    const greedy = (burg: Burg) => (burg.i === 1 ? 3 : 1);

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const spacing: Map<number, number> = new MarketsModule()["getSpacing"](burgs, greedy);

    expect(spacing.get(7)!).toBeGreaterThan(spacing.get(2)! * 1.5); // the lone burg needs far more room
    expect(spacing.get(1)!).toBeGreaterThan(spacing.get(2)! * 1.5); // so does its neighbor under a dear license
  });
});

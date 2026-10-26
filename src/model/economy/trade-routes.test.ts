import { beforeEach, describe, expect, it } from "vitest";
import { TradeRoutesModule } from "./trade-routes";

// five cells on a line, 10 units apart; cell 4 is a market center's burg
const line = (routes: Record<number, Record<number, number>>, groups: string[]) => ({
  cells: {
    h: [30, 30, 30, 30, 30],
    burg: [0, 0, 0, 0, 1],
    p: [0, 10, 20, 30, 40].map(x => [x, 0]),
    routes
  },
  routes: groups.map((group, i) => ({ i, group })),
  burgs: [null, { i: 1, cell: 4, x: 40, y: 0 }],
  markets: [{ i: 1, centerBurgId: 1 }]
});

let tradeRoutes: TradeRoutesModule;

beforeEach(() => {
  tradeRoutes = new TradeRoutesModule();
  globalThis.grid = { spacing: 10 } as any;
});

describe("TradeRoutes.search", () => {
  it("costs land routes by length", () => {
    globalThis.pack = line({ 0: { 1: 0 }, 1: { 0: 0, 2: 0 }, 2: { 1: 0 } }, ["roads"]) as any;
    const { search, endState } = tradeRoutes.search(0, 2);
    expect(endState).toBe(4);
    expect(search.cost[endState]).toBe(20);
  });

  it("costs sea routes at a fifth of land, plus loading when switching between land and water", () => {
    // land 0→1, then sea 1→2→3
    globalThis.pack = line({ 0: { 1: 0 }, 1: { 0: 0, 2: 1 }, 2: { 1: 1, 3: 1 }, 3: { 2: 1 } }, [
      "roads",
      "searoutes"
    ]) as any;
    const { search, endState } = tradeRoutes.search(0, 3);
    expect(endState).toBe(7);
    expect(search.cost[endState]).toBeCloseTo(10 + 20 * 0.2 + 4 * 10);
  });

  it("finds no path off the route network", () => {
    globalThis.pack = line({ 0: { 1: 0 }, 1: { 0: 0 } }, ["roads"]) as any;
    expect(tradeRoutes.search(0, 3).endState).toBe(-1);
  });
});

describe("TradeRoutes.measure", () => {
  it("measures each burg's travel cost from every market's center", () => {
    globalThis.pack = line({ 3: { 4: 0 }, 4: { 3: 0 } }, ["trails"]) as any;
    globalThis.pack.burgs.push({ i: 2, cell: 3, x: 30, y: 0 } as any, { i: 3, cell: 0, x: 0, y: 0 } as any);
    const [, row] = tradeRoutes.measure();
    expect([...row]).toEqual([Infinity, 0, 10, Infinity]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { DEAL_KINDS } from "@/model/economy/deals";
import { TradeTrafficModule } from "./trade-traffic";

// a road 0–1–2–3 and a branch 1–4; burg 1 at cell 0 is the market center, burg 2 at cell 3, burg 3 at cell 4
const map = () => ({
  cells: {
    h: [30, 30, 30, 30, 30, 30],
    burg: [1, 0, 0, 2, 3, 0],
    p: [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
      [10, 10],
      [50, 50]
    ],
    routes: { 0: { 1: 0 }, 1: { 0: 0, 2: 0, 4: 0 }, 2: { 1: 0, 3: 0 }, 3: { 2: 0 }, 4: { 1: 0 } }
  },
  routes: [{ i: 0, group: "roads" }],
  burgs: [
    null,
    { i: 1, cell: 0, x: 0, y: 0 },
    { i: 2, cell: 3, x: 30, y: 0 },
    { i: 3, cell: 4, x: 10, y: 10 },
    { i: 4, cell: 5, x: 50, y: 50 }
  ],
  markets: [{ i: 1, centerBurgId: 1 }],
  deals: [] as unknown[]
});

let traffic: TradeTrafficModule;

beforeEach(() => {
  traffic = new TradeTrafficModule();
  globalThis.grid = { spacing: 10 } as any;
  globalThis.pack = map() as any;
});

describe("TradeTraffic", () => {
  it("adds each deal's units, by good, to every link between the burg and its market's center", () => {
    pack.deals = [
      [2, 1, 0, DEAL_KINDS.sale, 4, 5, 0, 0, 0], // 4 of good 0 from cell 3
      [2, 1, 1, DEAL_KINDS.demand, 2, 3, 0, 0, 0], // 2 of good 1 to cell 3
      [3, 1, 0, DEAL_KINDS.input, 1, 10, 0, 0, 0] // 1 of good 0 to cell 4
    ] as any;
    const goods = (a: number, b: number) => [...traffic.get(a, b)!.goods];
    expect(goods(0, 1)).toEqual([
      [0, 5],
      [1, 2]
    ]);
    expect(goods(1, 2)).toEqual([
      [0, 4],
      [1, 2]
    ]);
    expect(goods(3, 2)).toEqual(goods(1, 2));
    expect(goods(4, 1)).toEqual([[0, 1]]);
    expect(traffic.getLinks()).toHaveLength(4);
  });

  it("leaves out kept goods, the center's own deals and burgs off the network", () => {
    pack.deals = [
      [2, 1, 0, DEAL_KINDS.kept, 4, 0, 0, 0, 0],
      [1, 1, 0, DEAL_KINDS.demand, 4, 5, 0, 0, 0],
      [4, 1, 0, DEAL_KINDS.demand, 4, 5, 0, 0, 0]
    ] as any;
    expect(traffic.getLinks()).toEqual([]);
  });

  it("marks links travelled by water", () => {
    pack.routes.push({ i: 1, group: "searoutes" } as any);
    pack.cells.routes[3][5] = 1;
    pack.cells.routes[5] = { 3: 1 };
    pack.deals = [[4, 1, 0, DEAL_KINDS.demand, 1, 7, 0, 0, 0]] as any;
    expect(traffic.get(3, 5)).toEqual({ cells: [3, 5], goods: new Map([[0, 1]]), water: true });
    expect(traffic.get(0, 1)?.water).toBe(false);
  });

  it("keeps its sums until the deals change", () => {
    pack.deals = [[2, 1, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0]] as any;
    expect(traffic.get(0, 1)?.goods.get(0)).toBe(1);
    pack.deals.push([3, 1, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0] as any);
    expect(traffic.get(0, 1)?.goods.get(0)).toBe(1);
    pack.deals = [...pack.deals];
    expect(traffic.get(0, 1)?.goods.get(0)).toBe(2);
  });

  it("follows the routes as they change", () => {
    pack.deals = [[2, 1, 0, DEAL_KINDS.sale, 1, 1, 0, 0, 0]] as any;
    expect(traffic.get(0, 1)).toBeDefined();
    pack.routes = [];
    pack.cells.routes = {};
    expect(traffic.get(0, 1)).toBeUndefined();
  });
});

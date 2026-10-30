import { beforeEach, describe, expect, it, vi } from "vitest";
import { noFinance } from "@/model/political/states-generator";
import { Markets } from "./markets-generator";
import { Production } from "./production-generator";
import { Prosperity } from "./prosperity";
import { ProvinceEconomy } from "./province-economy";
import { DEAL_KINDS, Trade } from "./trade";

// state A rules provinces 1 and 2, state B province 3; market 1 is centered in province 1, market 2 in province 3
beforeEach(() => {
  const markets = [{ i: 0 }, { i: 1, centerBurgId: 1, feePaid: 7 }, { i: 2, centerBurgId: 3 }];
  vi.spyOn(Markets, "get").mockImplementation(id => (id ? (markets[id] as any) : undefined));
  vi.spyOn(Trade, "getMargin").mockReturnValue(0);
  vi.spyOn(Production, "getRuralOutput").mockReturnValue([]);
  vi.spyOn(Prosperity, "getBurg").mockReturnValue(null);
  vi.spyOn(Prosperity, "getRuralCell").mockReturnValue(null);
  globalThis.pack = {
    markets,
    burgs: [
      { i: 0 },
      { i: 1, cell: 0, state: 1, population: 10, product: 50, pollTaxPaid: 4 },
      { i: 2, cell: 1, state: 1, population: 10, product: 30 },
      { i: 3, cell: 2, state: 2, population: 10, product: 20 }
    ],
    provinces: [{ i: 0 }, { i: 1, state: 1, burg: 1 }, { i: 2, state: 1, burg: 2 }, { i: 3, state: 2, burg: 3 }],
    states: [
      { i: 0, economy: noFinance() },
      { i: 1, capital: 1, economy: noFinance() },
      { i: 2, capital: 3, economy: noFinance() }
    ],
    cells: { i: [0, 1, 2], state: [1, 1, 2], province: [1, 2, 3], market: [1, 1, 2], pop: [0, 0, 0], burg: [1, 2, 3] },
    deals: [
      [2, 1, 1, DEAL_KINDS.sale, 1, 10, 5, 0, 0], // A's burg sells at A's market: A's tax, raised by its province 2
      [3, 1, 1, DEAL_KINDS.demand, 1, 10, 3, 2, 0], // B's burg buys at A's market: A's tax at the market, B's tariff at home
      [1, 2, 1, DEAL_KINDS.order, 2, 10, 1, 0, 0] // A's order at B's market: delivered to province 1, B's tax at its market
    ]
  } as any;
});

describe("ProvinceEconomy", () => {
  it("counts each tax where its state's own taxpayer is, or at the market where a foreigner paid it", () => {
    expect(ProvinceEconomy.get(1)!.taxes).toEqual({ salesTax: 3, tariffs: 0, pollTax: 4, marketFees: 7 });
    expect(ProvinceEconomy.get(2)!.taxes).toEqual({ salesTax: 5, tariffs: 0, pollTax: 0, marketFees: 0 });
    expect(ProvinceEconomy.get(3)!.taxes).toEqual({ salesTax: 1, tariffs: 2, pollTax: 0, marketFees: 0 });
  });

  it("sums its people and product, and the state spending delivered to its burgs", () => {
    expect(ProvinceEconomy.get(1)).toMatchObject({ people: 10, manufacturing: 50, product: 50, wealth: 5, spent: 20 });
    expect(ProvinceEconomy.get(2)!.spent).toBe(0);
  });

  it("follows regenerated provinces without an economy run", () => {
    expect(ProvinceEconomy.get(2)!.people).toBe(10);
    pack.provinces = [{ i: 0 }, { i: 1, state: 1, burg: 1 }, { i: 2, state: 2, burg: 3 }] as any;
    pack.cells.province = [1, 1, 2] as any;
    expect(ProvinceEconomy.get(1)!.people).toBe(20);
    expect(ProvinceEconomy.get(3)).toBeNull();
  });

  it("has nothing before the economy has run", () => {
    pack.deals = [];
    expect(ProvinceEconomy.get(1)).toBeNull();
  });
});

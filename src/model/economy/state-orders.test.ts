import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Burg } from "@/model/political/burgs-generator";
import { noFinance, type State } from "@/model/political/states-generator";
import type { Good } from "./goods-generator";
import { Goods } from "./goods-generator";
import { DEAL_KINDS, type Market, Markets } from "./markets-generator";
import { StateOrders } from "./state-orders";

const good = (i: number, name: string, value: number, need: string): Good => ({
  i,
  name,
  value,
  carriage: value / 10,
  demandCoverage: { [need]: 1 },
  tags: [],
  unit: "unit",
  icon: "",
  color: "#ffffff"
});

let market: Market;
let capital: Burg;
let state: State;

beforeEach(() => {
  const catalogue = [good(1, "Jewelry", 10, "luxury"), good(2, "Swords", 5, "military"), good(3, "Bread", 1, "food")];
  market = {
    i: 1,
    centerBurgId: 1,
    color: "#ffffff",
    goods: Object.fromEntries(catalogue.map(g => [g.i, { stock: 1000, price: g.value }]))
  };
  capital = { i: 1, cell: 0, state: 1, population: 10, pollTaxPaid: 100 } as Burg;
  state = {
    i: 1,
    capital: 1,
    economy: {
      ...noFinance(),
      salesTax: 0.1,
      budget: { court: 10, administration: 0, infrastructure: 0, military: 20, corruption: 0 }
    }
  } as State;
  globalThis.pack = {
    goods: catalogue,
    cells: { i: [0], state: [1], pop: [0], burg: [1], province: [0], market: [1, 1] },
    burgs: [{ i: 0 }, capital],
    states: [{ i: 0, economy: noFinance() }, state],
    provinces: [],
    markets: [market],
    deals: []
  } as unknown as typeof pack;
  Goods.sync();
  Markets.sync();
  // biome-ignore lint/complexity/useLiteralKeys: a new run's taxes
  Markets["taxes"] = [];
});

afterEach(() => vi.restoreAllMocks());

const spent = (stateId: number) => pack.states[stateId].economy.spent;

describe("state orders", () => {
  it("spend the court's and the army's shares of the taxes at the capital, tax-free at the state's own market", () => {
    StateOrders.start();
    StateOrders.place();
    StateOrders.end();

    expect(spent(1).court).toBeCloseTo(10, 0);
    expect(spent(1).military).toBeCloseTo(20, 0);
    const orders = pack.deals.filter(deal => deal[3] === DEAL_KINDS.order);
    expect(orders.map(([burgId, , goodId]) => [burgId, goodId]).sort()).toEqual([
      [1, 1],
      [1, 2],
      [1, 3]
    ]);
    expect(orders.every(deal => deal[6] === 0)).toBe(true);
  });

  it("spend more as more taxes come in during the run", () => {
    StateOrders.start();
    StateOrders.place();
    Markets.recordDeal(1, 1, 3, DEAL_KINDS.sale, { units: 10, price: 5, tax: 50 });
    StateOrders.place();
    StateOrders.end();

    expect(spent(1).court).toBeCloseTo(15, 0);
    expect(spent(1).military).toBeCloseTo(30, 0);
  });

  it("pay another state's sales tax at its market", () => {
    const foreign = { i: 2, cell: 1, state: 2 } as Burg;
    market.centerBurgId = 2;
    pack.burgs.push(foreign);
    pack.states.push({ i: 2, capital: 2, economy: { ...noFinance(), salesTax: 0.1 } } as State);
    vi.spyOn(Markets, "getTransport").mockReturnValue(0);

    StateOrders.start();
    StateOrders.place();

    const orders = pack.deals.filter(deal => deal[3] === DEAL_KINDS.order);
    expect(orders.every(deal => deal[6] > 0)).toBe(true);
    expect(Markets.getTaxesSoFar(2)).toBeGreaterThan(0);
  });
});

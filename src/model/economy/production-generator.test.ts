import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Burg } from "@/model/political/burgs-generator";
import { rn } from "@/utils/number-utils";
import type { Good } from "./goods-generator";
import { Goods } from "./goods-generator";
import { DEAL_KINDS, type Market, Markets } from "./markets-generator";
import { ProductionModule } from "./production-generator";
import { TradeRoutes } from "./trade-routes";

const good = (i: number, name: string, value: number, recipes?: Good["recipes"]): Good => ({
  i,
  name,
  value,
  carriage: value / 10,
  recipes,
  tags: [],
  unit: "unit",
  icon: "",
  color: "#ffffff"
});

let production: ProductionModule;
let catalogue: Good[];
let market: Market;
let burg: Burg;

beforeEach(() => {
  production = new ProductionModule();
  catalogue = [
    good(1, "Oil", 1),
    good(2, "Tool sets", 1),
    good(3, "Steel", 1),
    good(4, "Engine", 100, [{ 1: 2, 2: 2, 3: 10 }]),
    good(5, "Ship", 10000, [{ 4: 1 }])
  ];
  market = {
    i: 1,
    centerBurgId: 1,
    color: "#ffffff",
    goods: Object.fromEntries(catalogue.map(g => [g.i, { stock: g.i <= 3 ? 10000 : 0, price: g.value }]))
  };
  burg = { i: 1, cell: 0, population: 100, market: 1 } as Burg;
  globalThis.pack = {
    goods: catalogue,
    cells: { good: [0] },
    burgs: [{ i: 0 }, burg],
    markets: [market],
    deals: []
  } as unknown as typeof pack;
  Goods.sync();

  Markets.sync();
});

function prepare(inventory: number[] = []) {
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  const index = production["buildProductionIndex"](catalogue);
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  const state = production["createBurgProductionState"](burg, market);
  state.inventory = inventory;
  return { index, state };
}

function plan(output: number, workers: number, inventory: number[] = []) {
  const { index, state } = prepare(inventory);
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  return production["planGoodAction"](index, state, catalogue[output - 1], 1, 1, workers);
}

describe("manufacturing work with stocked inputs", () => {
  it("makes an engine in one step and an engine then ship in two steps", () => {
    expect(plan(4, 1)?.workersNeeded).toBe(1);
    const ship = plan(5, 2);
    expect(ship?.action.good.name).toBe("Engine");
    expect(ship?.workersNeeded).toBe(2);
    expect(ship?.normalizedGain).toBeCloseTo((10000 * 0.95 - 14 * 1.05) / 2);
    expect(plan(5, 100)?.workersNeeded).toBe(2);
  });

  it("executes the engine-then-ship chain with two workers and consumes the right inputs", () => {
    burg.population = 2;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    expect([state.produced[4], state.produced[5]]).toEqual([1, 1]);
    expect(state.inventory[4]).toBe(0);
    expect(state.inventory[5]).toBe(1);
    expect([1, 2, 3].map(id => market.goods[id].stock)).toEqual([9998, 9998, 9990]);
    expect(plan(5, 2)?.workersNeeded).toBe(2);
  });

  it("uses inventory before buying components and leaves real stock untouched", () => {
    const inventory = [0, 2, 2, 10];
    const before = structuredClone({ inventory, market });
    const ship = plan(5, 2, inventory);
    expect(ship?.workersNeeded).toBe(2);
    expect(ship?.marketCost).toBe(0);
    expect({ inventory, market }).toEqual(before);
  });

  it("refreshes available market stock after each production decision", () => {
    burg.population = 4;
    market.goods[1].stock = 2;
    market.goods[2].stock = 2;
    market.goods[3].stock = 10;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    expect([state.produced[4], state.produced[5]]).toEqual([1, 1]);
    expect([1, 2, 3].map(id => market.goods[id].stock)).toEqual([0, 0, 0]);
  });

  it("does not manufacture an engine already available in the market", () => {
    market.goods[4].stock = 1;
    const ship = plan(5, 1);
    expect(ship?.action.good.name).toBe("Ship");
    expect(ship?.workersNeeded).toBe(1);
  });

  it("spends at most a turn's workers and reports when the burg runs out of them", () => {
    burg.population = 12;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const turn = () => production["runWorkerLoop"](index, state, 5);
    expect([turn(), state.workersUsed]).toEqual([true, 5]);
    expect([turn(), state.workersUsed]).toEqual([true, 10]);
    expect([turn(), state.workersUsed]).toEqual([false, 12]);
  });

  it("rejects a chain whose actual work exceeds the remaining budget", () => {
    expect(plan(5, 1)).toBeNull();
  });

  it("rejects missing raw inputs even with a large worker budget", () => {
    market.goods[1].stock = 1;
    expect(plan(5, 100)).toBeNull();
  });

  it("checks inputs and costs for every unit of a missing component", () => {
    catalogue[4].recipes = [{ 4: 2 }];
    market.goods[1].stock = 2;
    expect(plan(5, 100)).toBeNull();
    market.goods[1].stock = 4;
    const ship = plan(5, 3);
    expect(ship?.workersNeeded).toBe(3);
    expect(ship?.marketCost).toBeCloseTo(28 * 1.05);
  });

  it("reserves shared inputs across the parent and its missing component", () => {
    catalogue[4].recipes = [{ 1: 1, 4: 1 }];
    market.goods[1].stock = 2;
    expect(plan(5, 100)).toBeNull();
    market.goods[1].stock = 3;
    expect(plan(5, 2)?.workersNeeded).toBe(2);
  });

  it("reserves shared inputs across separate missing components", () => {
    catalogue[1].recipes = [{ 1: 1 }];
    catalogue[4].recipes = [{ 2: 1, 4: 1 }];
    market.goods[2].stock = 0;
    market.goods[1].stock = 4;
    expect(plan(5, 100)).toBeNull();
    market.goods[1].stock = 5;
    expect(plan(5, 5)?.workersNeeded).toBe(5);
  });

  it("tries an alternative recipe after a failed branch without keeping its reservations", () => {
    catalogue[3].recipes = [
      { 1: 2, 2: 20000 },
      { 1: 2, 3: 10 }
    ];
    market.goods[1].stock = 2;
    expect(plan(5, 2)?.workersNeeded).toBe(2);
  });

  it("rejects unseeded cycles but permits a non-cyclic alternative", () => {
    catalogue[3].recipes = [{ 5: 1 }];
    expect(plan(5, 100)).toBeNull();
    catalogue[3].recipes.push({ 1: 2 });
    expect(plan(5, 2)?.workersNeeded).toBe(2);
  });

  it("allows stocked components to break a recipe cycle", () => {
    catalogue[3].recipes = [{ 5: 1 }];
    market.goods[5].stock = 1;
    expect(plan(5, 2)?.workersNeeded).toBe(2);
  });
});

describe("freighter with 20 engines and a 700-steel hull", () => {
  beforeEach(() => {
    catalogue.push(good(6, "Iron", 1));
    catalogue[2].recipes = [{ 1: 1, 6: 1 }];
    catalogue[4].recipes = [{ 3: 700, 4: 20 }];
    catalogue[4].value = 1000000;
    market.goods[1].stock = 940;
    market.goods[2].stock = 40;
    market.goods[5].price = 1000000;
    market.goods[6] = { stock: 900, price: 1 };
    Goods.sync();
  });

  it.each([
    [900, 21],
    [700, 221],
    [0, 921]
  ])("needs %i stocked steel to finish within %i workers", (steelStock, workers) => {
    market.goods[3].stock = steelStock;
    expect(plan(5, workers - 1)).toBeNull();
    expect(plan(5, workers)?.workersNeeded).toBe(workers);
  });

  it("executes the full steel, engine and ship chain within one burg's worker cap", () => {
    market.goods[3].stock = 0;
    burg.population = 921;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    expect([state.produced[3], state.produced[4], state.produced[5]]).toEqual([900, 20, 1]);
    expect(state.inventory[5]).toBe(1);
    expect([1, 2, 6].map(id => market.goods[id].stock)).toEqual([0, 0, 0]);
  });
});

describe("inputs missing in the burg's market", () => {
  let source: Market;

  beforeEach(() => {
    options.map.graph = { width: 1000, height: 800, points: 10000, sampling: "square", jitter: 0.9 };
    market.goods[3].stock = 0;
    source = { i: 2, centerBurgId: 2, color: "#000000", goods: { 3: { stock: 100, price: 1 } } };
    Object.assign(burg, { x: 0, y: 0 });
    pack.markets.push(source);
    pack.burgs = [{ i: 0 } as Burg, burg, { i: 2, x: 100, y: 0, market: 2 } as Burg];
    Markets.sync();
    // the two market centers are 100 apart along a route
    vi.spyOn(TradeRoutes, "measure").mockReturnValue([
      new Float32Array(),
      Float32Array.from([Infinity, 0, 100]),
      Float32Array.from([Infinity, 100, 0])
    ]);
    Markets.measureRoutes();
  });

  afterEach(() => vi.restoreAllMocks());

  it("are imported from another market at price plus margin and carriage into one deal with the source", () => {
    catalogue[4].recipes = [{ 4: 2 }]; // both workers make engines
    burg.population = 2;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);

    const deliveredPrice = rn(1 * 1.05 + 100 / Math.hypot(1000, 800), 2);
    const imports = pack.deals.filter(([, marketId]) => marketId === 2);
    expect(imports.map(([burgId, , goodId, kind, units]) => [burgId, goodId, kind, units])).toEqual([
      [1, 3, DEAL_KINDS.input, 20]
    ]);
    expect(imports[0][5]).toBeGreaterThanOrEqual(deliveredPrice); // the second import pays the raised price
    expect([source.goods[3].stock, market.goods[3].stock]).toEqual([80, 0]);
  });

  it("are bought only locally while the burg's market stocks them, even when importing is cheaper", () => {
    market.goods[3] = { stock: 20, price: 2 };
    source.goods[3].price = 0.1;
    burg.population = 1;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);

    expect(pack.deals.every(([, marketId]) => marketId === 1)).toBe(true);
    expect([source.goods[3].stock, market.goods[3].stock]).toEqual([100, 10]);
  });

  it("are imported for the burg's demand within its treasury", () => {
    catalogue[2].demandCoverage = { construction: 1 };
    burg.treasury = 5;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, state);

    const [[burgId, marketId, goodId, kind, units, price]] = pack.deals;
    expect([burgId, marketId, goodId, kind]).toEqual([1, 2, 3, DEAL_KINDS.demand]);
    expect(units).toBeCloseTo(5 / price, 1);
    expect(burg.treasury).toBeCloseTo(0, 1);
  });

  it("are not imported under an embargo", () => {
    burg.state = 1;
    pack.burgs[2].state = 2;
    pack.states = [{ i: 0 }, { i: 1, tariffs: [{ states: [2], goods: "all", rate: "embargo" }] }, { i: 2 }] as any;
    expect(plan(4, 1)).toBeNull();
  });
});

describe("demand fill", () => {
  it("takes back what the burg sold to its market as if never sold, then buys the rest", () => {
    catalogue[2].demandCoverage = { construction: 1 }; // 10 steel cover the burg's construction demand
    burg.treasury = 100;
    market.goods[3].stock = 20;
    pack.deals.push([1, 1, 3, DEAL_KINDS.sale, 4, 1, 0.8, 0, 0]); // sold 4 steel at 1, 0.2 tax each: earned 0.8 each
    const { index, state } = prepare();
    state.produced[3] = 4;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, state);

    const byKind = (kind: number) => pack.deals.find(([, , goodId, k]) => goodId === 3 && k === kind)!;
    const [sale, kept, bought] = [DEAL_KINDS.sale, DEAL_KINDS.kept, DEAL_KINDS.demand].map(byKind);
    expect([sale[4], sale[6]]).toEqual([0, 0]); // the tax is not owed on goods that never left
    expect([kept[4], kept[5], kept[6]]).toEqual([4, 0, 0]);
    expect(bought[4]).toBe(6);
    expect(market.goods[3].stock).toBe(10);
    expect(burg.treasury).toBeCloseTo(100 - 4 * 0.8 - 6 * bought[5], 1);
  });

  it("trims the sale and its tax by the share kept", () => {
    market.goods[3].stock = 20;
    pack.deals.push([1, 1, 3, DEAL_KINDS.sale, 10, 1, 2, 0, 0]);
    const trade = Markets.keep({ burg, good: catalogue[2], units: 4 })!;

    expect(trade).toEqual({ units: 4, price: 0.8, tax: 0 });
    expect(pack.deals[0]).toEqual([1, 1, 3, DEAL_KINDS.sale, 6, 1, 1.2, 0, 0]);
    expect(market.goods[3].stock).toBe(16);
  });
});

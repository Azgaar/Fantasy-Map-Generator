import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Burg } from "@/model/political/burgs-generator";
import { rn } from "@/utils/number-utils";
import type { Good } from "./goods-generator";
import { Goods } from "./goods-generator";
import { DEAL_KINDS, type Market, Markets, type SourceOption } from "./markets-generator";
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
  vi.spyOn(production, "getWorkers").mockImplementation(burg => burg.population || 0); // every townsperson works, as the expected units assume
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
    expect(ship?.normalizedGain).toBeCloseTo((10000 * 0.9 - 14 * 1.1) / 2);
    expect(plan(5, 100)?.workersNeeded).toBe(2);
  });

  it("executes the engine-then-ship chain with two workers and consumes the right inputs", () => {
    burg.population = 2;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    expect([state.produced[4], state.produced[5]]).toEqual([1, 1]);
    expect(state.inventory[4]).toBe(0);
    expect(state.inventory[5]).toBe(0); // the finished ship is sold at once
    expect(pack.deals.find(([, , goodId, kind]) => goodId === 5 && kind === DEAL_KINDS.sale)?.[4]).toBe(1);
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
    expect(ship?.marketCost).toBeCloseTo(28 * 1.1);
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
    vi.spyOn(production as any, "getSpecialization").mockReturnValue(1); // exact units, without division of labor
    market.goods[3].stock = 0;
    burg.population = 921;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    expect([state.produced[3], state.produced[4], state.produced[5]]).toEqual([900, 20, 1]);
    expect(pack.deals.find(([, , goodId, kind]) => goodId === 5 && kind === DEAL_KINDS.sale)?.[4]).toBe(1);
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

  it("are logged with every market they could come from in debug mode only", () => {
    catalogue[4].recipes = [{ 4: 2 }];
    burg.population = 2;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const index = production["buildProductionIndex"](catalogue);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    expect(production["createBurgProductionState"](burg, market).log).toBeUndefined();

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const state = production["createBurgProductionState"](burg, market, true);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);

    const trade = state.log!.find(entry => "sources" in entry && entry.goodId === 3) as {
      market: number;
      sources: SourceOption[];
    };
    expect(trade.market).toBe(2);
    expect(trade.sources.map(({ market, excluded }) => [market, excluded])).toEqual([
      [2, undefined],
      [1, "stock"]
    ]);
  });
});

describe("deposits", () => {
  it("yield their cell's population, up to 10, scaled to the map's cells", () => {
    const cells = (count: number) => {
      globalThis.pack.cells = { i: Array.from({ length: count }, (_, i) => i), h: [30, 30], pop: [4, 25] } as never;
    };
    cells(5000);
    expect(production.getDepositOutput(catalogue[0], 0)).toBeCloseTo(4);
    expect(production.getDepositOutput(catalogue[0], 1)).toBeCloseTo(10);
    cells(10000);
    expect(production.getDepositOutput(catalogue[0], 0)).toBeCloseTo(8);
  });
});

describe("workforce", () => {
  it("is the share of townspeople working in trades, capped", () => {
    vi.restoreAllMocks();
    expect(production.getWorkers({ population: 10 } as Burg)).toBe(3.5);
    expect(production.getWorkers({ population: 5000 } as Burg)).toBe(1000);
  });
});

describe("division of labor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("makes a good better the more of the burg's workers make it and the more its market makes of it than the world", () => {
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const index = production["buildProductionIndex"](catalogue);
    const { state } = prepare();
    state.population = 10;
    index.marketPopulation[market.i] = 40;
    index.worldPopulation = 240;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const specialization = (goodId: number) => production["getSpecialization"](index, state, goodId);
    expect(specialization(4)).toBe(1);

    state.workersByGood[4] = 5; // half the burg's workers
    index.marketWorkers[market.i] = [];
    index.marketWorkers[market.i][4] = 10; // a quarter of the market's
    index.worldWorkers[4] = 60; // as much as the world's quarter: no market bonus
    expect(specialization(4)).toBeCloseTo(1.5, 5);

    index.worldWorkers[4] = 40; // a sixth of the world's: the market makes 1.5 times its share
    expect(specialization(4)).toBeCloseTo(1 + 0.5 + 1 * 0.5, 5);

    index.worldWorkers[4] = 10; // the market alone makes it: the bonus is capped
    expect(specialization(4)).toBeCloseTo(1 + 0.5 + 1, 5);
    expect(specialization(5)).toBe(1);
  });

  it("raises the output of each worker as the burg keeps making the good", () => {
    burg.population = 4;
    market.goods[1].stock = 1000; // plenty of ore for steel
    const { index, state } = prepare();
    index.marketPopulation[market.i] = 4;
    index.worldPopulation = 4;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    const made = state.produced.reduce((sum: number, units = 0) => sum + units, 0);
    expect(made).toBeGreaterThan(state.workersUsed); // later workers make more than one unit each
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
    // the burg is its market's center: it takes the margin on its purchase and gives back the margin on the 4 kept
    const margins = Markets.getMargin(bought) - (4 * 1 * 0.1) / 0.9;
    expect(burg.treasury).toBeCloseTo(100 - 4 * 0.8 - 6 * bought[5] + margins, 1);
  });

  it("buys the share of the burg's needs due so far, and the rest on later turns", () => {
    catalogue[2].demandCoverage = { construction: 1 }; // 10 steel cover the burg's construction demand
    burg.treasury = 1000;
    market.goods[3].stock = 100;
    const { index, state } = prepare();
    const bought = () => pack.deals.find(([, , goodId, kind]) => goodId === 3 && kind === DEAL_KINDS.demand)?.[4];

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, state, 0.5);
    expect(bought()).toBe(5);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, state, 1);
    expect(bought()).toBe(10);
  });

  it("spends up to 85% of the burg's income on wants once its needs are met", () => {
    catalogue[2].demandCoverage = { luxury: 1 };
    market.goods[3] = { stock: 1000, price: 1 };
    burg.treasury = 100;
    const { index, state } = prepare();
    state.spent = 0;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["spendOnWants"](index, state);

    expect(state.spent).toBeGreaterThan(0);
    expect(state.spent).toBeLessThanOrEqual(85 + 0.01); // savings: 15% of the income
    expect(burg.treasury).toBeGreaterThanOrEqual(15 - 0.01);
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

describe("sales tax in choosing work", () => {
  // an engine sells at 95 and takes 14 inputs; the state taxes both the inputs bought and the engine sold
  const engines = (salesTax: number) => {
    burg.population = 1;
    burg.state = 1;
    globalThis.pack.states = [{ i: 0 }, { i: 1, salesTax }] as typeof pack.states;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    return state.produced[4] ?? 0;
  };

  it("makes what still pays after the burg's own sales tax", () => {
    expect(engines(0.1)).toBe(1);
  });

  it("leaves the worker idle when the sales tax on the engine would eat its margin", () => {
    expect(engines(0.8)).toBe(0); // 95 × 0.2 = 19 back, for inputs that cost 14 × (1.05 + 0.8)
  });
});

describe("a chain's steps", () => {
  it("make only the input the chain lacks, leaving the rest of the worker for the goal", () => {
    catalogue[0].recipes = [{ 3: 1 }]; // oil from steel
    market.goods[1].stock = 1.96; // an engine takes 2 oil
    burg.population = 1.045;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    expect(rn(state.produced[1], 2)).toBe(0.04);
    expect(rn(state.produced[4], 2)).toBe(1);
  });
});

describe("market stock in planning", () => {
  afterEach(() => vi.restoreAllMocks());

  it("counts a remainder too small to buy as no stock", () => {
    vi.spyOn(Markets, "quoteSource").mockReturnValue(null);
    market.goods[1].stock = 0.01;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    expect(production["quote"](index, state, 1).stock).toBe(0);
  });
});

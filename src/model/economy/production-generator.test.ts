import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEAL_KINDS, Deals } from "@/model/economy/deals";
import { NOVELTY, VARIETY } from "@/model/economy/demand";
import { DEPOSIT_RICHNESS, Output } from "@/model/economy/output";
import { Taxes } from "@/model/economy/taxes";
import type { Burg } from "@/model/political/burgs-generator";
import { noFinance } from "@/model/political/states-generator";
import type { Good, Market } from "@/types/economy";
import { rn } from "@/utils/number-utils";
import { EconomyDebug } from "./economy-debug";
import { Goods } from "./goods-generator";
import { Markets } from "./markets-generator";
import {
  BURG_SPECIALIZATION,
  DEPOSIT_OUTPUT,
  MARKET_SPECIALIZATION,
  MAX_DEPOSIT_VALUE,
  ProductionModule,
  WORKFORCE_SHARE
} from "./production-generator";
import { Prosperity } from "./prosperity";
import { StateOrders } from "./state-orders";
import { PRICE_CURVE, type SourceOption, Trade } from "./trade";
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

const MARGIN = Markets.getMarginRate(); // a market that paid no license fee
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
  burg = { i: 1, cell: 0, population: 100 } as Burg;
  globalThis.pack = {
    cells: { good: [0], market: [1, 2], h: [30, 30], development: [1, 1] },
    burgs: [{ i: 0 }, burg],
    markets: [market],
    deals: []
  } as unknown as typeof pack;
  options.map.goods = catalogue;
  Goods.sync();

  Markets.sync();
});

function prepare(inventory: number[] = []) {
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  const index = production["buildProductionIndex"](catalogue);
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  const day = production["createBurgDay"](index, burg, market);
  day.inventory = inventory;
  return { index, day };
}

function plan(output: number, workers: number, inventory: number[] = []) {
  const { index, day } = prepare(inventory);
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  return production["planGoodAction"](index, day, catalogue[output - 1], 1, 1, workers);
}

describe("clearing the run", () => {
  it("leaves nothing made or traded, the adjustments alone", () => {
    const state = { i: 1, economy: { ...noFinance(), spent: { ...noFinance().spent, military: 5 }, treasury: 9 } };
    const run = {
      i: 1,
      product: 7,
      production: [[1, 2]],
      pollTaxPaid: 1,
      treasury: 9,
      adjustments: [{ name: "Rent", value: 3 }]
    };
    pack.deals = [[1, 1, 1, 0, 2, 3]] as never;
    pack.burgs = [0, run] as never;
    pack.markets = [{ i: 1, goods: { 1: { stock: 1, price: 1 } }, feePaid: 2, rural: { earned: 1 } }] as never;
    pack.states = [{ i: 0 }, state] as never;
    pack.cells = { i: [0, 1], prosperity: Uint8Array.from([5, 5]) } as never;
    const collectTaxes = vi.spyOn(Taxes, "collect").mockImplementation(() => {});

    production.clear();

    expect(pack.deals).toEqual([]);
    expect(pack.markets[0]).toEqual({ i: 1, goods: {}, feePaid: 0 });
    expect(run).toMatchObject({ product: 0, production: [], pollTaxPaid: 0, treasury: 3 });
    expect(state.economy.spent.military).toBe(0);
    expect(Array.from(pack.cells.prosperity)).toEqual([0, 0]);
    expect(collectTaxes).toHaveBeenCalledOnce();
    collectTaxes.mockRestore();
  });
});

describe("manufacturing work with stocked inputs", () => {
  it("makes an engine in one step and an engine then ship in two steps", () => {
    expect(plan(4, 1)?.workersNeeded).toBe(1);
    const ship = plan(5, 2);
    expect(ship?.action.good.name).toBe("Engine");
    expect(ship?.workersNeeded).toBe(2);
    expect(ship?.normalizedGain).toBeCloseTo((10000 * (1 - MARGIN) - 14 * rn(1 + MARGIN, 2)) / 2);
    expect(plan(5, 100)?.workersNeeded).toBe(2);
  });

  it("executes the engine-then-ship chain with two workers and consumes the right inputs", () => {
    burg.population = 2;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect([day.produced[4], day.produced[5]]).toEqual([1, 1]);
    expect(day.inventory[4]).toBe(0);
    expect(day.inventory[5]).toBe(0); // the finished ship is sold at once
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
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect([day.produced[4], day.produced[5]]).toEqual([1, 1]);
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
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const turn = () => production["runWorkerLoop"](index, day, 5);
    expect([turn(), day.workersUsed]).toEqual([true, 5]);
    expect([turn(), day.workersUsed]).toEqual([true, 10]);
    expect([turn(), day.workersUsed]).toEqual([false, 12]);
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
    expect(ship?.marketCost).toBeCloseTo(28 * rn(1 + MARGIN, 2));
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
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect([day.produced[3], day.produced[4], day.produced[5]]).toEqual([900, 20, 1]);
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
    pack.burgs = [{ i: 0 } as Burg, burg, { i: 2, cell: 1, x: 100, y: 0 } as Burg];
    Markets.sync();
    // the two market centers are 100 apart along a route
    vi.spyOn(TradeRoutes, "measure").mockReturnValue([
      new Float32Array(),
      Float32Array.from([Infinity, 0, 100]),
      Float32Array.from([Infinity, 100, 0])
    ]);
    Trade.measureRoutes();
  });

  afterEach(() => vi.restoreAllMocks());

  it("are imported from another market at price plus margin and carriage into one deal with the source", () => {
    catalogue[4].recipes = [{ 4: 2 }]; // both workers make engines
    burg.population = 2;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);

    const deliveredPrice = rn(1 * (1 + MARGIN) + 100 / Math.hypot(1000, 800), 2);
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
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);

    expect(pack.deals.every(([, marketId]) => marketId === 1)).toBe(true);
    expect([source.goods[3].stock, market.goods[3].stock]).toEqual([100, 10]);
  });

  it("are imported when the burg's market has less than a unit left", () => {
    market.goods[3] = { stock: 0.5, price: 1 };
    burg.population = 1;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);

    expect(
      pack.deals.some(([, marketId, goodId, kind]) => marketId === 2 && goodId === 3 && kind === DEAL_KINDS.input)
    ).toBe(true);
    expect(market.goods[3].stock).toBe(0.5);
  });

  it("are imported for the burg's demand within its treasury", () => {
    catalogue[2].demandCoverage = { construction: 1 };
    burg.treasury = 5;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, day);

    const [[burgId, marketId, goodId, kind, units, price]] = pack.deals;
    expect([burgId, marketId, goodId, kind]).toEqual([1, 2, 3, DEAL_KINDS.demand]);
    expect(units).toBeCloseTo(5 / price, 1);
    expect(burg.treasury).toBeCloseTo(0, 1);
  });

  it("are not imported under an embargo", () => {
    burg.state = 1;
    pack.burgs[2].state = 2;
    pack.states = [
      { i: 0, economy: noFinance() },
      { i: 1, economy: { ...noFinance(), tariffs: [{ states: [2], goods: "all", rate: "embargo" }] } },
      { i: 2, economy: noFinance() }
    ] as any;
    expect(plan(4, 1)).toBeNull();
  });

  it("are logged with every market they could come from in debug mode only", () => {
    catalogue[4].recipes = [{ 4: 2 }];
    burg.population = 2;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const index = production["buildProductionIndex"](catalogue);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    expect(production["createBurgDay"](index, burg, market).log).toBeUndefined();

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const day = production["createBurgDay"](index, burg, market, true);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);

    const trade = day.log!.find(entry => "sources" in entry && entry.goodId === 3) as {
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
      globalThis.pack.cells = {
        i: Array.from({ length: count }, (_, i) => i),
        h: [30, 30],
        pop: [4, 25],
        development: [1, 1]
      } as never;
    };
    cells(5000);
    expect(Output.getDeposit(catalogue[0], 0)).toBeCloseTo(4 * DEPOSIT_RICHNESS);
    expect(Output.getDeposit(catalogue[0], 1)).toBeCloseTo(10 * DEPOSIT_RICHNESS);
    cells(10000);
    expect(Output.getDeposit(catalogue[0], 0)).toBeCloseTo(8 * DEPOSIT_RICHNESS);
  });

  it("are worked by a burg on them as a trade with no inputs, worth what its market pays", () => {
    pack.cells.good = Uint16Array.of(1); // oil
    const { index, day } = prepare();
    expect(day.inventory).toEqual([]); // nothing free
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const oil = production["planGoodAction"](index, day, catalogue[0], 2, 2, 100);
    expect(oil?.candidate.ingredientCost).toBe(0);
    expect(oil?.normalizedGain).toBeCloseTo(DEPOSIT_OUTPUT * (1 - MARGIN), 2); // a worker's units at the market's price, less its margin
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["executeManufacture"](index, day, { ...oil!, candidates: [], runnerUp: 0 }, 2);
    expect(day.produced[1]).toBe(2 * DEPOSIT_OUTPUT);
  });

  it("yield a burg at most a set worth a day, however many workers it has", () => {
    pack.cells.good = Uint16Array.of(1);
    catalogue[0].value = 50; // dear: at most 4 units a day
    const { index, day } = prepare();
    const cap = MAX_DEPOSIT_VALUE / 50;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const oil = production["planGoodAction"](index, day, catalogue[0], 10, 10, 100);
    expect(oil?.action.maxYield).toBeCloseTo(cap / DEPOSIT_OUTPUT); // the workers the deposit has work for
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["executeManufacture"](index, day, { ...oil!, candidates: [], runnerUp: 0 }, 100);
    expect(day.produced[1]).toBeCloseTo(cap);
    day.depositLeft = 0.005; // less than rounds to a unit's hundredth
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    expect(production["planGoodAction"](index, day, catalogue[0], 1, 1, 100)).toBeNull(); // spent: no worker wasted on it
  });

  it("give way to the good's recipes once capped, at the usual output", () => {
    pack.cells.good = Uint16Array.of(1);
    const { index, day } = prepare();
    const oil = catalogue[0];
    const recipes = [{ good: oil, ingredients: [{ goodId: 2, amount: 1 }] }];
    index.recipesByOutput[oil.i] = recipes;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const recipesNow = () => production["getRecipes"](index, day, oil);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const output = () => production["getBurgModifiers"](day, oil);
    const worked = output();
    expect(recipesNow()).toEqual([{ good: oil, ingredients: [] }]);
    day.depositLeft = 0;
    expect(recipesNow()).toBe(recipes);
    expect(output()).toBe(worked / DEPOSIT_OUTPUT);
  });

  it("are worked for a chain's input when that pays a worker more than buying it", () => {
    pack.cells.good = Uint16Array.of(1);
    market.goods[1].price = 30; // the engine's 2 oil cost 60 bought, a worker gathered
    expect(plan(4, 3)?.action.good.name).toBe("Oil");
    expect(plan(4, 3)?.workersNeeded).toBe(1 + 2 / DEPOSIT_OUTPUT);
    market.goods[1].price = 1; // cheap: buying beats spending workers on it
    expect(plan(4, 3)?.action.good.name).toBe("Engine");
  });

  it("supply a chain's input the market lacks", () => {
    pack.cells.good = Uint16Array.of(1);
    market.goods[1].stock = 0;
    burg.population = 4; // 2 to gather the oil, 1 to build the engine, 1 the ship
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect(day.produced[1]).toBeGreaterThanOrEqual(2); // gathered for the engine
    expect(day.produced[4]).toBeGreaterThanOrEqual(1);
  });
});

describe("a burg's purchases for a need", () => {
  const lots = (shares: number[], cost: number, budget = Infinity, buyable = (_k: number) => true) =>
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["getLotShares"](shares, buyable, () => cost, budget);

  it("keep every good whose share buys at least the minimum", () => {
    expect(lots([0.5, 0.3, 0.2], 10)).toEqual([0.5, 0.3, 0.2]);
  });

  it("drop goods buying less than the minimum, their money going to the rest", () => {
    const shares = lots([0.6, 0.35, 0.05], 10); // 6, 3.5 and 0.5 coins
    expect(shares[2]).toBe(0);
    expect(shares[0]).toBeCloseTo(0.6 / 0.95);
    expect(shares[1]).toBeCloseTo(0.35 / 0.95);
  });

  it("take a smaller minimum when all there is for the need is less than the usual one", () => {
    const shares = lots([0.6, 0.3, 0.1], 0.9); // 0.54, 0.27 and 0.09 coins
    expect(shares[2]).toBe(0);
    expect(shares[0]).toBeCloseTo(2 / 3);
    expect(shares[1]).toBeCloseTo(1 / 3);
  });

  it("go to the largest share when even that buys too little, and split no budget into lots below the minimum", () => {
    expect(lots([0.7, 0.3], 0.2)).toEqual([1, 0]); // 0.14 and 0.06 coins
    expect(lots([0.6, 0.4], 10, 1.5)).toEqual([1, 0]); // the money runs out: 0.9 and 0.6 coins
  });

  it("leave goods nobody stocks their shares, as they turn buyers away", () => {
    const shares = lots([0.6, 0.35, 0.05], 10, Infinity, k => k !== 2);
    expect(shares).toEqual([0.6, 0.35, 0.05]);
  });
});

describe("workforce", () => {
  it("is the share of townspeople working in trades, capped", () => {
    vi.restoreAllMocks();
    expect(production.getWorkers({ population: 10 } as Burg)).toBe(rn(10 * WORKFORCE_SHARE, 2));
    expect(production.getWorkers({ population: 5000 } as Burg)).toBe(300);
  });
});

describe("division of labor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("makes a good better the more of the burg's workers make it and the more its market makes of it than the world", () => {
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const index = production["buildProductionIndex"](catalogue);
    const { day } = prepare();
    day.workers = 10;
    index.marketWorkforce[market.i] = 40;
    index.worldWorkforce = 240;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const specialization = (goodId: number) => production["getSpecialization"](index, day, goodId);
    expect(specialization(4)).toBe(1);

    day.workersByGood[4] = 5; // half the burg's workers
    index.marketWorkers[market.i] = [];
    index.marketWorkers[market.i][4] = 10; // a quarter of the market's
    index.worldWorkers[4] = 60; // as much as the world's quarter: no market bonus
    expect(specialization(4)).toBeCloseTo(1 + BURG_SPECIALIZATION * 0.5, 5);

    index.worldWorkers[4] = 40; // a sixth of the world's: the market makes 1.5 times its share
    expect(specialization(4)).toBeCloseTo(1 + BURG_SPECIALIZATION * 0.5 + MARKET_SPECIALIZATION * 0.5, 5);

    index.worldWorkers[4] = 10; // the market alone makes it: the bonus is capped
    expect(specialization(4)).toBeCloseTo(1 + BURG_SPECIALIZATION * 0.5 + MARKET_SPECIALIZATION, 5);
    expect(specialization(5)).toBe(1);
  });

  it("raises the output of each worker as the burg keeps making the good", () => {
    burg.population = 4;
    market.goods[1].stock = 1000; // plenty of ore for steel
    const { index, day } = prepare();
    index.marketWorkforce[market.i] = 4;
    index.worldWorkforce = 4;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    const made = day.produced.reduce((sum: number, units = 0) => sum + units, 0);
    expect(made).toBeGreaterThan(day.workersUsed); // later workers make more than one unit each
  });
});

describe("demand fill", () => {
  it("takes back what the burg sold to its market as if never sold, then buys the rest", () => {
    catalogue[2].demandCoverage = { construction: 1 }; // 10 steel cover the burg's construction demand
    burg.treasury = 100;
    market.goods[3].stock = 20;
    pack.deals.push([1, 1, 3, DEAL_KINDS.sale, 4, 1, 0.8, 0, 0]); // sold 4 steel at 1, 0.2 tax each: earned 0.8 each
    const { index, day } = prepare();
    day.produced[3] = 4;
    day.revenue = 3.2;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, day);
    expect(day.revenue).toBeCloseTo(0, 2); // what it took back is no longer a sale

    const byKind = (kind: number) => pack.deals.find(([, , goodId, k]) => goodId === 3 && k === kind)!;
    const [sale, kept, bought] = [DEAL_KINDS.sale, DEAL_KINDS.kept, DEAL_KINDS.demand].map(byKind);
    expect([sale[4], sale[6]]).toEqual([0, 0]); // the tax is not owed on goods that never left
    expect([kept[4], kept[5], kept[6]]).toEqual([4, 0, 0]);
    expect(bought[4]).toBe(6);
    expect(market.goods[3].stock).toBe(10);
    // the burg is its market's center: it takes the margin on its purchase and gives back the margin on the 4 kept
    const margins = Deals.getMargin(bought) - (4 * 1 * MARGIN) / (1 - MARGIN);
    expect(burg.treasury).toBeCloseTo(100 - 4 * 0.8 - 6 * bought[5] + margins, 1);
  });

  it("buys the share of the burg's needs due so far, and the rest on later turns", () => {
    catalogue[2].demandCoverage = { construction: 1 }; // 10 steel cover the burg's construction demand
    burg.treasury = 1000;
    market.goods[3].stock = 100;
    const { index, day } = prepare();
    const bought = () => pack.deals.find(([, , goodId, kind]) => goodId === 3 && kind === DEAL_KINDS.demand)?.[4];

    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, day, 0.5);
    expect(bought()).toBe(5);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["fillDemand"](index, day, 1);
    expect(bought()).toBe(10);
  });

  it("spends up to 85% of the burg's income on wants once its needs are met", () => {
    catalogue[2].demandCoverage = { luxury: 1 };
    market.goods[3] = { stock: 1000, price: 1 };
    burg.treasury = 100;
    const { index, day } = prepare();
    day.spent = 0;
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["spendOnWants"](index, day);

    expect(day.spent).toBeGreaterThan(0);
    expect(day.spent).toBeLessThanOrEqual(85 + 0.01); // savings: 15% of the income
    expect(burg.treasury).toBeGreaterThanOrEqual(15 - 0.01);
  });

  it("pays more for goods it has had little of, the richer the burg is", () => {
    const { index, day } = prepare();
    index.needsCost = 1;
    const [oil, tools] = [catalogue[0], catalogue[1]].map(good => ({
      candidate: { good, goodId: good.i, coverageWeight: 1 },
      costPerCoverage: 1
    }));
    day.consumed[1] = 10;
    day.covered[4] = 10; // all its luxury so far came from oil
    const shares = (treasury: number) => {
      burg.treasury = treasury;
      // biome-ignore lint/complexity/useLiteralKeys: private test access
      return production["getShares"](index, day, 4, [oil, tools]);
    };
    expect(shares(0)).toEqual([0.5, 0.5]); // earns no more than its needs: price alone decides
    const [oilShare, toolsShare] = shares(1000); // ten days of needs a person: tool sets are worth 1 + NOVELTY times their price
    expect(toolsShare / oilShare).toBeCloseTo((1 + NOVELTY) ** VARIETY, 5);
  });

  it("lets luxury wants grow with the burg's wealth", () => {
    catalogue[2].demandCoverage = { luxury: 1 };
    market.goods[3] = { stock: 100000, price: 1 };
    burg.treasury = 10000;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["spendOnWants"](index, day);

    const fixedCap = 100 * 0.07 * 5; // the needs and four more days of luxury
    expect(day.covered[4]).toBeGreaterThan(fixedCap);
    expect(day.spent).toBeLessThanOrEqual(8500 + 0.01); // still within 85% of the income
  });

  it("trims the sale and its tax by the share kept", () => {
    market.goods[3].stock = 20;
    pack.deals.push([1, 1, 3, DEAL_KINDS.sale, 10, 1, 2, 0, 0]);
    const trade = Trade.keep({ burg, good: catalogue[2], units: 4 })!;

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
    globalThis.pack.states = [
      { i: 0, economy: noFinance() },
      { i: 1, economy: { ...noFinance(), salesTax } }
    ] as typeof pack.states;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    return day.produced[4] ?? 0;
  };

  it("makes what still pays after the burg's own sales tax", () => {
    expect(engines(0.1)).toBe(1);
  });

  it("leaves the worker idle when the sales tax on the engine would eat its margin", () => {
    expect(engines(0.8)).toBe(0); // 95 × 0.2 = 19 back, for inputs that cost 14 × (1.05 + 0.8)
  });
});

describe("price impact in choosing work", () => {
  // an engine opens at 95 and takes 14 inputs, but its market expects to sell only part of one a day
  const withEngineDepth = (depth: number) => {
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    Trade["days"] = [
      undefined,
      {
        depth: [0, 1e9, 1e9, 1e9, depth, 1e9],
        listPrice: catalogue.reduce((prices: number[], good) => {
          prices[good.i] = good.value;
          return prices;
        }, []),
        demand: [],
        supply: [],
        rural: [],
        covered: [],
        bought: [],
        pollTaxDue: []
      }
    ] as never;
  };
  afterEach(() => {
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    Trade["days"] = [];
  });

  it("values a step at what its lot fetches, not at the market's price for one unit", () => {
    withEngineDepth(2);
    const steps = Array.from({ length: 1000 }, (_, k) => (k + 0.5) / 1000); // the sale, unit by unit
    const lot = steps.reduce((sum, k) => sum + (2 / (2 + k)) ** PRICE_CURVE, 0) / steps.length; // the engine's average price over its own sale
    expect(plan(4, 1)?.normalizedGain).toBeCloseTo(rn(100 * (1 - MARGIN), 2) * lot - 14 * rn(1 + MARGIN, 2), 1);
  });

  it("leaves the worker idle when even its smallest step would sell for less than its inputs cost", () => {
    withEngineDepth(0.05); // half an engine sells for about 9 apiece
    burg.population = 1;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect(day.produced[4] ?? 0).toBe(0);
  });

  it("makes in a thin market only what still pays, a step at a time", () => {
    withEngineDepth(0.2); // half an engine sells for about 27 apiece, and leaves the price at a twelfth
    catalogue[4].recipes = []; // no ship to put the engines into
    burg.population = 1;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect(day.produced[4]).toBe(0.5);
    expect(day.workersUsed).toBe(0.5); // the other half finds nothing worth making
  });
});

describe("a chain's steps", () => {
  it("make only the input the chain lacks, leaving the rest of the worker for the goal", () => {
    catalogue[0].recipes = [{ 3: 1 }]; // oil from steel
    market.goods[1].stock = 1.96; // an engine takes 2 oil
    burg.population = 1.045;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect(rn(day.produced[1], 2)).toBe(0.04);
    expect(rn(day.produced[4], 2)).toBe(1);
  });

  it("take the workers that make the input the chain lacks, not one per unit of it", () => {
    catalogue[0].recipes = [{ 3: 1 }]; // oil from steel
    catalogue[0].multipliers = { biome: { 0: 2 } }; // a worker makes 2 oil, what an engine takes
    Object.assign(pack.cells, { biome: [0], burg: [1], culture: [0], state: [0], religion: [0] });
    market.goods[1].stock = 0;
    burg.population = 2;
    expect(plan(4, 2)?.workersNeeded).toBe(2);
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, day);
    expect([day.produced[1], day.produced[4]]).toEqual([2, 1]);
  });
});

describe("a chain's inputs", () => {
  it("are every good down the goal's recipes", () => {
    const { index } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    expect([...production["getChainInputs"](index, 5)].sort()).toEqual([1, 2, 3, 4]);
  });

  it("wait in the inventory between turns while the chain is under way", () => {
    const { index, day } = prepare([0, 3, 0, 0, 2]);
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["sellInventoryToMarket"](index, day, (goodId: number) => goodId !== 4);
    expect([day.inventory[1], day.inventory[4]]).toEqual([0, 2]);
  });
});

describe("market stock in planning", () => {
  afterEach(() => vi.restoreAllMocks());

  it("counts a remainder too small to buy as no stock", () => {
    vi.spyOn(Trade, "quoteSource").mockReturnValue(null);
    market.goods[1].stock = 0.01;
    const { index, day } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    expect(production["quote"](index, day, 1).stock).toBe(0);
  });
});

describe("the run's rounds", () => {
  afterEach(() => vi.restoreAllMocks());

  it("go on after a round in which burgs put only their last workers to work, so idle burgs try again", () => {
    globalThis.pack.burgs.push({ i: 2, cell: 0, population: 50 } as Burg);
    for (const method of ["collectRuralProduction", "initializeMarketPrices", "measureRoutes", "billLicenses"] as const)
      vi.spyOn(Trade, method).mockImplementation(() => {});
    for (const method of ["spendRural", "settleLicenses", "endRun"] as const)
      vi.spyOn(Trade, method).mockImplementation(() => {});
    for (const method of ["start", "place", "end"] as const) vi.spyOn(StateOrders, method).mockImplementation(() => {});
    vi.spyOn(EconomyDebug, "start").mockReturnValue(false);
    vi.spyOn(Prosperity, "getCellsProsperity").mockReturnValue(new Uint8Array(1));
    vi.spyOn(Output, "getRural").mockReturnValue([]);
    const internal = production as unknown as Record<string, (...args: any[]) => unknown>;
    for (const method of ["sellInventoryToMarket", "fillDemand", "spendOnWants"])
      vi.spyOn(internal, method).mockImplementation(() => {});
    const turns: number[] = [];
    vi.spyOn(internal, "runWorkerLoop").mockImplementation((_index, day) => {
      turns.push(day.burg.i);
      if (day.burg.i === 1) day.workersUsed = day.workers; // its last workers: none left to report
      return false;
    });

    production.produce();
    expect(turns).toEqual([1, 2, 2]); // burg 2 idles, then tries again after burg 1's last work
  });
});

describe("the turn order", () => {
  it("goes by √population × development, the most first", () => {
    globalThis.pack.cells.development = Uint8Array.from([80, 20, 50]);
    const burgs = [
      { i: 1, cell: 1, population: 16 },
      { i: 2, cell: 0, population: 4 },
      { i: 3, cell: 2, population: 9 }
    ] as Burg[];
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    const order = production["getTurnOrder"](burgs).map(burg => burg.i);
    expect(order).toEqual([2, 3, 1]); // 160, 150, 80
  });
});

describe("technology tiers", () => {
  it("make nothing of a good where development is below its tier", () => {
    catalogue[0].development = 50;
    const modifiers = (level: number) => {
      globalThis.pack.cells.development = Uint8Array.from([level]);
      // biome-ignore lint/complexity/useLiteralKeys: private test access
      return Output["getModifiers"](catalogue[0], 0);
    };
    expect(modifiers(40)).toBe(0);
    expect(modifiers(50)).toBeCloseTo(50 / 30);
  });

  it("make more of every good past the High Middle Ages", () => {
    const modifiers = (level: number) => {
      globalThis.pack.cells.development = Uint8Array.from([level]);
      // biome-ignore lint/complexity/useLiteralKeys: private test access
      return Output["getModifiers"](catalogue[0], 0);
    };
    expect(modifiers(20)).toBe(1);
    expect(modifiers(30)).toBe(1);
    expect(modifiers(60)).toBe(2);
    expect(modifiers(90)).toBe(3);
  });
});

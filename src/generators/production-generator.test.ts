import { beforeEach, describe, expect, it } from "vitest";
import type { Burg } from "./burgs-generator";
import type { Good } from "./goods-generator";
import { type Market, MarketsModule } from "./markets-generator";
import { isMfgRecord, ProductionModule } from "./production-generator";

const good = (i: number, name: string, value: number, recipes?: Good["recipes"]): Good => ({
  i,
  name,
  value,
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
  globalThis.pack = { goods: catalogue, cells: { good: [0] }, markets: [market], deals: [] } as unknown as typeof pack;
  Goods.sync();
  globalThis.Markets = new MarketsModule();
  Markets.sync();
});

function prepare(inventory: number[] = []) {
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  const index = production["buildProductionIndex"](catalogue);
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  const state = production["createBurgProductionState"](burg, market, index);
  state.inventory = inventory;
  return { index, state };
}

function plan(output: number, workers: number, inventory: number[] = []) {
  const { index, state } = prepare(inventory);
  // biome-ignore lint/complexity/useLiteralKeys: private test access
  return production["planGoodAction"](index, state, catalogue[output - 1], 1, 1, workers, {
    multiplier: 1,
    category: null
  });
}

describe("manufacturing work with stocked inputs", () => {
  it("makes an engine in one step and an engine then ship in two steps", () => {
    expect(plan(4, 1)?.workersNeeded).toBe(1);
    const ship = plan(5, 2);
    expect(ship?.action.good.name).toBe("Engine");
    expect(ship?.workersNeeded).toBe(2);
    expect(ship?.normalizedGain).toBeCloseTo((9000 - 14 * 1.1) / 2);
    expect(plan(5, 100)?.workersNeeded).toBe(2);
  });

  it("executes the engine-then-ship chain with two workers and consumes the right inputs", () => {
    burg.population = 2;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    expect(state.records.filter(isMfgRecord).map(record => [record.goodId, record.units])).toEqual([
      [4, 1],
      [5, 1]
    ]);
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
    expect(state.records.filter(isMfgRecord).map(record => [record.goodId, record.units])).toEqual([
      [4, 1],
      [5, 1]
    ]);
    expect([1, 2, 3].map(id => market.goods[id].stock)).toEqual([0, 0, 0]);
  });

  it("does not manufacture an engine already available in the market", () => {
    market.goods[4].stock = 1;
    const ship = plan(5, 1);
    expect(ship?.action.good.name).toBe("Ship");
    expect(ship?.workersNeeded).toBe(1);
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
    market.goods[3].stock = 0;
    burg.population = 921;
    const { index, state } = prepare();
    // biome-ignore lint/complexity/useLiteralKeys: private test access
    production["runWorkerLoop"](index, state);
    const records = state.records.filter(isMfgRecord);
    expect(records.filter(record => record.goodId === 3)).toHaveLength(900);
    expect(records.filter(record => record.goodId === 4)).toHaveLength(20);
    expect(state.inventory[5]).toBe(1);
    expect([1, 2, 6].map(id => market.goods[id].stock)).toEqual([0, 0, 0]);
  });
});

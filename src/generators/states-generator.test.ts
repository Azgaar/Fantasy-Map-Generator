import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("StatesModule.collectTaxes", () => {
  let StatesModule: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.window = globalThis.window || ({} as any);
    globalThis.pack = {
      states: [],
      burgs: [],
      markets: [],
      deals: [],
      biomes: []
    } as any;
    // Stub Names/COA data not needed for this test
    globalThis.Names = { getCultureShort: () => "X", getState: () => "X" } as any;
    globalThis.FlatQueue = class {
      length = 0;
      pop() {
        return undefined as any;
      }
      push() {
        /* noop */
      }
    } as any;
    globalThis.Routes = { areConnected: () => false } as any;
    globalThis.Markets = {
      get: (marketId: number | undefined) =>
        marketId ? globalThis.pack.markets?.find((m: any) => m?.i === marketId) : undefined
    } as any;
    globalThis.options = {} as any;

    // Reload module fresh
    await import("./states-generator");
    StatesModule = (globalThis as any).States;
  });

  it("credits sales-tax deal.tax to the seller's state and adds poll tax", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", salesTax: 0, pollTax: 0, treasury: 0 },
      {
        i: 1,
        name: "A",
        salesTax: 0.2,
        pollTax: 0.5,
        treasury: 0,
        rural: 100,
        urban: 50
      },
      {
        i: 2,
        name: "B",
        salesTax: 0.1,
        pollTax: 0.1,
        treasury: 0,
        rural: 200,
        urban: 100
      }
    ] as any;

    globalThis.pack.burgs = [{ i: 0 }, { i: 1, state: 1, cell: 1 }, { i: 2, state: 2, cell: 2 }] as any;

    globalThis.pack.markets = [
      { i: 1, centerBurgId: 1, color: "", goods: {} },
      { i: 2, centerBurgId: 2, color: "", goods: {} }
    ] as any;

    globalThis.pack.deals = [
      {
        i: 0,
        seller: 1,
        sellerType: "burg",
        buyer: 1,
        buyerType: "market",
        good: 0,
        units: 10,
        price: 5,
        tax: 10 // 10 = 0.2 * 10 * 5
      },
      {
        i: 1,
        seller: 1,
        sellerType: "market",
        buyer: 2,
        buyerType: "market",
        good: 0,
        units: 4,
        price: 3,
        tax: 2 // exporter market 1 -> state 1
      },
      {
        i: 2,
        seller: 2,
        sellerType: "burg",
        buyer: 2,
        buyerType: "market",
        good: 1,
        units: 2,
        price: 6,
        tax: 1.2
      },
      {
        i: 3,
        seller: 2,
        sellerType: "market",
        buyer: 1,
        buyerType: "burg",
        good: 1,
        units: 1,
        price: 8
        // no tax — pure buy from market
      }
    ] as any;

    StatesModule.collectTaxes();

    // State 1: sales tax 10 + 2 = 12; poll tax 0.5 * (100+50) = 75; treasury = 87
    expect(globalThis.pack.states[1].treasury).toBeCloseTo(87, 2);
    // State 2: sales tax 1.2; poll tax 0.1 * (200+100) = 30; treasury = 31.2
    expect(globalThis.pack.states[2].treasury).toBeCloseTo(31.2, 2);
    // Neutrals always 0
    expect(globalThis.pack.states[0].treasury).toBe(0);
  });

  it("leaves neutrals at zero even with deals from neutral burgs", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", salesTax: 0, pollTax: 0, treasury: 0 },
      { i: 1, name: "A", salesTax: 0.1, pollTax: 0, treasury: 0, rural: 10, urban: 0 }
    ] as any;
    globalThis.pack.burgs = [
      { i: 0 },
      { i: 1, state: 0, cell: 0 } // neutral burg
    ] as any;
    globalThis.pack.markets = [];
    globalThis.pack.deals = [
      {
        i: 0,
        seller: 1,
        sellerType: "burg",
        buyer: 1,
        buyerType: "market",
        good: 0,
        units: 5,
        price: 5,
        tax: 2.5
      }
    ] as any;

    StatesModule.collectTaxes();

    expect(globalThis.pack.states[0].treasury).toBe(0);
    // State 1 has no deal credit and only poll tax (0 here), so treasury stays 0
    expect(globalThis.pack.states[1].treasury).toBe(0);
  });
});

describe("StatesModule.generateDiplomacy", () => {
  let StatesModule: any;

  beforeEach(async () => {
    globalThis.TIME = false;
    globalThis.options = { year: 100 } as any;
    // 0.5 makes P(0.8) true and rw() pick no Rival, so the vassal branch runs and no war is declared
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await import("./states-generator");
    StatesModule = (globalThis as any).States;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips removed states when vassals copy their suzerain's relations", () => {
    // state 2 is a large state bordering the small state 3, which becomes its vassal; state 4 is far away
    const cellState = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 4];
    globalThis.pack = {
      cells: {
        i: cellState.map((_, i) => i),
        h: cellState.map(() => 30),
        state: cellState,
        area: cellState.map(() => 10),
        f: cellState.map(() => 1)
      },
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, removed: true },
        { i: 2, name: "A", neighbors: [3], center: 0, expansionism: 1, campaigns: [] },
        { i: 3, name: "B", neighbors: [2], center: 10, expansionism: 1, campaigns: [] },
        { i: 4, name: "C", neighbors: [], center: 11, expansionism: 1, campaigns: [] }
      ]
    } as any;

    expect(() => StatesModule.generateDiplomacy()).not.toThrow();

    const { states } = globalThis.pack;
    expect(states[1].diplomacy).toBeUndefined();
    expect(states[2].diplomacy).toEqual(["x", "x", "x", "Suzerain", "Neutral"]);
    expect(states[3].diplomacy).toEqual(["x", "x", "Vassal", "x", "Neutral"]);
    expect(states[4].diplomacy).toEqual(["x", "x", "Neutral", "Neutral", "x"]);
  });
});

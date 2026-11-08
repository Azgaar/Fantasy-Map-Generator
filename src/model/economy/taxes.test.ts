import { beforeEach, describe, expect, it } from "vitest";
import { Markets } from "@/model/economy/markets-generator";
import { Routes } from "@/model/economy/routes-generator";
import { noFinance, States } from "@/model/political/states-generator";
import { Names } from "@/model/society/names-generator";
import { DEAL_KINDS } from "./deals";
import { Taxes } from "./taxes";

describe("Taxes.collect", () => {
  let StatesModule: any;

  beforeEach(async () => {
    globalThis.window = globalThis.window || ({} as any);
    globalThis.pack = {
      states: [],
      burgs: [],
      cells: { market: [0, 1, 2, 3] }, // cell k lies in market k
      markets: [],
      deals: [],
      biomes: []
    } as any;
    // Stub Names/COA data not needed for this test
    Object.assign(Names, { getCultureShort: () => "X", getState: () => "X" });
    Object.assign(Routes, { areConnected: () => false });
    Object.assign(Markets, {
      get: (marketId: number | undefined) =>
        marketId ? globalThis.pack.markets?.find((m: any) => m?.i === marketId) : undefined
    });
    globalThis.options = {} as any;

    // Reload module fresh
    await import("@/model/political/states-generator");
    StatesModule = States;
  });

  it("credits sales-tax deal.tax to the seller's state and adds poll tax", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } },
      {
        i: 1,
        name: "A",
        economy: { ...noFinance(), salesTax: 0.2, pollTax: 0.5, treasury: 0 },
        rural: 100,
        urban: 50
      },
      {
        i: 2,
        name: "B",
        economy: { ...noFinance(), salesTax: 0.1, pollTax: 0.1, treasury: 0 },
        rural: 200,
        urban: 100
      }
    ] as any;

    globalThis.pack.burgs = [
      { i: 0 },
      { i: 1, state: 1, cell: 1, pollTaxPaid: 75 },
      { i: 2, state: 2, cell: 2, pollTaxPaid: 30 }
    ] as any;

    globalThis.pack.markets = [
      { i: 1, centerBurgId: 1, color: "", goods: {} },
      { i: 2, centerBurgId: 2, color: "", goods: {} }
    ] as any;

    globalThis.pack.deals = [
      [1, 1, 0, DEAL_KINDS.sale, 10, 5, 10, 0, 0], // 10 = 0.2 * 10 * 5
      [2, 1, 0, DEAL_KINDS.input, 4, 3, 2, 0, 0], // an import: exporter market 1 -> state 1
      [2, 2, 1, DEAL_KINDS.sale, 2, 6, 1.2, 0, 0],
      [1, 2, 1, DEAL_KINDS.demand, 1, 8, 0, 0, 0] // no tax: an import from an untaxed exporter
    ];

    Taxes.collect();

    // State 1: sales tax 10 + 2 = 12; poll tax 75; treasury = 87
    expect(globalThis.pack.states[1].economy.treasury).toBeCloseTo(87, 2);
    // State 2: sales tax 1.2; poll tax 30; treasury = 31.2
    expect(globalThis.pack.states[2].economy.treasury).toBeCloseTo(31.2, 2);
    // Neutrals always 0
    expect(globalThis.pack.states[0].economy.treasury).toBe(0);
  });

  it("credits the poll tax burgs and rural people paid, not rate × people", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } },
      { i: 1, name: "A", economy: { ...noFinance(), salesTax: 0, pollTax: 0.5, treasury: 0 }, rural: 100, urban: 50 },
      { i: 2, name: "B", economy: { ...noFinance(), salesTax: 0, pollTax: 0.1, treasury: 0 }, rural: 200, urban: 100 }
    ] as any;
    globalThis.pack.burgs = [{ i: 0 }, { i: 1, state: 1, pollTaxPaid: 25 }, { i: 2, state: 2, pollTaxPaid: 0 }] as any;
    // the market's rural people paid part of what they owed, split between the states of their cells
    globalThis.pack.markets = [
      {
        i: 1,
        centerBurgId: 1,
        color: "",
        goods: {},
        rural: {
          earned: 0,
          spent: 0,
          bought: [],
          pollTax: [
            [1, 40, 30],
            [2, 6, 4]
          ]
        }
      }
    ] as any;
    globalThis.pack.deals = [];

    Taxes.collect();

    expect(globalThis.pack.states[1].economy.treasury).toBeCloseTo(55, 2);
    expect(globalThis.pack.states[2].economy.treasury).toBeCloseTo(4, 2);
    expect(Taxes.getPollTax().owed.slice(1)).toEqual([65, 6]);
  });

  it("credits the market fees market centers paid to their state, and sets the fee by form and sales tax", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } },
      {
        i: 1,
        name: "A",
        form: "Monarchy",
        economy: { ...noFinance(), salesTax: 0.2, pollTax: 0, marketFee: 30, treasury: 0 }
      },
      { i: 2, name: "B", form: "Republic", economy: { ...noFinance(), salesTax: 0.005, pollTax: 0, treasury: 0 } },
      { i: 3, name: "C", form: "Anarchy", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } }
    ] as any;
    globalThis.pack.burgs = [{ i: 0 }, { i: 1, state: 1 }, { i: 2, state: 1 }, { i: 3, state: 0 }] as any;
    globalThis.pack.markets = [
      { i: 1, centerBurgId: 1, color: "", goods: {}, feePaid: 30 },
      { i: 2, centerBurgId: 2, color: "", goods: {}, feePaid: 30 },
      { i: 3, centerBurgId: 3, color: "", goods: {}, feePaid: 0 }
    ] as any;
    globalThis.pack.deals = [];

    Taxes.collect();

    expect(globalThis.pack.states[1].economy.treasury).toBe(60);
    expect(Markets.getFee(1)).toBe(30);
    expect(Markets.getFee(0)).toBe(0);
    // twice the Monarchy's base sales tax: its base fee × 1.5 at most; a tenth of the Republic's: a quarter at least
    expect(StatesModule.defineMarketFee(globalThis.pack.states[1])).toBe(45);
    expect(StatesModule.defineMarketFee(globalThis.pack.states[2])).toBe(4);
    expect(StatesModule.defineMarketFee(globalThis.pack.states[3])).toBe(0);
  });

  it("lets officials pocket their share of each expense", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: { ...noFinance() } },
      { i: 1, name: "A", economy: { ...noFinance(), budget: { ...noFinance().budget, court: 40, corruption: 25 } } }
    ] as any;
    globalThis.pack.burgs = [{ i: 0 }, { i: 1, state: 1 }] as any;
    globalThis.pack.markets = [{ i: 1, centerBurgId: 1, color: "", goods: {}, feePaid: 40 }] as any;
    globalThis.pack.deals = [];

    Taxes.collect();

    // the court's 40% of 40 is 16, a quarter of it pocketed; nothing bought, so the rest stays
    expect(globalThis.pack.states[1].economy.pocketed).toBe(4);
    expect(globalThis.pack.states[1].economy.treasury).toBe(36);
  });

  it("keeps what the expenses did not spend", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: noFinance() },
      {
        i: 1,
        name: "A",
        economy: { ...noFinance(), spent: { court: 10, administration: 5, infrastructure: 0, military: 15 } }
      }
    ] as any;
    globalThis.pack.burgs = [{ i: 0 }, { i: 1, state: 1 }] as any;
    globalThis.pack.markets = [{ i: 1, centerBurgId: 1, color: "", goods: {}, feePaid: 40 }] as any;
    globalThis.pack.deals = [];

    Taxes.collect();

    expect(globalThis.pack.states[1].economy.collected).toBe(40);
    expect(globalThis.pack.states[1].economy.treasury).toBe(10);
  });

  it("sets expenses that may pass 100 together, and corruption apart from them", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: noFinance() },
      { i: 1, name: "A", economy: noFinance() }
    ] as any;
    StatesModule.setBudget(1, { court: 60, military: 70 });
    StatesModule.setCorruption(1, 20);

    expect(globalThis.pack.states[1].economy.budget).toEqual({
      court: 60,
      administration: 0,
      infrastructure: 0,
      military: 70,
      corruption: 20
    });
    expect(() => StatesModule.setBudget(1, { administration: 101 })).toThrow("from 0 to 100");
  });

  it("defines a budget from the form, the state and its war alert", () => {
    globalThis.pack.burgs = [{ i: 0 }, { i: 1, population: 10 }] as any;
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: noFinance() },
      { i: 1, form: "Monarchy", capital: 1, burgs: 4, urban: 20, rural: 80, alert: 0.25, economy: noFinance() },
      { i: 2, form: "Monarchy", capital: 1, burgs: 4, urban: 20, rural: 80, alert: 100, economy: noFinance() }
    ] as any;

    // court 20 × (0.5 + half the townspeople in the capital), administration 10 + 15, infrastructure 8 + 20 × 0.2, military 25 + 20 × 0.5
    expect(StatesModule.defineBudget(globalThis.pack.states[1], 10)).toEqual({
      court: 20,
      administration: 25,
      infrastructure: 12,
      military: 35,
      corruption: 10
    });
    // at war alert 100 the military takes all the taxes, and the state runs into debt
    expect(StatesModule.defineBudget(globalThis.pack.states[2], 0).military).toBe(100);
  });

  it("leaves neutrals at zero even with deals from neutral burgs", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } },
      { i: 1, name: "A", economy: { ...noFinance(), salesTax: 0.1, pollTax: 0, treasury: 0 }, rural: 10, urban: 0 }
    ] as any;
    globalThis.pack.burgs = [
      { i: 0 },
      { i: 1, state: 0, cell: 0 } // neutral burg
    ] as any;
    globalThis.pack.markets = [];
    globalThis.pack.deals = [[1, 1, 0, DEAL_KINDS.sale, 5, 5, 2.5, 0, 0]];

    Taxes.collect();

    expect(globalThis.pack.states[0].economy.treasury).toBe(0);
    // State 1 has no deal credit and only poll tax (0 here), so treasury stays 0
    expect(globalThis.pack.states[1].economy.treasury).toBe(0);
  });

  it("credits deal.tariff to the buyer market's state treasury", () => {
    globalThis.pack.states = [
      { i: 0, name: "Neutrals", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } },
      { i: 1, name: "A", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } },
      { i: 2, name: "B", economy: { ...noFinance(), salesTax: 0, pollTax: 0, treasury: 0 } }
    ] as any;

    globalThis.pack.burgs = [{ i: 0 }, { i: 1, state: 1, cell: 1 }, { i: 2, state: 2, cell: 2 }] as any;

    globalThis.pack.markets = [
      { i: 1, centerBurgId: 1, color: "", goods: {} },
      { i: 2, centerBurgId: 2, color: "", goods: {} }
    ] as any;

    globalThis.pack.deals = [[2, 1, 0, DEAL_KINDS.input, 10, 5, 0, 4.5, 0]]; // burg 2 of market 2 imports from market 1

    Taxes.collect();

    // Exporter state 1 gets tax (0)
    expect(globalThis.pack.states[1].economy.treasury).toBe(0);
    // Importer state 2 gets tariff (4.5)
    expect(globalThis.pack.states[2].economy.treasury).toBe(4.5);
  });
});

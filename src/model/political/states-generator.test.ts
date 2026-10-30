import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Markets } from "@/model/economy/markets-generator";
import { Routes } from "@/model/economy/routes-generator";
import { DEAL_KINDS } from "@/model/economy/trade";
import { Names } from "@/model/society/names-generator";
import { noFinance, States } from "./states-generator";

/** States as the model keeps them: each with its finances, zero but for the given ones */
const withFinance = (states: any[]) =>
  states.map(state => ({ ...state, economy: { ...noFinance(), ...state.economy } }));

describe("StatesModule.collectTaxes", () => {
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
    await import("./states-generator");
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

    StatesModule.collectTaxes();

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

    StatesModule.collectTaxes();

    expect(globalThis.pack.states[1].economy.treasury).toBeCloseTo(55, 2);
    expect(globalThis.pack.states[2].economy.treasury).toBeCloseTo(4, 2);
    expect(StatesModule.getPollTax().owed.slice(1)).toEqual([65, 6]);
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

    StatesModule.collectTaxes();

    expect(globalThis.pack.states[1].economy.treasury).toBe(60);
    expect(StatesModule.getMarketFee(1)).toBe(30);
    expect(StatesModule.getMarketFee(0)).toBe(0);
    // twice the Monarchy's base sales tax: twice its base fee; a tenth of the Republic's: a quarter at least
    expect(StatesModule.defineMarketFee(globalThis.pack.states[1])).toBe(100);
    expect(StatesModule.defineMarketFee(globalThis.pack.states[2])).toBe(5);
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

    StatesModule.collectTaxes();

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

    StatesModule.collectTaxes();

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

    StatesModule.collectTaxes();

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

    StatesModule.collectTaxes();

    // Exporter state 1 gets tax (0)
    expect(globalThis.pack.states[1].economy.treasury).toBe(0);
    // Importer state 2 gets tariff (4.5)
    expect(globalThis.pack.states[2].economy.treasury).toBe(4.5);
  });
});

describe("StatesModule.generateDiplomacy", () => {
  let StatesModule: any;

  beforeEach(async () => {
    globalThis.options = { year: 100 } as any;
    // 0.5 makes P(0.8) true and rw() pick no Rival, so the vassal branch runs and no war is declared
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    await import("./states-generator");
    StatesModule = States;
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
      states: withFinance([
        { i: 0, name: "Neutrals" },
        { i: 1, removed: true },
        { i: 2, name: "A", neighbors: [3], center: 0, expansionism: 1, campaigns: [] },
        { i: 3, name: "B", neighbors: [2], center: 10, expansionism: 1, campaigns: [] },
        { i: 4, name: "C", neighbors: [], center: 11, expansionism: 1, campaigns: [] }
      ])
    } as any;

    expect(() => StatesModule.generateDiplomacy()).not.toThrow();

    const { states } = globalThis.pack;
    expect(states[1].diplomacy).toBeUndefined();
    expect(states[2].diplomacy).toEqual(["x", "x", "x", "Suzerain", "Neutral"]);
    expect(states[3].diplomacy).toEqual(["x", "x", "Vassal", "x", "Neutral"]);
    expect(states[4].diplomacy).toEqual(["x", "x", "Neutral", "Neutral", "x"]);
  });
});

describe("StatesModule.rename", () => {
  const state = (fields: object) => ({ i: 1, name: "Old", formName: "Empire", ...fields });

  beforeEach(async () => {
    await import("./states-generator");
  });

  it("keeps a custom full name and label containing the whole old name", () => {
    globalThis.pack = {
      states: [{ i: 0 }, state({ fullName: "United Realms of Old", label: { text: "Old|Realms" } })]
    } as any;
    States.rename(1, "New");
    expect(pack.states[1]).toMatchObject({
      name: "New",
      fullName: "United Realms of New",
      label: { text: "New|Realms" }
    });
  });

  it("rebuilds a generated full name that holds the old name only inside another word", () => {
    globalThis.pack = { states: [{ i: 0 }, state({ fullName: "Oldish Empire" })] } as any;
    States.rename(1, "Nova");
    expect(pack.states[1].fullName).toBe(States.getFullName(pack.states[1]));
    expect(pack.states[1].fullName).not.toContain("Oldish");
  });

  it("rejects removed states", () => {
    globalThis.pack = { states: [{ i: 0 }, state({ removed: true })] } as any;
    expect(() => States.rename(1, "New")).toThrow("State 1 does not exist");
  });
});

describe("StatesModule.setCells", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await import("./states-generator");
  });

  afterEach(() => vi.restoreAllMocks());

  it("drops a split province from its owner's list when its center becomes neutral", () => {
    globalThis.pack = {
      cells: {
        i: [0, 1, 2],
        h: [30, 30, 30],
        state: Uint16Array.from([1, 1, 1]),
        province: Uint16Array.from([1, 1, 2]),
        c: [[1], [0, 2], [1]],
        burg: [0, 0, 0]
      },
      provinces: [0, { i: 1, state: 1, center: 0 }, { i: 2, state: 1, center: 2 }],
      states: [{ i: 0 }, { i: 1, center: 2, provinces: [1, 2] }],
      burgs: []
    } as unknown as typeof pack;
    vi.spyOn(States, "getPoles").mockImplementation(() => {});
    vi.spyOn(States, "findNeighbors").mockImplementation(() => {});
    vi.spyOn(States, "collectStatistics").mockImplementation(() => {});

    States.setCells(0, [0]);

    expect(pack.provinces[1].removed).toBe(true);
    expect(pack.states[1].provinces).toEqual([2]);
    expect([...pack.cells.province]).toEqual([0, 2, 2]);
  });

  it.each([0, 1])("joins an annexed fragment at cell %s to a province of its new state", cell => {
    const center = cell === 0 ? 1 : 0;
    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3],
        h: [30, 30, 30, 30],
        state: Uint16Array.from([1, 1, 3, 2]),
        province: Uint16Array.from([1, 1, 2, 3]),
        c: cell === 0 ? [[2, 3], [], [0], [0]] : [[], [2, 3], [1], [1]],
        burg: [0, 0, 0, 0]
      },
      provinces: [
        { i: 0, state: 0 },
        { i: 1, state: 1, center },
        { i: 2, state: 3, center: 2 },
        { i: 3, state: 2, center: 3 }
      ],
      states: [
        { i: 0 },
        { i: 1, center, provinces: [1] },
        { i: 2, center: 3, provinces: [3] },
        { i: 3, center: 2, provinces: [2] }
      ],
      burgs: []
    } as unknown as typeof pack;
    vi.spyOn(States, "getPoles").mockImplementation(() => {});
    vi.spyOn(States, "findNeighbors").mockImplementation(() => {});
    vi.spyOn(States, "collectStatistics").mockImplementation(() => {});

    States.setCells(2, [cell]);

    expect(pack.cells.province[cell]).toBe(3);
    expect(pack.provinces[pack.cells.province[cell]].state).toBe(pack.cells.state[cell]);
    expect(pack.states[2].provinces).toEqual([3]);
  });

  it("refreshes the statistics of both states", () => {
    globalThis.pack = {
      cells: {
        i: [0, 1, 2],
        h: [30, 30, 30],
        area: [10, 20, 40],
        pop: [1, 2, 4],
        burg: [0, 1, 0],
        state: Uint16Array.from([1, 1, 2]),
        province: Uint16Array.from([0, 0, 0])
      },
      states: [{ i: 0 }, { i: 1, center: 0 }, { i: 2, center: 2 }],
      burgs: [0, { i: 1, state: 1, population: 5 }]
    } as any;
    const states = States as any;
    vi.spyOn(states, "getPoles").mockImplementation(() => {});
    vi.spyOn(states, "findNeighbors").mockImplementation(() => {});
    vi.spyOn(states, "adjustProvinces").mockImplementation(() => {});
    States.setCells(2, [1]);
    expect(pack.states[1]).toMatchObject({ cells: 1, area: 10, rural: 1, urban: 0, burgs: 0 });
    expect(pack.states[2]).toMatchObject({ cells: 2, area: 60, rural: 6, urban: 5, burgs: 1 });
  });
});

describe("StatesModule.tariffs", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await import("./states-generator");
  });

  afterEach(() => vi.restoreAllMocks());

  it("defineTariffs() seeds the 5% baseline and relation-based overrides", () => {
    globalThis.pack = {
      states: [
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "A",
          diplomacy: ["x", "x", "Ally", "Friendly", "Suspicion", "Rival", "Enemy", "Neutral", "Unknown"]
        },
        { i: 2, name: "AllyState" },
        { i: 3, name: "FriendlyState" },
        { i: 4, name: "SuspicionState" },
        { i: 5, name: "RivalState" },
        { i: 6, name: "EnemyState" },
        { i: 7, name: "NeutralState" },
        { i: 8, name: "UnknownState" }
      ]
    } as any;

    const rules = States.defineTariffs(pack.states[1]);
    expect(rules).toEqual([
      { states: "all", goods: "all", rate: 0.05 },
      { states: [2, 3], goods: "all", rate: 0 },
      { states: [4], goods: "all", rate: 0.2 },
      { states: [5], goods: "all", rate: 0.3 },
      { states: [6], goods: "all", rate: "embargo" }
    ]);
  });

  it("defineTariffs() returns empty array for neutral state", () => {
    globalThis.pack = { states: [{ i: 0, name: "Neutrals" }] } as any;
    expect(States.defineTariffs(pack.states[0])).toEqual([]);
  });

  it("defineTariffs() returns empty array for an anarchy, whatever its relations", () => {
    globalThis.pack = {
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "A", form: "Anarchy", diplomacy: ["x", "x", "Enemy"] },
        { i: 2, name: "B" }
      ]
    } as any;
    expect(States.defineTariffs(pack.states[1])).toEqual([]);
  });

  it("setTariffs() validates and normalizes rules", () => {
    globalThis.pack = {
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "A", economy: { ...noFinance(), tariffs: [] } },
        { i: 2, name: "B" },
        { i: 3, name: "C", removed: true }
      ],
      goods: [
        { i: 0, name: "Wheat" },
        { i: 1, name: "Iron" }
      ]
    } as any;

    States.setTariffs(1, [
      { states: "all", goods: "all", rate: 0.15 },
      { states: [2, 3], goods: [0, 99], rate: "embargo" },
      { states: [3], goods: "all", rate: 0.2 } // state 3 is removed -> rule dropped
    ]);

    expect(pack.states[1].economy.tariffs).toEqual([
      { states: "all", goods: "all", rate: 0.15 },
      { states: [2], goods: [0], rate: "embargo" }
    ]);
  });

  it("remove() prunes state ID from all other states' tariffs", () => {
    globalThis.pack = {
      cells: { state: new Uint16Array(10), province: new Uint16Array(10) },
      burgs: [],
      provinces: [],
      states: withFinance([
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "A",
          economy: {
            tariffs: [
              { states: "all", goods: "all", rate: 0.1 },
              { states: [2, 3], goods: "all", rate: 0 },
              { states: [2], goods: "all", rate: "embargo" }
            ]
          }
        },
        { i: 2, name: "B" },
        { i: 3, name: "C" }
      ])
    } as any;
    vi.spyOn(States, "collectStatistics").mockImplementation(() => {});

    States.remove(2);

    expect(pack.states[1].economy.tariffs).toEqual([
      { states: "all", goods: "all", rate: 0.1 },
      { states: [3], goods: "all", rate: 0 }
      // Rule with [2] alone dropped because states becomes empty
    ]);
  });

  it("merge() prunes merged state IDs from all living states' tariffs", () => {
    globalThis.pack = {
      cells: { state: new Uint16Array(10), province: new Uint16Array(10) },
      burgs: [],
      provinces: [],
      states: withFinance([
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "A",
          economy: {
            tariffs: [
              { states: "all", goods: "all", rate: 0.1 },
              { states: [2, 3], goods: "all", rate: 0.2 }
            ]
          }
        },
        { i: 2, name: "B" },
        { i: 3, name: "C" }
      ])
    } as any;
    vi.spyOn(States, "collectStatistics").mockImplementation(() => {});
    vi.spyOn(States, "findNeighbors").mockImplementation(() => {});
    vi.spyOn(States, "getPoles").mockImplementation(() => {});

    States.merge(1, [2, 3]);

    expect(pack.states[1].economy.tariffs).toEqual([{ states: "all", goods: "all", rate: 0.1 }]);
  });

  it("setTags() sets normalized tags on a state", () => {
    globalThis.pack = {
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, name: "A", tags: [] }
      ]
    } as any;

    States.setTags(1, "Coastal, TRADE, coastal, naval");
    expect(pack.states[1].tags).toEqual(["coastal", "trade", "naval"]);

    States.setTags(1, ["EMPIRE", "trade"]);
    expect(pack.states[1].tags).toEqual(["empire", "trade"]);
  });

  it("merge() merges tags of merged states into ruling state", () => {
    globalThis.pack = {
      cells: { state: new Uint16Array(10), province: new Uint16Array(10) },
      burgs: [],
      provinces: [],
      states: withFinance([
        { i: 0, name: "Neutrals" },
        { i: 1, name: "A", tags: ["coastal"] },
        { i: 2, name: "B", tags: ["trade", "coastal"] },
        { i: 3, name: "C", tags: ["empire"] }
      ])
    } as any;
    vi.spyOn(States, "collectStatistics").mockImplementation(() => {});
    vi.spyOn(States, "findNeighbors").mockImplementation(() => {});
    vi.spyOn(States, "getPoles").mockImplementation(() => {});

    States.merge(1, [2, 3]);

    expect(pack.states[1].tags).toEqual(["coastal", "trade", "empire"]);
  });
});

describe("StatesModule.getCorruption", () => {
  const state = (administration: number) =>
    ({
      i: 1,
      rural: 100, // administration needs 10 a day
      urban: 0,
      economy: { ...noFinance(), budget: { ...noFinance().budget, administration, corruption: 40 } }
    }) as any;

  it("is the state's corruption when administration gets nothing", () => {
    expect(States.getCorruption(state(0), 100)).toBe(40);
    expect(States.getCorruption(state(20), 0)).toBe(40);
  });

  it("is halved once administration is paid what the people need", () => {
    // 20 allotted, 16 paid at the curbed 20%: more than the 10 needed
    expect(States.getCorruption(state(20), 100)).toBe(20);
  });

  it("is curbed in proportion to what administration is paid of the need, the pay net of that corruption", () => {
    const corruption = States.getCorruption(state(20), 30);
    const pay = 6 * (1 - corruption / 100);
    expect(corruption).toBeCloseTo(40 * (1 - (0.5 * pay) / 10), 6);
    expect(corruption).toBeCloseTo(31.82, 2);
  });
});

describe("StatesModule.getProvision", () => {
  it("is the spending against the people's need, up to 1", () => {
    const state = (infrastructure: number) =>
      ({
        i: 1,
        rural: 80,
        urban: 20,
        economy: { ...noFinance(), spent: { ...noFinance().spent, infrastructure } }
      }) as any;
    expect(States.getProvision(state(2.5), "infrastructure")).toBe(0.5);
    expect(States.getProvision(state(50), "infrastructure")).toBe(1);
    expect(States.getProvision(undefined, "court")).toBe(0);
  });
});

describe("StatesModule.defineCorruption", () => {
  it("adds size and diversity to the form's share, doubled for despots", () => {
    globalThis.pack = {
      states: [
        { i: 0, name: "Neutrals" },
        { i: 1, form: "Monarchy", formName: "Despotate", cells: 100, burgs: 5, culture: 1, capital: 1 },
        { i: 2, form: "Republic", formName: "City-state", cells: 25, burgs: 1, culture: 1, capital: 2 },
        { i: 3, form: "Anarchy", formName: "Commune", cells: 25, burgs: 3, culture: 1, capital: 2 },
        { i: 4, form: "Union", formName: "League", cells: 25, burgs: 3, culture: 1, capital: 2 }
      ],
      burgs: [{ i: 0 }, { i: 1, cell: 0, population: 10 }, { i: 2, cell: 4, population: 1 }],
      // the despotate's people: 20 at its capital, 10 of its culture and faith, 10 of another culture, 10 of both others
      cells: {
        i: [0, 1, 2, 3, 4],
        state: [1, 1, 1, 1, 0],
        culture: [1, 1, 2, 2, 1],
        religion: [1, 1, 1, 2, 1],
        pop: [10, 10, 10, 10, 0],
        burg: [1, 0, 0, 0, 2]
      }
    } as any;

    // 30 for a despotic monarchy, 15 as the largest state, 10 × 15 strangers of 50 people
    expect(States.defineCorruption(pack.states[1])).toBe(48);
    expect(States.defineCorruption(pack.states[2])).toBe(8); // a city-state: its form's share only
    expect(States.defineCorruption(pack.states[3])).toBe(0); // anarchies collect nothing to steal
    expect(States.defineCorruption(pack.states[4])).toBe(12); // 4 + 15 × √(25 ÷ 100)
    expect(States.defineCorruption(pack.states[0])).toBe(0);
  });
});

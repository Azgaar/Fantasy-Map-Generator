import FlatQueue from "flatqueue";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Fork tests: sky state seeding and expansion
// ---------------------------------------------------------------------------

let States: any;

beforeAll(async () => {
  const g = globalThis as any;
  g.window = g.window ?? {};
  g.document = g.document ?? {
    readyState: "complete",
    getElementById: () => null,
    addEventListener: () => {},
    querySelector: () => null
  };
  g.FlatQueue = FlatQueue;
  g.TIME = false;
  g.WARN = false;
  g.ERROR = false;
  g.pack = g.pack ?? {};
  await import("./states-generator");
  States = (g.window as any).States;
});

// 5x5 all-land grid. State 1 (ground) capital at cell 0; state 2 (sky) capital
// burg flies over cell 12. document.getElementById -> null keeps growthRate
// tiny ((25/2)*1*1 = 12.5), so expansion stays near the seeds — the test only
// cares about seeding and burg assignment, not spread.
const N = 5;

function buildPack() {
  const n = N * N;
  const c: number[][] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const id = y * N + x;
      const neibs: number[] = [];
      if (x > 0) neibs.push(id - 1);
      if (x < N - 1) neibs.push(id + 1);
      if (y > 0) neibs.push(id - N);
      if (y < N - 1) neibs.push(id + N);
      c.push(neibs);
    }
  }
  const cells = {
    i: Uint32Array.from({ length: n }, (_, k) => k),
    c,
    h: new Uint8Array(n).fill(30),
    s: new Int16Array(n).fill(10),
    r: new Uint16Array(n),
    t: new Int8Array(n).fill(2),
    f: new Uint16Array(n).fill(1),
    biome: new Uint8Array(n).fill(5),
    culture: new Uint16Array(n).fill(1),
    fl: new Uint16Array(n),
    state: new Uint16Array(n)
  };
  const burgs: any[] = [
    0,
    { i: 1, capital: 1, cell: 0, x: 0, y: 0, culture: 1 }, // ground capital
    { i: 2, capital: 1, flying: 1, cell: 12, x: 50, y: 50, culture: 1 }, // sky capital
    { i: 3, flying: 1, cell: 7, x: 40, y: 20, culture: 1 }, // ordinary skyburg
    { i: 4, cell: 24, x: 90, y: 90, culture: 1 } // far ground burg (stays neutral)
  ];
  const states: any[] = [
    { i: 0, name: "Neutrals" },
    { i: 1, name: "Ground", capital: 1, center: 0, culture: 1, type: "Generic", expansionism: 1 },
    { i: 2, name: "Sky", capital: 2, center: 12, culture: 1, type: "Generic", expansionism: 1 }
  ];
  const cultures = [{ center: 0 }, { center: 0 }];
  // Upstream v1.139.7 moved biome cost from the biomesData global into pack.biomes[].cost
  const biomes = Array.from({ length: 13 }, () => ({ cost: 10 }));
  (globalThis as any).pack = { cells, burgs, states, cultures, biomes, features: [0, { type: "island" }] };
}

describe("createStates", () => {
  it("keeps state.i equal to the array index when a capital burg has a high id (sky capital)", () => {
    const g = globalThis as any;
    g.Names = { getCultureShort: () => "Test", getState: () => "Testland" };
    g.COA = { generate: () => ({}), getShield: () => "heater" };
    const prevGetEl = g.document.getElementById;
    // createStates reads ensureEl("sizeVariety").valueAsNumber
    g.document.getElementById = () => ({ valueAsNumber: 1, value: "1" });
    try {
      g.pack = {
        cultures: [{ type: "Generic" }, { type: "Generic" }],
        burgs: [
          0,
          { i: 1, capital: 1, cell: 0, culture: 1, name: "Alpha" }, // ground capital
          { i: 2, cell: 1, culture: 1, name: "Beta" }, // ordinary burg
          { i: 9, capital: 1, flying: 1, cell: 2, culture: 1, name: "Sky" } // sky capital, non-contiguous id
        ]
      };
      const states = (States as any).createStates();
      expect(states).toHaveLength(3); // neutrals + ground + sky
      for (let index = 0; index < states.length; index++) {
        expect(states[index].i).toBe(index); // pack.states is indexed by id
      }
      expect(states[2].capital).toBe(9); // capital field keeps the burg reference
    } finally {
      g.document.getElementById = prevGetEl;
    }
  });
});

describe("expandStates with a sky state", () => {
  it("never seeds or claims territory for the flying-capital state", () => {
    buildPack();
    States.expandStates();
    const pack = (globalThis as any).pack;
    expect(pack.cells.state[12]).not.toBe(2); // sky capital cell unclaimed
    expect(Array.from(pack.cells.state)).not.toContain(2); // no cell anywhere
    expect(pack.cells.state[0]).toBe(1); // ground capital seeded normally
  });

  it("assigns flying burgs to the sky state and ground burgs by territory", () => {
    buildPack();
    States.expandStates();
    const { burgs } = (globalThis as any).pack;
    expect(burgs[2].state).toBe(2); // sky capital
    expect(burgs[3].state).toBe(2); // ordinary skyburg, regardless of ground below
    expect(burgs[1].state).toBe(1); // ground capital on its seed cell
    expect(burgs[4].state).toBe(0); // out of expansion range -> neutral
  });

  it("falls back to ground assignment for flying burgs when no sky state exists", () => {
    buildPack();
    const pack = (globalThis as any).pack;
    pack.states.pop(); // remove the sky state
    pack.burgs[2].capital = 0;
    States.expandStates();
    expect(pack.burgs[2].state).toBe(0); // neutral, not some ground state
    expect(pack.burgs[3].state).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Upstream tests: StatesModule.collectTaxes
// ---------------------------------------------------------------------------

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

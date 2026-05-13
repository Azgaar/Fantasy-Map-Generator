/**
 * Benchmark harness for Production.produce()
 *
 * Measures total time and per-phase breakdown so we can assess
 * whether WASM / Web Worker would actually help.
 *
 * Run:  npx vitest bench src/modules/production-generator.bench.ts
 */
import { bench, describe, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks — must appear before any import that triggers the chain.
// They break the dependency on utils/index.ts (which uses browser DOM APIs).
// ---------------------------------------------------------------------------
vi.mock("./cultures-generator", () => ({
  DEFAULT_CULTURE_TYPE: "Generic"
}));

vi.mock("./goods-generator", () => ({
  DEMAND_PRIORITY: ["food", "utilities", "construction", "military", "luxury"],
  DEMAND_TARGET_FACTORS: {
    food: 0.2,
    utilities: 0.15,
    construction: 0.1,
    military: 0.08,
    luxury: 0.07
  }
}));

vi.mock("./trade-generator", () => ({
  BONUS_RESOURCE_PRODUCTION: 5,
  MARKET_MARGIN: 0.1,
  MARKET_PRESSURE_FACTOR: 0.01,
  PRICE_FLOOR_FACTOR: 0.25,
  PRICE_CEILING_FACTOR: 3.0
}));

// ---------------------------------------------------------------------------
// 1. Synthetic goods: 20 raw + 20 depth-1 manufactured + 10 depth-2
// ---------------------------------------------------------------------------
type Good = {
  i: number;
  name: string;
  value: number;
  chance: number;
  culture: Record<string, number>;
  demandCoverage: Record<string, number>;
  bonus: Record<string, number>;
  unit: string;
  icon: string;
  color: string;
  tags: string[];
  biome?: Record<number, number>;
  recipes?: Record<number, number>[];
};

function buildGoods(): Good[] {
  const goods: Good[] = [];

  // Raw goods (no recipes)
  for (let i = 1; i <= 20; i++) {
    goods.push({
      i,
      name: `Raw${i}`,
      value: 1 + (i % 4),
      chance: 1,
      culture: {},
      demandCoverage: {
        food: i <= 5 ? 0.5 : 0,
        utilities: i > 5 && i <= 10 ? 0.3 : 0,
        construction: i > 10 && i <= 15 ? 0.4 : 0
      },
      bonus: {},
      unit: "unit",
      icon: "good-wood",
      color: "#999",
      tags: [],
      biome: { 5: 0.1, 6: 0.1, 7: 0.05 }
    });
  }

  // Depth-1 manufactured goods (1 ingredient)
  for (let i = 21; i <= 40; i++) {
    const rawId = ((i - 21) % 20) + 1; // cycles through raw goods
    goods.push({
      i,
      name: `Mfg1_${i}`,
      value: 4 + (i % 5),
      chance: 1,
      culture: {},
      demandCoverage: {
        utilities: 0.4,
        military: i % 3 === 0 ? 0.3 : 0
      },
      bonus: {},
      unit: "unit",
      icon: "good-wood",
      color: "#666",
      tags: [],
      recipes: [{ [rawId]: 2 }]
    });
  }

  // Depth-2 manufactured goods (2 ingredients: 1 d1 + 1 raw)
  for (let i = 41; i <= 50; i++) {
    const d1Id = ((i - 41) % 20) + 21;
    const rawId = ((i - 41) % 20) + 1;
    goods.push({
      i,
      name: `Mfg2_${i}`,
      value: 10 + (i % 6),
      chance: 1,
      culture: {},
      demandCoverage: {
        military: 0.5,
        luxury: i % 2 === 0 ? 0.4 : 0
      },
      bonus: {},
      unit: "unit",
      icon: "good-wood",
      color: "#444",
      tags: [],
      recipes: [{ [d1Id]: 1, [rawId]: 1 }]
    });
  }

  return goods;
}

// ---------------------------------------------------------------------------
// 2. Mock Trade module — same interface as real Trade, minimal logic
// ---------------------------------------------------------------------------
let dealCounter = 0;
function buildTradeMock(markets: Map<number, Record<number, { stock: number; price: number }>>) {
  return {
    getMarketForBurg: (burg: { i?: number }) => {
      const g = markets.get(burg.i ?? 0);
      if (!g) return null;
      return { goods: g };
    },
    buyFromMarket: (p: { burg: { i?: number }; good: Good; units: number; marketPrice: number }) => {
      const market = markets.get(p.burg.i ?? 0);
      if (!market) return { units: 0, totalCost: 0, dealId: null };
      const slot = market[p.good.i];
      if (!slot || slot.stock <= 0 || p.units <= 0) return { units: 0, totalCost: 0, dealId: null };
      const bought = Math.min(p.units, slot.stock);
      slot.stock -= bought;
      return { units: bought, totalCost: bought * p.marketPrice, dealId: dealCounter++ };
    },
    sellToMarket: (p: { burg: { i?: number }; good: Good; units: number; marketPrice: number }) => {
      const market = markets.get(p.burg.i ?? 0);
      if (!market) return { revenue: 0, dealId: null };
      // biome-ignore lint/suspicious/noAssignInExpressions: test harness convenience
      const slot = (market[p.good.i] ??= { stock: 0, price: p.good.value });
      slot.stock += p.units;
      return { revenue: p.units * p.marketPrice, dealId: dealCounter++ };
    },
    applyMarketPressure: (_value: number, price: number, _units: number) => price,
    redistributeAcrossMarkets: () => {},
    updateMarketDemand: () => {}
  };
}

// ---------------------------------------------------------------------------
// 3. Build pack with N burgs and realistic market seeding
// ---------------------------------------------------------------------------
function buildPack(goods: Good[], numBurgs: number) {
  const markets = new Map<number, Record<number, { stock: number; price: number }>>();

  const burgs = [
    // slot 0 is always empty in the real game
    { i: 0, removed: true, cell: 0, type: "Generic", population: 0, treasury: 0, inventory: {} }
  ];

  for (let b = 1; b <= numBurgs; b++) {
    const population = 1 + (b % 30); // 1..30
    burgs.push({
      i: b,
      removed: false,
      cell: b,
      type: "Generic",
      population,
      treasury: population * 50,
      inventory: {}
    });

    // Seed market: raw goods only (manufactured must be crafted)
    const marketGoods: Record<number, { stock: number; price: number }> = {};
    for (const g of goods) {
      if (!g.recipes) {
        marketGoods[g.i] = { stock: population * 3, price: g.value };
      } else {
        marketGoods[g.i] = { stock: 0, price: g.value };
      }
    }
    markets.set(b, marketGoods);
  }

  const cells = {
    good: new Array(numBurgs + 2).fill(0)
  };
  // Give every 3rd burg a local raw good
  for (let b = 1; b <= numBurgs; b++) {
    if (b % 3 === 0) cells.good[b] = (b % 20) + 1; // raw good id 1..20
  }

  return { pack: { burgs, goods, cells }, markets };
}

// ---------------------------------------------------------------------------
// 4. Dynamic import of ProductionModule after globals are set
// ---------------------------------------------------------------------------
const goods = buildGoods();

async function makeProduction(numBurgs: number) {
  const { pack: p, markets } = buildPack(goods, numBurgs);
  (globalThis as Record<string, unknown>).pack = p;
  (globalThis as Record<string, unknown>).Trade = buildTradeMock(markets);
  (globalThis as Record<string, unknown>).TIME = false;

  // Fresh import every time to get a clean ProductionModule instance
  const { ProductionModule } = await import("./production-generator");
  return new ProductionModule();
}

// ---------------------------------------------------------------------------
// 5. Phase-breakdown measurement (run once before bench to inspect)
// ---------------------------------------------------------------------------
async function measurePhases(numBurgs = 50) {
  const module = await makeProduction(numBurgs);

  // Wrap Trade.redistributeAcrossMarkets and updateMarketDemand for post-loop timing
  const tradeMock = (globalThis as Record<string, unknown>).Trade as {
    redistributeAcrossMarkets: () => void;
    updateMarketDemand: () => void;
  };
  let tPostLoop = 0;
  const origR = tradeMock.redistributeAcrossMarkets.bind(tradeMock);
  const origU = tradeMock.updateMarketDemand.bind(tradeMock);
  tradeMock.redistributeAcrossMarkets = () => {
    const t0 = performance.now();
    origR();
    tPostLoop += performance.now() - t0;
  };
  tradeMock.updateMarketDemand = () => {
    const t0 = performance.now();
    origU();
    tPostLoop += performance.now() - t0;
  };

  const t0 = performance.now();
  module.produce();
  const total = performance.now() - t0;

  return {
    total,
    postLoop: tPostLoop,
    workerLoopTotal: total - tPostLoop
    // perf fields removed: makeDecisionCalls, makeDecisionMs, cheapPlanCalls, cheapPlanMs
  };
}

// ---------------------------------------------------------------------------
// 6. Run phase breakdown once and print
// ---------------------------------------------------------------------------
measurePhases(50).then(t => {
  const pct = (n: number) => `${((n / t.total) * 100).toFixed(1)}%`;
  console.log("\n[BENCH] Phase breakdown (50 burgs, 50 goods):");
  console.log(`  ${"total".padEnd(24)} ${t.total.toFixed(2)}ms`);
  console.log(`  ${"postLoop".padEnd(24)} ${t.postLoop.toFixed(2)}ms  (${pct(t.postLoop)})`);
  console.log(`  ${"workerLoopTotal".padEnd(24)} ${t.workerLoopTotal.toFixed(2)}ms  (${pct(t.workerLoopTotal)})`);
  // perf fields removed: makeDecisionMs, makeDecisionCalls, cheapPlanMs, cheapPlanCalls
  // const unexplained = t.workerLoopTotal - t.makeDecisionMs - t.cheapPlanMs;
  // console.log(`  ${"unexplained (execute+overhead)".padEnd(24)} ${unexplained.toFixed(2)}ms  (${pct(unexplained)})`);
});

// ---------------------------------------------------------------------------
// 7. Vitest bench suites
// ---------------------------------------------------------------------------
describe("Production.produce() — scale", () => {
  bench(
    "10 burgs",
    async () => {
      const m = await makeProduction(10);
      m.produce();
    },
    { iterations: 10 }
  );

  bench(
    "50 burgs",
    async () => {
      const m = await makeProduction(50);
      m.produce();
    },
    { iterations: 10 }
  );

  bench(
    "100 burgs",
    async () => {
      const m = await makeProduction(100);
      m.produce();
    },
    { iterations: 5 }
  );

  bench(
    "200 burgs",
    async () => {
      const m = await makeProduction(200);
      m.produce();
    },
    { iterations: 3 }
  );
});

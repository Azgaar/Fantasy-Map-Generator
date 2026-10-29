import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Burg } from "@/model/political/burgs-generator";
import type { DemandCategory, Good } from "./goods-generator";
import { Goods } from "./goods-generator";
import { type Market, Markets } from "./markets-generator";
import { Production } from "./production-generator";
import { Prosperity } from "./prosperity";
import { StateEconomy } from "./state-economy";
import { DEAL_KINDS, type Deal, Trade } from "./trade";

const good = (i: number, value: number, demandCoverage: Partial<Record<DemandCategory, number>>): Good => ({
  i,
  name: `Good ${i}`,
  value,
  carriage: 0,
  demandCoverage,
  tags: [],
  unit: "unit",
  icon: "",
  color: "#ffffff"
});

// the cheapest coverage of each need costs 1.35 a person a day: food 0.2, utilities 0.3, construction 0.1, military 0.4, luxury 0.35
const catalogue = [
  good(1, 1, { food: 1 }),
  good(2, 2, { utilities: 1 }),
  good(3, 1, { construction: 1 }),
  good(4, 5, { military: 1 }),
  good(5, 5, { luxury: 1 }),
  good(6, 30, { luxury: 1 }) // a dear way to cover luxury
];
const bareNeeds: [number, number][] = [
  [1, 2],
  [2, 1.5],
  [3, 1],
  [4, 0.8],
  [5, 0.7]
]; // ten people's needs, each covered the cheapest way

let burg: Burg;
let market: Market;
const consume = (goods: [number, number][]) =>
  goods.map(([goodId, units]): Deal => [1, 1, goodId, DEAL_KINDS.demand, units, 1, 0, 0, 0]);

beforeEach(() => {
  burg = { i: 1, cell: 0, population: 10, state: 1 } as Burg;
  market = { i: 1, centerBurgId: 1, color: "#fff", goods: {} };
  globalThis.pack = {
    goods: catalogue,
    cells: { i: [0, 1], pop: [0, 20], market: [1, 1], state: [1, 1] },
    burgs: [{ i: 0 }, burg],
    states: [{ i: 0 }, { i: 1 }],
    markets: [market],
    deals: []
  } as unknown as typeof pack;
  Goods.sync();
  Markets.sync();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prosperity", () => {
  it("is unknown before the economy runs", () => {
    expect(Prosperity.getBurg(1)).toBeNull();
  });

  it("is nothing when no need is met", () => {
    pack.deals = [[1, 1, 1, DEAL_KINDS.sale, 5, 1, 0, 0, 0]]; // the burg only sold
    expect(Prosperity.getBurg(1)?.prosperity).toBe(0);
  });

  it("meets every need at bare needs, the cheapest way", () => {
    pack.deals = consume(bareNeeds);
    const living = Prosperity.getBurg(1)!;
    expect(living.needs).toBeCloseTo(1, 5);
    expect(living.comfort).toBeCloseTo(1, 5);
    expect(living.prosperity).toBeGreaterThan(0.2); // needs alone, plus the variety of five goods
    expect(living.prosperity).toBeLessThan(0.35);
  });

  it("rises with more and finer goods", () => {
    pack.deals = consume(bareNeeds);
    const bare = Prosperity.getBurg(1)!.prosperity;
    pack.deals = consume([...bareNeeds, [6, 5]]);
    const rich = Prosperity.getBurg(1)!;
    expect(rich.comfort).toBeGreaterThan(10);
    expect(rich.prosperity).toBeGreaterThan(bare);
  });

  it("splits a market's rural earnings and purchases over its cells by their produce", () => {
    pack.cells = {
      i: [0, 1, 2],
      pop: [0, 20, 20],
      market: [1, 1, 1],
      state: [1, 1, 1]
    } as unknown as typeof pack.cells;
    const output = [{ 1: 10 }, { 1: 30 }, { 1: 10 }];
    vi.spyOn(Production, "getRuralOutput").mockReturnValue(output);
    market.rural = { earned: 40, rent: 0, spent: 20, bought: [[5, 4]] };
    pack.deals = consume(bareNeeds);

    const rich = Prosperity.getRuralCell(1)!;
    const poor = Prosperity.getRuralCell(2)!;
    expect(rich.earned).toBeCloseTo(30, 5);
    expect(poor.earned).toBeCloseTo(10, 5);
    expect(rich.living.needs).toBe(1); // their fields feed them
    expect(rich.living.comfort).toBeGreaterThan(poor.living.comfort);
    const kept = Array.from(Prosperity.getCellsProsperity(output));
    expect(kept[0]).toBe(0); // no one lives there
    expect(kept[1]).toBe(Math.round(rich.living.prosperity * 100));
  });

  it("names its level", () => {
    expect(Prosperity.getLevel(0)).toBe("Desolate");
    expect(Prosperity.getLevel(0.1)).toBe("Destitute");
    expect(Prosperity.getLevel(0.55)).toBe("Thriving");
    expect(Prosperity.getLevel(0.95)).toBe("Peerless");
    expect(Prosperity.getLevel(1)).toBe("Peerless");
  });
});

describe("state trade", () => {
  it("counts selling abroad and foreign buying here as exports, buying abroad as imports", () => {
    const foreign = { i: 2, cell: 2, population: 10, state: 2 } as Burg;
    pack.cells.market[2] = 2;
    pack.burgs.push(foreign);
    pack.states.push({ i: 2 } as (typeof pack.states)[number]);
    pack.markets.push({ i: 2, centerBurgId: 2, color: "#fff", goods: {} });
    Markets.sync();
    pack.deals = [
      [1, 2, 1, DEAL_KINDS.sale, 10, 1, 0, 0, 0], // sells abroad: 10 to the burg, the market's margin on top
      [2, 1, 1, DEAL_KINDS.demand, 5, 2, 0, 0, 0], // a foreign burg buys here: 10 with the margin
      [1, 2, 2, DEAL_KINDS.input, 4, 3, 0, 1, 0.5] // buys abroad: 12 less the tariff, carriage and margin
    ];
    const rate = Trade.getMarginRate();
    const exports = 10 / (1 - rate) + 10 / (1 + rate);
    const imports = 9 / (1 + rate);
    const trade = StateEconomy.getTrade(1);
    expect(trade.exports).toBeCloseTo(exports, 5);
    expect(trade.imports).toBeCloseTo(imports, 5);
    expect(trade.partners.get(2)!.exports).toBeCloseTo(exports, 5);
    expect(trade.partners.get(2)!.imports).toBeCloseTo(imports, 5);
  });
});

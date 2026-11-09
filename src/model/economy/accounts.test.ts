import { beforeEach, describe, expect, it, vi } from "vitest";
import { Accounts } from "@/model/economy/accounts";
import { DEAL_KINDS, Deals } from "@/model/economy/deals";
import { Output } from "@/model/economy/output";
import { Pack } from "@/model/graph/pack-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { noFinance, States } from "@/model/political/states-generator";
import { Population } from "@/model/society/population-generator";
import { Goods } from "./goods-generator";
import { Prosperity } from "./prosperity";
import { Taxes } from "./taxes";

it("counts a state's markets when its fee is zero", () => {
  globalThis.pack.markets = [{ i: 1, centerBurgId: 1, goods: {} }] as never;
  globalThis.pack.states = [{ i: 0 }, { i: 1, economy: { adjustments: [], pocketed: 0 } }] as never;
  expect(Accounts.getBudget(1).markets).toBe(1);
});

beforeEach(() => {
  globalThis.pack = {
    burgs: [{ i: 0 }, { i: 1, state: 1 }, { i: 2, state: 2 }],
    cells: { i: [0, 1], state: [1, 2] },
    deals: [
      [1, 1, 1, DEAL_KINDS.demand, 3],
      [1, 1, 1, DEAL_KINDS.kept, 1],
      [1, 1, 2, DEAL_KINDS.order, 2],
      [1, 1, 2, DEAL_KINDS.sale, 50], // sold, not consumed
      [1, 1, 2, DEAL_KINDS.input, 50], // used up making goods, not consumed
      [2, 1, 1, DEAL_KINDS.demand, 5]
    ]
  } as any;
  options.map.goods = [
    { i: 1, value: 2 },
    { i: 2, value: 10 }
  ] as never;
  Goods.sync();
  // cell 0's rural people bought a unit of good 2 and kept 7 of good 1 they could not sell
  vi.spyOn(Prosperity, "getRuralCell").mockImplementation(
    cellId => (cellId ? { bought: [], goods: [] } : { bought: [0, 0, 1], goods: [0, 7, 1] }) as any
  );
});

describe("Output.getWorkingCell", () => {
  it("gives a water cell to a shore cell of its market, land to itself", () => {
    pack.cells = { h: [30, 30, 10, 30], c: [[], [], [0, 1, 3], []], market: [1, 2, 2, 2] } as any;
    expect(Output.getWorkingCell(0)).toBe(0);
    expect(Output.getWorkingCell(2)).toBe(1);
  });
});

describe("Accounts.getConsumption", () => {
  it("sums the units the state's burgs bought or kept back, its orders and its rural people's purchases, not their unsold produce", () => {
    expect(Accounts.getConsumption(1).slice(1)).toEqual([4, 3]);
    expect(Accounts.getConsumption(2).slice(1)).toEqual([5]);
    expect(Accounts.getConsumption(3)).toEqual([]);
  });

  it("goes by who holds the burgs now, once told they changed hands", () => {
    expect(Accounts.getConsumption(1).slice(1)).toEqual([4, 3]);
    pack.burgs[2].state = 1; // merged
    Pack.markChanged();
    expect(Accounts.getConsumption(1).slice(1)).toEqual([9, 3]);
  });
});

describe("StateEconomy summaries when the map changes without a new run", () => {
  beforeEach(() => {
    Object.assign(pack, {
      markets: [],
      provinces: [],
      states: [{ i: 0 }, { i: 1, economy: noFinance() }, { i: 2, economy: noFinance() }]
    });
    Object.assign(pack.burgs[1], { cell: 0, population: 3, product: 30, production: [[1, 1]] });
    Object.assign(pack.burgs[2], { cell: 1, population: 4, product: 40, production: [[1, 2]] });
    Object.assign(pack.cells, {
      h: [30, 30],
      area: [1, 1],
      pop: [10, 20],
      burg: [1, 2],
      market: [0, 0],
      province: [0, 0]
    });
    vi.spyOn(Deals, "getMargin").mockReturnValue(0);
    vi.spyOn(Taxes, "getTaxesByState").mockReturnValue({ salesTax: [], tariffs: [] });
    vi.spyOn(Prosperity, "getBurg").mockReturnValue(null as never);
    vi.spyOn(Output, "getRural").mockReturnValue([] as never);
    vi.spyOn(States, "getPoles").mockImplementation(() => {});
    vi.spyOn(States, "findNeighbors").mockImplementation(() => {});
    Pack.markChanged();
  });

  it("sums a merged state's figures into its ruler", () => {
    expect(Accounts.ofState(1)).toMatchObject({ people: 13, urbanPeople: 3, manufacturing: 30 });
    expect(Accounts.getOutput(1)[1]).toBe(2);
    expect(Accounts.getConsumption(1).slice(1)).toEqual([4, 3]);

    States.merge(1, [2]);

    expect(Accounts.ofState(1)).toMatchObject({ people: 37, urbanPeople: 7, manufacturing: 70 });
    expect(Accounts.getOutput(1)[1]).toBe(6);
    expect(Accounts.getOutput(2)).toEqual([]);
    expect(Accounts.getConsumption(1).slice(1)).toEqual([9, 3]);
    expect(Accounts.getConsumption(2)).toEqual([]);
  });

  it("counts a burg's new population", () => {
    expect(Accounts.ofState(1)?.urbanPeople).toBe(3);
    const { scale, urbanization } = options.map.units.population;
    Burgs.setPopulation(1, 5 * scale * urbanization.rate);
    expect(Accounts.ofState(1)?.urbanPeople).toBe(5);
  });

  it("counts an area's new population", () => {
    expect(Accounts.ofState(1)?.rural).toBe(0);
    expect(Accounts.ofState(1)?.people).toBe(13);
    const { scale } = options.map.units.population;
    Population.setArea([0], [], 40 * scale, 0);
    expect(Accounts.ofState(1)?.people).toBe(43);
  });
});

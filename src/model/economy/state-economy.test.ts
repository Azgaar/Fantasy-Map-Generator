import { beforeEach, describe, expect, it, vi } from "vitest";
import { Goods } from "./goods-generator";
import { Production } from "./production-generator";
import { Prosperity } from "./prosperity";
import { StateEconomy } from "./state-economy";
import { DEAL_KINDS } from "./trade";

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

describe("Production.getWorkingCell", () => {
  it("gives a water cell to a shore cell of its market, land to itself", () => {
    pack.cells = { h: [30, 30, 10, 30], c: [[], [], [0, 1, 3], []], market: [1, 2, 2, 2] } as any;
    expect(Production.getWorkingCell(0)).toBe(0);
    expect(Production.getWorkingCell(2)).toBe(1);
  });
});

describe("StateEconomy.getConsumption", () => {
  it("sums the units the state's burgs bought or kept back, its orders and its rural people's purchases, not their unsold produce", () => {
    expect(StateEconomy.getConsumption(1).slice(1)).toEqual([4, 3]);
    expect(StateEconomy.getConsumption(2).slice(1)).toEqual([5]);
    expect(StateEconomy.getConsumption(3)).toEqual([]);
  });

  it("goes by who holds the burgs now, once told they changed hands", () => {
    expect(StateEconomy.getConsumption(1).slice(1)).toEqual([4, 3]);
    pack.burgs[2].state = 1; // merged
    StateEconomy.forgetConsumption();
    expect(StateEconomy.getConsumption(1).slice(1)).toEqual([9, 3]);
  });
});

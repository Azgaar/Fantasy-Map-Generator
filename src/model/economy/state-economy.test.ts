import { beforeEach, describe, expect, it, vi } from "vitest";
import { Goods } from "./goods-generator";
import { Prosperity } from "./prosperity";
import { StateEconomy } from "./state-economy";
import { DEAL_KINDS } from "./trade";

beforeEach(() => {
  globalThis.pack = {
    goods: [
      { i: 1, value: 2 },
      { i: 2, value: 10 }
    ],
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
  Goods.sync();
  // cell 0's rural people bought a unit of good 2 and kept 7 of good 1 they could not sell
  vi.spyOn(Prosperity, "getRuralCell").mockImplementation(
    cellId => (cellId ? { bought: [], goods: [] } : { bought: [0, 0, 1], goods: [0, 7, 1] }) as any
  );
});

describe("StateEconomy.getConsumption", () => {
  it("sums the units the state's burgs bought or kept back, its orders and its rural people's purchases, not their unsold produce", () => {
    expect(StateEconomy.getConsumption(1).slice(1)).toEqual([4, 3]);
    expect(StateEconomy.getConsumption(2).slice(1)).toEqual([5]);
    expect(StateEconomy.getConsumption(3)).toEqual([]);
  });
});

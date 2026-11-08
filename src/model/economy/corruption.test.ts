import { beforeEach, describe, expect, it } from "vitest";
import { noFinance } from "@/model/political/states-generator";
import { Corruption } from "./corruption";
import { StateOrders } from "./state-orders";

// a state of three cells: the capital's, in no province, a near province and an overseas one of strangers
beforeEach(() => {
  options.map.graph = { width: 1000, height: 0 } as any; // a decima of 100
  globalThis.pack = {
    deals: [],
    burgs: [
      { i: 0 },
      { i: 1, cell: 0, x: 0, y: 0, state: 1, population: 0 },
      { i: 2, cell: 1, x: 150, y: 0, state: 1, population: 0 },
      { i: 3, cell: 2, x: 50, y: 0, state: 1, population: 0 }
    ],
    provinces: [{ i: 0 }, { i: 1, state: 1, burg: 2 }, { i: 2, state: 1, burg: 3 }],
    cells: {
      i: [0, 1, 2],
      state: [1, 1, 1],
      province: [0, 1, 2],
      culture: [1, 1, 2],
      religion: [0, 0, 0],
      pop: [50, 30, 20],
      burg: [0, 0, 0],
      f: [1, 1, 2]
    },
    states: [
      { i: 0, economy: noFinance() },
      {
        i: 1,
        capital: 1,
        culture: 1,
        rural: 100,
        urban: 0,
        economy: {
          ...noFinance(),
          budget: { ...noFinance().budget, infrastructure: 20, corruption: 20 },
          spent: { ...noFinance().spent, infrastructure: 2.5 }
        }
      }
    ]
  } as any;
});

describe("Corruption by province", () => {
  it("weighs each province, and the cells outside any, by their people, minorities and remoteness", () => {
    const [outside, near, overseas] = Corruption.getProvinces(1);
    expect(outside).toMatchObject({ id: 0, share: 0.5, diversity: 0, remoteness: 0 });
    expect(near).toMatchObject({ id: 1, share: 0.3, diversity: 0, remoteness: 0.75 }); // 150 of 200
    expect(overseas).toMatchObject({ id: 2, share: 0.2, diversity: 0.5, remoteness: 1 }); // other culture, half
    expect(Corruption.ofCell(2)).toBe(overseas);
    expect(Corruption.ofCapital(pack.states[1])).toBe(outside);
  });

  it("follows regenerated provinces without an economy run", () => {
    expect(Corruption.getProvinces(1)).toHaveLength(3);
    pack.provinces = [{ i: 0 }, { i: 1, state: 1, burg: 2 }] as any;
    expect(Corruption.getProvinces(1).map(d => d.id)).toEqual([0, 1]); // the former province's people are in none
  });

  it("keeps a cell's province until reindexed, so a cell painted to another state names no wrong one", () => {
    const overseas = Corruption.ofCell(2);
    pack.cells.state[2] = 2;
    expect(Corruption.ofCell(2)).toBe(overseas);
  });

  it("is above the state's in remote and diverse provinces and below it in the rest, averaging to it", () => {
    const state = pack.states[1];
    const provinces = Corruption.getProvinces(1);
    const tendencies = provinces.map(d => Corruption.getTendency(state, d));
    expect(tendencies[0]).toBeLessThan(20);
    expect(tendencies[2]).toBeGreaterThan(tendencies[1]);
    expect(provinces.reduce((sum, d, k) => sum + d.share * tendencies[k], 0)).toBeCloseTo(20);
  });

  it("leaves provinces served by infrastructure as far as their officials leave of their share", () => {
    const state = pack.states[1];
    const served = StateOrders.getInfrastructure(state);
    expect(served.get(0)!).toBeGreaterThan(served.get(2)!); // the overseas province loses most to graft
    // all of it reached them: the spending against the need of all their people
    const spent = Corruption.getProvinces(1).reduce((sum, d) => sum + served.get(d.id)! * 0.05 * d.people, 0);
    expect(spent).toBeCloseTo(2.5);
  });

  it("gives the state's as its provinces' by where it spends", () => {
    const state = pack.states[1];
    const inProvinces = Corruption.getProvinces(1).reduce(
      (sum, d) => sum + d.share * Corruption.ofProvince(state, d, 100),
      0
    );
    expect(Corruption.ofState(state, 100)).toBeCloseTo(inProvinces); // infrastructure only, spent in the provinces
  });

  it("weighs the state's before administration as after it: the court and the army spend at the least corrupt capital", () => {
    const state = pack.states[1];
    expect(Corruption.getStateTendency(state)).toBeCloseTo(20); // infrastructure only: the provinces by their people
    state.economy.budget.court = 20;
    const capital = Corruption.getTendency(state, Corruption.ofCapital(state)!);
    expect(Corruption.getStateTendency(state)).toBeCloseTo((20 * capital + 20 * 20) / 40);
    expect(Corruption.getStateTendency(state)).toBeLessThan(20);
  });
});

describe("Corruption.curb", () => {
  const state = (administration: number) =>
    ({
      i: 1,
      rural: 100, // administration needs 10 a day
      urban: 0,
      economy: { ...noFinance(), budget: { ...noFinance().budget, administration, corruption: 40 } }
    }) as any;

  it("is the state's corruption when administration gets nothing", () => {
    expect(Corruption.curb(state(0), 100)).toBe(40);
    expect(Corruption.curb(state(20), 0)).toBe(40);
  });

  it("is halved once administration is paid what the people need", () => {
    // 20 allotted, 16 paid at the curbed 20%: more than the 10 needed
    expect(Corruption.curb(state(20), 100)).toBe(20);
  });

  it("is curbed in proportion to what administration is paid of the need, the pay net of that corruption", () => {
    const corruption = Corruption.curb(state(20), 30);
    const pay = 6 * (1 - corruption / 100);
    expect(corruption).toBeCloseTo(40 * (1 - (0.5 * pay) / 10), 6);
    expect(corruption).toBeCloseTo(31.82, 2);
  });
});

describe("StateOrders.getProvision", () => {
  it("is the spending against the people's need, up to 1", () => {
    const state = (infrastructure: number) =>
      ({
        i: 1,
        rural: 80,
        urban: 20,
        economy: { ...noFinance(), spent: { ...noFinance().spent, infrastructure } }
      }) as any;
    expect(StateOrders.getProvision(state(2.5), "infrastructure")).toBe(0.5);
    expect(StateOrders.getProvision(state(50), "infrastructure")).toBe(1);
    expect(StateOrders.getProvision(undefined, "court")).toBe(0);
  });
});

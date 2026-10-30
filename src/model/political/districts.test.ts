import { beforeEach, describe, expect, it, vi } from "vitest";
import { Markets } from "@/model/economy/markets-generator";
import { Districts } from "./districts";
import { noFinance } from "./states-generator";

// a state of three cells: the capital's (crown lands, no province), a near province and an overseas one of strangers
beforeEach(() => {
  options.map.graph = { width: 1000, height: 0 } as any; // a decima of 100
  vi.spyOn(Markets, "ofBurg").mockReturnValue({} as any);
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

describe("Districts", () => {
  it("are the crown lands and each province with a seat, with their people, minorities and remoteness", () => {
    const [crown, near, overseas] = Districts.get(1);
    expect(crown).toMatchObject({ province: 0, share: 0.5, diversity: 0, remoteness: 0 });
    expect(near).toMatchObject({ province: 1, share: 0.3, diversity: 0, remoteness: 0.75 }); // 150 of 200
    expect(overseas).toMatchObject({ province: 2, share: 0.2, diversity: 0.5, remoteness: 1 }); // other culture, half
    expect(Districts.at(2)).toBe(overseas);
    expect(Districts.getCapital(pack.states[1])).toBe(crown);
  });

  it("follow regenerated provinces without an economy run", () => {
    expect(Districts.get(1)).toHaveLength(3);
    pack.provinces = [{ i: 0 }, { i: 1, state: 1, burg: 2 }] as any;
    expect(Districts.get(1).map(d => d.province)).toEqual([0, 1]); // the former province's people join the crown lands
  });

  it("keep a cell's district until reindexed, so a cell painted to another state names no wrong district", () => {
    const overseas = Districts.at(2);
    pack.cells.state[2] = 2;
    expect(Districts.at(2)).toBe(overseas);
  });

  it("put corruption above the state's in remote and diverse districts and below it in the rest, averaging to it", () => {
    const state = pack.states[1];
    const districts = Districts.get(1);
    const tendencies = districts.map(d => Districts.getTendency(state, d));
    expect(tendencies[0]).toBeLessThan(20);
    expect(tendencies[2]).toBeGreaterThan(tendencies[1]);
    expect(districts.reduce((sum, d, k) => sum + d.share * tendencies[k], 0)).toBeCloseTo(20);
  });

  it("are served by infrastructure as far as their officials leave of their share", () => {
    const state = pack.states[1];
    const served = Districts.getInfrastructure(state);
    expect(served[0]).toBeGreaterThan(served[2]); // the overseas province loses most to graft
    // all of it reached them: the spending against the need of all their people
    const people = Districts.get(1).map(d => d.people);
    const spent = served.reduce((sum, value, k) => sum + value * 0.05 * people[k], 0);
    expect(spent).toBeCloseTo(2.5);
  });

  it("give the state's corruption as its districts' by where it spends", () => {
    const state = pack.states[1];
    const atSeats = Districts.get(1).reduce((sum, d) => sum + d.share * Districts.getCorruption(state, d, 100), 0);
    expect(Districts.getStateCorruption(state, 100)).toBeCloseTo(atSeats); // infrastructure only, spent at the seats
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prosperity } from "@/model/economy/prosperity";
import { StateEconomy } from "@/model/economy/state-economy";
import { Military } from "./military-generator";
import { Stability } from "./stability";
import { noFinance } from "./states-generator";

const army = (troops: number) => [{ a: troops, u: { infantry: troops } }];

beforeEach(() => {
  options.map.units.population.scale = 1000;
  options.map.units.population.urbanization.rate = 1;
  options.map.military.units = [{ name: "infantry", power: 1 }] as any;
  globalThis.pack = {
    deals: [[1]],
    burgs: [{ i: 0 }],
    cells: { i: [0, 1], state: [1, 1], culture: [1, 1], religion: [0, 0], pop: [50, 50], burg: [0, 0], f: [1, 1] },
    states: [
      { i: 0, name: "Neutrals", economy: noFinance() },
      {
        i: 1,
        culture: 1,
        capital: 0,
        cells: 10,
        burgs: 1,
        rural: 100, // 100 000 people
        urban: 0,
        military: army(500), // half a percent of them
        economy: { ...noFinance(), spent: { ...noFinance().spent, military: 25 } }
      }
    ]
  } as any;
});

describe("Military.getUpkeep", () => {
  it("is the military spending against what the forces' power needs, up to 1", () => {
    expect(Military.getUpkeep(1)).toBe(1); // 500 troops of power 1 need 12.5
    pack.states[1].military = army(2000) as any;
    expect(Military.getUpkeep(1)).toBe(0.5);
  });

  it("is 1 before the economy has run, for the neutral lands and for anarchies", () => {
    expect(Military.getUpkeep(0)).toBe(1);
    pack.states[1].military = army(2000) as any;
    pack.states[1].form = "Anarchy";
    expect(Military.getUpkeep(1)).toBe(1);
    pack.states[1].form = "Monarchy";
    pack.deals = [];
    pack.states[1].military = army(2000) as any;
    expect(Military.getUpkeep(1)).toBe(1);
  });
});

describe("Stability.get", () => {
  it("sums its parts: a kept army supports it, an unkept one undermines it", () => {
    vi.spyOn(StateEconomy, "getAccounts").mockReturnValue({ prosperity: 0.25, taxes: 0, product: 100 } as any);
    vi.spyOn(Prosperity, "getRuralCell").mockReturnValue({ living: { prosperity: 0.25 } } as any);
    const kept = Stability.get(1)!;
    expect(kept.parts.prosperity).toBeCloseTo(0.25);
    expect(kept.parts.army).toBeCloseTo(0.15);
    expect(kept.stability).toBeCloseTo(0.5 + 0.25 + 0.15);

    pack.states[1].military = army(4000) as any; // a quarter kept
    expect(Stability.get(1)!.parts.army).toBeCloseTo(-0.075);
  });

  it("is null for the neutral lands and before the economy has run", () => {
    vi.spyOn(StateEconomy, "getAccounts").mockReturnValue(null);
    expect(Stability.get(1)).toBeNull();
    expect(Stability.get(0)).toBeNull();
  });
});

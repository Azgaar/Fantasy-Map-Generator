import { beforeEach, describe, expect, it, vi } from "vitest";
import { Goods } from "@/model/economy/goods-generator";
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
        economy: { ...noFinance(), spent: { ...noFinance().spent, military: 40 } }
      }
    ]
  } as any;
});

describe("Military.getUpkeep", () => {
  it("is the military spending against what the forces' power needs, up to 1", () => {
    expect(Military.getUpkeep(1)).toBe(1); // 500 troops of power 1 need 20
    pack.states[1].military = army(2000) as any;
    expect(Military.getUpkeep(1)).toBe(0.5);
  });

  it("scales the forces' power in battle, never below 0.05", () => {
    pack.states[1].military = army(2000) as any;
    expect(Military.getPower(1)).toBe(1000); // 2000 troops of power 1, half kept
    pack.states[1].military = army(100000) as any;
    expect(Military.getBattleUpkeep(1)).toBe(0.05); // 1% kept
    expect(Military.getPower(1)).toBe(5000);
  });

  it("gives a regiment's power with its state's battle upkeep", () => {
    pack.states[1].military = [...army(1500), ...army(500)].map(regiment => ({ ...regiment, state: 1 })) as any;
    expect(Military.getRegimentPower(pack.states[1].military![1])).toBe(250); // 500 troops, the state's forces half kept
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

describe("Military.getEquipped", () => {
  beforeEach(() => {
    options.map.military.units = [
      { name: "infantry", type: "melee" },
      { name: "cavalry", type: "mounted", goods: [2, 3] },
      { name: "knights", type: "mounted", goods: [2] },
      { name: "fleet", type: "naval", goods: [4] }
    ] as any;
    pack.goods = [
      { i: 1, name: "Arms" },
      { i: 2, name: "Horses", demandCoverage: { military: 0.5 } },
      { i: 3, name: "Camels", demandCoverage: { utilities: 1 } }, // no military coverage: a unit each
      { i: 4, name: "Boats", demandCoverage: { military: 1 } }
    ] as any;
    Goods.sync();
  });

  it("equips a unit with a year of its goods times their military coverage, shared goods split by troops", () => {
    vi.spyOn(StateEconomy, "getConsumption").mockReturnValue([0, 0, 2, 1, 0]);
    // horses: 2 × 365 × 0.5 = 365 kits, 3/4 to cavalry; camels: 365 kits, all to cavalry
    const equipped = Military.getEquipped(1, { infantry: 5000, cavalry: 900, knights: 300, fleet: 10 });
    expect(equipped.infantry).toBe(1); // needs no goods
    expect(equipped.cavalry).toBeCloseTo((365 * 0.75 + 365) / 900);
    expect(equipped.knights).toBeCloseTo((365 * 0.25) / 300);
    expect(equipped.fleet).toBe(0);
  });

  it("needs no goods for a unit without the goods field, as in maps and rosters saved before it", () => {
    options.map.military.units = [{ name: "legion", type: "melee" }] as any;
    vi.spyOn(StateEconomy, "getConsumption").mockReturnValue([]);
    expect(Military.getEquipped(1, { legion: 5000 })).toEqual({ legion: 1 });
  });

  it("is full when goods suffice, and before the economy has run", () => {
    vi.spyOn(StateEconomy, "getConsumption").mockReturnValue([0, 0, 100, 0, 1]);
    expect(Military.getEquipped(1, { cavalry: 100, knights: 100, fleet: 10 })).toEqual({
      infantry: 1,
      cavalry: 1,
      knights: 1,
      fleet: 1
    });
    pack.deals = [];
    expect(Military.getEquipped(1, { cavalry: 100 }).cavalry).toBe(1);
  });
});

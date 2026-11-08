// Regenerating one element on real generated maps
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Accounts } from "@/model/economy/accounts";
import { Goods } from "@/model/economy/goods-generator";
import { Routes } from "@/model/economy/routes-generator";
import { Pack } from "@/model/graph/pack-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Military } from "@/model/political/military-generator";
import { Stability } from "@/model/political/stability";
import { States } from "@/model/political/states-generator";
import { Zones } from "@/model/political/zones-generator";
import { Cultures } from "@/model/society/cultures-generator";
import { generateMap, living } from "./real-map.testing";

const FIRST_GOOD = 1;
beforeAll(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} }));

const stateMultipliers = () => Goods.get(FIRST_GOOD)!.multipliers?.state;

describe("Regenerate Burgs", () => {
  it("gives every province holding a burg a capital inside it", async () => {
    await generateMap({ seed: "regen-burgs" });
    Burgs.regenerate();
    for (const province of living(pack.provinces)) {
      const holdsBurg = living(pack.burgs).some(burg => pack.cells.province[burg.cell] === province.i);
      if (!holdsBurg) continue;
      const capital = pack.burgs[province.burg];
      expect(pack.cells.province[capital.cell]).toBe(province.i);
      expect(province.center).toBe(capital.cell);
    }
  });

  it("keeps a locked burg its province's seat under its new id", async () => {
    await generateMap({ seed: "regen-locked-seat" });
    const province = living(pack.provinces).find(({ burg }) => burg && !pack.burgs[burg].capital)!;
    const seat = pack.burgs[province.burg];
    seat.lock = true;
    Burgs.regenerate();
    expect(pack.burgs[province.burg]).toBe(seat);
  });

  it("leaves markets naming only burgs that still exist", async () => {
    await generateMap({ seed: "regen-market-centers" });
    const center = pack.burgs[pack.markets[0].centerBurgId];
    center.lock = true;
    Burgs.regenerate();
    expect(pack.burgs[pack.markets[0].centerBurgId]).toBe(center);
    for (const { centerBurgId } of pack.markets.slice(1)) expect(centerBurgId).toBe(0);
  });
});

describe("Burgs on the map", () => {
  it("never loses a locked burg's cell to a new one", async () => {
    await generateMap({ seed: "regen-locked-cells" });
    const locked = living(pack.burgs).filter((_, index) => index % 2 === 0);
    for (const burg of locked) burg.lock = true;
    Burgs.regenerate();
    for (const burg of locked) expect(pack.cells.burg[burg.cell]).toBe(burg.i);
  });

  it("takes a road when moved off the network", async () => {
    await generateMap({ seed: "move-off-road" });
    const provinceCapitals = new Set(living(pack.provinces).map(province => province.burg));
    const burg = living(pack.burgs).find(
      b => !b.capital && !provinceCapitals.has(b.i!) && !pack.markets.some(market => market.centerBurgId === b.i)
    )!;
    const free = Array.from(pack.cells.i).find(
      cell =>
        pack.cells.h[cell] >= 20 &&
        !pack.cells.burg[cell] &&
        !Routes.isConnected(cell) &&
        pack.cells.state[cell] === burg.state
    )!;
    Burgs.move(burg.i!, ...pack.cells.p[free]);
    expect(Routes.isConnected(burg.cell)).toBe(true);
  });

  it("gives a province another seat when a state is founded on its own", async () => {
    await generateMap({ seed: "found-on-seat" });
    const province = living(pack.provinces).find(
      p =>
        p.burg &&
        !pack.burgs[p.burg].capital &&
        living(pack.burgs).filter(b => pack.cells.province[b.cell] === p.i).length > 1
    )!;
    const seat = pack.burgs[province.burg];
    States.add(...pack.cells.p[seat.cell]);
    expect(province.burg).not.toBe(seat.i);
    expect(pack.burgs[province.burg].state).toBe(province.state);
    expect(pack.cells.province[province.center]).toBe(province.i);
  });
});

describe("the economy's summaries", () => {
  it("follow an edit of a burg's people and of a province's cells", async () => {
    await generateMap({ seed: "summaries-follow" });
    const province = living(pack.provinces).find(p => p.burg)!;
    const was = Accounts.ofProvince(province.i)!.people;
    const burg = pack.burgs[province.burg];
    const { scale, urbanization } = options.map.units.population;
    Burgs.setPopulation(burg.i!, burg.population! * scale * urbanization.rate * 5);
    expect(Accounts.ofProvince(province.i)!.people).toBeGreaterThan(was);
  });
});

describe("regiment troops", () => {
  it("are population points shown at the rate, rounded up", async () => {
    await generateMap({ seed: "army-troops" });
    options.map.units.population.scale = 10;
    expect(Military.getTroops(0)).toBe(0);
    expect(Military.getTroops(0.001)).toBe(1);
    expect(Military.getTroops(0.25)).toBe(3);
    options.map.units.population.scale = 1000;
    expect(Military.getTroops(0.007)).toBe(7); // no float noise rounds it up
    expect(Military.getTroops(0.25)).toBe(250);
  });

  it("keep their sum and exact points through edits, splits and a change of rate", async () => {
    await generateMap({ seed: "army-edits" });
    const state = living(pack.states).find(s => s.military?.some(r => r.a > 0.1))!;
    const regiment = state.military!.find(r => r.a > 0.1)!;
    const [unit] = Object.keys(regiment.u);
    const points = regiment.u[unit];
    const shown = Object.fromEntries(Object.entries(regiment.u).map(([n, v]) => [n, Military.getTroops(v)]));
    Military.setUnits(state.i, regiment.i, shown);
    expect(regiment.u[unit]).toBe(points);
    Military.setUnits(state.i, regiment.i, { ...shown, [unit]: 25 });
    expect(Military.getTroops(regiment.u[unit])).toBe(25);
    const total = regiment.a;
    const added = Military.split(state.i, regiment.i);
    const half = state.military!.find(r => r.i === added)!;
    expect(regiment.a + half.a).toBeCloseTo(total);
  });
});

describe("army figures", () => {
  it("do not depend on the population rate, on a change of it or when raised", async () => {
    await generateMap({ seed: "army-scale" });
    const state = living(pack.states).find(s => s.military?.length)!;
    const need = Military.getUpkeepNeed(state.i);
    const army = Stability.get(state.i)!.parts.army;
    const rate = options.map.units.population.scale;
    options.map.units.population.scale = rate * 100;
    Pack.markChanged();
    expect(Military.getUpkeepNeed(state.i)).toBe(need);
    expect(Stability.get(state.i)!.parts.army).toBeCloseTo(army);
    const troops = () => living(pack.states).map(s => (s.military ?? []).map(r => r.a));
    Military.regenerate();
    const atHighRate = troops();
    options.map.units.population.scale = rate;
    Military.regenerate();
    expect(atHighRate).toEqual(troops());
  });
});

describe("Regenerate Rivers", () => {
  it("leaves no port on water that is gone", async () => {
    await generateMap({ seed: "regen-rivers" });
    Rivers.regenerate();
    Burgs.syncPorts();
    for (const burg of living(pack.burgs)) if (burg.port) expect(Burgs.getPortWater(burg.cell)).toBe(burg.port);
  });
});

describe("entity multipliers", () => {
  it("follow a locked state through its new id, and go with dropped states", async () => {
    await generateMap({ seed: "regen-state-multipliers" });
    const [kept, dropped] = living(pack.states).slice(-2);
    kept.lock = true;
    Goods.get(FIRST_GOOD)!.multipliers = { state: { [kept.i]: 0, [dropped.i]: 3 } };
    States.regenerate();
    expect(kept.i).toBe(1);
    expect(stateMultipliers()).toEqual({ 1: 0 });
  });

  it("follow a locked culture through its new id", async () => {
    await generateMap({ seed: "regen-culture-multipliers" });
    const kept = living(pack.cultures).at(-1)!;
    kept.lock = true;
    Goods.get(FIRST_GOOD)!.multipliers = { culture: { [kept.i]: 0, 999: 3 } };
    Cultures.regenerate();
    expect(Goods.get(FIRST_GOOD)!.multipliers!.culture).toEqual({ [kept.i]: 0 });
    expect(pack.cultures[kept.i]).toBe(kept);
  });

  it("go when zones are generated again", async () => {
    await generateMap({ seed: "regen-zone-multipliers" });
    Goods.get(FIRST_GOOD)!.multipliers = { zone: { 1: 0 } };
    Zones.regenerate();
    expect(Goods.get(FIRST_GOOD)!.multipliers!.zone).toBeUndefined();
  });
});

describe("generated zones", () => {
  it("hold each cell once", async () => {
    await generateMap({ seed: "zones-unique" });
    for (const zone of pack.zones) expect(new Set(zone.cells).size).toBe(zone.cells.length);
  });
});

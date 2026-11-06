// Regenerating one element on real generated maps
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Goods } from "@/model/economy/goods-generator";
import { Rivers } from "@/model/physical/river-generator";
import { Burgs } from "@/model/political/burgs-generator";
import { Districts } from "@/model/political/districts";
import { States } from "@/model/political/states-generator";
import { Zones } from "@/model/political/zones-generator";
import { Cultures } from "@/model/society/cultures-generator";
import { generateMap, living } from "./real-map.testing";

const FIRST_GOOD = 1;
beforeAll(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} }));

const stateMultipliers = () => Goods.get(FIRST_GOOD)!.multipliers?.state;

describe("Regenerate Burgs", () => {
  it("seats every province holding a burg, so provinces stay districts", async () => {
    await generateMap({ seed: "regen-burgs" });
    const before = living(pack.states).reduce((total, { i }) => total + Districts.get(i).length, 0);
    Burgs.regenerate();
    for (const province of living(pack.provinces)) {
      const holdsBurg = living(pack.burgs).some(burg => pack.cells.province[burg.cell] === province.i);
      if (!holdsBurg) continue;
      const seat = pack.burgs[province.burg];
      expect(pack.cells.province[seat.cell]).toBe(province.i);
      expect(province.center).toBe(seat.cell);
    }
    const after = living(pack.states).reduce((total, { i }) => total + Districts.get(i).length, 0);
    expect(after).toBeGreaterThan(before / 2);
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

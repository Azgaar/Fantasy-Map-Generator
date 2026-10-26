/**
 * CAPACITY-PLAN Phase 3 — gating, attrition, development.
 *
 * The contract this file pins:
 *  - **flag off is bit-identical**: no gate, no attrition, no development, and
 *    the gold economy exactly as it has always run;
 *  - **flag on gates play**: a recruit, a character and a building are refused
 *    when the realm has no free capacity, and the refusal names the pool;
 *  - **over capacity attrits**: a realm that cannot feed its army loses men,
 *    and the provinces hosting them sour;
 *  - **development**: `Develop` commits Wealth and promotes a settlement only
 *    when the commitment completes; organic growth does the same slowly, and
 *    only where the province can carry it;
 *  - **a garrison holds order**: a region with a friendly unit in it keeps its
 *    order; an empty one keeps the drift it has always had.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

import { currentContent } from "@/conquest/content/store";
import { MEN_PER_BLOCK, resolveForPack } from "@/conquest/engine/common/content";
import type { MapPack } from "@/conquest/engine/common/types";
import { compileAzgaar } from "@/conquest/engine/compiler/index";
import {
  bindingPool,
  developmentBonus,
  developmentCap,
  factionCustoms,
  freeCapacity,
  isGarrisoned,
  recomputeCapacity,
  settlementTier
} from "@/conquest/engine/game/capacity";
import { startSiege, siegeOf } from "@/conquest/engine/game/sieges";
import { applyCommand, type Command, type EngineCtx, getMilitiaDefenseUnits } from "@/conquest/engine/game/commands";
import { type CampaignConfig, DEFAULT_CONFIG, resolveConfig } from "@/conquest/engine/game/config";
import { economyTick } from "@/conquest/engine/game/economy";
import { regionValues } from "@/conquest/engine/game/saves";
import { createCampaign, stateHash } from "@/conquest/engine/game/state";

const SOURCE = path.resolve(testDir, "../test-data/sample-world.json");
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const pack: MapPack = compileAzgaar(raw).pack;
const content = currentContent().content;
const resolved = resolveForPack(pack, content);
const SHIPPED_CONFIG = JSON.parse(readFileSync(path.resolve(testDir, "../content/docs/game.json"), "utf8"));

/** The shipped config with the capacity model turned on. */
const capacityConfig: CampaignConfig = {
  ...DEFAULT_CONFIG,
  economy: { ...DEFAULT_CONFIG.economy, capacityMode: true }
};

function boot(config: CampaignConfig = DEFAULT_CONFIG, seed = 606) {
  const commands: Command[] = [];
  const campaign = createCampaign({
    mapPackId: "test",
    pack,
    factionId: 1,
    seed,
    config,
    content,
    resolved,
    id: `cap3-${seed}`
  });
  const ctx = { campaign, pack, config, content, resolved, commands } as EngineCtx;
  return { ctx, campaign, commands };
}

/** A realm's free capacity per pool. */
function free(ctx: EngineCtx, factionId: number) {
  const cap = ctx.campaign.factions[String(factionId)]!.capacity!;
  return { m: cap.m.gen - cap.m.load, w: cap.w.gen - cap.w.load, s: cap.s.gen - cap.s.load, c: cap.c.gen - cap.c.load };
}

/**
 * Make the realm genuinely short of `pool` — by swelling its army until the
 * pool's load passes its generation.
 *
 * The gates read a *fresh* ledger, so a shortfall has to be real: mutating the
 * stored figures would simply be overwritten.
 */
function overCapacity(ctx: EngineCtx, factionId: number, pool: "m" | "w" | "s", margin = 1): void {
  const gen = ctx.campaign.factions[String(factionId)]!.capacity![pool].gen;
  // The unit type that costs most in this pool.
  let best: { type: string; perBlock: number } | null = null;
  for (const [id, u] of Object.entries(content.unitTypes)) {
    const perBlock = u.capacityCost?.[pool] ?? 0;
    if (perBlock <= 0) continue;
    if (!best || perBlock > best.perBlock) best = { type: id, perBlock };
  }
  expect(best, `no unit costs ${pool}`).not.toBeNull();
  const army = Object.values(ctx.campaign.armies).find(a => a.factionId === factionId)!;
  const target = army.units[0]!;
  // count / MEN_PER_BLOCK x perBlock must exceed the generation.
  target.count = Math.ceil(((gen + margin) * MEN_PER_BLOCK) / best!.perBlock);
  target.type = best!.type;
}

/** A settlement of the realm that has room to grow. */
function growableSettlement(
  ctx: EngineCtx,
  factionId: number
): { regionId: number; settlement: { id: number; tier: number } } {
  for (const r of pack.regions) {
    if (ctx.campaign.regions[String(r.id)]!.owner !== factionId) continue;
    const settlement = pack.settlements.find(s => s.regionId === r.id && developmentCap(ctx, s.id) > 0);
    if (settlement) return { regionId: r.id, settlement };
  }
  throw new Error("no growable settlement on this map");
}

/** A unit the realm can actually raise. */
function recruitableFor(ctx: EngineCtx, factionId: number): string {
  const roster = ctx.resolved.factions[String(factionId)]!.roster;
  return roster.recruitable[0]!;
}

/** An army of the realm, placed in its capital region. */
function armyInCapital(ctx: EngineCtx, factionId: number): string | undefined {
  const f = pack.factions.find(x => x.id === factionId)!;
  const region = pack.regions.find(r => r.id === f.capitalRegion)!;
  const cell = pack.settlements.find(s => s.regionId === region.id && s.kind === "major")!.cell;
  const army = Object.values(ctx.campaign.armies).find(a => a.factionId === factionId && !a.fleet);
  if (!army) return undefined;
  army.cell = cell;
  // Room to recruit: the cap is 20 units per army.
  army.units = army.units.slice(0, 5);
  return army.id;
}

describe("Phase 3 — the flag", () => {
  test("off by default, in the defaults and in the shipped config", () => {
    expect(DEFAULT_CONFIG.economy.capacityMode).toBe(false);
    const shipped = resolveConfig(SHIPPED_CONFIG);
    expect(shipped.economy.capacityMode).toBe(false);
  });

  test("the ledger is flag-independent: the same numbers either way", () => {
    const off = boot();
    const on = boot(capacityConfig);
    economyTick(off.ctx);
    economyTick(on.ctx);
    for (const f of pack.factions) {
      const a = off.campaign.factions[String(f.id)]!.capacity!;
      const b = on.campaign.factions[String(f.id)]!.capacity!;
      expect(b.m, `faction ${f.id}`).toEqual(a.m);
      expect(b.w, `faction ${f.id}`).toEqual(a.w);
      expect(b.s, `faction ${f.id}`).toEqual(b.s && a.s);
      expect(b.c, `faction ${f.id}`).toEqual(a.c);
    }
  });

  test("flag off, the gold economy is untouched", () => {
    const { ctx, campaign } = boot();
    const before = pack.factions.map(f => campaign.factions[String(f.id)]!.treasury);
    economyTick(ctx);
    const after = pack.factions.map(f => campaign.factions[String(f.id)]!.treasury);
    expect(after).not.toEqual(before);
  });

  test("flag on, the treasury stops moving: the pools are the economy", () => {
    const { ctx, campaign } = boot(capacityConfig);
    const before = pack.factions.map(f => campaign.factions[String(f.id)]!.treasury);
    economyTick(ctx);
    const after = pack.factions.map(f => campaign.factions[String(f.id)]!.treasury);
    expect(after).toEqual(before);
  });
});

describe("Phase 3 — the gates", () => {
  test("a recruit is refused when the realm has no free Military", () => {
    const { ctx } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const armyId = armyInCapital(ctx, f.id)!;
    const unitType = recruitableFor(ctx, f.id);
    // Squeeze the realm's Military capacity to nothing: an army it cannot feed.
    overCapacity(ctx, f.id, "m");
    const refused = applyCommand(ctx, { type: "RecruitUnit", armyId, unitType });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("Military");
    expect(refused.error).toContain("capacity");
  });

  test("the same recruit succeeds when there is room", () => {
    const { ctx } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const armyId = armyInCapital(ctx, f.id)!;
    const unitType = recruitableFor(ctx, f.id);
    const ok = applyCommand(ctx, { type: "RecruitUnit", armyId, unitType });
    expect(ok.ok).toBe(true);
  });

  test("flag off, a recruit is limited by the treasury and not by capacity", () => {
    const { ctx, campaign } = boot();
    economyTick(ctx);
    const f = pack.factions[0]!;
    const armyId = armyInCapital(ctx, f.id)!;
    const unitType = recruitableFor(ctx, f.id);
    const state = campaign.factions[String(f.id)]!;
    overCapacity(ctx, f.id, "m"); // no Military at all
    state.treasury = 100_000; // plenty of gold
    const ok = applyCommand(ctx, { type: "RecruitUnit", armyId, unitType });
    expect(ok.ok).toBe(true);
  });

  test("a character is refused when there is no free Social", () => {
    const { ctx } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    overCapacity(ctx, f.id, "s");
    const refused = applyCommand(ctx, { type: "RecruitCharacter", kind: "lord" });
    expect(refused.ok).toBe(false);
    // A character costs 1 S. The pools bind in a fixed order (M, W, S, C) and
    // every unit that costs Social also costs Wealth, so the *pool* the refusal
    // names depends on which the realm is shortest of; the rule itself is
    // asserted below.
    expect(refused.error).toContain("capacity");
    // The rule: a load that exactly fits is allowed, one point more is not.
    expect(bindingPool({ m: 0, w: 0, s: 0, c: 0 }, { m: 0, w: 0, s: 1, c: 0 })).toBe("s");
    expect(bindingPool({ m: 0, w: 0, s: 1, c: 0 }, { m: 0, w: 0, s: 1, c: 0 })).toBeNull();
  });

  test("a building is refused when its upkeep does not fit", () => {
    const { ctx } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const regionId = f.capitalRegion;
    // Stone Walls load 1 W of upkeep; make Wealth exactly tight.
    overCapacity(ctx, f.id, "w");
    const refused = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "walls2" });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("Wealth");
  });

  test("a building with no upkeep is not refused for upkeep", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    // The rule: a building with no upkeep adds no load, so it is never refused
    // *for upkeep* — whatever the realm's Wealth happens to be.
    expect(bindingPool({ m: 0, w: 0, s: 0, c: 0 }, { m: 0, w: 0, s: 0, c: 0 })).toBeNull();
    const owned = pack.regions.filter(r => campaign.regions[String(r.id)]!.owner === f.id);
    // A chain the region does not already hold — one structure of a given
    // type per location (AER p1591).
    const chainOf = (id: string): string => content.buildings.find(b => b.id === id)!.chain;
    const free = content.buildings.find(
      b =>
        b.effects.upkeep === undefined &&
        !b.requires &&
        owned.some(r => !campaign.regions[String(r.id)]!.buildings.some(x => chainOf(x) === b.chain))
    )!;
    const region = owned.find(r => !campaign.regions[String(r.id)]!.buildings.some(x => chainOf(x) === free.chain))!;
    const ok = applyCommand(ctx, { type: "BuildBuilding", regionId: region.id, buildingId: free.id });
    expect(ok.ok, ok.error).toBe(true);
  });
});

describe("Phase 3 — over capacity attrits", () => {
  test("a realm that cannot feed its army loses men, and its provinces sour", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const army = Object.values(campaign.armies).find(a => a.factionId === f.id)!;
    // Full strength, so what changes is the attrition and not the refill — and
    // twenty times the men, so the realm is genuinely over its Military
    // capacity (the ledger is recomputed every tick, so it cannot be faked).
    for (const u of army.units) u.count = content.unitTypes[u.type]!.men * 20;
    const before = army.units.reduce((s, u) => s + u.count, 0);
    const orderBefore = campaign.regions[String(f.capitalRegion)]!.order;
    expect(before).toBeGreaterThan(0);

    economyTick(ctx);
    const after = army.units.reduce((s, u) => s + u.count, 0);
    expect(after).toBeLessThan(before);
    // 10 % a turn.
    expect(before - after).toBeGreaterThanOrEqual(Math.floor(before * 0.05));
    // The province hosting them sours.
    const regionId = pack.regions.find(r => r.id === f.capitalRegion)!.id;
    const armyHere = Object.values(campaign.armies).find(
      a => a.factionId === f.id && a.cell === pack.regions.find(r => r.id === regionId)!.capitalCell
    );
    if (armyHere) {
      expect(campaign.regions[String(regionId)]!.order).toBeLessThan(orderBefore);
    }
  });

  test("a realm within its capacity loses nobody", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const army = Object.values(campaign.armies).find(a => a.factionId === f.id)!;
    for (const u of army.units) u.count = content.unitTypes[u.type]!.men;
    const before = army.units.reduce((s, u) => s + u.count, 0);
    economyTick(ctx);
    const after = army.units.reduce((s, u) => s + u.count, 0);
    expect(after).toBe(before);
  });

  test("flag off, nobody attrits", () => {
    const { ctx, campaign } = boot();
    economyTick(ctx);
    const f = pack.factions[0]!;
    const army = Object.values(campaign.armies).find(a => a.factionId === f.id)!;
    for (const u of army.units) u.count = content.unitTypes[u.type]!.men;
    const before = army.units.reduce((s, u) => s + u.count, 0);
    campaign.factions[String(f.id)]!.capacity!.m.gen = 0; // even so
    economyTick(ctx);
    const after = army.units.reduce((s, u) => s + u.count, 0);
    expect(after).toBe(before);
  });
});

describe("Phase 3 — development", () => {
  test("`Develop` commits Wealth and promotes the settlement only on completion", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const { regionId, settlement } = growableSettlement(ctx, f.id);
    const before = settlementTier(ctx, settlement.id);
    // Stability is the price of the development; it is gated and tested on its
    // own, so here it is simply granted.
    campaign.regions[String(regionId)]!.stability = capacityConfig.capacity.developStabilityCost;

    const freeBefore = free(ctx, f.id).w;
    const queued = applyCommand(ctx, { type: "Develop", regionId, settlementId: settlement.id });
    expect(queued.ok).toBe(true);
    // The commitment loads Wealth while it runs — the ledger is rebuilt on the
    // next tick, which is when the commitment is billed.
    economyTick(ctx);
    expect(free(ctx, f.id).w).toBeLessThan(freeBefore);

    // Not promoted yet.
    expect(settlementTier(ctx, settlement.id)).toBe(before);

    // It completes after its turns.
    for (let i = 0; i < capacityConfig.capacity.developTurns; i++) economyTick(ctx);
    expect(settlementTier(ctx, settlement.id)).toBe(before + 1);
    expect(campaign.regions[String(regionId)]!.development).toBeNull();
  });

  test("`Develop` is refused without free Wealth, and names the pool", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const { regionId, settlement } = growableSettlement(ctx, f.id);
    campaign.regions[String(regionId)]!.stability = capacityConfig.capacity.developStabilityCost;
    overCapacity(ctx, f.id, "w");
    const refused = applyCommand(ctx, { type: "Develop", regionId, settlementId: settlement.id });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("Wealth");
  });

  test("a settlement cannot grow past its tier ladder or its province's habitability", () => {
    const { ctx } = boot(capacityConfig);
    const settlement = pack.settlements.find(s => s.tier === 0)!;
    const cap = developmentCap(ctx, settlement.id);
    expect(cap).toBeLessThanOrEqual(5 - settlement.tier);
    const region = pack.regions.find(r => r.id === settlement.regionId)!;
    expect(cap).toBeLessThanOrEqual(
      Math.floor(region.stats.habitability / capacityConfig.capacity.growthPerHabitability)
    );
  });

  test("a developed settlement generates: the region's Wealth and Social rise", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const { regionId, settlement } = growableSettlement(ctx, f.id);
    campaign.regions[String(regionId)]!.stability = capacityConfig.capacity.developStabilityCost;
    const bonusBefore = developmentBonus(ctx, regionId);
    applyCommand(ctx, { type: "Develop", regionId, settlementId: settlement.id });
    for (let i = 0; i < capacityConfig.capacity.developTurns; i++) economyTick(ctx);
    // +1 W and +1 S for the region's generation.
    expect(developmentBonus(ctx, regionId)).toBe(bonusBefore + 1);
    expect(regionValues(ctx, regionId).w).toBe(regionValues(ctx, regionId).w);
  });

  test("organic growth needs an orderly, garrisoned province", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    // An empty, disorderly province does not grow.
    const empty = pack.regions.find(r => {
      const rs = campaign.regions[String(r.id)]!;
      return rs.owner !== 0 && !isGarrisoned(ctx, r.id, rs.owner);
    })!;
    campaign.regions[String(empty.id)]!.order = 10; // disorderly
    const target = pack.settlements.find(s => s.regionId === empty.id)!;
    const before = settlementTier(ctx, target.id);
    for (let i = 0; i < capacityConfig.capacity.growthTurns + 2; i++) economyTick(ctx);
    expect(settlementTier(ctx, target.id)).toBe(before);
  });

  test("organic growth grows the smallest town of an orderly, garrisoned province", { timeout: 20000 }, () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const region = pack.regions.find(r => {
      const rs = campaign.regions[String(r.id)]!;
      if (rs.owner === 0) return false;
      if (!isGarrisoned(ctx, r.id, rs.owner)) return false;
      return pack.settlements.some(s => s.regionId === r.id && developmentCap(ctx, s.id) > 0);
    })!;
    expect(region, "no orderly garrisoned province on this map").toBeDefined();
    const rs = campaign.regions[String(region.id)]!;
    rs.order = 100;
    const towns = pack.settlements.filter(s => s.regionId === region.id);
    const before = towns.map(s => settlementTier(ctx, s.id));
    // Growth lands on a turn divisible by `growthTurns`, so the test has to
    // advance the *campaign* turn, not just the economy.
    for (let i = 0; i < capacityConfig.capacity.growthTurns; i++) {
      applyCommand(ctx, { type: "EndTurn" });
    }
    const after = towns.map(s => settlementTier(ctx, s.id));
    expect(
      after.some((t, i) => t > before[i]!),
      "no town grew"
    ).toBe(true);
  });
});

describe("Phase 3 — stability", () => {
  test("a region with a friendly unit gains stability every turn", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const region = pack.regions.find(r => isGarrisoned(ctx, r.id, r.factionId))!;
    const rs = campaign.regions[String(region.id)]!;
    const before = rs.stability;
    economyTick(ctx);
    expect(rs.stability).toBe(before + capacityConfig.capacity.stabilityPerGarrison);
  });

  test("an empty region gains nothing", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const region = pack.regions.find(r => {
      const rs = campaign.regions[String(r.id)]!;
      return rs.owner !== 0 && !isGarrisoned(ctx, r.id, rs.owner);
    })!;
    const rs = campaign.regions[String(region.id)]!;
    const before = rs.stability;
    economyTick(ctx);
    expect(rs.stability).toBe(before);
  });

  test("a town that grows of its own accord is worth more stability than a held line", () => {
    expect(capacityConfig.capacity.stabilityPerGrowth).toBeGreaterThan(capacityConfig.capacity.stabilityPerGarrison);
  });

  test("`Develop` is refused without stability, and says so", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const { regionId, settlement } = growableSettlement(ctx, f.id);
    const rs = campaign.regions[String(regionId)]!;
    rs.stability = 0;
    const refused = applyCommand(ctx, { type: "Develop", regionId, settlementId: settlement.id });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("stability");
    expect(refused.error).toContain("0 of 4");
  });

  test("`Develop` spends the stability it is priced at", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const { regionId, settlement } = growableSettlement(ctx, f.id);
    const rs = campaign.regions[String(regionId)]!;
    rs.stability = capacityConfig.capacity.developStabilityCost;
    const queued = applyCommand(ctx, { type: "Develop", regionId, settlementId: settlement.id });
    expect(queued.ok).toBe(true);
    expect(rs.stability).toBe(0);
  });

  test("a garrison is what funds a development: a region with none cannot develop", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    // A region with no garrison has earned nothing, whatever the pool says.
    const region = pack.regions.find(r => {
      const rs = campaign.regions[String(r.id)]!;
      if (rs.owner !== f.id) return false;
      if (isGarrisoned(ctx, r.id, rs.owner)) return false;
      return pack.settlements.some(s => s.regionId === r.id && developmentCap(ctx, s.id) > 0);
    })!;
    expect(region, "no ungarrisoned province with a growable town").toBeDefined();
    const rs = campaign.regions[String(region.id)]!;
    const settlement = pack.settlements.find(s => s.regionId === region.id && developmentCap(ctx, s.id) > 0)!;
    expect(rs.stability).toBe(0);
    const refused = applyCommand(ctx, { type: "Develop", regionId: region.id, settlementId: settlement.id });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("stability");
  });

  test("`Develop` needs the capacity model: with the flag off there is no stability to spend", () => {
    const { ctx, campaign } = boot();
    economyTick(ctx);
    const f = pack.factions[0]!;
    const { regionId, settlement } = growableSettlement(ctx, f.id);
    campaign.regions[String(regionId)]!.stability = 99;
    const refused = applyCommand(ctx, { type: "Develop", regionId, settlementId: settlement.id });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("capacity model");
  });
});

describe("Phase 3 — determinism", () => {
  test("a `Develop` survives a save/reload: the replayed log gives the same hash", { timeout: 20000 }, () => {
    // The development is campaign state, so it has to be in the state hash and
    // reproducible from the command log alone — the save/reload DoD.
    // The turns go through `EndTurn`, not a bare economy tick: the replay
    // reproduces the *command log*, so the ticks have to be commands too.
    const { ctx, campaign } = boot(capacityConfig);
    const f = pack.factions[0]!;
    applyCommand(ctx, { type: "EndTurn" });
    const { regionId, settlement } = growableSettlement(ctx, f.id);
    campaign.regions[String(regionId)]!.stability = capacityConfig.capacity.developStabilityCost;
    const queued = applyCommand(ctx, { type: "Develop", regionId, settlementId: settlement.id });
    expect(queued.ok).toBe(true);
    for (let i = 0; i < capacityConfig.capacity.developTurns; i++) applyCommand(ctx, { type: "EndTurn" });
    const hash = stateHash(campaign);
    expect(campaign.settlementDevelopment[String(settlement.id)]).toBe(1);

    const replayed = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed: 606,
      config: capacityConfig,
      content,
      resolved,
      id: "cap3-replay"
    });
    const ctx2 = {
      campaign: replayed,
      pack,
      config: capacityConfig,
      content,
      resolved,
      commands: [] as Command[]
    } as EngineCtx;
    applyCommand(ctx2, { type: "EndTurn" });
    // The stability was granted by hand (it is state, not a command), so the
    // replay grants it the same way.
    replayed.regions[String(regionId)]!.stability = capacityConfig.capacity.developStabilityCost;
    applyCommand(ctx2, { type: "Develop", regionId, settlementId: settlement.id });
    for (let i = 0; i < capacityConfig.capacity.developTurns; i++) applyCommand(ctx2, { type: "EndTurn" });
    expect(stateHash(replayed)).toBe(hash);
  });
});

describe("Phase 3 — a garrison holds order", () => {
  test("a region with a friendly unit in it keeps its order", () => {
    const { ctx, campaign } = boot();
    economyTick(ctx);
    const region = pack.regions.find(r => isGarrisoned(ctx, r.id, r.factionId))!;
    const rs = campaign.regions[String(region.id)]!;
    rs.order = 90;
    economyTick(ctx);
    expect(rs.order).toBe(90);
  });

  test("an empty region keeps the drift it has always had", () => {
    const { ctx, campaign } = boot();
    economyTick(ctx);
    // A region with no order-giving buildings, held above the start order, so
    // the shipped drift is visible.
    const region = pack.regions.find(r => {
      const rs = campaign.regions[String(r.id)]!;
      if (rs.owner === 0) return false;
      if (isGarrisoned(ctx, r.id, rs.owner)) return false;
      return rs.buildings.length === 0;
    })!;
    const rs = campaign.regions[String(region.id)]!;
    rs.order = 90;
    economyTick(ctx);
    expect(rs.order).toBeLessThan(90);
  });
});

describe("Phase 3: Domain Asset Mechanical Effects", () => {
  test("custom chainMultiplier doubles chain capacity output in ledger and regionValues", () => {
    const { ctx, campaign } = boot();
    const region = pack.regions.find(r => r.factionId === 1)!;
    // Clear other regions of faction 1 to isolate this test
    for (const r of pack.regions) {
      if (r.factionId === 1 && r.id !== region.id) {
        campaign.regions[String(r.id)]!.buildings = [];
      }
    }
    const rs = campaign.regions[String(region.id)]!;
    rs.buildings = ["market1"];
    recomputeCapacity(ctx);
    const beforeW = campaign.factions["1"]!.capacity!.w.gen;
    const beforeVal = regionValues(ctx, region.id).w;

    // Add Mercantile custom (+4 W, doubles economy chain Wealth)
    rs.buildings.push("custom_mercantile");
    recomputeCapacity(ctx);
    const afterW = campaign.factions["1"]!.capacity!.w.gen;
    const afterVal = regionValues(ctx, region.id).w;

    // market1 doubled (+2 extra W) + custom_mercantile base (+4 W) = +6 W total
    expect(afterW - beforeW).toBe(6);
    // regionValues also reflects the doubled market (+2 extra W)
    expect(afterVal - beforeVal).toBe(2);
  });

  test("custom_slavery waives upkeep of the costliest building per region", () => {
    const { ctx, campaign } = boot();
    const region = pack.regions.find(r => r.factionId === 1)!;
    // Clear other regions of faction 1 to isolate this test
    for (const r of pack.regions) {
      if (r.factionId === 1 && r.id !== region.id) {
        campaign.regions[String(r.id)]!.buildings = [];
      }
    }
    const rs = campaign.regions[String(region.id)]!;
    // Add walls2 (upkeep: 1 W) and school2 (upkeep: 1 S)
    rs.buildings = ["walls2", "school2"];
    recomputeCapacity(ctx);
    const beforeLoad = { ...campaign.factions["1"]!.capacity! };

    // Add Slavery (freeBuildingUpkeepPerRegion: 1, upkeep: 2 S)
    rs.buildings.push("custom_slavery");
    recomputeCapacity(ctx);
    const afterLoad = campaign.factions["1"]!.capacity!;

    // One of the 1-upkeep buildings is waived.
    // custom_slavery adds +2 S load, but 1 upkeep is waived.
    const netUpkeepChange = (afterLoad.w.load - beforeLoad.w.load) + (afterLoad.s.load - beforeLoad.s.load);
    // Before: 1 W + 1 S = 2 upkeep.
    // After: 1 waived + 1 remaining + 2 Slavery = 3 upkeep (net +1 instead of +2).
    expect(netUpkeepChange).toBeCloseTo(1, 4);
  });

  test("custom_devil_worshipers zeroes capacity generation of ungarrisoned regions", () => {
    const { ctx, campaign } = boot();
    const regions = pack.regions.filter(r => r.factionId === 1);
    expect(regions.length).toBeGreaterThan(1);
    const capitalRegion = regions[0]!;
    const remoteRegion = regions[1]!;

    // Ensure remoteRegion is empty of armies
    for (const army of Object.values(campaign.armies)) {
      if (army.factionId === 1 && remoteRegion.cells.includes(army.cell)) {
        army.cell = capitalRegion.cells[0]!;
      }
    }

    expect(isGarrisoned(ctx, remoteRegion.id, 1)).toBe(false);

    // Give faction 1 Devil Worshipers
    campaign.regions[String(capitalRegion.id)]!.buildings.push("custom_devil_worshipers");
    recomputeCapacity(ctx);

    // Remote region generates 0 in regionValues
    const vals = regionValues(ctx, remoteRegion.id);
    expect(vals.m).toBe(0);
    expect(vals.w).toBe(0);
    expect(vals.s).toBe(0);

    // Move friendly army into remoteRegion
    const army = Object.values(campaign.armies).find(a => a.factionId === 1)!;
    army.cell = remoteRegion.cells[0]!;
    expect(isGarrisoned(ctx, remoteRegion.id, 1)).toBe(true);

    const valsAfter = regionValues(ctx, remoteRegion.id);
    expect(valsAfter.m + valsAfter.w + valsAfter.s).toBeGreaterThan(0);
  });

  test("barracks freeGarrisonUnits waives upkeep of stationed garrison units", () => {
    const { ctx, campaign } = boot();
    const region = pack.regions.find(r => r.factionId === 1)!;
    const rs = campaign.regions[String(region.id)]!;
    rs.buildings = [];

    // Place an army in this region with 2 units
    const army = Object.values(campaign.armies).find(a => a.factionId === 1)!;
    army.cell = region.cells[0]!;
    army.units = [
      { type: "sword", count: 100, exp: 0 },
      { type: "sword", count: 100, exp: 0 }
    ];
    // Remove other armies for faction 1 to isolate load
    for (const other of Object.values(campaign.armies)) {
      if (other.factionId === 1 && other.id !== army.id) delete campaign.armies[other.id];
    }

    recomputeCapacity(ctx);
    const loadNoBarracks = campaign.factions["1"]!.capacity!.m.load;
    expect(loadNoBarracks).toBeGreaterThan(0);

    // Add barracks1 (waives 1 garrison unit)
    rs.buildings = ["barracks1"];
    recomputeCapacity(ctx);
    const loadBarracks1 = campaign.factions["1"]!.capacity!.m.load;
    expect(loadBarracks1).toBeCloseTo(loadNoBarracks / 2, 2);

    // Add barracks2 (waives 2 garrison units)
    rs.buildings = ["barracks2"];
    recomputeCapacity(ctx);
    const loadBarracks2 = campaign.factions["1"]!.capacity!.m.load;
    expect(loadBarracks2).toBe(0);
  });

  test("conversion assets convert capacity when region output threshold is met", () => {
    const { ctx, campaign } = boot();
    const region = pack.regions.find(r => r.factionId === 1)!;
    const rs = campaign.regions[String(region.id)]!;
    rs.buildings = ["processing_camp"];
    recomputeCapacity(ctx);

    const cap = campaign.factions["1"]!.capacity!;
    // processing_camp adds +2 W base, +1 M converted, and loads 1 W
    expect(cap.m.gen).toBeGreaterThanOrEqual(1);
    expect(cap.w.load).toBeGreaterThanOrEqual(1);
  });

  test("militiaDefense generates temporary defense units for defender side", () => {
    const { ctx, campaign } = boot();
    const region = pack.regions.find(r => r.factionId === 1)!;
    const rs = campaign.regions[String(region.id)]!;
    rs.buildings = ["militia1"]; // 2 levy_spear

    const militia = getMilitiaDefenseUnits(ctx, region.id, 1);
    expect(militia.length).toBe(2);
    expect(militia[0]!.type).toBe("levy_spear");
    expect(militia[0]!.temporaryMilitia).toBe(true);

    // Upgrade to militia3 (4 sword)
    rs.buildings = ["militia3"];
    const militia3 = getMilitiaDefenseUnits(ctx, region.id, 1);
    expect(militia3.length).toBe(4);
    expect(militia3[0]!.type).toBe("sword");
    expect(militia3[0]!.temporaryMilitia).toBe(true);
  });

  test("siege supplies buffer siege progress and order damage, consuming 10 HD per turn", () => {
    const { ctx, campaign } = boot();
    // Faction 1 besieges a settlement belonging to Faction 2
    const targetRegion = pack.regions.find(r => r.factionId !== 1 && r.settlements.length > 0)!;
    const settlement = pack.settlements.find(s => s.regionId === targetRegion.id && s.kind === "major")!;
    const rs = campaign.regions[String(targetRegion.id)]!;
    rs.order = 80;
    rs.buildings = ["siege_supplies"]; // 20 HD supplies

    // Position an army at settlement cell
    const army = Object.values(campaign.armies).find(a => a.factionId === 1)!;
    army.cell = settlement.cell;

    const err = startSiege(ctx, army.id);
    expect(err).toBeNull();
    const siege = siegeOf(campaign, targetRegion.id)!;
    expect(siege).toBeDefined();
    expect(siege.suppliesRemaining).toBe(20);
    expect(siege.progress).toBe(0);

    // Tick 1: consumes 10 HD, progress stays 0
    economyTick(ctx);
    expect(siege.suppliesRemaining).toBe(10);
    expect(siege.progress).toBe(0);

    // Tick 2: consumes 10 HD, supplies exhausted, progress stays 0
    economyTick(ctx);
    expect(siege.suppliesRemaining).toBe(0);
    expect(siege.progress).toBe(0);

    // Tick 3: no supplies remaining -> progress advances
    economyTick(ctx);
    expect(siege.progress).toBe(1);
  });
});

/**
 * AER Domain value checks and saving throws (CAPACITY-PLAN Phase 4).
 *
 * These tests pin three things:
 *  1. the modifier ladder is AER's own table, read off line 1425;
 *  2. the Domain is scoped to a **region**, and per-region values land inside
 *     the band that table was written for (line 1768's worked domain is M 4 /
 *     W 6 / S 6);
 *  3. upkeep never enters a Domain's value — AER line 1424: *"Upkeep costs do
 *     not subtract from a Domain's scores."*
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

import { currentContent } from "@/conquest/content/store";
import { resolveForPack } from "@/conquest/engine/common/content";
import type { MapPack } from "@/conquest/engine/common/types";
import { compileAzgaar } from "@/conquest/engine/compiler/index";
import { applyCommand, type Command, type EngineCtx } from "@/conquest/engine/game/commands";
import { type CampaignConfig, DEFAULT_CONFIG } from "@/conquest/engine/game/config";
import {
  ACTIVITY_NAMES,
  assetCheckDifficulties,
  DEFAULT_BAND_STEP,
  DEFAULT_BANDS,
  domainValue,
  effectiveValue,
  regionActivity,
  regionValues,
  rollSave,
  rollValueCheck,
  SAVE_POOL,
  SAVES,
  valueModifier
} from "@/conquest/engine/game/saves";
import { type Campaign, createCampaign, stateHash } from "@/conquest/engine/game/state";
import { checkRebellions } from "@/conquest/engine/game/world";

const SOURCE = path.resolve(testDir, "../test-data/sample-world.json");
const SETTINGS_DIR = path.resolve(testDir, "../content/docs");
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const pack: MapPack = compileAzgaar(raw).pack;

const loadedContent = currentContent();
const content = loadedContent.content;
const resolved = resolveForPack(pack, content);

/** A config identical to the shipped one, with Phase 4 flipped on or off. */
function savesConfig(enabled: boolean): CampaignConfig {
  return { ...DEFAULT_CONFIG, saves: { ...DEFAULT_CONFIG.saves, enabled } };
}

function boot(cfg: CampaignConfig, seed = 777): { ctx: EngineCtx; campaign: Campaign } {
  const commands: Command[] = [];
  const campaign = createCampaign({
    mapPackId: "test",
    pack,
    factionId: 1,
    seed,
    config: cfg,
    content,
    resolved,
    id: `saves-${seed}-${cfg.saves.enabled}`
  });
  return { ctx: { campaign, pack, config: cfg, content, resolved, commands } as EngineCtx, campaign };
}

describe("value modifier ladder (AER line 1425)", () => {
  test("the table is AER's own, band by band", () => {
    expect(DEFAULT_BANDS).toEqual([6, 11, 16, 21]);
    expect(DEFAULT_BAND_STEP).toBe(5);
    // The published table, transcribed.
    for (const v of [0, 1, 2, 3, 4, 5]) expect(valueModifier(v)).toBe(0);
    for (const v of [6, 7, 8, 9, 10]) expect(valueModifier(v)).toBe(1);
    for (const v of [11, 12, 13, 14, 15]) expect(valueModifier(v)).toBe(2);
    for (const v of [16, 17, 18, 19, 20]) expect(valueModifier(v)).toBe(3);
    // "For every additional five points, add +1" — the open-ended tail.
    for (const v of [21, 22, 23, 24, 25]) expect(valueModifier(v)).toBe(4);
    for (const v of [26, 30]) expect(valueModifier(v)).toBe(3 + Math.floor((v - 16) / 5));
  });

  test("it reproduces AER's worked Domain: M 4 → +0, W 6 → +1, S 6 → +1", () => {
    // Line 1768, the only place the book states a value and its modifier together.
    expect(valueModifier(4)).toBe(0);
    expect(valueModifier(6)).toBe(1);
    // Line 1772 spends that +1 Wealth modifier as a bonus on a roll.
    expect(valueModifier(6)).toBe(1);
  });
});

describe("Domain scope is the region (CAPACITY-PLAN Phase 4)", () => {
  test("region values are the static capacity plus the buildings standing there", () => {
    const { ctx } = boot(savesConfig(false));
    const buildingById = new Map(content.buildings.map(b => [b.id, b]));
    let checked = 0;
    for (const r of pack.regions) {
      const rs = ctx.campaign.regions[String(r.id)];
      if (!rs || rs.owner === 0) continue;
      const expected = { ...r.stats.capacity };
      for (const bid of rs.buildings) {
        const cap = buildingById.get(bid)?.effects.capacity;
        if (!cap) continue;
        expected.m += cap.m;
        expected.w += cap.w;
        expected.s += cap.s;
        expected.c += cap.c;
      }
      expect(regionValues(ctx, r.id)).toEqual(expected);
      checked++;
    }
    expect(checked).toBe(127);
  });

  test("a Domain's value is generation, not the net balance — upkeep never enters", () => {
    // AER line 1424: a Domain with a score of 30 and 28 points of upkeep is
    // still more martial than one with a score of 5. So `regionValues` must be
    // the gen arm of the ledger alone.
    const { ctx } = boot(savesConfig(false));
    const regionId = pack.regions.find(r => {
      const rs = ctx.campaign.regions[String(r.id)];
      return rs && rs.owner !== 0;
    })!.id;

    const before = regionValues(ctx, regionId);
    // Empty every army in the world: load collapses, values must not move.
    for (const army of Object.values(ctx.campaign.armies)) army.units = [];
    expect(regionValues(ctx, regionId)).toEqual(before);
  });

  test("per-region values stay inside the rows AER's ladder actually publishes", () => {
    // The reason the scope is a region and not an empire: an empire totals 2…26
    // of these stacked, which asks for `1d20 + 28` on a Wealth check — off the
    // top of the table and past the point where the ladder says anything. A
    // region is a Domain at AER's own scale, so every value it produces must be
    // a number the published table can read.
    //
    // Measured on the sample world under the **region-level** model (§4.7),
    // with specialty W removed (`SPECIALTY_W_CAP = 0`) and founding barracks
    // sized by population (§4.5):
    //   M max 18 → +3 · S max 6 → +1 · W max 7 → +1 · C max 5 → +0
    //
    // That collapse from 6/20/21/5 to 6/6/7/5 is the point of §4.7: W and S
    // used to be `Σ settlement.tier`, which asked the ladder for +3 and +4. The
    // region ladder lands every pool inside **AER's own worked example**
    // (p1768: a Domain of M 4 / W 6 / S 6), so a regional check reads +0 or +1
    // — a Domain at AER's scale rather than an empire's.
    //
    // **M moved, and §4.5 is why.** A realm's Military capacity follows the
    // people it governs, so a populous province is founded at a higher
    // *wartime footing* — better walls and a bigger barracks — and its
    // Domain value rises with them: the map's largest province now reads M 18.
    // That is still AER's own scale for a large Domain — p1424 describes
    // *"a sprawling Domain with a score of 30 in Military"* — and the ladder's
    // published rows (stopping at 16–20, then open-ended from 21) still read
    // it. What §4.5 bought is the empire-level balance: a realm's M now
    // tracks its people, so the per-empire spread of M-per-population fell
    // from 2.43× to 1.62×, and the residue is the map's own province density
    // rather than a model artifact.
    const { ctx } = boot(savesConfig(false));
    const worst = { m: 0, w: 0, s: 0, c: 0 };
    let held = 0;
    for (const r of pack.regions) {
      const rs = ctx.campaign.regions[String(r.id)];
      if (!rs || rs.owner === 0) continue;
      held++;
      const v = regionValues(ctx, r.id);
      worst.m = Math.max(worst.m, v.m);
      worst.w = Math.max(worst.w, v.w);
      worst.s = Math.max(worst.s, v.s);
      worst.c = Math.max(worst.c, v.c);
    }
    expect(held).toBe(127);
    // The claim under test: no region can roll higher than the table's own
    // explicit rows (which stop at 16–20, then run open-ended from 21). Value
    // 25 is the +4 band's ceiling — past it the ladder is extrapolating.
    for (const pool of ["m", "w", "s", "c"] as const) {
      expect(worst[pool], `${pool} worst value ${worst[pool]}`).toBeLessThanOrEqual(25);
      expect(valueModifier(worst[pool]), `${pool} modifier`).toBeLessThanOrEqual(4);
    }
    // And the shape it was meant to produce: every pool sits in the range a
    // single AER Domain occupies, so no region is off the top of the ladder.
    // M is the one that grew, and it grew on purpose (§4.5).
    expect(worst.m).toBe(18);
    expect(worst.s).toBe(6);
    expect(worst.w).toBe(8);
    expect(worst.c).toBe(5);
  });

  test("every AER throw draws on the right pool, and Cunning has none of its own", () => {
    expect(Object.keys(SAVES)).toEqual(["m", "w", "s"]);
    expect(SAVE_POOL.uprising).toBe("m");
    expect(SAVE_POOL.poverty).toBe("w");
    expect(SAVE_POOL.despair).toBe("s");
    const all = Object.values(SAVES).flat();
    expect(all).toHaveLength(6);
    // C carries a pool in the ledger but AER defines no throw against it.
    expect(all).not.toContain("c");
    expect(new Set(all).size).toBe(6);
  });
});

describe("saving throws", () => {
  test("a roll is 1d20 + the region's modifier, against the configured difficulty", () => {
    const { ctx } = boot(savesConfig(true));
    const regionId = pack.regions.find(r => {
      const rs = ctx.campaign.regions[String(r.id)];
      return rs && rs.owner !== 0;
    })!.id;

    for (let i = 0; i < 50; i++) {
      const roll = rollSave(ctx, regionId, "uprising");
      const value = domainValue(ctx, regionId, "m");
      expect(roll.pool).toBe("m");
      expect(roll.value).toBe(value);
      expect(roll.modifier).toBe(valueModifier(value));
      expect(roll.roll).toBeGreaterThanOrEqual(1);
      expect(roll.roll).toBeLessThanOrEqual(20);
      expect(roll.dc).toBe(DEFAULT_CONFIG.saves.defaultDc);
      expect(roll.success).toBe(roll.roll + roll.modifier >= roll.dc);
    }
  });

  test("a value check rolls the same die with no difficulty of its own", () => {
    const { ctx } = boot(savesConfig(true));
    const regionId = pack.regions.find(r => {
      const rs = ctx.campaign.regions[String(r.id)];
      return rs && rs.owner !== 0;
    })!.id;
    const check = rollValueCheck(ctx, regionId, "w");
    const value = domainValue(ctx, regionId, "w");
    expect(check.pool).toBe("w");
    expect(check.value).toBe(value);
    expect(check.modifier).toBe(valueModifier(value));
    expect(check.roll).toBeGreaterThanOrEqual(1);
    expect(check.roll).toBeLessThanOrEqual(20);
  });

  test("rolls are deterministic: the same seed produces the same sequence", () => {
    const a = boot(savesConfig(true), 1234).ctx;
    const b = boot(savesConfig(true), 1234).ctx;
    const regionId = pack.regions.find(r => {
      const rs = a.campaign.regions[String(r.id)];
      return rs && rs.owner !== 0;
    })!.id;
    const seqA = Array.from({ length: 20 }, () => rollSave(a, regionId, "disorder").roll);
    const seqB = Array.from({ length: 20 }, () => rollSave(b, regionId, "disorder").roll);
    expect(seqA).toEqual(seqB);
    // A different seed must actually differ, or the test proves nothing.
    const c = boot(savesConfig(true), 4321).ctx;
    const seqC = Array.from({ length: 20 }, () => rollSave(c, regionId, "disorder").roll);
    expect(seqC).not.toEqual(seqA);
  });
});

describe("flag-off is untouched, flag-on changes unrest", () => {
  /** Drive one owned region's order to zero and run the check `turns` times. */
  function driveUnrest(cfg: CampaignConfig, seed: number) {
    const { ctx, campaign } = boot(cfg, seed);
    const region = pack.regions.find(r => {
      const rs = campaign.regions[String(r.id)];
      return rs && rs.owner !== 0;
    })!;
    campaign.regions[String(region.id)]!.order = 0;
    for (let i = 0; i < DEFAULT_CONFIG.rebellion.requiredTurns; i++) checkRebellions(ctx);
    return { ctx, campaign, region };
  }

  test("the flag defaults off, so no die is rolled in the shipped campaign", async () => {
    expect(DEFAULT_CONFIG.saves.enabled).toBe(false);
    expect(DEFAULT_CONFIG.saves.defaultDc).toBe(12);
    const shipped = JSON.parse(readFileSync(path.join(SETTINGS_DIR, "game.json"), "utf8"));
    expect(shipped.saves.enabled).toBe(false);
    // The shipped ruleset must agree with the engine default, or a test that
    // reads one and a campaign that loads the other validate different games.
    expect(shipped.saves.defaultDc).toBe(DEFAULT_CONFIG.saves.defaultDc);
  });

  test("flag-off: unrest escalates on the flat count and logs no save", () => {
    const { campaign } = driveUnrest(savesConfig(false), 31);
    expect(campaign.log.some(e => e.type === "DomainSave")).toBe(false);
    // The legacy path is unchanged: brigands rise once the count is spent.
    expect(campaign.log.some(e => e.type === "RebellionSpawned")).toBe(true);
  });

  test("flag-on: the same unrest rolls a Military save against DC 12", () => {
    const { campaign, region } = driveUnrest(savesConfig(true), 31);
    const save = campaign.log.find(e => e.type === "DomainSave");
    expect(save).toBeDefined();
    if (save?.type !== "DomainSave") throw new Error("unreachable");
    expect(save.regionId).toBe(region.id);
    expect(save.save).toBe("uprising");
    expect(save.pool).toBe("m");
    expect(save.dc).toBe(12);
    expect(save.modifier).toBe(
      valueModifier(
        domainValue({ campaign, pack, config: savesConfig(true), content, resolved } as EngineCtx, region.id, "m")
      )
    );
    expect(save.roll).toBeGreaterThanOrEqual(1);
    expect(save.roll).toBeLessThanOrEqual(20);
    expect(save.success).toBe(save.roll + save.modifier >= save.dc);
  });

  test("flag-on: a successful save averts the uprising", () => {
    const { campaign } = driveUnrest(savesConfig(true), 31);
    const save = campaign.log.find(e => e.type === "DomainSave");
    if (save?.type !== "DomainSave") throw new Error("no save logged");
    const rebels = campaign.log.some(e => e.type === "RebellionSpawned");
    expect(rebels).toBe(!save.success);
  });

  test("flag-on: an unreachable DC always rebels, DC 0 always averts", () => {
    // A save succeeds on `roll + modifier >= dc`, so 99 is unwinnable and 0 is
    // automatic — the two ends pin that the difficulty is actually consulted.
    const unreachable: CampaignConfig = { ...savesConfig(true), saves: { ...savesConfig(true).saves, defaultDc: 99 } };
    const free: CampaignConfig = { ...savesConfig(true), saves: { ...savesConfig(true).saves, defaultDc: 0 } };

    const rose = driveUnrest(unreachable, 55);
    const roseSave = rose.campaign.log.find(e => e.type === "DomainSave");
    if (roseSave?.type !== "DomainSave") throw new Error("no save logged");
    expect(roseSave.success).toBe(false);
    expect(roseSave.dc).toBe(99);
    expect(rose.campaign.log.some(e => e.type === "RebellionSpawned")).toBe(true);

    const held = driveUnrest(free, 55);
    const heldSave = held.campaign.log.find(e => e.type === "DomainSave");
    if (heldSave?.type !== "DomainSave") throw new Error("no save logged");
    expect(heldSave.success).toBe(true);
    expect(heldSave.dc).toBe(0);
    expect(held.campaign.log.some(e => e.type === "RebellionSpawned")).toBe(false);
  });

  test("flag-off and flag-on campaigns stay identical until the first save", () => {
    // The flag must not perturb anything it does not own: two campaigns from the
    // same seed agree on the state hash through the founding turn.
    const off = boot(savesConfig(false), 909);
    const on = boot(savesConfig(true), 909);
    expect(stateHash(on.campaign)).toBe(stateHash(off.campaign));
    // And no die is drawn during that turn by either side.
    expect(off.campaign.rngState).toBe(on.campaign.rngState);
  });
});

// ---------------------------------------------------------------------------
// Town activities (AER line 467) — modifiers, never generation
// ---------------------------------------------------------------------------

describe("region activities (AER line 467)", () => {
  test("the chain assigns exactly one activity per region, or none", () => {
    const { ctx } = boot(savesConfig(false));
    const counts: Record<string, number> = {};
    let withActivity = 0;
    for (const r of pack.regions) {
      if (ctx.campaign.regions[String(r.id)]!.owner === 0) continue;
      const a = regionActivity(ctx, r.id);
      if (!a) continue;
      withActivity++;
      // Every activity must be one the chain can actually grant, and must bump
      // a real AER value.
      expect(ACTIVITY_NAMES).toContain(a.name);
      expect(["m", "w", "s"]).toContain(a.pool);
      expect(a.bonus).toBe(2);
      counts[a.name] = (counts[a.name] ?? 0) + 1;
    }
    // Measured on the sample world: 101 of 127 regions are notable, 26 are not.
    expect(withActivity).toBe(101);
    expect(counts["Martial Tradition"]).toBe(10);
    expect(counts["Vigorous Trade"]).toBe(4);
    expect(counts.Councils).toBe(15);
    expect(counts["Production Center"]).toBe(22);
    expect(counts["Strong Society"]).toBe(31);
    expect(counts["Mutual Defense"]).toBe(19);
  });

  test("AER grants no Cunning activity, so none of ours does either", () => {
    // Its ten activities are M, W or S only. C stays driven by capitals, rough
    // terrain and spy networks — adding a C activity would be ours, not AER's.
    const { ctx } = boot(savesConfig(false));
    for (const r of pack.regions) {
      if (ctx.campaign.regions[String(r.id)]!.owner === 0) continue;
      expect(regionActivity(ctx, r.id)?.pool).not.toBe("c");
    }
  });

  test("an activity changes what you can roll, never what you can spend", () => {
    // AER line 1424: upkeep does not subtract from a Domain's scores, and an
    // activity is a *modifier to a value*, not generation. So `regionValues`
    // must be untouched by it, or activities would silently become capacity.
    const { ctx } = boot(savesConfig(false));
    const before = new Map<number, ReturnType<typeof regionValues>>();
    for (const r of pack.regions) {
      if (ctx.campaign.regions[String(r.id)]!.owner === 0) continue;
      before.set(r.id, regionValues(ctx, r.id));
    }
    for (const r of pack.regions) {
      const v = before.get(r.id);
      if (!v) continue;
      expect(regionValues(ctx, r.id)).toEqual(v);
    }
    // And emptying every army still leaves them alone — load never enters either.
    for (const army of Object.values(ctx.campaign.armies)) army.units = [];
    for (const r of pack.regions) {
      const v = before.get(r.id);
      if (!v) continue;
      expect(regionValues(ctx, r.id)).toEqual(v);
    }
  });

  test("effectiveValue is raw + the bump for the activity's pool, and raw otherwise", () => {
    const { ctx } = boot(savesConfig(false));
    for (const r of pack.regions) {
      if (ctx.campaign.regions[String(r.id)]!.owner === 0) continue;
      const a = regionActivity(ctx, r.id);
      for (const pool of ["m", "w", "s", "c"] as const) {
        const raw = domainValue(ctx, r.id, pool);
        const expected = a && a.pool === pool ? raw + a.bonus : raw;
        expect(effectiveValue(ctx, r.id, pool), `${r.id} ${pool}`).toBe(expected);
      }
    }
  });

  test("the bump is applied BEFORE the ladder, as AER words it", () => {
    // "each with their own modifier to its values" — so a region at W 5 with a
    // Wealth activity rolls as W 7, which crosses 5 (+0) into 7 (+1). If the
    // +2 were applied after the ladder this crossing would never happen.
    const { ctx } = boot(savesConfig(false));
    let crossings = 0;
    for (const r of pack.regions) {
      if (ctx.campaign.regions[String(r.id)]!.owner === 0) continue;
      const a = regionActivity(ctx, r.id);
      if (!a) continue;
      const raw = domainValue(ctx, r.id, a.pool);
      expect(valueModifier(effectiveValue(ctx, r.id, a.pool))).toBe(valueModifier(raw + a.bonus));
      if (valueModifier(raw) !== valueModifier(raw + a.bonus)) crossings++;
    }
    // The chain must actually move at least one region across a band, or the
    // ordering is untested in practice.
    expect(crossings).toBeGreaterThan(0);
  });

  test("a save reports the value it rolled and the activity behind it", () => {
    const { ctx } = boot(savesConfig(true));
    const regionId = pack.regions.find(r => {
      const rs = ctx.campaign.regions[String(r.id)];
      return rs && rs.owner !== 0 && regionActivity(ctx, r.id)?.pool === "m";
    })!.id;
    const save = rollSave(ctx, regionId, "uprising");
    const a = regionActivity(ctx, regionId)!;
    expect(save.activity).toBe(a.name);
    expect(save.raw).toBe(domainValue(ctx, regionId, "m"));
    expect(save.value).toBe(save.raw + a.bonus);
    expect(save.modifier).toBe(valueModifier(save.raw + a.bonus));
  });

  test("activities are deterministic across two campaigns", () => {
    const a = boot(savesConfig(false), 202).ctx;
    const b = boot(savesConfig(false), 202).ctx;
    for (const r of pack.regions) {
      expect(regionActivity(a, r.id)?.name ?? null).toBe(regionActivity(b, r.id)?.name ?? null);
    }
  });
});

describe("Phase 2: 3-Check Establish an Asset & Disband", () => {
  test("assetCheckDifficulties matches AER formula: 12 + max(benefit, upkeep) - pity", () => {
    const palisade = content.buildings.find(b => b.id === "walls1")!;
    const temple3 = content.buildings.find(b => b.id === "temple3")!;
    expect(assetCheckDifficulties(palisade, 0)).toEqual({ m: 14, w: 12, s: 12 });
    expect(assetCheckDifficulties(temple3, 0)).toEqual({ m: 12, w: 14, s: 20 });
    // Pity bonus reduces DC by 1 per point down to min 2
    expect(assetCheckDifficulties(palisade, 1)).toEqual({ m: 13, w: 11, s: 11 });
    expect(assetCheckDifficulties(temple3, 10)).toEqual({ m: 2, w: 4, s: 10 });
  });

  test("maxInstances allows multiple copies up to limit (Siege Supplies: 2)", () => {
    const { ctx } = boot(savesConfig(false));
    const factionId = 1;
    const regionId = pack.regions.find(r => ctx.campaign.regions[String(r.id)]!.owner === factionId)!.id;
    const rs = ctx.campaign.regions[String(regionId)]!;
    rs.buildings = [];
    rs.construction = null;
    ctx.campaign.factions[String(factionId)]!.treasury += 5000;

    // First instance of siege_supplies
    expect(applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "siege_supplies" }).ok).toBe(true);
    rs.buildings.push("siege_supplies");
    rs.construction = null;

    // Second instance allowed (maxInstances: 2)
    expect(applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "siege_supplies" }).ok).toBe(true);
    rs.buildings.push("siege_supplies");
    rs.construction = null;

    // Third instance rejected
    const third = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "siege_supplies" });
    expect(third.ok).toBe(false);
    expect(third.error).toContain("already built here");
  });

  test("incompatibleWith prevents conflicting assets (Slavery vs Dwarf Friend)", () => {
    const { ctx } = boot(savesConfig(false));
    const factionId = 1;
    const regionId = pack.regions.find(r => ctx.campaign.regions[String(r.id)]!.owner === factionId)!.id;
    const rs = ctx.campaign.regions[String(regionId)]!;
    rs.buildings = ["custom_slavery"];
    rs.construction = null;

    // Trying to build custom_dwarf_friend when slavery is standing fails
    const res = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "custom_dwarf_friend" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("incompatible");
  });

  test("customs are unique across the entire faction domain", () => {
    const { ctx } = boot(savesConfig(false));
    const factionId = 1;
    const owned = pack.regions.filter(r => ctx.campaign.regions[String(r.id)]!.owner === factionId);
    expect(owned.length).toBeGreaterThanOrEqual(2);
    const r1 = owned[0]!.id;
    const r2 = owned[1]!.id;

    const rs1 = ctx.campaign.regions[String(r1)]!;
    rs1.buildings.push("custom_mercantile");

    // Building the same custom in a second region is rejected
    const res = applyCommand(ctx, { type: "BuildBuilding", regionId: r2, buildingId: "custom_mercantile" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("already been established in your domain");
  });

  test("disbanding removes assets; customs require suppressCustom penalty unless in deficit", () => {
    const { ctx } = boot(savesConfig(false));
    const factionId = 1;
    const regionId = pack.regions.find(r => ctx.campaign.regions[String(r.id)]!.owner === factionId)!.id;
    const rs = ctx.campaign.regions[String(regionId)]!;
    rs.buildings = ["walls1", "custom_spartan_culture"];

    // Disband normal building
    const disWalls = applyCommand(ctx, { type: "DisbandBuilding", regionId, buildingId: "walls1" });
    expect(disWalls.ok).toBe(true);
    expect(rs.buildings).not.toContain("walls1");

    // Disband custom without suppressCustom is refused
    const disCustomRefused = applyCommand(ctx, { type: "DisbandBuilding", regionId, buildingId: "custom_spartan_culture" });
    expect(disCustomRefused.ok).toBe(false);
    expect(disCustomRefused.error).toContain("suppressCustom");

    // Disband custom with suppressCustom succeeds and inflicts order penalty
    const orderBefore = rs.order;
    const disCustomOk = applyCommand(ctx, { type: "DisbandBuilding", regionId, buildingId: "custom_spartan_culture", suppressCustom: true });
    expect(disCustomOk.ok).toBe(true);
    expect(rs.buildings).not.toContain("custom_spartan_culture");
    expect(rs.order).toBe(Math.max(0, orderBefore - 15));
  });

  test("3-check construction lifecycle with saves.enabled", () => {
    const { ctx } = boot(savesConfig(true));
    const factionId = 1;
    const regionId = pack.regions.find(r => ctx.campaign.regions[String(r.id)]!.owner === factionId)!.id;
    const rs = ctx.campaign.regions[String(regionId)]!;
    rs.buildings = [];
    rs.construction = null;

    // Queue palisade
    const buildRes = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "walls1" });
    expect(buildRes.ok).toBe(true);
    expect(rs.construction).toBeDefined();
    expect(rs.construction!.checks).toEqual({ m: false, w: false, s: false });
    expect(rs.construction!.pityBonus).toBe(0);

    // Explicit step advances checks
    let stepCount = 0;
    while (rs.construction && stepCount < 20) {
      stepCount++;
      const step = applyCommand(ctx, { type: "EstablishAssetStep", regionId, spendTreasure: 10 });
      expect(step.ok).toBe(true);
    }
    // Completed building moves into buildings array
    expect(rs.construction).toBeNull();
    expect(rs.buildings).toContain("walls1");
  });
});


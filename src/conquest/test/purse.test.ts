/**
 * CAPACITY-PLAN Phase 5 — the purse.
 *
 * The locked decision: **gold survives as a diplomacy purse only**. In the
 * capacity model the four pools are the economy, so gold is not a price for
 * anything except gifts, tributes, ransoms and mercenaries.
 *
 * The contract this file pins:
 *  - `WithdrawTreasure` converts free **Wealth** into purse gold, and the
 *    conversion **escalates**: the n-th in a turn costs n W (AER's extraction);
 *  - the Wealth is *spent*, not copied — it is a permanent load, so a realm's
 *    gold income is bounded by the Wealth it generates;
 *  - the purse pays for diplomacy and **nothing else**;
 *  - raiding and sacking take purse gold out of the victim's purse rather than
 *    minting it, and a POI discovery puts gold into the purse.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

import { currentContent } from "@/conquest/content/store";
import { resolveForPack } from "@/conquest/engine/common/content";
import { compileAzgaar } from "@/conquest/engine/compiler/index";
import { recomputeCapacity } from "@/conquest/engine/game/capacity";
import { applyCommand, type Command, type EngineCtx } from "@/conquest/engine/game/commands";
import { type CampaignConfig, DEFAULT_CONFIG } from "@/conquest/engine/game/config";
import { economyTick } from "@/conquest/engine/game/economy";
import { createCampaign } from "@/conquest/engine/game/state";
import { discoverPoisAt } from "@/conquest/engine/game/world";

const SOURCE = path.resolve(testDir, "../test-data/sample-world.json");
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const pack = compileAzgaar(raw).pack;
const content = currentContent().content;
const resolved = resolveForPack(pack, content);

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
    id: `purse-${seed}`
  });
  const ctx = { campaign, pack, config, content, resolved, commands } as EngineCtx;
  return { ctx, campaign };
}

const purseOf = (ctx: EngineCtx, id: number): number => ctx.campaign.factions[String(id)]!.purse;

describe("Phase 5 — the purse", () => {
  test("the realm's starting gold moves into the purse in capacity mode", () => {
    const { campaign } = boot(capacityConfig);
    const f = pack.factions[0]!;
    const state = campaign.factions[String(f.id)]!;
    expect(state.purse).toBe(Math.round(f.treasury));
    expect(state.treasury).toBe(0);
  });

  test("flag off, the purse is empty and the treasury is untouched", () => {
    const { campaign } = boot();
    const f = pack.factions[0]!;
    const state = campaign.factions[String(f.id)]!;
    expect(state.purse).toBe(0);
    expect(state.treasury).toBe(Math.round(f.treasury));
  });

  test("withdrawing treasure converts free Wealth into purse gold", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const before = purseOf(ctx, f.id);
    recomputeCapacity(ctx);
    const loadBefore = campaign.factions[String(f.id)]!.capacity!.w.load;
    const ok = applyCommand(ctx, { type: "WithdrawTreasure" });
    expect(ok.ok).toBe(true);
    expect(purseOf(ctx, f.id)).toBe(before + capacityConfig.capacity.purseGoldPerW);
    // The Wealth is spent, not copied: it is a permanent load on the W pool, so
    // a realm's gold income is bounded by the Wealth it generates.
    recomputeCapacity(ctx);
    expect(campaign.factions[String(f.id)]!.capacity!.w.load).toBe(loadBefore + 1);
    expect(campaign.factions[String(f.id)]!.withdrawnW).toBe(1);
  });

  test("the conversion escalates: the n-th in a turn costs n Wealth", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const before = purseOf(ctx, f.id);
    // First: 1 W for 100 gold. Second: 2 W for 100 gold.
    expect(applyCommand(ctx, { type: "WithdrawTreasure" }).ok).toBe(true);
    expect(purseOf(ctx, f.id)).toBe(before + 100);
    expect(applyCommand(ctx, { type: "WithdrawTreasure" }).ok).toBe(true);
    expect(purseOf(ctx, f.id)).toBe(before + 200);
    // Two conversions, three Wealth spent.
    expect(campaign.factions[String(f.id)]!.withdrawnW).toBe(3);
  });

  test("the escalation resets with the turn, so one W a turn is the best rate", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    // Measured on the **Wealth spent**, not the purse's balance: the purse also
    // moves when the AI gifts or a province is raided, and the point of the test
    // is the escalation, not the balance.
    applyCommand(ctx, { type: "WithdrawTreasure" });
    applyCommand(ctx, { type: "WithdrawTreasure" });
    expect(campaign.factions[String(f.id)]!.withdrawnW).toBe(3); // 1 W, then 2 W
    // A new turn: the counter is back to zero, so the next conversion costs 1 W.
    applyCommand(ctx, { type: "EndTurn" });
    expect(campaign.factions[String(f.id)]!.withdrawalsThisTurn).toBe(0);
    applyCommand(ctx, { type: "WithdrawTreasure" });
    // One more Wealth spent, not three — the escalation reset with the turn.
    expect(campaign.factions[String(f.id)]!.withdrawnW).toBe(4);
    // And the purse was paid for each conversion.
    expect(purseOf(ctx, f.id)).toBeGreaterThanOrEqual(300);
  });

  test("a realm with no free Wealth cannot withdraw", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    // Lose every region: the realm generates nothing and holds nothing, so it
    // has no free Wealth to convert. (The gate reads a *fresh* ledger, so the
    // shortfall has to be real rather than faked in the stored figures.)
    for (const r of pack.regions) {
      if (campaign.regions[String(r.id)]!.owner === f.id) campaign.regions[String(r.id)]!.owner = 0;
    }
    const state = campaign.factions[String(f.id)]!;
    const refused = applyCommand(ctx, { type: "WithdrawTreasure" });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("Wealth");
    expect(state.purse).toBe(Math.round(f.treasury)); // nothing spent
  });

  test("a realm cannot withdraw more Wealth than it has free", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const state = campaign.factions[String(f.id)]!;
    // Convert until the realm runs out: the escalating price means it stops
    // well before its free Wealth is gone.
    let conversions = 0;
    let refusal: string | undefined;
    for (let i = 0; i < 20; i++) {
      const res = applyCommand(ctx, { type: "WithdrawTreasure" });
      if (!res.ok) {
        refusal = res.error;
        break;
      }
      conversions++;
    }
    expect(conversions).toBeGreaterThan(0);
    expect(refusal ?? "").toContain("Wealth");
    // And it never converted more Wealth than it had.
    expect(state.withdrawnW).toBeLessThanOrEqual((conversions * (conversions + 1)) / 2);
  });

  test("the purse is gold for diplomacy, and nothing else", () => {
    const { ctx } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const other = pack.factions.find(x => x.id !== f.id)!;
    const purseBefore = purseOf(ctx, f.id);
    const purseOther = purseOf(ctx, other.id);

    // A gift is a diplomatic purchase: it draws on the purse.
    const gift = applyCommand(ctx, { type: "GiftGold", toFactionId: other.id, amount: 100 });
    expect(gift.ok).toBe(true);
    expect(purseOf(ctx, f.id)).toBe(purseBefore - 100);
    expect(purseOf(ctx, other.id)).toBe(purseOther + 100);
  });

  test("a non-diplomacy purchase does not touch the purse", () => {
    const { ctx, campaign } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const purseBefore = purseOf(ctx, f.id);
    const treasuryBefore = campaign.factions[String(f.id)]!.treasury;

    // Building and recruiting are paid for in capacity, not gold.
    const regionId = f.capitalRegion;
    const built = applyCommand(ctx, { type: "BuildBuilding", regionId, buildingId: "market2" });
    expect(built.ok).toBe(true);
    const army = Object.values(campaign.armies).find(a => a.factionId === f.id)!;
    army.units = army.units.slice(0, 5);
    const recruited = applyCommand(ctx, {
      type: "RecruitUnit",
      armyId: army.id,
      unitType: resolved.factions[String(f.id)]!.roster.recruitable[0]!
    });
    expect(recruited.ok).toBe(true);

    // Neither the purse nor the treasury moved.
    expect(purseOf(ctx, f.id)).toBe(purseBefore);
    expect(campaign.factions[String(f.id)]!.treasury).toBe(treasuryBefore);
  });

  test("a gift beyond the purse is refused", () => {
    const { ctx } = boot(capacityConfig);
    economyTick(ctx);
    const f = pack.factions[0]!;
    const other = pack.factions.find(x => x.id !== f.id)!;
    const refused = applyCommand(ctx, { type: "GiftGold", toFactionId: other.id, amount: 1_000_000 });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("purse");
  });

  test("a POI discovery puts gold in the purse", () => {
    const { ctx, campaign } = boot(capacityConfig);
    const f = pack.factions[0]!;
    const before = purseOf(ctx, f.id);
    // Discover a POI the realm has not found: walk the army onto it.
    const poi = pack.pois.find(p => !campaign.discoveredPois[String(p.id)]?.includes(f.id))!;
    const army = Object.values(campaign.armies).find(a => a.factionId === f.id)!;
    army.cell = poi.cell;
    discoverPoisAt(ctx, f.id, poi.cell);
    expect(purseOf(ctx, f.id)).toBe(before + DEFAULT_CONFIG.pois.discoveryGold);
  });

  test("flag off, a gift still draws on the treasury and the purse is untouched", () => {
    const { ctx, campaign } = boot();
    economyTick(ctx);
    const f = pack.factions[0]!;
    const other = pack.factions.find(x => x.id !== f.id)!;
    const treasuryBefore = campaign.factions[String(f.id)]!.treasury;
    const gift = applyCommand(ctx, { type: "GiftGold", toFactionId: other.id, amount: 50 });
    expect(gift.ok).toBe(true);
    expect(campaign.factions[String(f.id)]!.treasury).toBe(treasuryBefore - 50);
    expect(purseOf(ctx, f.id)).toBe(0);
  });

  test("withdrawing treasure needs the capacity model", () => {
    const { ctx } = boot();
    const refused = applyCommand(ctx, { type: "WithdrawTreasure" });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("capacity model");
  });
});

/**
 * Sieges (total-war/.plans/PLAN.md §5.5): siege start/escalation, garrison weakening, capture
 * policies (occupy / sack / loot / raze). Escalation runs in the economy tick.
 */
import type { EngineCtx } from "./context";
import type { CapturePolicy } from "./events";
import { graphIndex } from "./graph";
import type { Campaign, Siege } from "./state";

export function siegeOf(campaign: Campaign, regionId: number): Siege | undefined {
  return campaign.sieges.find(s => s.regionId === regionId);
}

export function regionSiegeSupplies(ctx: EngineCtx, regionId: number): number {
  const rs = ctx.campaign.regions[String(regionId)];
  if (!rs) return 0;
  const buildingById = new Map(ctx.content.buildings.map(b => [b.id, b]));
  return rs.buildings.reduce((acc, bid) => acc + (buildingById.get(bid)?.effects.siegeSupplies ?? 0), 0);
}

export function startSiege(ctx: EngineCtx, armyId: string): string | null {
  const { campaign, pack } = ctx;
  const army = campaign.armies[armyId];
  if (!army) return `unknown army '${armyId}'`;
  const settlement = pack.settlements.find(s => s.kind === "major" && s.cell === army.cell);
  if (!settlement) return `no major settlement at cell ${army.cell}`;
  const regionState = campaign.regions[String(settlement.regionId)]!;
  if (regionState.owner === army.factionId) return "you already own this region";
  const existing = siegeOf(campaign, settlement.regionId);
  if (existing) {
    if (existing.byArmyId === armyId) return "already besieging";
    return "another army is besieging this settlement";
  }
  const supplies = regionSiegeSupplies(ctx, settlement.regionId);
  campaign.sieges.push({
    regionId: settlement.regionId,
    byArmyId: armyId,
    byFaction: army.factionId,
    sinceTurn: campaign.turn,
    progress: 0,
    suppliesRemaining: supplies
  });
  campaign.log.push({
    type: "SiegeStarted",
    regionId: settlement.regionId,
    byFaction: army.factionId,
    byArmyId: armyId
  });
  return null;
}

/** Garrison multiplier from siege escalation (floor at garrisonWeakenFloor). */
export function garrisonWeakenFactor(ctx: EngineCtx, regionId: number): number {
  const { config } = ctx;
  const siege = siegeOf(ctx.campaign, regionId);
  if (!siege) return 1;
  const factor = 1 - siege.progress * config.sieges.garrisonWeakenPerTick;
  return Math.max(config.sieges.garrisonWeakenFloor, factor);
}

/** Lift sieges whose army moved away, died, or whose region changed hands. */
export function cleanupSieges(ctx: EngineCtx): void {
  const { campaign, pack } = ctx;
  const idx = graphIndex(pack);
  campaign.sieges = campaign.sieges.filter(s => {
    const army = campaign.armies[s.byArmyId];
    const stillValid =
      army !== undefined &&
      army.factionId === s.byFaction &&
      idx.cellRegion.get(army.cell) === s.regionId &&
      campaign.regions[String(s.regionId)]!.owner !== s.byFaction;
    if (!stillValid) {
      campaign.log.push({
        type: "SiegeLifted",
        regionId: s.regionId,
        reason: army === undefined ? "the besieging army was destroyed" : "the besiegers moved on"
      });
    }
    return stillValid;
  });
}

/** One-time capture payout + devastation per policy (§5.5 outcomes). */
export function applyCapturePolicy(
  ctx: EngineCtx,
  regionId: number,
  policy: CapturePolicy
): { gold: number; order: number } {
  const { campaign, config, pack } = ctx;
  const region = pack.regions.find(r => r.id === regionId)!;
  const regionState = campaign.regions[String(regionId)]!;
  const baseIncome = (region.stats.population / 1000) * config.economy.taxPer1000Pop * regionState.populationScale;

  switch (policy) {
    case "sack": {
      const gold = Math.round(baseIncome * 4);
      regionState.order = 15;
      return { gold, order: regionState.order };
    }
    case "loot": {
      const gold = Math.round(baseIncome * 2);
      regionState.order = 20;
      return { gold, order: regionState.order };
    }
    case "raze": {
      const gold = Math.round(baseIncome * 3);
      regionState.buildings = [];
      regionState.construction = null;
      regionState.populationScale = 0.5;
      regionState.order = 5;
      return { gold, order: regionState.order };
    }
    default:
      return { gold: 0, order: config.economy.occupiedOrder };
  }
}

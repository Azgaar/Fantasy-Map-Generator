/**
 * Victory + elimination evaluation (total-war/.plans/PLAN.md §5.10): per-faction victory sets
 * from the content pack (faction YAML → culture binding → default).
 */

import type { VictoryObjective } from "../common/content";
import type { EngineCtx } from "./context";

export function checkElimination(ctx: EngineCtx, factionId: number): void {
  const { campaign } = ctx;
  const state = campaign.factions[String(factionId)];
  if (!state?.alive) return;
  const hasRegions = Object.values(campaign.regions).some(r => r.owner === factionId);
  const hasArmies = Object.values(campaign.armies).some(a => a.factionId === factionId);
  if (!hasRegions && !hasArmies) {
    state.alive = false;
    state.eliminatedOnTurn = campaign.turn;
    campaign.wars = campaign.wars.filter(w => !w.between.includes(factionId));
    campaign.log.push({ type: "FactionEliminated", factionId });
  }
}

function objectiveSatisfied(ctx: EngineCtx, factionId: number, obj: VictoryObjective): boolean {
  const { campaign, pack } = ctx;
  const held = Object.values(campaign.regions).filter(r => r.owner === factionId).length;
  switch (obj.type) {
    case "controlRegions":
      if (obj.count !== undefined) return held >= obj.count;
      return held >= Math.ceil(pack.regions.length * (obj.fraction ?? 1));
    case "eliminateFactions":
      // A faction can never be required to eliminate itself.
      return obj.factions.every(fid => fid === factionId || campaign.factions[String(fid)]?.alive === false);
    case "holdCapitals": {
      const ownedCapitals = pack.factions.filter(
        f => campaign.regions[String(f.capitalRegion)]?.owner === factionId
      ).length;
      return ownedCapitals >= obj.count;
    }
  }
}

export function evaluateVictory(ctx: EngineCtx, factionId: number): boolean {
  const state = ctx.campaign.factions[String(factionId)];
  if (!state?.alive) return false;
  const set = ctx.content.victory[state.victorySetId];
  if (!set) {
    // Content gap: fall back to the engine default fraction (§ game.yaml victory).
    const held = Object.values(ctx.campaign.regions).filter(r => r.owner === factionId).length;
    return held >= Math.ceil(ctx.pack.regions.length * ctx.config.victory.regionFraction);
  }
  return set.objectives.every(o => objectiveSatisfied(ctx, factionId, o));
}

export function checkVictory(ctx: EngineCtx): void {
  const { campaign, pack } = ctx;
  if (campaign.status !== "active") return;
  for (const f of pack.factions) {
    if (evaluateVictory(ctx, f.id)) {
      campaign.status = "finished";
      campaign.victor = f.id;
      const held = Object.values(campaign.regions).filter(r => r.owner === f.id).length;
      const setName = campaign.factions[String(f.id)]!.victorySetId;
      campaign.log.push({
        type: "VictoryAchieved",
        factionId: f.id,
        regions: held,
        reason: `${setName} (holds ${held}/${pack.regions.length} regions)`
      });
      return;
    }
  }
}

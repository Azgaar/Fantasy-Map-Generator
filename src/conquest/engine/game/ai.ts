/**
 * Campaign AI (total-war/.plans/PLAN.md §5.11, Phase 4): utility-based strategy with threat
 * evaluation, focused offensives, an income budget shared across military,
 * construction and research; reliability-aware AI-to-AI diplomacy with
 * defensive call-to-arms; war exhaustion bending peace decisions; and opt-in
 * rationale logging (campaign.aiRationale) for replay debugging.
 *
 * Deterministic: faction/army iteration in stable id order, all chance through
 * the campaign PRNG, and the AI drives the same rule cores the player uses.
 */

import { armyPower } from "./battle";
import { developmentCap, freeCapacity, regionDevelopment, settlementDevelopment } from "./capacity";
import { aiBuild, aiDevelop, aiGift, aiRecruitCharacter, aiResearch, applyCommand } from "./commands";
import type { Command } from "./commandTypes";
import type { EngineCtx } from "./context";
import { declareWarCore, offerTreaty, warExhaustion } from "./diplomacy";
import { graphIndex, regionDistance } from "./graph";
import { findPath } from "./movement";
import { siegeOf } from "./sieges";
import { BRIGAND_FACTION, isPlayerFaction, rng } from "./state";
import { garrisonUnits, minorGarrisonUnits } from "./units";

export function enemiesOf(campaign: import("./state").Campaign, factionId: number): Set<number> {
  const set = new Set<number>();
  for (const w of campaign.wars) {
    if (w.between[0] === factionId) set.add(w.between[1]!);
    if (w.between[1] === factionId) set.add(w.between[0]!);
  }
  return set;
}

export function atWar(campaign: import("./state").Campaign, a: number, b: number): boolean {
  // Brigands are hostile to everyone by definition.
  if (a === BRIGAND_FACTION || b === BRIGAND_FACTION) return true;
  return enemiesOf(campaign, a).has(b);
}

/** Opt-in AI decision logging (replay debugging, total-war/.plans/PLAN.md Phase 4). */
function rationale(ctx: EngineCtx, factionId: number, decision: string, detail: string): void {
  if (!ctx.campaign.aiRationale) return;
  ctx.campaign.log.push({ type: "AiRationale", factionId, decision, detail });
}

/** Men under arms — the AI's strength currency. */
function menOf(ctx: EngineCtx, factionId: number): number {
  return Object.values(ctx.campaign.armies)
    .filter(a => a.factionId === factionId)
    .reduce((s, a) => s + a.units.reduce((x, u) => x + u.count, 0), 0);
}

// ---------------------------------------------------------------------------
// Threat evaluation + defense
// ---------------------------------------------------------------------------

interface Threat {
  armyId: string;
  factionId: number;
  cell: number;
  men: number;
  steps: number;
}

/** Enemy armies within `defenseRadius` region steps of any owned region. */
function threats(ctx: EngineCtx, factionId: number): Threat[] {
  const { campaign, pack, config } = ctx;
  const idx = graphIndex(pack);
  const owned = Object.values(campaign.regions)
    .filter(r => r.owner === factionId)
    .map(r => r.id);

  // Multi-source BFS from all owned regions, bounded by the defense radius.
  const dist = new Map<number, number>(owned.map(id => [id, 0]));
  let frontier = [...owned];
  for (let depth = 1; depth <= config.ai.defenseRadius; depth++) {
    const next: number[] = [];
    for (const regionId of frontier) {
      for (const n of idx.regionAdjacency.get(regionId) ?? []) {
        if (!dist.has(n)) {
          dist.set(n, depth);
          next.push(n);
        }
      }
    }
    frontier = next;
  }

  const out: Threat[] = [];
  for (const army of Object.values(campaign.armies)) {
    if (army.factionId === factionId) continue;
    if (!atWar(campaign, factionId, army.factionId)) continue;
    const armyRegion = idx.cellRegion.get(army.cell) ?? 0;
    const steps = dist.get(armyRegion);
    if (steps === undefined) continue;
    out.push({
      armyId: army.id,
      factionId: army.factionId,
      cell: army.cell,
      men: army.units.reduce((s, u) => s + u.count, 0),
      steps
    });
  }
  return out.sort((a, b) => a.steps - b.steps || b.men - a.men);
}

/** Commit the closest army against the top threat. Returns true if it acted. */
function defend(ctx: EngineCtx, factionId: number, list: Threat[]): boolean {
  const { campaign, pack } = ctx;
  if (list.length === 0) return false;
  const threat = list[0]!;

  const defenders = Object.values(campaign.armies)
    .filter(a => a.factionId === factionId && !a.fleet)
    .sort((a, b) => a.id.localeCompare(b.id));
  const army =
    defenders.find(a => {
      const adjacent = pack.graph.land.edges.some(
        ([x, y]) => (x === a.cell && y === threat.cell) || (y === a.cell && x === threat.cell)
      );
      return adjacent || a.cell === threat.cell;
    }) ?? defenders[0];
  if (!army) return false;

  const adjacent = pack.graph.land.edges.some(
    ([x, y]) => (x === army.cell && y === threat.cell) || (y === army.cell && x === threat.cell)
  );
  if (adjacent || army.cell === threat.cell) {
    const power = armyPower(army.units, ctx.resolved.pack.unitTypes);
    // No heroic suicides: badly outmatched defenders hold position (peace feelers
    // will handle the war's end), unless the odds are merely bad, not hopeless.
    if (army.stance !== "march" && power >= threat.men * 0.3) {
      rationale(
        ctx,
        factionId,
        "defend:attack",
        `${army.id} attacks ${threat.armyId} (${Math.round(power)} power vs ${threat.men} men, ${threat.steps} step${threat.steps === 1 ? "" : "s"} from home)`
      );
      apply(ctx, { type: "AttackArmy", armyId: army.id, targetId: threat.armyId });
      return true;
    }
    rationale(
      ctx,
      factionId,
      "defend:hold",
      `${army.id} holds against ${threat.armyId} — outmatched (${Math.round(power)} power vs ${threat.men} men)`
    );
    return false;
  }
  const path = findPath(pack, ctx.config, army.cell, threat.cell);
  if (path.reachable && path.path.length > 1) {
    rationale(
      ctx,
      factionId,
      "defend:march",
      `${army.id} intercepts ${threat.armyId} (${threat.steps} step${threat.steps === 1 ? "" : "s"} from home)`
    );
    apply(ctx, { type: "MoveArmy", armyId: army.id, path: path.path });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Focused offense
// ---------------------------------------------------------------------------

/** The weakest enemy settlement, scoring garrison + nearby relief forces. */
function focusTarget(
  ctx: EngineCtx,
  _factionId: number,
  enemies: Set<number>
): { cell: number; regionId: number; score: number } | null {
  const { campaign, pack, resolved, config } = ctx;
  const idx = graphIndex(pack);
  const types = resolved.pack.unitTypes;
  let best: { cell: number; regionId: number; score: number } | null = null;

  for (const s of pack.settlements) {
    if (s.kind !== "major") continue;
    const owner = campaign.regions[String(s.regionId)]?.owner ?? 0;
    if (!enemies.has(owner)) continue;
    const garrison = armyPower(garrisonUnits(resolved.factions[String(owner)]!.roster, types, s.walls), types);
    let relief = 0;
    for (const army of Object.values(campaign.armies)) {
      if (!enemies.has(army.factionId) || army.fleet) continue;
      const steps = regionDistance(idx, s.regionId, idx.cellRegion.get(army.cell) ?? 0);
      if (steps <= 2) relief += armyPower(army.units, types);
    }
    const score = garrison * (1 + s.walls * config.battle.wallBonusPerTier) + relief * 0.5;
    if (!best || score < best.score || (score === best.score && s.regionId < best.regionId)) {
      best = { cell: s.cell, regionId: s.regionId, score };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Faction turn
// ---------------------------------------------------------------------------

/** AI turn for every living non-player faction, in ascending id order. */
export function runAi(ctx: EngineCtx): void {
  const { campaign, pack } = ctx;

  for (const f of pack.factions) {
    if (isPlayerFaction(campaign, f.id, ctx.resolved)) continue;
    const state = campaign.factions[String(f.id)]!;
    if (!state.alive || campaign.status !== "active") continue;
    const enemies = enemiesOf(campaign, f.id);
    const aiType = ctx.resolved?.factions[String(f.id)]?.aiType ?? "balanced";
    if (enemies.size === 0) {
      peaceTime(ctx, f.id, f.expansionism, aiType);
    } else {
      actAtWar(ctx, f.id, enemies);
    }
    manageCharacters(ctx, f.id);
  }
}

function actAtWar(ctx: EngineCtx, factionId: number, enemies: Set<number>): void {
  const { campaign, pack, config, resolved } = ctx;
  const types = resolved.pack.unitTypes;

  // 1. Defense first: intercept invaders near home. Committed armies skip offense.
  const list = threats(ctx, factionId);
  const defended = defend(ctx, factionId, list);

  // 2. Peace feelers run EVERY turn (desperation/exhaustion end wars — Phase 4).
  const myMen = menOf(ctx, factionId);
  for (const enemy of [...enemies].sort((a, b) => a - b)) {
    const enemyState = campaign.factions[String(enemy)]!;
    if (!enemyState.alive) continue;
    const theirMen = Math.max(1, menOf(ctx, enemy));
    const ratio = myMen / theirMen;
    const exhaustion = warExhaustion(ctx, factionId, enemy);
    const desperate = ratio < 0.4;
    const weary = exhaustion >= 0.5 && ratio < 0.8 && rng(campaign) < 0.5;
    if (desperate || weary) {
      // CAPACITY-PLAN Phase 5/6: the purse buys peace. A realm that would
      // rather pay than fight offers a tribute with its peace — which is what
      // the purse is for, and the reason a realm hoards one.
      const tribute = config.economy.capacityMode
        ? Math.min(300, Math.floor(campaign.factions[String(factionId)]!.purse))
        : 0;
      rationale(
        ctx,
        factionId,
        "peace:offer",
        `sues ${enemy} for peace (strength ratio ${ratio.toFixed(2)}, exhaustion ${exhaustion.toFixed(2)}${
          tribute > 0 ? `, ${tribute} gold tribute` : ""
        })`
      );
      offerTreaty(ctx, factionId, enemy, "peace", tribute > 0 ? tribute : undefined);
    }
  }

  // 3. Focused offense with the armies that didn't spend the turn defending.
  if (defended) return;
  const focus = focusTarget(ctx, factionId, enemies);
  const settlementsByCell = new Map<number, import("../common/types").Settlement>();
  for (const s of pack.settlements) {
    settlementsByCell.set(s.cell, s);
  }

  const armies = Object.values(campaign.armies)
    .filter(a => a.factionId === factionId && !a.fleet)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const army of armies) {
    if (!campaign.armies[army.id] || campaign.status !== "active") continue;

    // Opportunistic attack on adjacent enemies.
    const adjacent = pack.graph.land.edges
      .filter(e => e[0] === army.cell || e[1] === army.cell)
      .map(e => (e[0] === army.cell ? e[1]! : e[0]!));
    const enemyArmy = Object.values(campaign.armies)
      .filter(a => enemies.has(a.factionId) && adjacent.includes(a.cell))
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    if (enemyArmy && armyPower(army.units, types) > armyPower(enemyArmy.units, types) * 1.15) {
      apply(ctx, { type: "AttackArmy", armyId: army.id, targetId: enemyArmy.id });
      continue;
    }

    // On an enemy settlement: assault when strong or siege-worn, else besiege (major).
    const settlement = settlementsByCell.get(army.cell);
    const regionState = settlement ? campaign.regions[String(settlement.regionId)] : undefined;
    const regionOwner = regionState?.owner ?? 0;
    if (settlement && enemies.has(regionOwner)) {
      const ownerRoster = resolved.factions[String(regionOwner)]!.roster;
      if (settlement.kind === "minor") {
        if (!regionState?.occupiedSettlements?.includes(settlement.id)) {
          const minorGarrison = minorGarrisonUnits(ownerRoster, types, settlement.tier, settlement.walls);
          const garrisonPower =
            armyPower(minorGarrison, types) * (1 + settlement.walls * config.battle.wallBonusPerTier);
          const myPower = armyPower(army.units, types);
          if (myPower > garrisonPower * 1.1) {
            apply(ctx, { type: "AssaultSettlement", armyId: army.id });
            continue;
          }
        }
      } else {
        const siege = siegeOf(campaign, settlement.regionId);
        const weaken = siege
          ? Math.max(config.sieges.garrisonWeakenFloor, 1 - siege.progress * config.sieges.garrisonWeakenPerTick)
          : 1;
        const garrisonPower =
          armyPower(garrisonUnits(ownerRoster, types, settlement.walls), types) *
          (1 + settlement.walls * config.battle.wallBonusPerTier) *
          weaken;
        const myPower = armyPower(army.units, types);
        if (myPower > garrisonPower * 1.4 || (siege?.byArmyId === army.id && siege.progress >= 2)) {
          apply(ctx, { type: "AssaultSettlement", armyId: army.id });
          continue;
        }
        if (!siege) {
          rationale(
            ctx,
            factionId,
            "siege",
            `${army.id} lays siege (garrison ${Math.round(garrisonPower)}, ours ${Math.round(myPower)})`
          );
          apply(ctx, { type: "SiegeSettlement", armyId: army.id });
          continue;
        }
      }
    }

    // March toward the shared focus target.
    if (focus && focus.cell !== army.cell && rng(campaign) < 0.9) {
      const path = findPath(pack, config, army.cell, focus.cell);
      if (path.reachable && path.path.length > 1) {
        apply(ctx, { type: "MoveArmy", armyId: army.id, path: path.path });
        continue;
      }
    }

    // Otherwise raid enemy land, encamp at home.
    const idx = graphIndex(pack);
    const here = idx.cellRegion.get(army.cell) ?? 0;
    const owner = campaign.regions[String(here)]?.owner ?? 0;
    if (enemies.has(owner)) {
      apply(ctx, { type: "SetStance", armyId: army.id, stance: "raid" });
    } else {
      apply(ctx, { type: "SetStance", armyId: army.id, stance: "encamp" });
    }
  }
}

function peaceTime(ctx: EngineCtx, factionId: number, expansionism: number, aiType: string = "balanced"): void {
  const effExpansionism =
    aiType === "aggressive"
      ? Math.max(expansionism, 3)
      : aiType === "defensive"
        ? Math.min(expansionism, 1)
        : expansionism;
  if (aiType === "economic") {
    maybeBuild(ctx, factionId, 1500);
    maybeResearch(ctx, factionId, 3000);
    maybeAiTreaties(ctx, factionId, 0.4);
    maybeRecruit(ctx, factionId, 1200);
    maybeDevelop(ctx, factionId);
    maybeDeclareWar(ctx, factionId, effExpansionism);
  } else if (aiType === "aggressive") {
    maybeRecruit(ctx, factionId, 500);
    maybeBuild(ctx, factionId, 3000);
    maybeDevelop(ctx, factionId);
    maybeResearch(ctx, factionId, 7000);
    maybeAiTreaties(ctx, factionId, 0.1);
    maybeGift(ctx, factionId);
    maybeDeclareWar(ctx, factionId, effExpansionism);
  } else if (aiType === "defensive") {
    maybeRecruit(ctx, factionId, 800);
    maybeBuild(ctx, factionId, 2000);
    maybeDevelop(ctx, factionId);
    maybeResearch(ctx, factionId, 5000);
    maybeAiTreaties(ctx, factionId, 0.3);
    maybeGift(ctx, factionId);
    maybeDeclareWar(ctx, factionId, effExpansionism);
  } else {
    maybeRecruit(ctx, factionId);
    maybeBuild(ctx, factionId);
    maybeDevelop(ctx, factionId);
    maybeResearch(ctx, factionId);
    maybeAiTreaties(ctx, factionId);
    maybeGift(ctx, factionId);
    maybeDeclareWar(ctx, factionId, effExpansionism);
  }
}

// ---------------------------------------------------------------------------
// Budget: military, construction, research (§5.11 balance)
// ---------------------------------------------------------------------------

function maybeRecruit(ctx: EngineCtx, factionId: number, minTreasury: number = 1000): void {
  const { campaign, pack, config, resolved } = ctx;
  const state = campaign.factions[String(factionId)]!;
  if (state.treasury < minTreasury) return;
  const f = pack.factions.find(x => x.id === factionId)!;
  const capitalRegion = campaign.regions[String(f.capitalRegion)];
  if (!capitalRegion || capitalRegion.owner !== factionId) return;
  const idx = graphIndex(pack);
  const army = Object.values(campaign.armies)
    .filter(a => a.factionId === factionId && !a.fleet && idx.cellRegion.get(a.cell) === f.capitalRegion)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!army || army.units.length >= config.military.maxUnitsPerArmy) return;

  // CAPACITY-PLAN Phase 6: in the capacity model the realm's **free capacity**
  // is the budget, and gold is not a price at all. The comparison is an integer
  // one — does this unit fit — and the ledger answers it exactly.
  const capacityMode = config.economy.capacityMode;
  const free = capacityMode ? freeCapacity(ctx, factionId) : null;
  // The old budget guard: projected expenses must stay under the income share
  // (Phase 4), with an emergency allowance when enemies threaten the capital.
  const income = Math.max(1, state.lastIncome);
  const budget = state.lastExpenses + 200 <= income * config.ai.incomeBudgetShare ? config.ai.incomeBudgetShare : 1.15; // emergency: something is at the gates

  const roster = resolved.factions[String(factionId)]!.roster;
  const ofType = (uid: string) => army.units.filter(u => u.type === uid).length;
  for (const uid of roster.recruitable) {
    const type = resolved.pack.unitTypes[uid]!;
    if (roster.caps[uid] !== undefined && ofType(uid) >= roster.caps[uid]!) continue;
    if (capacityMode) {
      // Does the unit fit the realm's free capacity? A unit is a fraction of an
      // AER block, so it loads that fraction of its price.
      const cost = type.capacityCost;
      if (cost) {
        const fits =
          free!.m - cost.m * type.blocks >= 0 &&
          free!.w - cost.w * type.blocks >= 0 &&
          free!.s - cost.s * type.blocks >= 0 &&
          free!.c - cost.c * type.blocks >= 0;
        if (!fits) {
          rationale(
            ctx,
            factionId,
            "capacity:skip",
            `no free capacity for ${uid} (needs ${(cost.m * type.blocks).toFixed(2)} M)`
          );
          return;
        }
      }
    } else {
      if (state.treasury < type.cost) continue;
      const projected = state.lastExpenses + type.upkeep;
      if (projected > income * budget) {
        rationale(
          ctx,
          factionId,
          "budget:skip",
          `recruitment of ${uid} exceeds ${(budget * 100).toFixed(0)}% of income (${income})`
        );
        return;
      }
    }
    apply(ctx, { type: "RecruitUnit", armyId: army.id, unitType: uid });
    return;
  }
}

/** Stable treasury → cheapest constructible building in the capital. */
function maybeBuild(ctx: EngineCtx, factionId: number, minTreasury: number = 2500): void {
  const { campaign, content, pack, config } = ctx;
  const state = campaign.factions[String(factionId)]!;
  if (!config.economy.capacityMode && state.treasury < minTreasury) return;
  const f = pack.factions.find(x => x.id === factionId)!;
  const regionId = f.capitalRegion;
  const rs = campaign.regions[String(regionId)];
  if (!rs || rs.owner !== factionId || rs.construction) return;
  const settlement = pack.settlements.find(s => s.kind === "major" && s.regionId === regionId);
  if (!settlement) return;

  const available = ctx.resolved.factions[String(factionId)]?.buildings ?? content.buildings;
  // CAPACITY-PLAN Phase 6: in the capacity model the budget is free capacity —
  // a building's upkeep is what it loads, and it must fit.
  const free = config.economy.capacityMode ? freeCapacity(ctx, factionId) : null;
  for (const b of available) {
    if (rs.buildings.includes(b.id)) continue;
    // AER p1591: one structure of a given type per location, and an upgrade
    // consumes the lesser asset. So a region that already holds this chain at
    // this tier or higher is not a candidate — the AI must not queue a
    // Palisade beside the Stone Walls that replaced it.
    const sameChain = rs.buildings
      .map(bid => content.buildings.find(x => x.id === bid))
      .find(x => x !== undefined && x.chain === b.chain);
    if (sameChain && sameChain.tier >= b.tier) continue;
    if (b.requires && !rs.buildings.includes(b.requires)) continue;
    if (!b.settlementKinds.includes(settlement.kind)) continue;
    if (config.economy.capacityMode) {
      const up = b.effects.upkeep;
      const fits = !up || (free!.m - up.m >= 0 && free!.w - up.w >= 0 && free!.s - up.s >= 0 && free!.c - up.c >= 0);
      if (!fits) {
        rationale(ctx, factionId, "capacity:skip", `no free capacity for ${b.name} in region ${regionId}`);
        return;
      }
    } else {
      if (state.treasury < b.cost + 500) continue; // keep a war chest
    }
    rationale(ctx, factionId, "build", `${b.name} in region ${regionId} (${b.cost})`);
    aiBuild(ctx, factionId, regionId, b.id);
    return;
  }
}

/**
 * CAPACITY-PLAN Phase 3 — the AI develops a town.
 *
 * A realm with free Wealth can grow a settlement: the commitment holds W for a
 * number of turns and the town rises a tier when it completes. The AI does it
 * only in capacity mode — the gold economy has no such purchase — and only
 * where the province can carry the growth and the realm can pay for it.
 */
function maybeDevelop(ctx: EngineCtx, factionId: number): void {
  const { campaign, pack, config } = ctx;
  if (!config.economy.capacityMode) return;
  const owned = pack.regions.filter(r => campaign.regions[String(r.id)]!.owner === factionId);
  for (const region of owned) {
    const rs = campaign.regions[String(region.id)]!;
    if (rs.development) continue;
    const room = regionDevelopment(ctx, region.id);
    if (room.total >= room.cap) continue;
    // The smallest town first — a hamlet becoming a town is the clearest
    // payoff there is.
    // The price is stability, and the AI checks it before it spends a rationale
    // on an attempt that would be refused.
    if ((rs.stability ?? 0) < config.capacity.developStabilityCost) continue;
    const candidates = region.settlements
      .map(sid => pack.settlements[sid])
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .sort((a, b) => a.tier - b.tier || a.id - b.id);
    for (const s of candidates) {
      if (settlementDevelopment(ctx, s.id) >= developmentCap(ctx, s.id)) continue;
      rationale(ctx, factionId, "develop", `developing ${s.name} in region ${region.id}`);
      aiDevelop(ctx, factionId, region.id, s.id);
      return;
    }
  }
}

function maybeResearch(ctx: EngineCtx, factionId: number, minTreasury: number = 6000): void {
  const { campaign, content, config } = ctx;
  const state = campaign.factions[String(factionId)]!;
  // The tech tree is a gold-era system and every shipped tech is inert in the
  // capacity model, so the AI does not spend a turn on one. Phase 6 re-points it.
  if (config.economy.capacityMode) return;
  if (state.treasury < minTreasury) return;
  const available = ctx.resolved.factions[String(factionId)]?.tech ?? content.tech;
  for (const tech of available) {
    if (state.tech.includes(tech.id)) continue;
    if ((tech.requires ?? []).some(r => !state.tech.includes(r))) continue;
    if (state.treasury < tech.cost) continue;
    rationale(ctx, factionId, "research", tech.name);
    aiResearch(ctx, factionId, tech.id);
    return;
  }
}

// ---------------------------------------------------------------------------
// AI-to-AI diplomacy + expansion (§5.7, Phase 4)
// ---------------------------------------------------------------------------

/** Occasional trade/alliance offers between AI factions, resolved by utility. */
/**
 * CAPACITY-PLAN Phase 5/6: the AI spends its **purse**.
 *
 * Gold survives for diplomacy only, so a gift is the one purchase the AI has a
 * use for: a hundred gold buys relation (`diplomacy.giftRelationPer100` a point
 * per hundred), and relation is what keeps a neighbour from declaring war. So a
 * realm with a full purse and a hostile neighbour buys its way out of a war it
 * cannot afford — which is exactly what the purse is for.
 */
function maybeGift(ctx: EngineCtx, factionId: number): void {
  const { campaign, config, pack } = ctx;
  const state = campaign.factions[String(factionId)];
  if (!state) return;
  // The purse is the capacity model's gold; with the flag off, gold is the
  // *economy* and the AI spending it on gifts would be a change to the shipped
  // game that Phase 6 does not need to make.
  if (!config.economy.capacityMode) return;
  const purse = state.purse;
  if (purse < 100) return;
  if (rng(campaign) > 0.15) return;
  // A realm we are on poor terms with — an enemy, or a neighbour whose
  // relations have soured. Relation is what keeps a war from starting, so it is
  // what gold buys.
  const target = pack.factions
    .filter(o => o.id !== factionId && campaign.factions[String(o.id)]!.alive)
    .map(o => ({ o, rel: campaign.relations[String(factionId)]?.[String(o.id)] ?? 0 }))
    .filter(x => x.rel < 0)
    .sort((a, b) => a.rel - b.rel)[0];
  if (!target) return;
  const amount = Math.min(Math.floor(purse), 300);
  if (amount < 100) return;
  rationale(ctx, factionId, "diplomacy:gift", `gifts ${amount} gold to ${target.o.name} (relations ${target.rel})`);
  aiGift(ctx, factionId, target.o.id, amount);
}

function maybeAiTreaties(ctx: EngineCtx, factionId: number, chanceThreshold: number = 0.2): void {
  const { campaign, pack } = ctx;
  if (rng(campaign) > chanceThreshold) return;
  const idx = graphIndex(pack);
  const owned = new Set(
    Object.values(campaign.regions)
      .filter(r => r.owner === factionId)
      .map(r => r.id)
  );
  const others = pack.factions
    .filter(o => o.id !== factionId && campaign.factions[String(o.id)]!.alive)
    .filter(o => {
      // Neighbours only: adjacency through regions.
      for (const rid of owned) {
        for (const n of idx.regionAdjacency.get(rid) ?? []) {
          if (campaign.regions[String(n)]?.owner === o.id) return true;
        }
      }
      return false;
    })
    .sort((a, b) => a.id - b.id);

  for (const other of others) {
    const relations = campaign.relations[String(factionId)]?.[String(other.id)] ?? 0;
    const hasTrade = campaign.treaties.some(
      t => t.type === "trade" && t.between.includes(factionId) && t.between.includes(other.id)
    );
    if (!hasTrade && relations >= 20 && rng(campaign) < 0.5) {
      rationale(ctx, factionId, "diplomacy:trade", `offers trade to ${other.name} (relations ${relations})`);
      offerTreaty(ctx, factionId, other.id, "trade");
      return;
    }
    const sharedEnemy = [...enemiesOf(campaign, factionId)].some(e => enemiesOf(campaign, other.id).has(e));
    if (relations >= 60 && sharedEnemy && rng(campaign) < 0.3) {
      rationale(ctx, factionId, "diplomacy:alliance", `offers alliance to ${other.name} against a shared enemy`);
      offerTreaty(ctx, factionId, other.id, "alliance");
      return;
    }
  }
}

/** Expansionist factions probe weak, hated neighbours — never uphill (§5.11). */
function maybeDeclareWar(ctx: EngineCtx, factionId: number, expansionism: number): void {
  const { campaign, pack, config } = ctx;
  if (expansionism < 2) return;
  // CAPACITY-PLAN Phase 6: **an over-capacity realm prefers peace.** A realm
  // that cannot already feed what it has fielded has no appetite for another
  // front, and the war it would win would bring land it could not garrison —
  // and ungarrisoned land sours (Phase 3's order rule). So a realm at its
  // Military ceiling stays home, and wars acquire a natural saturation point.
  if (config.economy.capacityMode) {
    const cap = campaign.factions[String(factionId)]?.capacity;
    if (cap && cap.m.gen - cap.m.load < 0) {
      rationale(ctx, factionId, "peace:overcapacity", "over Military capacity — no appetite for war");
      return;
    }
  }
  if (rng(campaign) > 0.05) return;
  const idx = graphIndex(pack);
  const myRegions = new Set(
    Object.values(campaign.regions)
      .filter(r => r.owner === factionId)
      .map(r => r.id)
  );
  const neighbors = new Set<number>();
  for (const [regionId, set] of idx.regionAdjacency) {
    if (!myRegions.has(regionId)) continue;
    for (const n of set) {
      const owner = campaign.regions[String(n)]?.owner ?? 0;
      if (owner !== factionId && owner !== 0 && owner !== BRIGAND_FACTION) neighbors.add(owner);
    }
  }
  const myMen = menOf(ctx, factionId);
  const candidates = [...neighbors]
    .filter(fid => campaign.factions[String(fid)]!.alive)
    .filter(fid => {
      const rel = campaign.relations[String(factionId)]?.[String(fid)] ?? 0;
      return rel < -40 && myMen >= menOf(ctx, fid) * 0.8; // never uphill
    })
    .sort((a, b) => menOf(ctx, a) - menOf(ctx, b));
  if (candidates.length === 0) return;
  const target = candidates[0]!;
  rationale(
    ctx,
    factionId,
    "war:declare",
    `declares war on ${ctx.pack.factions.find(f => f.id === target)!.name} (expansionism ${expansionism}, hostile relations)`
  );
  declareWarCore(ctx, factionId, target);
}

function manageCharacters(ctx: EngineCtx, factionId: number): void {
  const { campaign, config, pack } = ctx;
  const state = campaign.factions[String(factionId)]!;

  // Auto-spend skill points on combat (deterministic).
  for (const c of Object.values(campaign.characters)) {
    if (c.factionId !== factionId || !c.alive || c.skillPoints <= 0) continue;
    apply(ctx, { type: "SpendSkillPoint", characterId: c.id, branch: "combat" });
  }

  // A lordless army gets a lord when the coffers allow.
  const lordless = Object.values(campaign.armies)
    .filter(
      a =>
        a.factionId === factionId &&
        !a.fleet &&
        !Object.values(campaign.characters).some(c => c.armyId === a.id && c.alive)
    )
    .sort((a, b) => a.id.localeCompare(b.id))[0];
  // CAPACITY-PLAN Phase 3: with gold retired, what a character costs is a
  // question about capacity, not coffers — the command checks the free Social.
  const canAfford = (cost: number): boolean => config.economy.capacityMode || state.treasury >= cost;
  // CAPACITY-PLAN Phase 6: a character costs 1 S, so the realm needs a point of
  // free Social before it can keep one.
  const socialFree = config.economy.capacityMode ? freeCapacity(ctx, factionId).s : Infinity;
  if (lordless && canAfford(config.characters.lordCost + 500) && socialFree >= 1) {
    aiRecruitCharacter(ctx, factionId, "lord", lordless.id);
  }

  // Occasional assassin + assassination attempt against the biggest enemy lord.
  const hasAssassin = Object.values(campaign.characters).some(
    c => c.factionId === factionId && c.kind === "assassin" && c.alive
  );
  if (!hasAssassin && canAfford(config.characters.agentCost * 2) && socialFree >= 1 && rng(campaign) < 0.15) {
    aiRecruitCharacter(ctx, factionId, "assassin");
  }
  const assassin = Object.values(campaign.characters).find(
    c => c.factionId === factionId && c.kind === "assassin" && c.alive && (c.cooldownUntil ?? 0) <= campaign.turn
  );
  if (assassin && rng(campaign) < 0.3) {
    const enemies = enemiesOf(campaign, factionId);
    const target = Object.values(campaign.characters)
      .filter(c => c.kind === "lord" && c.alive && enemies.has(c.factionId))
      .sort((a, b) => b.level - a.level)[0];
    if (target) {
      const targetArmy = target.armyId ? campaign.armies[target.armyId] : undefined;
      const targetCell = targetArmy?.cell ?? target.cell;
      const idx = graphIndex(ctx.pack);
      const reach = regionDistance(idx, idx.cellRegion.get(assassin.cell) ?? 0, idx.cellRegion.get(targetCell) ?? 0);
      if (reach <= 2) {
        if (reach > 0) {
          const path = findPath(ctx.pack, ctx.config, assassin.cell, targetCell);
          if (path.reachable && path.path.length > 1) {
            apply(ctx, { type: "MoveCharacter", characterId: assassin.id, path: path.path.slice(0, 2) });
          }
        } else {
          apply(ctx, {
            type: "CharacterAction",
            characterId: assassin.id,
            action: "assassinate",
            targetCharacterId: target.id
          });
        }
      }
    }
  }

  // CAPACITY-PLAN Phase 6: an assassin with nothing to assassinate turns to
  // **sabotage** — disrupting a nearby enemy province's generation. AER: it
  // hits generation, not load, so the province's people still work and its
  // garrison still stands; what stops is the output.
  // CAPACITY-PLAN Phase 6: sabotage is the capacity model's business — it
  // disrupts a province's *generation*, which is a shadow number with the flag
  // off. The check comes before the roll on purpose: a stray `rng()` call would
  // shift the random stream and change a game that has nothing to do with it.
  if (!config.economy.capacityMode) return;
  const saboteur = Object.values(campaign.characters).find(
    c => c.factionId === factionId && c.kind === "assassin" && c.alive && (c.cooldownUntil ?? 0) <= campaign.turn
  );
  if (saboteur && rng(campaign) < 0.2) {
    const enemies = enemiesOf(campaign, factionId);
    const idx = graphIndex(ctx.pack);
    const here = idx.cellRegion.get(saboteur.cell) ?? 0;
    const target = pack.regions.find(
      r =>
        enemies.has(r.factionId) &&
        r.factionId !== factionId &&
        regionDistance(idx, here, r.id) <= config.characters.sabotageRange &&
        (campaign.regions[String(r.id)]?.suppressedTurns ?? 0) <= 0
    );
    if (target) {
      rationale(ctx, factionId, "sabotage", `disrupts province ${target.id}`);
      apply(ctx, {
        type: "CharacterAction",
        characterId: saboteur.id,
        action: "sabotage",
        targetRegionId: target.id
      });
    }
  }
}

/** Internal command application (no player-ownership checks, no command-log append). */
function apply(ctx: EngineCtx, cmd: Command): void {
  applyCommand(ctx, cmd, { internal: true });
}

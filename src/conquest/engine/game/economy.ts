/**
 * Economy tick (total-war/.plans/PLAN.md §5.6): tax income with corruption (per faction mechanics),
 * building/tech/trade/lord income effects, upkeep, raiding, public order drift +
 * building order effects, siege escalation, construction, rebellions, replenishment,
 * seasonal movement/income, elimination + victory checks, YAML event scan.
 */

import {
  developmentCap,
  isGarrisoned,
  recomputeCapacity,
  regionDevelopment,
  settlementDevelopment,
  settlementTier
} from "./capacity";
import { lordCampaignBonus, lordEconomyBonus } from "./characters";
import type { EngineCtx } from "./context";
import { setRelation } from "./diplomacy";
import type { GameEvent } from "./events";
import { graphIndex, regionDistance } from "./graph";
import { maxMovement } from "./movement";
import { cleanupSieges } from "./sieges";
import { season } from "./state";
import { checkElimination, checkVictory } from "./victory";
import { checkRebellions, scanEvents, seasonMovementMult } from "./world";

/**
 * How much a faction's income is scaled by its map-derived sales tax.
 *
 * Azgaar gives every state a `salesTax` (the slice taken on deals it sells) drawn
 * from `DEFAULT_TAX_BY_FORM`, perturbed per-state. This maps that to an income
 * multiplier, clamped so a hand-edited or unusual export cannot run away with the
 * economy.
 *
 * Exported for tests: the Phase 1 contract is that this function, applied to two
 * factions with identical territory, produces exactly the income ratio a player
 * can predict from the numbers on screen.
 */
export function salesTaxFactor(salesTax: number): number {
  if (!Number.isFinite(salesTax)) return 1;
  return Math.min(1.4, Math.max(0.7, 0.8 + salesTax * 2));
}

export function economyTick(ctx: EngineCtx): GameEvent[] {
  const { campaign, pack, config, content, resolved } = ctx;
  const unitTypes = content.unitTypes;
  const events: GameEvent[] = [];
  const idx = graphIndex(pack);

  // Capacity first, before any gold arithmetic (CAPACITY-PLAN Phase 2). Shadow:
  // computed identically whether or not the capacity flag exists, so Phase 3 can
  // diff flag-off against flag-on using the same figures.
  recomputeCapacity(ctx);

  // Region income by owner (before raiding), corruption from capital distance.
  const incomeByRegion = new Map<number, number>();
  const corruptionByRegion = new Map<number, number>();
  const capitalRegion = new Map<number, number>();
  for (const f of pack.factions) capitalRegion.set(f.id, f.capitalRegion);

  const buildingById = new Map(content.buildings.map(b => [b.id, b]));

  // Phase 1 (ECONOMY-PLAN): the map's own per-state tax form. Gated so the
  // flag-off path is literally the arithmetic that shipped, not a multiply by 1.
  const taxFromMap = config.economy.taxFromMap === true;
  const taxFormByFaction = new Map<number, { salesTax: number; pollTax: number }>();
  if (taxFromMap) {
    for (const f of pack.factions) taxFormByFaction.set(f.id, { salesTax: f.salesTax, pollTax: f.pollTax });
  }

  // Phase 2 (ECONOMY-PLAN): regional goods specialties — where a region is
  // matters. Specialties are static pack data (compiled from the map's goods),
  // so the count is hoisted out of the per-region loop. Capped, and counts only
  // the *distinct* goods, so the bonus tracks breadth of production.
  const specialtiesOn = config.economy.specialtiesFromMap === true;
  const specialtyBonusByRegion = new Map<number, number>();
  if (specialtiesOn) {
    for (const r of pack.regions) {
      const n = r.stats.specialties?.length ?? 0;
      if (n === 0) continue;
      specialtyBonusByRegion.set(
        r.id,
        Math.min(config.economy.specialtyCap, n * config.economy.specialtyIncomePerGood)
      );
    }
  }
  const specialtyMult = (regionId: number): number => 1 + (specialtyBonusByRegion.get(regionId) ?? 0);

  const regionIncomeMult = (regionId: number): number => {
    const rs = campaign.regions[String(regionId)];
    if (!rs) return 1;
    let mult = 1;
    for (const bid of rs.buildings) {
      const eff = buildingById.get(bid)?.effects;
      if (eff?.incomePct) mult += eff.incomePct;
    }
    return mult;
  };
  const factionIncomeMult = (factionId: number): number => {
    const st = campaign.factions[String(factionId)]!;
    let mult = 1;
    for (const tid of st.tech) {
      const eff = content.tech.find(t => t.id === tid)?.effects;
      if (eff?.incomePct) mult += eff.incomePct;
    }
    // Trade treaties (§5.7): +10% income each.
    mult += campaign.treaties.filter(t => t.type === "trade" && t.between.includes(factionId)).length * 0.1;
    // The map's sales tax scales everything above it.
    const form = taxFormByFaction.get(factionId);
    if (form) mult *= salesTaxFactor(form.salesTax);
    // Lords' economy branch (§5.8).
    return mult * lordEconomyBonus(ctx, factionId);
  };

  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)]!;
    const owner = rs.owner;
    if (owner === 0) continue;
    const rf = resolved.factions[String(owner)];
    const hasCorruption = rf?.traits.includes("corruption") || rf?.mechanics?.corruption === true;
    let corruption = 0;
    if (hasCorruption) {
      const cap = capitalRegion.get(owner) ?? 0;
      const dist = cap > 0 ? regionDistance(idx, cap, r.id) : Number.POSITIVE_INFINITY;
      corruption = Math.min(
        config.economy.corruptionCap,
        Number.isFinite(dist) ? dist * config.economy.corruptionPerStep : config.economy.corruptionCap
      );
    }
    corruptionByRegion.set(r.id, corruption);
    const base = (r.stats.population / 1000) * config.economy.taxPer1000Pop * rs.populationScale * (1 - corruption);
    incomeByRegion.set(r.id, base * regionIncomeMult(r.id) * specialtyMult(r.id));
  }

  // Raiding: raid-stance armies in enemy regions siphon half the region income.
  for (const army of Object.values(campaign.armies)) {
    if (army.stance !== "raid") continue;
    const regionId = idx.cellRegion.get(army.cell) ?? 0;
    const regionState = campaign.regions[String(regionId)];
    if (!regionState || regionState.owner === army.factionId || regionState.owner === 0) continue;
    const base = incomeByRegion.get(regionId) ?? 0;
    const stolen = base * 0.5;
    incomeByRegion.set(regionId, base - stolen);
    // CAPACITY-PLAN Phase 5: raiding steals **purse gold** — it comes out of
    // the victim's purse, not out of thin air, because a realm's gold is only
    // ever as much as some realm converted out of its Wealth. The order cost
    // stays either way: a raid unsettles a province whatever the gold does.
    if (config.economy.capacityMode) {
      const victim = campaign.factions[String(regionState.owner)];
      const raider = campaign.factions[String(army.factionId)];
      if (victim && raider) {
        const taken = Math.min(Math.round(stolen), victim.purse);
        victim.purse = Math.round((victim.purse - taken) * 100) / 100;
        raider.purse = Math.round((raider.purse + taken) * 100) / 100;
      }
    } else {
      campaign.factions[String(army.factionId)]!.treasury += stolen;
    }
    regionState.order = Math.max(0, regionState.order - 5);
    events.push({ type: "RegionRaided", regionId, byFaction: army.factionId, gold: Math.round(stolen) });
  }

  // Persist per-region economics for clients (5b region panel).
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (!rs) continue;
    rs.lastIncome = Math.round(incomeByRegion.get(r.id) ?? 0);
    rs.corruption = Math.round((corruptionByRegion.get(r.id) ?? 0) * 100) / 100;
  }

  // Per-faction ledger. Autumn harvest bonus applies while the season is Autumn.
  const autumn = season(campaign, config) === "Autumn" ? 1 + config.seasons.autumnIncomeBonus : 1;
  for (const f of pack.factions) {
    const state = campaign.factions[String(f.id)]!;
    if (!state.alive) continue;
    let income = incomeByRegionByOwner(ctx, incomeByRegion, f.id) * factionIncomeMult(f.id) * autumn;
    // Poll tax: a flat per-capita levy, so it is charged on the population the
    // faction actually administers rather than folded into the regional rate.
    // Priced deliberately small — it is the income half of a trade whose other
    // half is the order drag applied below.
    const form = taxFormByFaction.get(f.id);
    if (form && form.pollTax > 0) {
      let ownedPop = 0;
      for (const r of pack.regions) {
        if (campaign.regions[String(r.id)]?.owner === f.id) ownedPop += r.stats.population;
      }
      income += (ownedPop / 1000) * form.pollTax;
    }
    const corruptionSum = corruptionByRegionSum(ctx, corruptionByRegion, f.id);
    const regionCount = Object.values(campaign.regions).filter(r => r.owner === f.id).length;
    const corruption = regionCount > 0 ? corruptionSum / regionCount : 0;

    const upkeepReduction = Math.min(
      0.5,
      state.tech.reduce((acc, tid) => acc + (content.tech.find(t => t.id === tid)?.effects.upkeepReduction ?? 0), 0)
    );
    let expenses = 0;
    for (const army of Object.values(campaign.armies)) {
      if (army.factionId !== f.id) continue;
      for (const u of army.units) {
        const t = unitTypes[u.type];
        if (!t) continue;
        expenses += t.upkeep * (u.count / t.men);
      }
    }
    expenses *= 1 - upkeepReduction;

    // Holding land has a price independent of the army on it (config
    // `economy.garrisonUpkeepPerRegion`; zero disables). Charged *after* tech
    // upkeep reduction, because that reduction is about maintaining troops —
    // paying less to feed soldiers should not make the state cheaper to
    // administer.
    const garrison = regionCount * config.economy.garrisonUpkeepPerRegion;
    expenses += garrison;

    const net = income - expenses;
    // CAPACITY-PLAN Phase 3: in the capacity model the **gold economy is
    // retired** — the four pools are the economy, so the treasury stops
    // moving. Phase 5 reintroduces gold as the purse (a diplomatic currency),
    // Phase 6 re-points the AI, and Phase 7 deletes the gold code. Flag-off
    // this line is the arithmetic that has always shipped.
    if (!config.economy.capacityMode) {
      state.treasury = Math.round((state.treasury + net) * 100) / 100;
    }
    state.lastIncome = Math.round(income);
    state.lastExpenses = Math.round(expenses);
    events.push({
      type: "TreasuryTicked",
      factionId: f.id,
      income: Math.round(income),
      expenses: Math.round(expenses),
      corruption: Math.round(corruption * 100) / 100,
      net: Math.round(net),
      treasury: Math.round(state.treasury)
    });
  }
  // Construction progress + public order drift (building order effects).
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)]!;
    if (rs.construction) {
      rs.construction.turnsLeft--;
      if (rs.construction.turnsLeft <= 0) {
        const done = rs.construction.buildingId;
        // AER p1591: an upgrade *consumes* the lesser asset — it does not join
        // it. Without this, a Stone Walls went up beside the Palisade it
        // replaced and the region counted both their capacity, their upkeep
        // and their fortification.
        const built = buildingById.get(done);
        if (built) {
          rs.buildings = rs.buildings.filter(bid => {
            const other = buildingById.get(bid);
            return other === undefined || other.chain !== built.chain || other.tier >= built.tier;
          });
        }
        rs.buildings.push(done);
        rs.construction = null;
        events.push({ type: "BuildingCompleted", regionId: r.id, buildingId: done });
      }
    }
    if (rs.owner === 0) continue;
    const orderPerTurn = rs.buildings.reduce((acc, bid) => acc + (buildingById.get(bid)?.effects.orderPerTurn ?? 0), 0);
    // CAPACITY-PLAN Phase 3 — **region stability**.
    //
    // A region with a friendly unit standing in it **holds** its order: it
    // neither drifts down nor is quietly restored. A besieged province with a
    // garrison in it stays broken until the province is relieved, which is the
    // point — a realm that garrisons a province keeps the situation it is in.
    //
    // An **empty** region keeps the drift it has always had: order gravitates
    // to `startOrder`, so it decays down from above and is restored from
    // below. The plan's own rule — *"it replaces nothing shipped; it is new
    // order-system behaviour, tuned conservatively"* — is what keeps this
    // additive rather than a replacement: nothing the shipped order model did
    // is taken away, and the poll tax's drag still bites as it always has.
    if (isGarrisoned(ctx, r.id, rs.owner)) {
      // holds
    } else if (rs.order < config.economy.startOrder) {
      rs.order = Math.min(config.economy.startOrder, rs.order + 2 + orderPerTurn);
    } else {
      rs.order = Math.max(config.economy.startOrder, rs.order - 1 + orderPerTurn);
    }
    // CAPACITY-PLAN Phase 3 — **a garrison earns stability.**
    //
    // A province held by a friendly unit is orderly and working: it accrues
    // stability, which is the currency a deliberate development is paid in. So
    // the same garrison that holds the region's order also funds its growth —
    // "build capacity and pay to use", with the capacity being the realm's own
    // presence there.
    if (config.economy.capacityMode && isGarrisoned(ctx, r.id, rs.owner)) {
      rs.stability = (rs.stability ?? 0) + config.capacity.stabilityPerGarrison;
    }
    // Poll tax's cost: the realm sours wherever its collectors lean on it.
    const ownerForm = taxFormByFaction.get(rs.owner);
    if (ownerForm && ownerForm.pollTax > 0) {
      rs.order -= ownerForm.pollTax * config.economy.pollTaxOrderDrag;
    }
    rs.order = Math.min(100, Math.max(0, rs.order));
  }

  for (const siege of campaign.sieges) {
    siege.progress++;
    const rs = campaign.regions[String(siege.regionId)];
    if (rs) rs.order = Math.max(0, rs.order - config.sieges.orderDamagePerTick);
  }
  cleanupSieges(ctx);

  // CAPACITY-PLAN Phase 3 — **development completes.**
  //
  // A `Develop` commitment holds Wealth for its turns and promotes the
  // settlement when it runs out — never before. The promotion is capped: a
  // settlement cannot outgrow its tier ladder, and a province cannot grow
  // every one of its towns at once.
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (!rs?.development) continue;
    rs.development.turnsLeft--;
    if (rs.development.turnsLeft > 0) continue;
    const settlementId = rs.development.settlementId;
    rs.development = null;
    const have = settlementDevelopment(ctx, settlementId);
    const room = regionDevelopment(ctx, r.id);
    if (have >= developmentCap(ctx, settlementId) || room.total >= room.cap) continue;
    campaign.settlementDevelopment = { ...campaign.settlementDevelopment, [String(settlementId)]: have + 1 };
    events.push({
      type: "SettlementDeveloped",
      regionId: r.id,
      settlementId,
      tier: settlementTier(ctx, settlementId)
    });
  }

  // CAPACITY-PLAN Phase 3 — **organic growth.**
  //
  // PLAN.md §5.6's promised-and-never-built *"settlement population grows toward
  // habitability cap"*, in the capacity model's terms: an orderly, garrisoned
  // province grows its smallest town a step every few turns. The smallest
  // first — a hamlet becoming a town is the clearest visible payoff of
  // development there is.
  if (config.economy.capacityMode && campaign.turn % config.capacity.growthTurns === 0) {
    for (const r of pack.regions) {
      const rs = campaign.regions[String(r.id)];
      if (!rs || rs.owner === 0) continue;
      if (rs.order < config.capacity.growthOrderThreshold) continue;
      if (!isGarrisoned(ctx, r.id, rs.owner)) continue;
      const room = regionDevelopment(ctx, r.id);
      if (room.total >= room.cap) continue;
      const candidates = r.settlements
        .map(sid => ctx.pack.settlements[sid])
        .filter((s): s is NonNullable<typeof s> => s !== undefined)
        .sort((a, b) => a.tier - b.tier || a.id - b.id);
      for (const s of candidates) {
        if (settlementDevelopment(ctx, s.id) >= developmentCap(ctx, s.id)) continue;
        campaign.settlementDevelopment = {
          ...campaign.settlementDevelopment,
          [String(s.id)]: settlementDevelopment(ctx, s.id) + 1
        };
        // A town that grew of its own accord is the strongest proof a province
        // works, so it is worth more stability than a held line.
        rs.stability = (rs.stability ?? 0) + config.capacity.stabilityPerGrowth;
        break;
      }
    }
  }

  // CAPACITY-PLAN Phase 6: a sabotage wears off.
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (!rs?.suppressedTurns) continue;
    rs.suppressedTurns--;
    if (rs.suppressedTurns <= 0) rs.suppressedTurns = 0;
  }

  // CAPACITY-PLAN Phase 5: AER's escalating extraction resets each turn, so
  // the n-th conversion in a turn costs n W — and a realm that converts one W
  // a turn is paid 100 gold for it every turn, while one that bursts pays 1 + 2
  // + 3 for the same three.
  for (const f of pack.factions) {
    const state = campaign.factions[String(f.id)];
    if (state) state.withdrawalsThisTurn = 0;
  }

  // Replenishment in friendly territory (encamp replenishes faster, §5.3).
  for (const army of Object.values(campaign.armies)) {
    const regionId = idx.cellRegion.get(army.cell) ?? 0;
    const owner = campaign.regions[String(regionId)]?.owner ?? 0;
    if (owner !== army.factionId) continue;
    const rate =
      config.military.replenishFraction * (army.stance === "encamp" ? config.military.encampReplenishBonus : 1);
    for (const u of army.units) {
      const max = unitTypes[u.type]?.men;
      if (max !== undefined && u.count < max) u.count = Math.min(max, u.count + Math.ceil((max - u.count) * rate));
    }
  }

  // CAPACITY-PLAN Phase 3 — **over capacity, the army dies back.**
  //
  // This runs *after* the replenishment below, and that order matters: a
  // region refills its garrison from its own people, and a realm that cannot
  // feed what it has fielded cannot replace its losses either. Attriting
  // first and refilling second let the two cancel — the army stayed at full
  // strength and the realm was never punished.
  //
  // AER p1424: *"a Domain cannot sustain more troops, infrastructure, or
  // random catastrophes than its point totals allow"*. A realm whose Military
  // load exceeds its Military generation cannot feed what it has fielded, so
  // its regiments die back a tenth a turn — and the provinces hosting them
  // sour, because an army that cannot be paid for is an army nobody wants
  // around. This is the punishment for over-extending, and it is the reason
  // the gate exists.
  if (config.economy.capacityMode) {
    for (const f of pack.factions) {
      const state = campaign.factions[String(f.id)];
      const cap = state?.capacity;
      if (!state?.alive || !cap) continue;
      if (cap.m.gen - cap.m.load >= 0) continue;
      for (const army of Object.values(campaign.armies)) {
        if (army.factionId !== f.id) continue;
        for (const u of army.units) {
          const lost = Math.ceil(u.count * config.capacity.attritionPerTurn);
          u.count = Math.max(0, u.count - lost);
        }
        // A regiment that died back entirely is no longer a regiment.
        army.units = army.units.filter(u => u.count > 0);
        const regionId = idx.cellRegion.get(army.cell);
        const rs = regionId === undefined ? undefined : campaign.regions[String(regionId)];
        if (rs && rs.owner === f.id) {
          rs.order = Math.max(0, rs.order - config.capacity.overCapacityOrderCost);
        }
      }
    }
  }

  // Eliminations: no regions and no armies.
  for (const f of pack.factions) {
    checkElimination(ctx, f.id);
  }

  // Victory via per-faction objective sets (§5.10).
  checkVictory(ctx);

  // Season advance — then movement refresh with the NEW season's modifiers.
  campaign.seasonIndex++;
  if (campaign.seasonIndex >= config.turn.seasonsPerYear) {
    campaign.seasonIndex = 0;
    campaign.year++;
  }
  const newSeason = season(campaign, config);
  for (const army of Object.values(campaign.armies)) {
    army.movementLeft = maxMovement(config, army.stance) * seasonMovementMult(ctx) * lordCampaignBonus(ctx, army.id);
  }

  // War Relations decay: long wars grind goodwill down (§5.7).
  for (const w of campaign.wars) {
    setRelation(campaign, w.between[0]!, w.between[1]!, -1);
  }

  // Rebellions from low public order (§5.6).
  checkRebellions(ctx);

  // YAML event scan (§5.9) — after the season advance so season triggers see it.
  scanEvents(ctx, { newSeason });
  void events;
  return events;
}

function incomeByRegionByOwner(ctx: EngineCtx, incomeByRegion: Map<number, number>, factionId: number): number {
  let sum = 0;
  for (const r of ctx.pack.regions) {
    if (ctx.campaign.regions[String(r.id)]?.owner === factionId) sum += incomeByRegion.get(r.id) ?? 0;
  }
  return sum;
}

function corruptionByRegionSum(ctx: EngineCtx, corruptionByRegion: Map<number, number>, factionId: number): number {
  let sum = 0;
  for (const r of ctx.pack.regions) {
    if (ctx.campaign.regions[String(r.id)]?.owner === factionId) sum += corruptionByRegion.get(r.id) ?? 0;
  }
  return sum;
}

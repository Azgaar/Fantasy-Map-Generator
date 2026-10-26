/**
 * The capacity ledger and the rules that read it (CAPACITY-PLAN).
 *
 * The ledger itself is **flag-independent**: it is computed identically whether
 * or not the capacity model is on, so a flag-off run and a flag-on run can be
 * diffed against the same figures. What the flag changes is *who reads it* —
 * the gates, the attrition and the growth in Phase 3.
 *
 * - **gen**: static `RegionStats.capacity` of every region held, plus the
 *   capacity of every building standing in those regions (buildings are mutable
 *   campaign state, so they cannot live in the compiler's static figure), plus
 *   what the region's settlements have *earned* by being developed (§3).
 * - **load**: armies (per `UnitType.capacityCost`), characters (lords and
 *   agents), the upkeep of every building standing in a held region, and the
 *   commitments a realm has made (a building under construction, a development
 *   running).
 *
 * Deterministic: iterates pack order, never a Map keyed by insertion.
 */

import type { BuildingDef } from "../common/content";
import { MEN_PER_BLOCK } from "../common/content";
import type { ArmyUnit, CapacityPoints, FactionCapacity } from "../common/types";
import type { EngineCtx } from "./context";

/** The four pools, in the order the ledger reports them. */
export const POOLS = ["m", "w", "s", "c"] as const;
export type Pool = (typeof POOLS)[number];

/** A pool's worth of capacity, zeroed. */
export function zeroCapacity(): CapacityPoints {
  return { m: 0, w: 0, s: 0, c: 0 };
}

// ---------------------------------------------------------------------------
// Settlement development (CAPACITY-PLAN Phase 3)
// ---------------------------------------------------------------------------

/**
 * How many development points a settlement has earned.
 *
 * Development is what the capacity model earns: a settlement's **effective
 * tier** is `min(5, base tier + development)`, so a T0 hamlet developed twice
 * is a T2 town. Each point adds +1 W and +1 S to the settlement's region — the
 * payoff for the Wealth a `Develop` commitment costs.
 */
export function settlementDevelopment(ctx: EngineCtx, settlementId: number): number {
  return ctx.campaign.settlementDevelopment?.[String(settlementId)] ?? 0;
}

/** A settlement's effective tier: its compiled tier plus what it has earned. */
export function settlementTier(ctx: EngineCtx, settlementId: number): number {
  const s = ctx.pack.settlements[settlementId];
  if (!s) return 0;
  return Math.min(5, s.tier + settlementDevelopment(ctx, settlementId));
}

/**
 * How many more development steps a settlement may take.
 *
 * Two ceilings: the tier ladder stops at 5 (`effective tier = min(5, base +
 * development)`), and a town cannot outgrow its province — the region's
 * habitability caps how much a place can carry. PLAN.md §5.6's *"settlement
 * population grows toward habitability cap"*, in the capacity model's terms.
 */
export function developmentCap(ctx: EngineCtx, settlementId: number): number {
  const s = ctx.pack.settlements[settlementId];
  if (!s) return 0;
  const headroom = Math.max(0, 5 - s.tier);
  const region = ctx.pack.regions.find(r => r.id === s.regionId);
  const habitability = region?.stats.habitability ?? 0;
  const byPlace = Math.floor(habitability / Math.max(1, ctx.config.capacity.growthPerHabitability));
  return Math.min(headroom, byPlace);
}

/**
 * The Wealth and Social a region's development adds to its generation.
 *
 * Only the points a settlement has *earned* count. A settlement's **base**
 * tier does not: §4.7 replaced the old `Σ settlement.tier` tally with one tier
 * from the region's own population, because a tally of burgs measured how many
 * hamlets a province had rather than how many people it governed. Development
 * is the opposite of a tally — it is a deliberate, capped investment, and its
 * cost is paid in the pool it generates.
 */
export function developmentBonus(ctx: EngineCtx, regionId: number): number {
  const region = ctx.pack.regions.find(r => r.id === regionId);
  if (!region) return 0;
  let bonus = 0;
  for (const sid of region.settlements) bonus += settlementDevelopment(ctx, sid);
  return bonus;
}

// ---------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------

/** Collect domain-wide customs held by a faction across unsuppressed regions (Phase 3). */
export function factionCustoms(ctx: EngineCtx, factionId: number): BuildingDef[] {
  const { campaign, pack, content } = ctx;
  const buildingById = new Map(content.buildings.map(b => [b.id, b]));
  const seen = new Set<string>();
  const customs: BuildingDef[] = [];
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (!rs || rs.owner !== factionId) continue;
    if ((rs.suppressedTurns ?? 0) > 0) continue;
    for (const bid of rs.buildings) {
      const b = buildingById.get(bid);
      if (b && b.kind === "custom" && !seen.has(b.id)) {
        seen.add(b.id);
        customs.push(b);
      }
    }
  }
  return customs;
}

/**
 * Recompute every realm's capacity ledger and store it on the campaign.
 *
 * Flag-independent by design: the same figures with the flag on and off, so
 * Phase 3 can be diffed against the shadow report it was tuned from.
 */
export function recomputeCapacity(ctx: EngineCtx): void {
  const { campaign, pack, content } = ctx;
  const zero = (): FactionCapacity => ({
    m: { gen: 0, load: 0 },
    w: { gen: 0, load: 0 },
    s: { gen: 0, load: 0 },
    c: { gen: 0, load: 0 }
  });
  const cap = new Map<number, FactionCapacity>();
  for (const f of pack.factions) cap.set(f.id, zero());

  const add = (factionId: number, pool: Pool, field: "gen" | "load", n: number): void => {
    const target = cap.get(factionId);
    if (target) target[pool][field] += n;
  };

  const buildingById = new Map(content.buildings.map(b => [b.id, b]));
  const idx = cellRegionIndex(ctx);

  const armiesByRegion = new Map<number, import("./state").Army[]>();
  for (const army of Object.values(campaign.armies)) {
    const rid = idx.cellRegion.get(army.cell);
    if (rid !== undefined) {
      let list = armiesByRegion.get(rid);
      if (!list) {
        list = [];
        armiesByRegion.set(rid, list);
      }
      list.push(army);
    }
  }

  // Phase 3: Domain-wide customs are deduplicated and counted once per faction.
  const customsByFaction = new Map<number, BuildingDef[]>();
  const seenCustomIds = new Map<number, Set<string>>();
  for (const f of pack.factions) {
    customsByFaction.set(f.id, []);
    seenCustomIds.set(f.id, new Set());
  }

  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (!rs || rs.owner === 0 || (rs.suppressedTurns ?? 0) > 0) continue;
    for (const bid of rs.buildings) {
      const b = buildingById.get(bid);
      if (b && b.kind === "custom") {
        const seen = seenCustomIds.get(rs.owner);
        if (seen && !seen.has(b.id)) {
          seen.add(b.id);
          customsByFaction.get(rs.owner)?.push(b);
        }
      }
    }
  }

  for (const [factionId, customs] of customsByFaction) {
    for (const c of customs) {
      if (c.effects.capacity) {
        add(factionId, "m", "gen", c.effects.capacity.m ?? 0);
        add(factionId, "w", "gen", c.effects.capacity.w ?? 0);
        add(factionId, "s", "gen", c.effects.capacity.s ?? 0);
        add(factionId, "c", "gen", c.effects.capacity.c ?? 0);
      }
      if (c.effects.upkeep) {
        add(factionId, "m", "load", c.effects.upkeep.m ?? 0);
        add(factionId, "w", "load", c.effects.upkeep.w ?? 0);
        add(factionId, "s", "load", c.effects.upkeep.s ?? 0);
        add(factionId, "c", "load", c.effects.upkeep.c ?? 0);
      }
    }
  }

  // Generation: static region capacity + the buildings standing in it.
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (!rs || rs.owner === 0) continue;
    const regionCap = r.stats.capacity;
    const suppressed = (rs.suppressedTurns ?? 0) > 0;
    const customs = customsByFaction.get(rs.owner) ?? [];
    const reqGarrison = customs.some(c => c.effects.requiresGarrisonToProduce);
    const regionArmies = armiesByRegion.get(r.id);
    const garrisoned = regionArmies ? regionArmies.some(a => a.factionId === rs.owner) : false;
    // Phase 3: Devil Worshipers requires a garrison in the region to produce.
    const produces = !suppressed && (!reqGarrison || garrisoned);

    if (produces) {
      add(rs.owner, "m", "gen", regionCap.m);
      add(rs.owner, "w", "gen", regionCap.w);
      add(rs.owner, "s", "gen", regionCap.s);
      add(rs.owner, "c", "gen", regionCap.c);

      const bonus = developmentBonus(ctx, r.id);
      add(rs.owner, "w", "gen", bonus);
      add(rs.owner, "s", "gen", bonus);
    }

    // Phase 3: Slavery waives the upkeep of N buildings per region.
    const freeUpkeepSlots = customs.reduce((acc, c) => acc + (c.effects.freeBuildingUpkeepPerRegion ?? 0), 0);
    const nonCustomBuildings = rs.buildings
      .map(bid => buildingById.get(bid))
      .filter((b): b is BuildingDef => b !== undefined && b.kind !== "custom");

    const waivedBuildingSet = new Set<BuildingDef>();
    if (freeUpkeepSlots > 0) {
      const candidates = nonCustomBuildings
        .map(b => {
          const u = b.effects.upkeep;
          const totalCost = (u?.m ?? 0) + (u?.w ?? 0) + (u?.s ?? 0) + (u?.c ?? 0);
          return { b, totalCost };
        })
        .filter(c => c.totalCost > 0)
        .sort((a, b) => b.totalCost - a.totalCost || a.b.id.localeCompare(b.b.id));
      for (let i = 0; i < Math.min(freeUpkeepSlots, candidates.length); i++) {
        waivedBuildingSet.add(candidates[i]!.b);
      }
    }

    const multipliers = customs.map(c => c.effects.chainMultiplier).filter(Boolean);

    for (const b of nonCustomBuildings) {
      const e = b.effects;
      // Phase 3: Conversion assets (Community Aid, Military Spending, Processing Camp, United Efforts)
      if (e.conversion) {
        const fromPool = e.conversion.from;
        const baseFrom = produces
          ? r.stats.capacity[fromPool] + (fromPool === "w" || fromPool === "s" ? developmentBonus(ctx, r.id) : 0)
          : 0;
        if (baseFrom >= e.conversion.ratio) {
          if (b.id === "processing_camp") {
            if (produces) {
              add(rs.owner, "w", "gen", e.capacity?.w ?? 2);
              add(rs.owner, "m", "gen", 1);
            }
            if (!waivedBuildingSet.has(b)) {
              add(rs.owner, "w", "load", 1);
            }
          } else {
            if (produces && e.capacity) {
              for (const p of POOLS) {
                let val = e.capacity[p] ?? 0;
                for (const cm of multipliers) {
                  if (cm!.chain === b.chain && cm!.pool === p) val *= cm!.factor;
                }
                add(rs.owner, p, "gen", val);
              }
            }
            if (!waivedBuildingSet.has(b) && e.upkeep) {
              add(rs.owner, "m", "load", e.upkeep.m ?? 0);
              add(rs.owner, "w", "load", e.upkeep.w ?? 0);
              add(rs.owner, "s", "load", e.upkeep.s ?? 0);
              add(rs.owner, "c", "load", e.upkeep.c ?? 0);
            }
          }
        }
        continue;
      }

      if (produces && e.capacity) {
        for (const p of POOLS) {
          let val = e.capacity[p] ?? 0;
          for (const cm of multipliers) {
            if (cm!.chain === b.chain && cm!.pool === p) val *= cm!.factor;
          }
          add(rs.owner, p, "gen", val);
        }
      }
      if (!waivedBuildingSet.has(b) && e.upkeep) {
        add(rs.owner, "m", "load", e.upkeep.m ?? 0);
        add(rs.owner, "w", "load", e.upkeep.w ?? 0);
        add(rs.owner, "s", "load", e.upkeep.s ?? 0);
        add(rs.owner, "c", "load", e.upkeep.c ?? 0);
      }
    }
  }

  // Phase 3: Barracks garrison upkeep waiver (freeGarrisonUnits: 1 / 2 / 4)
  const waivedShareByUnit = new Map<ArmyUnit, number>();
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (!rs || rs.owner === 0) continue;
    const freeGarrisonSlots = rs.buildings.reduce(
      (sum, bid) => sum + (buildingById.get(bid)?.effects.freeGarrisonUnits ?? 0),
      0
    );
    if (freeGarrisonSlots <= 0) continue;

    const regionArmies = armiesByRegion.get(r.id);
    if (!regionArmies || regionArmies.length === 0) continue;

    const candidates: { unit: ArmyUnit; share: number; cost: number; armyId: string; uidx: number }[] = [];
    for (const army of regionArmies) {
      if (army.factionId !== rs.owner) continue;
      army.units.forEach((u, uidx) => {
        const uc = content.unitTypes[u.type]?.capacityCost;
        const share = u.count / MEN_PER_BLOCK;
        const cost = uc ? share * (uc.m ?? 0) : 0;
        candidates.push({ unit: u, share, cost, armyId: army.id, uidx });
      });
    }
    candidates.sort((a, b) => b.cost - a.cost || a.armyId.localeCompare(b.armyId) || a.uidx - b.uidx);
    for (let i = 0; i < Math.min(freeGarrisonSlots, candidates.length); i++) {
      const c = candidates[i]!;
      waivedShareByUnit.set(c.unit, Math.min(c.share, 1.0));
    }
  }

  for (const army of Object.values(campaign.armies)) {
    for (const u of army.units) {
      const uc = content.unitTypes[u.type]?.capacityCost;
      if (!uc) continue;
      const totalShare = u.count / MEN_PER_BLOCK;
      const waivedShare = waivedShareByUnit.get(u) ?? 0;
      const netMShare = Math.max(0, totalShare - waivedShare);
      if (netMShare > 0) add(army.factionId, "m", "load", netMShare * uc.m);
      add(army.factionId, "w", "load", totalShare * uc.w);
      add(army.factionId, "s", "load", totalShare * uc.s);
      add(army.factionId, "c", "load", totalShare * uc.c);
    }
  }

  // Load: characters. Lords and agents both cost S in v1.
  for (const c of Object.values(campaign.characters)) {
    if (!c.alive) continue;
    add(c.factionId, "s", "load", c.kind === "lord" ? 1 : 1);
  }

  // Load: commitments (CAPACITY-PLAN Phase 3). A building under construction
  // and a running development both hold Wealth for as long as they run — the
  // price of the thing they are making. §1's table: Wealth is loaded by
  // *"raising regiments, constructing buildings, `Develop`, purse conversion"*.
  if (ctx.config.economy.capacityMode) {
    const constructionW = ctx.config.capacity.constructionWPerTurn;
    for (const r of pack.regions) {
      const rs = campaign.regions[String(r.id)];
      if (!rs || rs.owner === 0) continue;
      if (rs.construction) add(rs.owner, "w", "load", constructionW);
      if (rs.development) add(rs.owner, "w", "load", ctx.config.capacity.developWPerTurn);
    }
    // CAPACITY-PLAN Phase 5: Wealth converted into purse gold is **spent**, not
    // copied — it is a permanent load on the realm's W pool, so a realm's gold
    // income can never exceed the Wealth it generates.
    for (const f of pack.factions) {
      const state = campaign.factions[String(f.id)];
      if (state) add(f.id, "w", "load", state.withdrawnW ?? 0);
    }
    // CAPACITY-PLAN Phase 6: research is committed the same way — a permanent
    // load on the realm's W pool.
    for (const f of pack.factions) {
      const state = campaign.factions[String(f.id)];
      if (state) add(f.id, "w", "load", state.techW ?? 0);
    }
  }

  // The tech tree, re-read as capacity (CAPACITY-PLAN Phase 6). `incomePct` was
  // a multiplier on a realm's gold income; the capacity model's output is its
  // *generation*, so it becomes a percentage of the Wealth generated. And
  // `upkeepReduction` was a cut to the gold upkeep of an army, which in the
  // capacity model is a cut to what the army *loads*.
  for (const f of pack.factions) {
    const state = campaign.factions[String(f.id)];
    const realm = cap.get(f.id);
    if (!state || !realm) continue;
    let generationPct = 0;
    let loadPct = 0;
    for (const tid of state.tech) {
      const t = content.tech.find(x => x.id === tid);
      if (!t) continue;
      generationPct += t.effects.incomePct ?? 0;
      loadPct += t.effects.upkeepReduction ?? 0;
    }
    if (generationPct > 0) realm.w.gen *= 1 + generationPct;
    if (loadPct > 0) {
      const factor = Math.max(0, 1 - loadPct);
      realm.m.load *= factor;
      realm.w.load *= factor;
      realm.s.load *= factor;
      realm.c.load *= factor;
    }
  }

  for (const f of pack.factions) {
    const state = campaign.factions[String(f.id)];
    if (state) state.capacity = cap.get(f.id) ?? zero();
  }
}

// ---------------------------------------------------------------------------
// The gates (CAPACITY-PLAN Phase 3)
// ---------------------------------------------------------------------------

/** A realm's free capacity per pool — what it can still take on. */
export function freeCapacity(ctx: EngineCtx, factionId: number): CapacityPoints {
  const cap = ctx.campaign.factions[String(factionId)]?.capacity;
  const out = zeroCapacity();
  if (!cap) return out;
  for (const pool of POOLS) out[pool] = cap[pool].gen - cap[pool].load;
  return out;
}

/**
 * Can this realm take on `load` more points, and if not, which pool stops it?
 *
 * Returns the **binding pool** (the first one that would go negative), or
 * `null` when there is room. A refusal must name the pool: "you cannot raise
 * another regiment" is a lesson, "not enough capacity" is not.
 */
export function bindingPool(free: CapacityPoints, load: CapacityPoints): Pool | null {
  for (const pool of POOLS) {
    // The new free is `free - load`; it must not go negative.
    if (free[pool] - load[pool] < 0) return pool;
  }
  return null;
}

/**
 * The refusal for a load the realm cannot take on, or `null` when there is
 * room.
 *
 * A refusal must name the **binding pool**: "no free Military capacity for
 * another regiment" teaches, "not enough capacity" does not. Off the flag this
 * is always `null` — the gold path decides instead.
 */
export function capacityRefusal(ctx: EngineCtx, factionId: number, load: CapacityPoints, what: string): string | null {
  if (!ctx.config.economy.capacityMode) return null;
  // The ledger is rebuilt here, not read stale. Two commands in a row — two
  // recruits, a recruit and a building — must not both be measured against
  // the *same* free capacity and both be allowed, which is how a realm ends up
  // over its own capacity through the gate.
  recomputeCapacity(ctx);
  const free = freeCapacity(ctx, factionId);
  const pool = bindingPool(free, load);
  if (!pool) return null;
  const have = Math.floor(free[pool] * 10) / 10;
  const need = Math.ceil((load[pool] - free[pool]) * 10) / 10;
  return `no free ${POOL_NAME[pool]} capacity for ${what} (${have} free, ${need} needed)`;
}

/**
 * Does a realm have a unit standing in a region?
 *
 * A garrison is what holds a province's order together (CAPACITY-PLAN Phase 3)
 * and what lets it grow.
 */
export function isGarrisoned(ctx: EngineCtx, regionId: number, factionId: number): boolean {
  const idx = cellRegionIndex(ctx);
  for (const army of Object.values(ctx.campaign.armies)) {
    if (army.factionId !== factionId) continue;
    if (idx.cellRegion.get(army.cell) === regionId) return true;
  }
  return false;
}

/** The cell → region map, built once per call site (the graph is static). */
function cellRegionIndex(ctx: EngineCtx): { cellRegion: Map<number, number> } {
  const cellRegion = new Map<number, number>();
  for (const r of ctx.pack.regions) {
    for (const cell of r.cells) cellRegion.set(cell, r.id);
  }
  return { cellRegion };
}

/**
 * The development a region already carries, and how much more it may take.
 *
 * The per-settlement cap is the tier ladder and the province's habitability;
 * the per-region cap is the same habitability figure, so a province cannot
 * grow every one of its towns at once.
 */
export function regionDevelopment(ctx: EngineCtx, regionId: number): { total: number; cap: number } {
  const region = ctx.pack.regions.find(r => r.id === regionId);
  if (!region) return { total: 0, cap: 0 };
  const habitability = region.stats.habitability ?? 0;
  const cap = Math.floor(habitability / Math.max(1, ctx.config.capacity.growthPerHabitability));
  let total = 0;
  for (const sid of region.settlements) total += settlementDevelopment(ctx, sid);
  return { total, cap };
}

/** The pool's name as a player sees it. */
export const POOL_NAME: Record<Pool, string> = {
  m: "Military",
  w: "Wealth",
  s: "Social",
  c: "Cunning"
};

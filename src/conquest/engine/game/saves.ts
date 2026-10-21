/**
 * AER value checks and Domain saving throws (CAPACITY-PLAN Phase 4).
 *
 * An Echo Resounding treats each value as a number the ruler rolls *against*
 * (line 1435): *"When a value check is made, the ruler rolls 1d20 and adds that
 * value's modifier to the roll."* Saving throws are the same roll, defensive
 * (line 1437) — six of them, two per value, at a default difficulty of 12.
 *
 * The scope is deliberately **the region, not the empire**. AER calibrates a
 * Domain at a handful of locations, and the modifier table stops publishing
 * rows past 20. Measured on the sample world, a *region* lands at M 1…6,
 * W 0…7, S 0…6, C 0…5 — every value inside the table, so every check is a
 * **+0…+1** roll. An *empire* totals 2…26 of those stacked: Ithlonor alone reads
 * M 78 / W 101 / S 87, which is `1d20 + 20` on a Wealth check and a ladder
 * that has stopped meaning anything. Region scope is what keeps the table
 * readable at all. (CAPACITY-PLAN §4.7 moved W and S onto the region population
 * tier; before it they read 6/20/21/5 and asked for +3 and +4.)
 *
 * **Load is not part of a Domain's value.** AER line 1424: *"Upkeep costs do
 * not subtract from a Domain's scores"* — a Domain with a Military score of 30
 * and 28 points of Military upkeep is still more martial than one with a score
 * of 5. So `regionValues` returns generation only; the capacity ledger's
 * `gen − load` balance is a separate question and is not consulted here.
 *
 * Flag-gated via `config.saves.enabled` (default **false**): with the flag off
 * the engine resolves unrest the way it always has — the flat `rebellion`
 * threshold — and never touches a die, so flag-off runs stay bit-identical.
 */

import type { CapacityPoints } from "../common/types";
import { developmentBonus } from "./capacity";
import type { EngineCtx } from "./context";
import { rng } from "./state";

export type Pool = "m" | "w" | "s" | "c";

/**
 * A settlement's special function, per AER line 467 — *"the following ten
 * activities are a sampling of common activities for a town or city, each with
 * their own modifier to its values."*
 *
 * AER grants a flat **+2 to one value**, one activity per settlement. Crucially
 * this is a *modifier to the value*, not generation: it is read when a roll is
 * made and **never enters the capacity ledger**. That is why AER can hand
 * activities out generously without breaking its economy — a modifier neither
 * generates nor loads anything. Implemented here as a *region* activity, because
 * the Domain is the region (see {@link regionValues}).
 */
export interface RegionActivity {
  /** AER p467's name for it. */
  name: string;
  /** The value it modifies. */
  pool: Exclude<Pool, "c">;
  /** AER's flat bump. */
  bonus: number;
}

/**
 * The chain that assigns one activity per region — **first match wins**.
 *
 * Sourced from map features rather than trade goods, because goods cannot carry
 * it: Azgaar derives them from `biomeOutput`, so goods 1 / 9 / 12 / 21 appear in
 * 94–100 % of regions and filtering to distinctive goods covers 6 of 127. Nor
 * does any single signal work on its own — measured on the sample world, POIs
 * cover only 27/127 (21 %) *and* there are **zero S POIs**, so a POI-only chain
 * would grant no Social activity at all, while tier (96 % at T2+) and coastal
 * (65 %) are far too common to be distinctive. Only a chain gets a usable
 * spread: 101/127 regions, M +58 / W +52 / S +92.
 *
 * The order is deliberate. Sparse map features first (a POI is a real landmark),
 * then the seat of rule, then increasingly common urban signals — so a region
 * that could claim several always takes the rarer claim.
 */
const ACTIVITY_CHAIN: readonly (RegionActivity & { readonly test: (r: ActivityRegion) => boolean })[] = [
  { name: "Martial Tradition", pool: "m", bonus: 2, test: r => r.poi.m > 0 },
  { name: "Vigorous Trade", pool: "w", bonus: 2, test: r => r.poi.w > 0 },
  { name: "Councils", pool: "s", bonus: 2, test: r => r.capital },
  { name: "Production Center", pool: "w", bonus: 2, test: r => r.topTier >= 5 },
  { name: "Strong Society", pool: "s", bonus: 2, test: r => r.t3Plus >= 3 },
  // AER's own Mutual Defense: a port worth defending, held at rank.
  { name: "Mutual Defense", pool: "m", bonus: 2, test: r => r.port && r.topTier >= 4 }
];

/** The map features the chain reads, gathered once per region. */
interface ActivityRegion {
  poi: Record<Pool, number>;
  capital: boolean;
  port: boolean;
  topTier: number;
  t3Plus: number;
}

/**
 * A region's activity, or `null` when it is an ordinary place with nothing
 * remarkable about it — which is the common case in AER and deliberately so:
 * 26 of 127 regions on the sample world have no activity at all.
 *
 * Deterministic: pack order, first match wins.
 *
 * **AER defines no Cunning activity** — its ten grant M, W or S only — so this
 * returns nothing for C and Cunning stays driven by capitals, rough terrain and
 * spy networks. Adding a C activity would be ours, not the source's.
 */
export function regionActivity(ctx: EngineCtx, regionId: number): RegionActivity | null {
  const { pack, campaign } = ctx;
  const region = pack.regions.find(r => r.id === regionId);
  if (!region) return null;

  const poi: Record<Pool, number> = { m: 0, w: 0, s: 0, c: 0 };
  const owned = campaign.regions[String(regionId)];
  if (owned) {
    const cellToRegion = new Map<number, number>();
    for (const c of region.cells) cellToRegion.set(c, regionId);
    for (const p of pack.pois) {
      if (!p.capacityType || cellToRegion.get(p.cell) !== regionId) continue;
      poi[p.capacityType]++;
    }
  }

  let capital = false;
  let port = false;
  let topTier = 0;
  let t3Plus = 0;
  for (const sid of region.settlements) {
    const s = pack.settlements[sid];
    if (!s) continue;
    if (s.capital) capital = true;
    if (s.port) port = true;
    if (s.tier > topTier) topTier = s.tier;
    if (s.tier >= 3) t3Plus++;
  }

  const feature: ActivityRegion = { poi, capital, port, topTier, t3Plus };
  for (const entry of ACTIVITY_CHAIN) {
    if (entry.test(feature)) return { name: entry.name, pool: entry.pool, bonus: entry.bonus };
  }
  return null;
}

/** Every activity the chain can grant, for exhaustiveness checks in tests. */
export const ACTIVITY_NAMES: readonly string[] = ACTIVITY_CHAIN.map(a => a.name);

/**
 * The value a *roll* reads: the Domain's generation, plus its activity's bump.
 *
 * AER line 467 calls an activity *"a modifier to its values"*, so the +2 is
 * applied to the value **before** the ladder is read — a town at W 5 with Expert
 * Artisans rolls as W 7. `regionValues` stays raw, because AER line 1424 is
 * explicit that a Domain's *score* is its generation: an activity changes what
 * you can roll, never what you can spend.
 */
export function effectiveValue(ctx: EngineCtx, regionId: number, pool: Pool): number {
  const raw = domainValue(ctx, regionId, pool);
  const activity = regionActivity(ctx, regionId);
  return activity && activity.pool === pool ? raw + activity.bonus : raw;
}

/** AER's six saving throws — two per value (line 1437). */
export const SAVES = {
  m: ["uprising", "disorder"],
  w: ["poverty", "ignorance"],
  s: ["despair", "corruption"]
} as const;

/**
 * AER defines no throw for Cunning — its six are two each for M, W and S. C
 * carries a pool in the ledger but nothing rolls against it yet, so this union
 * is deliberately narrower than {@link Pool}.
 */
export type SaveKind = (typeof SAVES)[keyof typeof SAVES][number];

/** Which value a throw draws on. Cunning has no AER throw of its own yet. */
export const SAVE_POOL: Record<SaveKind, Pool> = {
  uprising: "m",
  disorder: "m",
  poverty: "w",
  ignorance: "w",
  despair: "s",
  corruption: "s"
};

/** Floor of each modifier band (AER line 1425). */
export const DEFAULT_BANDS = [6, 11, 16, 21] as const;
/** Open-ended tail: every +5 of value past the last band is +1 more. */
export const DEFAULT_BAND_STEP = 5;

/**
 * AER's value-modifier table (line 1425):
 *
 * ```
 *   0–5 +0 | 6–10 +1 | 11–15 +2 | 16–20 +3 | then +5 value → +1 more
 * ```
 *
 * Checked against line 1768's worked Domain (M 4 → +0, W 6 → +1, S 6 → +1).
 * `bands` are the *floors*, so `6` opens the +1 band and `21` opens +4.
 */
export function valueModifier(
  value: number,
  bands: readonly number[] = DEFAULT_BANDS,
  bandStep: number = DEFAULT_BAND_STEP
): number {
  let mod = 0;
  for (const band of bands) if (value >= band) mod++;
  // The table's last row is open-ended: 21–25 is +4, 26–30 is +5, and so on.
  const top = bands[bands.length - 1];
  if (top !== undefined && bandStep > 0 && value >= top) {
    mod += Math.floor((value - top) / bandStep);
  }
  return mod;
}

/**
 * A region's Domain values: its static capacity plus the capacity of every
 * building standing in it. Mirrors `recomputeCapacity`'s *generation* arm
 * exactly, minus the faction-wide load (armies, characters) that has no region
 * to belong to.
 *
 * Returns the region's **generation**, which is what AER scores against — see
 * the note in `regionValues` callers: load never enters a Domain value.
 */
export function regionValues(ctx: EngineCtx, regionId: number): CapacityPoints {
  const { pack, campaign, content } = ctx;
  const region = pack.regions.find(r => r.id === regionId);
  if (!region) return { m: 0, w: 0, s: 0, c: 0 };

  const out: CapacityPoints = { ...region.stats.capacity };
  const rs = campaign.regions[String(regionId)];
  if (!rs) return out;

  const buildingById = new Map(content.buildings.map(b => [b.id, b]));
  for (const bid of rs.buildings) {
    const cap = buildingById.get(bid)?.effects.capacity;
    if (!cap) continue;
    out.m += cap.m;
    out.w += cap.w;
    out.s += cap.s;
    out.c += cap.c;
  }
  // CAPACITY-PLAN Phase 3: a developed settlement generates, so the Domain's
  // value rises with it — the same +1 W and +1 S the ledger counts. A grown
  // town is a *bigger* town, and AER scores a Domain on what it generates.
  const bonus = developmentBonus(ctx, regionId);
  out.w += bonus;
  out.s += bonus;
  return out;
}

/** The Domain's value in the pool a check or throw draws on. */
export function domainValue(ctx: EngineCtx, regionId: number, pool: Pool): number {
  return regionValues(ctx, regionId)[pool];
}

export interface SaveRoll {
  /** Which throw was rolled. */
  kind: SaveKind;
  /** The value pool it draws on. */
  pool: Pool;
  /** The Domain's generation in that pool — what AER calls its *score*. */
  raw: number;
  /** Generation plus any {@link RegionActivity} bump — what the ladder reads. */
  value: number;
  /** The activity that raised it, if the region has one for this pool. */
  activity: string | null;
  /** Ladder modifier applied to the die. */
  modifier: number;
  /** 1d20. */
  roll: number;
  dc: number;
  success: boolean;
}

/**
 * Roll 1d20 + modifier against the difficulty. AER's own DC is 12 (line 1437),
 * which a +0 Domain meets 45% of the time and a +3 Domain 60% of the time —
 * the ladder is deliberately shallow, so a Domain never becomes untouchable.
 */
export function rollSave(ctx: EngineCtx, regionId: number, kind: SaveKind, dcOverride?: number): SaveRoll {
  const cfg = ctx.config.saves;
  const pool = SAVE_POOL[kind];
  const raw = domainValue(ctx, regionId, pool);
  const value = effectiveValue(ctx, regionId, pool);
  const activity = regionActivity(ctx, regionId);
  const modifier = valueModifier(value, cfg.bands, cfg.bandStep);
  const roll = 1 + Math.floor(rng(ctx.campaign) * 20);
  const dc = dcOverride ?? cfg.defaultDc;
  return {
    kind,
    pool,
    raw,
    value,
    activity: activity && activity.pool === pool ? activity.name : null,
    modifier,
    roll,
    dc,
    success: roll + modifier >= dc
  };
}

/** A value check's outcome — 1d20 + modifier, no difficulty of its own. */
export interface ValueCheck {
  pool: Pool;
  /** The Domain's generation in that pool. */
  raw: number;
  /** Generation plus any {@link RegionActivity} bump — what the ladder reads. */
  value: number;
  /** The activity that raised it, if the region has one for this pool. */
  activity: string | null;
  /** Ladder modifier applied to the die. */
  modifier: number;
  /** 1d20. */
  roll: number;
}

/**
 * AER line 1435's *offensive* roll: 1d20 + the value's modifier, no DC — the
 * caller compares against a target number of its own choosing.
 */
export function rollValueCheck(ctx: EngineCtx, regionId: number, pool: Pool): ValueCheck {
  const cfg = ctx.config.saves;
  const raw = domainValue(ctx, regionId, pool);
  const value = effectiveValue(ctx, regionId, pool);
  const activity = regionActivity(ctx, regionId);
  const modifier = valueModifier(value, cfg.bands, cfg.bandStep);
  const roll = 1 + Math.floor(rng(ctx.campaign) * 20);
  return {
    pool,
    raw,
    value,
    activity: activity && activity.pool === pool ? activity.name : null,
    modifier,
    roll
  };
}

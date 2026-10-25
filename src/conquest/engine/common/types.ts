/**
 * Layer contracts for the TotalWar engine (total-war/.plans/PLAN.md §2.1 principle 5).
 *
 * These types are the single source of truth shared by:
 *   - src/compiler  → must produce a valid `MapPack`
 *   - src/engine    → consumes `MapPack` + owns mutable `Campaign` (later phases)
 *   - src/server    → serializes only JSON shaped by these types
 *   - TS clients    → may import these types directly (wire format is JSON)
 */

// ---------------------------------------------------------------------------
// Map pack — immutable output of the compiler (total-war/.plans/PLAN.md §3.2)
// ---------------------------------------------------------------------------

interface MapPackMeta {
  mapId: string;
  name: string;
  azgaarSeed: string;
  azgaarVersion: string;
  compilerVersion: string;
  /** Source file basename, for traceability. Excluded from the content hash. */
  sourceFile: string;
  /** ISO timestamp. Excluded from the content hash (see hashMapPack). */
  compiledAt: string;
  width: number;
  height: number;
  /** sha256 of the canonical form of everything except volatile meta fields. */
  contentHash: string;
}

// -- Graph ------------------------------------------------------------------

/** A land cell (Azgaar cell with h >= 20). Array index === `id`. */
export interface LandCell {
  id: number;
  /** Position in map units. */
  p: [number, number];
  /** Azgaar biome id (see `biomeLegend`). */
  biome: number;
  /** River id flowing through the cell, or 0. */
  river: number;
  /** 0 = off-road, 1 = trail, 2 = road. */
  road: 0 | 1 | 2;
  /** Adjacent sea cell id (Azgaar `haven`), or 0. */
  haven: number;
  /** Region (province) id, or 0 for unclaimed land. */
  region: number;
  /** Faction (state) id, or 0. */
  faction: number;
}

/** Land edge tuple: [fromCellId, toCellId, biomeCostAvg, roadFlag, crossesRiver].
 *  from < to; cost is pre-road (engine applies multipliers). */
export type LandEdge = [number, number, number, 0 | 1 | 2, 0 | 1];

/** A navigable sea cell (ocean feature; lakes excluded). `id` is the Azgaar cell id. */
export interface SeaCell {
  id: number;
  p: [number, number];
  /** True when the cell is part of a searoute. */
  searoute: boolean;
}

/** Sea edge tuple: [fromCellId, toCellId, onSearoute]. */
export type SeaEdge = [number, number, 0 | 1];

/** Embarkation link tuple: [landCellId, seaCellId] — harbor land cell to its adjacent
 *  sea cell (total-war/.plans/PLAN.md §3.3, v1 transports-only rule for island factions like Chok't). */
export type EmbarkLink = [number, number];

// -- Political geography ----------------------------------------------------

type SettlementKind = "major" | "minor";

export interface Settlement {
  /** Pack-local id (array index). */
  id: number;
  /** Azgaar burg id; null when auto-placed for a burgless province (total-war/.plans/PLAN.md §3.3). */
  burgId: number | null;
  name: string;
  regionId: number;
  cell: number;
  kind: SettlementKind;
  /** Faction capital settlement (Azgaar `burg.capital` or auto-placed province capital). */
  capital: boolean;
  port: boolean;
  /** Fortification tier: walls (1) + citadel (1), range 0..2. */
  walls: number;
  /** Burg population in thousands; 0 for auto-placed. */
  population: number;
  /**
   * Development tier, **0–5** (CAPACITY-PLAN §1 *Tiered settlements*). Compiled
   * from `population` against {@link SETTLEMENT_TIER_STEPS} — a geometric ladder,
   * so each step doubles rank. **Tier 0 generates nothing** until the settlement
   * is developed in play: a hamlet too small to pay its way is a real thing, and
   * it is the raw material the `Develop` path works on.
   */
  tier: number;
  pos: [number, number];
}

/**
 * Capacity **points**, per pool (CAPACITY-PLAN §1). v1 uses four: M military,
 * W wealth, S social, C cunning. All are *static per-turn* stocks — generation
 * minus load — never an accumulating balance.
 *
 * Named for what it holds rather than who holds it: the same four numbers are a
 * region's generation, a building's output, a building's upkeep, and a unit's
 * cost. Every one of them is points in a pool, and the direction is always
 * spelled out by the field that carries them — `capacity` generates,
 * `capacityCost` and `upkeep` consume.
 */
export interface CapacityPoints {
  m: number;
  w: number;
  s: number;
  c: number;
}

/** One pool of a faction's capacity: what it generates vs. what it carries. */
export interface CapacityPool {
  /** Points generated this tick from held locations and buildings. */
  gen: number;
  /** Points loaded by held assets - armies, characters, buildings. */
  load: number;
}

/**
 * A faction's capacity ledger, per pool (CAPACITY-PLAN S1). `free = gen - load`
 * is the number a decision actually turns on.
 *
 * Shadow data through Phase 2: recomputed every tick, read by no gameplay until
 * Phase 3 gates play on it. Optional so a `.map` written by an older build
 * replays cleanly.
 */
export type FactionCapacity = Record<"m" | "w" | "s" | "c", CapacityPool>;

interface RegionStats {
  /** Square map-area units (Azgaar cell.area sum). */
  area: number;
  /** Total population in people: rural (cell.pop × populationRate) + urban (burgs × 1000). */
  population: number;
  /** Population-weighted biome habitability, 0..100. */
  habitability: number;
  /** biome id → land cell count. */
  biomeCounts: Record<number, number>;
  /**
   * Trade goods this region produces, as Azgaar good ids — derived from the
   * region's biome set intersected with each good's `biomeOutput` keys
   * (ECONOMY-PLAN Phase 2). Sorted ascending, so the array is order-stable and
   * a `stateHash` over it is deterministic.
   *
   * Only goods that publish `biomeOutput` can appear; on the sample world that
   * is 16 of 71. Empty is legal — a region of pure ocean-facing rock may
   * produce nothing the compiler can name.
   */
  specialties: number[];
  /**
   * What this region generates for whoever holds it (CAPACITY-PLAN §1). Static
   * map data — no behaviour reads it yet; Phase 2 turns it into a shadow ledger
   * and Phase 3 gates play on it. `Settlement.tier` 0–5 plus the region's own
   * levy base, specialty goods and POIs are folded in by the compiler.
   */
  capacity: CapacityPoints;
  coastal: boolean;
  /** Count of river cells. */
  rivers: number;
}

export interface Region {
  /** Azgaar province id. */
  id: number;
  name: string;
  /** Owning faction (Azgaar state id), or 0 for unclaimed. */
  factionId: number;
  /** Settlement ids (pack-local) belonging to this region. */
  settlements: number[];
  /** Province center cell (auto-capital anchor). */
  capitalCell: number;
  /** Land cell ids of this region. */
  cells: number[];
  stats: RegionStats;
  /** Majority culture id (tie-break: lowest id), or 0. */
  culture: number;
  /** Majority religion id (tie-break: lowest id), or 0. */
  religion: number;
  /** Burgs present but not selected as settlements (flavor: population/trade only). */
  flavorBurgs: number;
}

// -- Factions ----------------------------------------------------------------

export type RelationLabel =
  | "Unknown"
  | "Neutral"
  | "Friendly"
  | "Ally"
  | "Suspicion"
  | "Rival"
  | "Enemy"
  | "Suzerain"
  | "Vassal";

/** Initial relation from one faction's perspective (matrix row). */
interface Relation {
  factionId: number;
  label: RelationLabel | "War";
  /** Mapped score −100..+100: Ally 80, Friendly 40, Neutral/Unknown 0, Suspicion −30,
   *  Rival −60, Enemy −90, War −100, Suzerain/Vassal 50. */
  score: number;
}

export interface War {
  name: string;
  /** The two directly-warring faction ids, ascending. */
  between: [number, number];
  /** Raw Azgaar detail lines ("X's vassal Y joined the war…"). */
  details: string[];
}

export interface HistoricalWar {
  name: string;
  start: number;
  /** Absent when the war is ongoing (also surfaced in `wars` if reported in diplomacy). */
  end?: number;
  attacker: number;
  defender: number;
}

export interface Faction {
  /** Azgaar state id. */
  id: number;
  name: string;
  fullName: string;
  form: string;
  formName: string;
  color: string;
  culture: number;
  religion: number;
  rosterId?: string;
  /** Azgaar expansionism (seeds AI aggression, total-war/.plans/PLAN.md §5.11). */
  expansionism: number;
  /** Azgaar starting treasury. */
  treasury: number;
  /**
   * Azgaar sales tax (0–1): the slice taken on deals *this faction sells*.
   * Compiled from `pack.states[].salesTax`, and **read by nothing yet** — the
   * engine's income model is `taxPer1000Pop` (a ruleset constant), not the
   * map's per-state tax form. Carried so Phase 1 of `ECONOMY-PLAN.md` can make
   * it load-bearing; until then it is inert data, not a lie in the UI.
   *
   * Sample world (`sample-world.json`, 16 states): 0.04 (Chuyench) … 0.22 (Thelhona).
   */
  salesTax: number;
  /**
   * Azgaar poll tax: a flat per-capita levy across the whole state's population.
   * Compiled from `pack.states[].pollTax`, and **read by nothing yet** — same
   * status as {@link Faction.salesTax}. In FMG it carries an approval cost;
   * Phase 1 proposes mirroring that as a public-order drag so a high poll tax
   * buys short-term gold at a stability price.
   *
   * Sample world: 0.11 (Thelhona) … 0.25 (Thelese).
   */
  pollTax: number;
  capitalRegion: number;
  capitalCell: number;
  regions: number[];
  /** Matrix row: this faction's stance toward every other faction (excluding self). */
  relations: Relation[];
  /** Wars this faction is fighting at campaign start. */
  wars: War[];
  history: HistoricalWar[];
  /** Factions this one is the suzerain (overlord) of. */
  suzerainOf: number[];
  /** Overlord of this faction, if vassal. */
  vassalOf: number | null;
}

// -- Military, POIs, flavor ---------------------------------------------------

export interface ArmyUnit {
  type: string;
  /** Current men (0..UnitType.men). */
  count: number;
  /** Experience 0..9. */
  exp: number;
}

export interface StartingArmy {
  id: string;
  factionId: number;
  name: string;
  cell: number;
  /** n === 1 in Azgaar (fleet regiment). */
  fleet: boolean;
  units: Record<string, number>;
  slots?: ArmyUnit[];
  /** Total regiment strength (Azgaar `a`). */
  strength: number;
}

export interface Poi {
  id: number;
  type: string;
  name: string;
  cell: number;
  pos: [number, number];
  /** Volcano height, dungeon flavor, etc. */
  note?: string;
  /**
   * Which pool this POI feeds when cleared (CAPACITY-PLAN §1): martial ruins
   * are M, treasure is W, dens of secrets are C. `undefined` means the marker
   * grants no capacity at all (an inn, a bridge, a waterfall).
   */
  capacityType?: "m" | "w" | "s" | "c";
}

export interface Zone {
  id: number;
  name: string;
  type: string;
  cells: number[];
}

// -- Root ---------------------------------------------------------------------

/** One settlement's founding assets: the region it sits in, and the chains it starts with. */
export interface StartingAsset {
  regionId: number;
  /**
   * Asset chains this settlement begins with, e.g. `["market", "walls"]`.
   * Known v1 chains: `market`, `harbor`, `temple`, `shadows`. (`walls` and
   * `barracks` are no longer chains — they are a province's *footing*, see
   * {@link StartingAsset.militaryNeed}.)
   * Resolved to buildings at campaign creation; unknown chains are ignored.
   */
  chains: string[];
  /**
   * How much Military capacity this region's founding assets must cover
   * (CAPACITY-PLAN §4.5) — the region's *wartime footing*, in points.
   *
   * A realm's people can mobilise `alert × population ÷ MEN_PER_BLOCK` blocks
   * of men, and a block costs 2 M to house, so a province's walls and its
   * barracks must cover that many points between them. The **tier** is
   * resolved at campaign creation against the live ruleset, so a ruleset that
   * prices its barracks differently still gets a coherent founding
   * establishment — the need is a point value, which is content-independent.
   */
  militaryNeed?: number;
}

export interface MapPack {
  meta: MapPackMeta;
  /** Biome id → movement cost / habitability, copied from Azgaar for engine use. */
  biomeLegend: Record<number, { name: string; cost: number; habitability: number }>;
  /**
   * Trade good id → its name (Azgaar's own). The regions carry only good
   * *ids* in their specialties, so a gate that refuses a unit for want of a good
   * needs the name to say *which* good — "no region of yours yields Horses",
   * not "no region of yours yields good 18".
   */
  goods: Record<string, string>;
  /** Culture id → name + nameBase index (content bindings + name pools). */
  cultures: { i: number; name: string; base: string }[];
  graph: {
    land: { cells: LandCell[]; edges: LandEdge[] };
    sea: { cells: SeaCell[]; edges: SeaEdge[] };
    embark: EmbarkLink[];
  };
  regions: Region[];
  settlements: Settlement[];
  factions: Faction[];
  armies: StartingArmy[];
  pois: Poi[];
  zones: Zone[];
  /**
   * What each state already holds at campaign start (CAPACITY-PLAN §1 *Starting
   * domains*). **Chain names, not building ids** — the compiler does not know the
   * content pack, so it records *what kind* of asset each settlement begins with
   * and `createCampaign` resolves each chain to its tier-1 building from the live
   * ruleset. Government form shifts the mix here, never the size.
   */
  startingAssets: StartingAsset[];
  /** nameBase index → name pool (settlement + ruler names) for procedural naming. */
  namePools: Record<string, string[]>;
}

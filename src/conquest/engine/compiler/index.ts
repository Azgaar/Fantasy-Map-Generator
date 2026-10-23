/**
 * Map compiler (total-war/.plans/PLAN.md §3): Azgaar FMG export → immutable MapPack.
 *
 * Pure function: same input ⇒ identical output (determinism is golden-tested).
 * Translation rulings live in §3.3 of total-war/.plans/PLAN.md and are referenced inline.
 */

import { MEN_PER_BLOCK } from "../common/content";
import { canonicalHash } from "../common/prng";
import type {
  EmbarkLink,
  Faction,
  HistoricalWar,
  LandCell,
  LandEdge,
  MapPack,
  Poi,
  Region,
  RelationLabel,
  SeaCell,
  SeaEdge,
  Settlement,
  StartingArmy,
  StartingAsset,
  War,
  Zone
} from "../common/types";
import type { AzgaarBurg, AzgaarCell, AzgaarCulture, AzgaarMap, AzgaarState } from "./azgaar";

const COMPILER_VERSION = "0.1.0";

/** Max minor settlements allowed for any region. */
export const MAX_MINOR_SETTLEMENTS = 3;

/**
 * Bounds minor settlements by region land cell count:
 *  - Under 5 cells: 0 minor settlements
 *  - 5 to 10 cells: 1 minor settlement
 *  - 11 to 30 cells: 2 minor settlements
 *  - 31+ cells: 3 minor settlements
 */
export function maxMinorSettlementsForCells(cellCount: number): number {
  if (cellCount < 5) return 0;
  if (cellCount <= 10) return 1;
  if (cellCount <= 30) return 2;
  return MAX_MINOR_SETTLEMENTS;
}

/** Max names kept per name pool (pack-size guard). */
const MAX_NAMES_PER_POOL = 150;

const RELATION_SCORES: Record<string, number> = {
  Ally: 80,
  Friendly: 40,
  Neutral: 0,
  Unknown: 0,
  Suspicion: -30,
  Rival: -60,
  Enemy: -90,
  Suzerain: 50,
  Vassal: 50
};

/**
 * `Sample World` → `sample-world`: the filename stem for a pack compiled from an export.
 */
export function packSlug(pack: MapPack): string {
  return pack.meta.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Id for a pack compiled from a live world: `<name>-<seed>`.
 *
 * Both runtimes must agree on this string, because it becomes the campaign's
 * `mapPackId` — which is part of the state hash. A page that named its pack
 * `1791916147185` while the server called the same world `world-799869553` would
 * produce two different hashes for one identical campaign, and the parity harness
 * would report a divergence that is really just a filename.
 */
export function worldPackId(name: string, seed: string | number | null | undefined): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "world";
  return seed != null && String(seed) !== "" ? `${slug}-${seed}` : slug;
}

export interface CompileResult {
  pack: MapPack;
  /** Canonical content hash (meta timestamps excluded) — identical across runs. */
  contentHash: string;
}

export function compileAzgaar(raw: AzgaarMap): CompileResult {
  const pack = buildPack(raw);
  const { meta, ...content } = pack;
  const contentHash = canonicalHash({ mapId: meta.mapId, ...content });
  pack.meta.contentHash = contentHash;
  return { pack, contentHash };
}

// ---------------------------------------------------------------------------
// Cell indexing helpers
// ---------------------------------------------------------------------------

function buildCellArray(raw: AzgaarMap): AzgaarCell[] {
  const keys = Object.keys(raw.pack.cells);
  const max = Math.max(...keys.map(Number));
  const cells: (AzgaarCell | undefined)[] = new Array(max + 1);
  for (const key of keys) {
    const cell = raw.pack.cells[key]!;
    cells[cell.i] = cell;
  }
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) throw new Error(`Azgaar cells not dense: missing index ${i}`);
  }
  return cells as AzgaarCell[];
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

/**
 * Settlement tier ladder — **the balance knob for CAPACITY-PLAN §1**.
 *
 * A settlement's tier is the count of steps its burg population (in thousands)
 * has reached, so tiers run 0..5 and **tier 0 generates nothing** until the
 * settlement is developed in play. Geometric on purpose (1/2/4/8/16): each step
 * doubles rank, so the ladder is predictable without a reference table, and
 * re-tuning one rung does not reshuffle every other.
 *
 * **To re-tune, edit the array below.** Measured on `sample-world.json` (337
 * compiled settlements, populations 0.5k–43.5k): **10 / 28 / 24 / 91 / 148 / 36**
 * across tiers 0–5 — ten T0 hamlets that begin as dead weight, and 36 true T5
 * cities. The 16 faction capitals land T3 (Lefranthe, 4.65k) through T5 (Khat,
 * 43.5k) — no capital sits below T3, and a minor realm's capital is simply a
 * lesser city. Every settlement lands in 0..5; the ladder is the only knob.
 *
 * Changing this changes the pack `contentHash` (settlements carry `tier`), which
 * is expected and needs no golden re-baseline — see ECONOMY-PLAN §5.
 */
export const SETTLEMENT_TIER_STEPS = [1, 2, 4, 8, 16] as const;

/** Highest reachable settlement tier — `SETTLEMENT_TIER_STEPS.length`. */
export const MAX_SETTLEMENT_TIER = SETTLEMENT_TIER_STEPS.length;

/**
 * **Region** tier thresholds, in thousands of people — the CAPACITY-PLAN §4.7
 * move from a *sum over settlements* to a *single value for the region*.
 *
 * A region's Wealth and Social generation used to be `Σ settlement.tier`, which
 * summed to **1,121 across 127 regions (mean 8.83)**. That is a meaningless
 * number: it counts *how many burgs a province happens to contain*, so a
 * province with eight hamlets out-generates a province with one city, and the
 * world ended up generating W and S at **3.70× and 3.48×** its Military while
 * its units consume them at **1.12× and 0.39×**. AER scores a Domain by what it
 * *is*, not by how many places stand inside it.
 *
 * The requirement is that MWCS reads the **region, by population**, so this
 * ladder replaces the sum:
 *
 * | tier | a region of at least | on this map |
 * |---|---|---|
 * | 0 | — | 21 regions under 100k |
 * | 1 | 100,000 | 41 |
 * | 2 | 200,000 | 37 |
 * | 3 | 400,000 | 26 |
 * | 4 | 800,000 | 2 |
 * | 5 | 1,600,000 | 0 — **headroom** |
 *
 * It is deliberately the *same shape* as {@link SETTLEMENT_TIER_STEPS} —
 * geometric, ratio 2 — just anchored a hundredfold higher, because a region is
 * an order of population above a burg. `SETTLEMENT_TIER_STEPS` runs 1k…16k for
 * settlements; this runs 100k…1.6M for regions. Region populations on
 * `sample-world.json` span 4.5k…968k (median 201k), so T5 sits above the
 * current map: the ladder has a rung left for a bigger world rather than
 * pinning every region to its top tier.
 *
 * **Measured effect** (127 owned regions, founding assets included):
 *
 * ```
 *                  Σtier   W gen   S gen    W:M   S:M   gap vs units
 *   Σ settlements   1,121   1,450   1,363   3.70  3.48   3.04x / 8.86x
 *   region ladder     201     530     443   1.35  1.13   1.11x / 2.88x
 * ```
 *
 * W lands within 11% of what its units actually consume. S stops at 2.88× and
 * should not be pushed further: S's *assets alone* (242) already sit at 1.6×
 * the target, and `campaign.characters` is empty — the espionage and character
 * load that will consume S has not landed yet, so tuning S to its unit ratio
 * would pre-pay for a system that does not exist.
 *
 * **Military is deliberately absent from this ladder.** §4.5 locks the lever for
 * M as barracks *count* — capacity must cost something, so a populous region
 * builds M rather than generating it. M still reads the region (1 levy + POIs +
 * assets); it just is not population-scaled directly.
 *
 * **To re-tune, edit the array below.** Units are thousands of population. It is
 * a pack-level constant, so changing it changes `contentHash` — expected, no
 * golden re-baseline (ECONOMY-PLAN §5).
 */
export const REGION_TIER_STEPS = [100, 200, 400, 800, 1600] as const;

/** Highest reachable region tier — `REGION_TIER_STEPS.length`. */
export const MAX_REGION_TIER = REGION_TIER_STEPS.length;

/**
 * Re-export of {@link MEN_PER_BLOCK} — the conversion that turns a mobilisation
 * alert into a capacity load.
 *
 * AER is explicit that its points do not move with scale (line 1557):
 * *"Military units might represent blocks of 1,000 or even 10,000 men… In all
 * cases, the Military, Wealth, and Social points… remain the same."* The lever
 * is men-per-block, never points — so this constant, and not any capacity value,
 * is how the engine reconciles FMG's military data with AER's point economy.
 *
 * It *lives* beside `UnitType` in `common/content.ts`, because it is what
 * derives `UnitType.men` from the authored `UnitType.blocks`. It is re-exported
 * here so every capacity tuning knob — `SETTLEMENT_TIER_STEPS`,
 * `REGION_TIER_STEPS`, `MEN_PER_BLOCK` — is reachable from the one module the
 * plan says to re-tune.
 *
 * **Load-bearing since CAPACITY-PLAN Phase 4b**: a unit loads
 * `(count ÷ MEN_PER_BLOCK) × capacity` onto the ledger, so the peacetime map
 * reads **M 88.9 mobilised against 392 generated** — an alert of 0.17 %, well
 * under AER's own 1,000-man floor. The constant's own doc carries the full
 * ladder (1,445 buys 1 %, 7,224 buys 5 %).
 */
export { MEN_PER_BLOCK } from "../common/content";

/**
 * Region capacity generation (CAPACITY-PLAN §1, re-scoped in §4.7) — v1 weights,
 * also balance knobs.
 *
 * A region's `capacity` is what it generates for whoever holds it:
 *
 * | Source | Grants |
 * |---|---|
 * | the region itself | +1 M (a levy base — every province can raise men) |
 * | the region's own tier from population | +tier W, +tier S — see {@link REGION_TIER_STEPS} |
 * | specialty goods | nothing — {@link SPECIALTY_W_CAP} is **0**, see below |
 * | a POI | +1 of its {@link Poi.capacityType} |
 * | the faction capital's region | +{@link CAPITAL_CUNNING} C (a court runs eyes) |
 * | a rough-terrain minor settlement | +1 C (hard country breeds smugglers) |
 *
 * **W and S are a property of the region, not a tally of its burgs.** They used
 * to be `Σ settlement.tier`; §4.7 replaced that with one tier compiled from the
 * region's population, so a province is scored by how many people it has rather
 * than by how many settlements happen to stand in it. M is *not* population
 * scaled — §4.5 locks its lever as barracks count, because capacity must cost
 * something to build.
 */
const REGION_LEVY_M = 1;

/**
 * W granted per specialty good, capped per region — **set to 0**.
 *
 * Specialties used to be a W generator: `min(2, marks)` per region, which summed
 * to **254 W** across the sample world — a flat 2 W on essentially every region,
 * because Azgaar's goods derive from `biomeOutput` and are therefore *climate,
 * not economic signature*. Measured: goods 1 / 9 / 12 / 21 appear in 94–100 % of
 * regions, and filtering to goods held by ≤13 regions (genuinely distinctive)
 * covers **6 of 127** regions at any threshold up to 20 % — the distribution is
 * bimodal, near-universal goods plus eight stragglers.
 *
 * So the term measured nothing about a region and simply scaled with region
 * count — the exact behaviour the region-level rescale exists to remove. Worse,
 * it made the pool *proportions* wrong: units consume M and W at roughly
 * **1 : 1.13**, but generation ran **1 : 4.05**, and this was the single largest
 * contributor to the excess.
 *
 * **Where specialties belong instead** (CAPACITY-PLAN Phase 4b):
 * - **gating** units and assets — a gate on a good held by 45 % of regions is a
 *   real constraint, and Horses→cavalry / Iron→artillery were already planned;
 * - **trade and diplomacy** — a good everyone holds is worth little on a route,
 *   which is economically correct and self-balancing;
 * - **check modifiers**, not generation — AER p467's town activities grant a
 *   flat +2 to *one* value per settlement and are read at roll time. A modifier
 *   neither generates nor loads capacity, which is why AER can hand them out
 *   without breaking its economy.
 *
 * Non-zero restores W generation. It is not expected to: the proportions above
 * are the tuning target, and re-enabling this moves them the wrong way.
 */
const SPECIALTY_W_CAP = 0;
const CAPITAL_CUNNING = 2;

/** Biomes whose back country hides people: forests, taiga, tundra, wetland. */
const ROUGH_BIOMES = new Set([5, 6, 7, 8, 9, 10, 12]);

/**
 * Which pool each Azgaar marker feeds when cleared. Unlisted marker types grant
 * nothing — an inn or a bridge is not a power source.
 *
 * Martial ground (battlefields, mines of iron, lairs of beasts) is M; buried
 * treasure and trade are W; ruins, dungeons, brigand dens, necropolises and
 * portals are C — dens of secrets, per CAPACITY-PLAN §1 *Cunning*.
 */
const POI_CAPACITY: Record<string, "m" | "w" | "s" | "c"> = {
  battlefields: "m",
  "hill-monsters": "m",
  mines: "m",
  brigands: "m",
  "lake-monsters": "m",
  "sea-monsters": "m",
  volcanoes: "m",
  necropolises: "w",
  statues: "w",
  ruins: "c",
  dungeons: "c",
  caves: "c",
  "disturbed-burials": "c",
  rifts: "c",
  portals: "c",
  libraries: "c"
};

/**
 * The war alert the founding assets are built to support — CAPACITY-PLAN §4.5,
 * and the knob that sizes every realm's starting Military capacity.
 *
 * **A realm's founding barracks follow `alert × population ÷ MEN_PER_BLOCK`**,
 * not its region count. That is the whole of §4.5: generation must track the
 * *people* a realm governs, because the load side tracks the people it can
 * mobilise, and a lever that tracks regions lets a small realm of many
 * hamlets out-muster a large one.
 *
 * The load is `blocks × 2 M` (a block of line infantry costs 2 M to house), and
 * one tier-1 Barracks is 2 M — so one barracks is exactly one block, and the
 * barracks count *is* the block count. Measured on `sample-world.json`:
 *
 * ```
 *   alert    world men   M gen needed   barracks   per region   verdict
 *     0.4%       131,299            655       328          2.6   fits
 *     1.0%       328,246          1,312       656          5.2   fits
 *     2.0%       656,493          2,625     1,312         10.3   tight
 *     5.0%     1,641,232          6,565     3,282         25.8   unsupported
 * ```
 *
 * **1 % is the ceiling this map's asset economy can carry.** Beyond it a region
 * would need more barracks than a province can meaningfully house, and the
 * alternative — inflating what one barracks produces — is exactly the failure
 * the capacity pivot exists to prevent: it would let a realm buy an army for a
 * single building. So the lever is the **count**, and the count costs gold
 * because a barracks has to be *built*.
 *
 * Raising `MEN_PER_BLOCK` instead is the other lever, and AER-legal: a block
 * of 10,000 men is still one block, so the same 1 % alert needs a tenth of the
 * barracks. Neither touches a point value.
 */
export const FOUNDING_ALERT = 0.01;

/**
 * Military capacity one AER **block** of men costs to house — the AER line
 * infantry rate (2 M), and the yardstick every mobilisation is priced in.
 *
 * AER p1719 prices a block of line infantry at 2 M; every other military unit
 * type sits near it (levy 0 M, horse 3 M, artillery 4 M). It is a policy
 * number rather than content, because it says what the *model* charges for a
 * soldier, not what a particular ruleset calls a barracks.
 */
export const M_PER_MEN_BLOCK = 2;

/**
 * How much Military capacity a region's founding assets must cover
 * (CAPACITY-PLAN §4.5).
 *
 * A realm's people can mobilise `alert × population ÷ MEN_PER_BLOCK` blocks
 * of men, and a block costs `M_PER_MEN_BLOCK` to house, so the region's
 * Military assets (its walls and its barracks, together) must cover:
 *
 * ```
 *   need = alert × population ÷ MEN_PER_BLOCK × M_PER_MEN_BLOCK
 * ```
 *
 * The result is a **need in capacity points**, not a tier and not a count: the
 * tier is resolved against the *content* at campaign creation, so a ruleset
 * that prices its barracks differently still gets a coherent founding
 * establishment. The policy lives here; the ladder lives in the roster.
 *
 * Exported so the rule is testable on its own, and so this stays the single
 * place to raise or lower how martial a realm starts.
 */
export function foundingMilitaryNeedFor(population: number): number {
  const blocks = (FOUNDING_ALERT * population) / MEN_PER_BLOCK;
  return blocks * M_PER_MEN_BLOCK;
}

/**
 * Which asset chains a founding settlement starts with, by tier and role
 * (CAPACITY-PLAN §1 *Starting domains*). Ordered highest tier first so the
 * generator can walk settlements in descending tier.
 *
 * Tier gates are a balance knob too: `settleChainsFor` is the single place to
 * raise or lower how developed a realm starts.
 *
 * Barracks and walls are **not** here: §4.5 gives a province a *footing* —
 * the tier of fortification and garrison its people oblige it to keep — and
 * that tier is resolved at campaign creation against the content. See
 * {@link foundingMilitaryNeedFor}.
 */
export function settleChainsFor(tier: number, opts: { capital: boolean; port: boolean; form: string }): string[] {
  if (tier <= 0) return []; // a T0 hamlet starts with nothing at all
  const chains: string[] = [];
  // Every seat of rule trades and watches: market + informants, always.
  if (opts.capital) {
    chains.push("market", "shadows");
    // Government form shifts the *mix*, never the size: a Republic leans trade,
    // a Theocracy leans faith. A Monarchy leans arms — but its barracks are a
    // *count* now, sized by §4.5, so it keeps no chain of its own here.
    if (opts.form === "Republic") chains.push("harbor");
    else if (opts.form === "Theocracy") chains.push("temple");
  }
  if (opts.port && opts.form !== "Theocracy") chains.push("harbor");
  if (tier >= 2) {
    chains.push("market");
    // Republics trade a tier earlier than everyone else.
    if (opts.form === "Republic") chains.push("harbor");
  }
  if (tier >= 3) chains.push("temple");
  // No "walls" here: since §4.5 a province's fortification follows its
  // *wartime footing* — the tier its people oblige it to keep — rather than
  // its settlement's development. The tier is resolved at campaign creation
  // against the content, so the recipe cannot name it.
  // Deduplicate, keep first-seen order (deterministic).
  return [...new Set(chains)];
}

/** POI type → capacity pool, or undefined when the marker grants nothing. */
export function poiCapacityType(poiType: string): "m" | "w" | "s" | "c" | undefined {
  return POI_CAPACITY[poiType];
}

/**
 * Tier for a burg population (thousands). Below the first step is tier 0.
 *
 * Auto-placed burgless provinces have no population to judge, so they pass 0 and
 * compile at T0 — the intended floor, not a degenerate case.
 */
export function tierForPopulation(populationThousands: number): number {
  if (!Number.isFinite(populationThousands)) return 0;
  let tier = 0;
  for (const step of SETTLEMENT_TIER_STEPS) if (populationThousands >= step) tier++;
  return tier;
}

/**
 * A region's own tier from its **total** population (rural + urban, in
 * thousands) — the CAPACITY-PLAN §4.7 ladder. See {@link REGION_TIER_STEPS} for
 * why this replaces `Σ settlement.tier`.
 */
export function regionTierForPopulation(populationThousands: number): number {
  if (!Number.isFinite(populationThousands)) return 0;
  let tier = 0;
  for (const step of REGION_TIER_STEPS) if (populationThousands >= step) tier++;
  return tier;
}

function buildPack(raw: AzgaarMap): MapPack {
  const cells = buildCellArray(raw);
  const { pack } = raw;

  const biomeLegend: MapPack["biomeLegend"] = {};
  for (const b of pack.biomes) {
    if (b) biomeLegend[b.i] = { name: b.name, cost: b.cost, habitability: b.habitability };
  }
  const biomeCost = (id: number): number => biomeLegend[id]?.cost ?? 100;
  const biomeHab = (id: number): number => biomeLegend[id]?.habitability ?? 0;
  const featureType = (id: number): string => pack.features[String(id)]?.type ?? "ocean";

  const burgById = new Map<number, AzgaarBurg>();
  for (const b of pack.burgs) if (b) burgById.set(b.i, b);
  const stateById = new Map<number, AzgaarState>();
  for (const s of pack.states) if (s) stateById.set(s.i, s);

  // -- Road/trail/searoute overlays (§3.1 step 2) ---------------------------
  const roadFlag = new Map<number, 0 | 1 | 2>(); // cellId → best flag
  const searouteCells = new Set<number>();
  for (const key of Object.keys(pack.routes ?? {})) {
    const route = pack.routes[key]!;
    for (const [, , cellId] of route.points) {
      if (route.group === "roads") {
        roadFlag.set(cellId, 2);
      } else if (route.group === "trails") {
        if (roadFlag.get(cellId) !== 2) roadFlag.set(cellId, 1);
      } else if (route.group === "searoutes") {
        searouteCells.add(cellId);
      }
    }
  }

  // -- Land graph (§3.1 step 2) ---------------------------------------------
  const landCells: LandCell[] = [];
  for (const cell of cells) {
    if (cell.h < 20) continue;
    landCells.push({
      id: cell.i,
      p: cell.p,
      biome: cell.biome,
      river: cell.r,
      road: roadFlag.get(cell.i) ?? 0,
      haven: cell.haven,
      region: cell.province,
      faction: cell.state
    });
  }

  const landEdges: LandEdge[] = [];
  for (const cell of cells) {
    if (cell.h < 20) continue;
    for (const n of cell.c) {
      const other = cells[n];
      if (!other || other.h < 20 || other.i <= cell.i) continue;
      landEdges.push([
        cell.i,
        other.i,
        (biomeCost(cell.biome) + biomeCost(other.biome)) / 2,
        Math.max(roadFlag.get(cell.i) ?? 0, roadFlag.get(other.i) ?? 0) as 0 | 1 | 2,
        // §3.3 rivers: boundary crossing when a river id differs between neighbors
        (cell.r > 0 || other.r > 0) && cell.r !== other.r ? 1 : 0
      ]);
    }
  }

  // -- Sea graph + embark links (§3.3 transports rule) -----------------------
  const seaCells: SeaCell[] = [];
  for (const cell of cells) {
    if (cell.h >= 20) continue;
    if (featureType(cell.f) !== "ocean") continue; // lakes excluded from v1 sea graph
    seaCells.push({ id: cell.i, p: cell.p, searoute: searouteCells.has(cell.i) });
  }
  const seaSet = new Set(seaCells.map(c => c.id));
  const seaEdges: SeaEdge[] = [];
  for (const cell of seaCells) {
    const azgaar = cells[cell.id]!;
    for (const n of azgaar.c) {
      if (!seaSet.has(n) || n <= cell.id) continue;
      seaEdges.push([cell.id, n, cell.searoute && searouteCells.has(n) ? 1 : 0]);
    }
  }
  const embark: EmbarkLink[] = [];
  for (const cell of landCells) {
    if (cell.haven > 0 && seaSet.has(cell.haven)) embark.push([cell.id, cell.haven]);
  }

  // -- Settlements (§3.1 step 3, §3.3 selection rules) -----------------------
  // Burgs → regions via cell.province (burgs carry no province field).
  const burgsByProvince = new Map<number, AzgaarBurg[]>();
  for (const burg of burgById.values()) {
    const province = cells[burg.cell]?.province ?? 0;
    if (province === 0) continue;
    const list = burgsByProvince.get(province) ?? [];
    list.push(burg);
    burgsByProvince.set(province, list);
  }

  // Land cells per province (used for cell-count settlement bounding and region stats).
  const cellsByProvince = new Map<number, AzgaarCell[]>();
  for (const cell of cells) {
    if (cell.h < 20 || cell.province === 0) continue;
    const list = cellsByProvince.get(cell.province) ?? [];
    list.push(cell);
    cellsByProvince.set(cell.province, list);
  }

  const settlements: Settlement[] = [];
  const addSettlement = (s: Omit<Settlement, "id">): number => {
    const id = settlements.length;
    settlements.push({ id, ...s });
    return id;
  };

  /** Rank chain per §3.3: population → walls → port → lowest burg id (asc). */
  const rankBurg = (a: AzgaarBurg, b: AzgaarBurg): number =>
    b.population - a.population || b.walls - a.walls || b.port - a.port || a.i - b.i;

  const settlementIdsByRegion = new Map<number, number[]>();

  for (const p of pack.provinces) {
    if (!p || p.i === 0) continue;
    const burgs = (burgsByProvince.get(p.i) ?? []).slice().sort(rankBurg);
    const ids: number[] = [];
    const major = burgs.find(b => b.i === p.burg) ?? (p.burg === 0 ? undefined : burgs[0]) ?? null;

    if (major) {
      ids.push(
        addSettlement({
          burgId: major.i,
          name: major.name,
          regionId: p.i,
          cell: major.cell,
          kind: "major",
          capital: major.capital === 1,
          port: major.port === 1,
          walls: major.walls + major.citadel,
          population: major.population,
          tier: tierForPopulation(major.population),
          pos: [major.x, major.y]
        })
      );
    } else {
      // §3.3 burgless provinces: auto-place at province center; named from the province.
      const center = cells[p.center]!;
      ids.push(
        addSettlement({
          burgId: null,
          name: p.name,
          regionId: p.i,
          cell: p.center,
          kind: "major",
          capital: false,
          port: center.harbor > 0,
          walls: 0,
          population: 0,
          // No burg, no population to judge — the T0 floor by design.
          tier: tierForPopulation(0),
          pos: center.p
        })
      );
    }

    const provinceCells = cellsByProvince.get(p.i) ?? [];
    const maxMinors = maxMinorSettlementsForCells(provinceCells.length);
    const minors = burgs.filter(b => b !== major).slice(0, maxMinors);
    for (const b of minors) {
      ids.push(
        addSettlement({
          burgId: b.i,
          name: b.name,
          regionId: p.i,
          cell: b.cell,
          kind: "minor",
          capital: false,
          port: b.port === 1,
          walls: b.walls + b.citadel,
          population: b.population,
          tier: tierForPopulation(b.population),
          pos: [b.x, b.y]
        })
      );
    }

    settlementIdsByRegion.set(p.i, ids);
  }

  // -- Regions (provinces) + stats -------------------------------------------

  /** Majority by count, tie-break lowest id (§3.3 determinism). */
  const majority = (ids: number[]): number => {
    const counts = new Map<number, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    let best = 0;
    let bestCount = -1;
    for (const [id, count] of [...counts.entries()].sort((x, y) => x[0] - y[0])) {
      if (count > bestCount) {
        best = id;
        bestCount = count;
      }
    }
    return best;
  };

  const populationRate = raw.settings.populationRate || 1000;
  const regions: Region[] = [];

  // -- Regional specialties (ECONOMY-PLAN Phase 2) -----------------------------
  // Only goods that publish structured `biomeOutput` can be attributed to a
  // region; the rest express placement only via a rule expression we don't
  // evaluate. Biome → good-id list, built once and sorted for determinism.
  const biomeGoods = new Map<number, number[]>();
  for (const g of raw.pack.goods ?? []) {
    if (!g?.biomeOutput) continue;
    for (const biomeKey of Object.keys(g.biomeOutput)) {
      const biome = Number(biomeKey);
      if (!Number.isFinite(biome)) continue;
      const list = biomeGoods.get(biome);
      if (list) list.push(g.i);
      else biomeGoods.set(biome, [g.i]);
    }
  }

  for (const p of pack.provinces) {
    if (!p || p.i === 0) continue;
    const provinceCells = cellsByProvince.get(p.i) ?? [];
    const biomeCounts: Record<number, number> = {};
    let area = 0;
    let ruralPop = 0;
    let habWeighted = 0;
    let popWeight = 0;
    let rivers = 0;
    for (const c of provinceCells) {
      area += c.area;
      ruralPop += c.pop * populationRate;
      habWeighted += biomeHab(c.biome) * c.pop;
      popWeight += c.pop;
      biomeCounts[c.biome] = (biomeCounts[c.biome] ?? 0) + 1;
      if (c.r > 0) rivers++;
    }

    // Union of the goods any biome in this region can yield, ascending.
    const specialtySet = new Set<number>();
    for (const biome of Object.keys(biomeCounts)) {
      for (const goodId of biomeGoods.get(Number(biome)) ?? []) specialtySet.add(goodId);
    }
    const specialties = [...specialtySet].sort((a, b) => a - b);
    let urbanPop = 0;
    const provinceBurgs = burgsByProvince.get(p.i) ?? [];
    for (const b of provinceBurgs) urbanPop += b.population * 1000;

    const usedBurgIds = new Set(
      (settlementIdsByRegion.get(p.i) ?? []).map(sid => settlements[sid]!.burgId).filter(id => id !== null)
    );
    const flavorBurgs = provinceBurgs.filter(b => !usedBurgIds.has(b.i)).length;

    // -- Region capacity (CAPACITY-PLAN §1, re-scoped in §4.7) ---------------
    const regionSettlements = (settlementIdsByRegion.get(p.i) ?? []).map(sid => settlements[sid]!);
    const hasCapital = regionSettlements.some(st => st.capital);
    const roughMinor = regionSettlements.some(
      st => st.kind === "minor" && st.tier > 0 && provinceCells.some(c => ROUGH_BIOMES.has(c.biome))
    );
    // Region POIs are attributed by cell → region, resolved below from the
    // marker list; this pass records the static part and the POI pass adds to it.
    const regionPoiCapacity = { m: 0, w: 0, s: 0, c: 0 };

    // §4.7: W and S are ONE tier for the region, compiled from its population —
    // not `Σ settlement.tier`. A province is scored by the people it has, not by
    // how many burgs happen to stand inside it. M stays out of this on purpose:
    // §4.5 makes barracks *count* the lever, so M must still be built.
    const regionPopulation = Math.round(ruralPop + urbanPop);
    const regionTier = regionTierForPopulation(regionPopulation / 1000);

    regions.push({
      id: p.i,
      name: p.name,
      factionId: p.state,
      settlements: settlementIdsByRegion.get(p.i) ?? [],
      capitalCell: p.center,
      cells: provinceCells.map(c => c.i),
      stats: {
        area,
        population: regionPopulation,
        habitability: popWeight > 0 ? Math.round(habWeighted / popWeight) : 0,
        biomeCounts,
        specialties,
        capacity: {
          m: REGION_LEVY_M + regionPoiCapacity.m,
          w: regionTier + Math.min(SPECIALTY_W_CAP, specialties.length) + regionPoiCapacity.w,
          s: regionTier + regionPoiCapacity.s,
          c: (hasCapital ? CAPITAL_CUNNING : 0) + (roughMinor ? 1 : 0) + regionPoiCapacity.c
        },
        coastal: provinceCells.some(c => c.harbor > 0),
        rivers
      },
      culture: majority(provinceCells.map(c => c.culture)),
      religion: majority(provinceCells.map(c => c.religion)),
      flavorBurgs
    });
  }

  // -- Factions (§3.1 step 4): states, relations, wars, vassalage -------------
  const factionById = new Map<number, Faction>();
  for (const s of pack.states) {
    if (!s || s.i === 0) continue;
    factionById.set(s.i, {
      id: s.i,
      name: s.name,
      fullName: s.fullName || s.name,
      form: s.form,
      formName: s.formName || s.form,
      color: s.color,
      culture: s.culture,
      rosterId: s.rosterId,
      religion: 0, // patched below from regions
      expansionism: s.expansionism,
      treasury: s.treasury,
      // Passthrough, not consumption: the engine's income model reads the
      // ruleset constant `economy.taxPer1000Pop`, never these per-state rates.
      // They are carried faithfully so `ECONOMY-PLAN.md` Phase 1 can differentiate
      // faction economies by tax *form* (mercantile Republic vs feudal Monarchy)
      // without a second compiler pass. Do not treat them as live balance knobs
      // until Phase 1 lands them behind a `taxFromMap` flag.
      salesTax: s.salesTax,
      pollTax: s.pollTax,
      capitalRegion: cells[s.center]?.province ?? 0,
      capitalCell: s.center,
      regions: [],
      relations: [],
      wars: [],
      history: [],
      suzerainOf: [],
      vassalOf: null
    });
  }

  for (const r of regions) {
    factionById.get(r.factionId)?.regions.push(r.id);
  }
  // Faction religion = majority religion across its regions (tie: lowest id).
  for (const f of factionById.values()) {
    f.religion = majority(f.regions.map(rid => regions.find(x => x.id === rid)?.religion ?? 0).filter(rel => rel > 0));
  }

  // Ongoing wars. FMG v1.154 stores active wars as descriptor arrays in the
  // placeholder state 0's diplomacy ("war journal"): [name, detail, …], where
  // detail[0] reads "<Attacker> declared a war on [its <x> ]<Defender>".
  const wars: War[] = [];
  const warsByFaction = new Map<number, War[]>();
  const nameToState = new Map<string, number>();
  for (const s of stateById.values()) nameToState.set(s.name, s.i);

  const attachWar = (war: War, a: number, b: number): void => {
    for (const id of [a, b]) {
      if (id === 0) continue;
      const list = warsByFaction.get(id) ?? [];
      if (!list.includes(war)) list.push(war);
      warsByFaction.set(id, list);
    }
  };

  const recordWar = (a: number, b: number, name: string, details: string[]): War => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    let war = wars.find(w => w.between[0] === lo && w.between[1] === hi && w.name === name);
    if (!war) {
      war = { name, between: [lo, hi], details };
      wars.push(war);
    }
    return war;
  };

  const neutral = stateById.get(0);
  if (neutral?.diplomacy) {
    for (const entry of neutral.diplomacy) {
      if (!Array.isArray(entry)) continue;
      const [name = "War", ...details] = entry;
      const decl = String(details[0] ?? "").match(/^(.+?) declared a war on (?:its \w+ |a |an |the )?(.+?)$/);
      const attacker = decl ? (nameToState.get(decl[1]!.trim()) ?? 0) : 0;
      const defender = decl ? (nameToState.get(decl[2]!.trim()) ?? 0) : 0;
      if (attacker > 0 && defender > 0) {
        attachWar(recordWar(attacker, defender, String(name), details), attacker, defender);
      } else {
        // Unresolvable descriptor — kept with between [0,0] for lossless round-trip.
        wars.push({ name: String(name), between: [0, 0], details });
      }
    }
  }

  for (const s of pack.states) {
    if (!s || s.i === 0 || !s.diplomacy) continue;
    const me = factionById.get(s.i)!;
    s.diplomacy.forEach((entry, j) => {
      if (j === s.i) return;
      const other = factionById.get(j);
      if (!other) return;
      if (Array.isArray(entry)) {
        // Some generator versions inline war arrays into the matrix itself.
        const [name = "War", ...details] = entry;
        const war = recordWar(s.i, j, String(name), details);
        attachWar(war, s.i, j);
        me.relations.push({ factionId: j, label: "War", score: -100 });
        other.relations.push({ factionId: s.i, label: "War", score: -100 });
        return;
      }
      const label = entry as RelationLabel;
      const score = RELATION_SCORES[label] ?? 0;
      me.relations.push({ factionId: j, label, score });
      if (label === "Suzerain") {
        // i is the overlord of j
        me.suzerainOf.push(j);
        other.vassalOf = s.i;
      } else if (label === "Vassal") {
        me.vassalOf = j;
        other.suzerainOf.push(s.i);
      }
    });
    me.history = (s.campaigns ?? []).map(
      (c): HistoricalWar => ({
        name: c.name,
        start: c.start,
        ...(c.end !== undefined ? { end: c.end } : {}),
        attacker: c.attacker,
        defender: c.defender
      })
    );
  }

  // Azgaar's matrix is symmetric (Suzerain/Vassal mirror on both sides), so
  // structured entries can be pushed twice — dedupe by pair/overlord.
  for (const f of factionById.values()) {
    const seenRel = new Set<number>();
    f.relations = f.relations.filter(r => {
      if (seenRel.has(r.factionId)) return false;
      seenRel.add(r.factionId);
      return true;
    });
    f.suzerainOf = [...new Set(f.suzerainOf)];
  }
  for (const [factionId, list] of warsByFaction) {
    factionById.get(factionId)!.wars = list;
  }

  // -- Starting armies (§3.1 step 5): regiments with compositions -------------
  const armies: StartingArmy[] = [];
  for (const s of pack.states) {
    if (!s || s.i === 0) continue;
    for (const reg of s.military ?? []) {
      armies.push({
        id: `s${s.i}-r${reg.i}`,
        factionId: s.i,
        name: reg.name,
        cell: reg.cell,
        fleet: reg.n === 1,
        units: {
          infantry: reg.u.infantry ?? 0,
          archers: reg.u.archers ?? 0,
          cavalry: reg.u.cavalry ?? 0,
          artillery: reg.u.artillery ?? 0
        },
        strength: reg.a
      });
    }
  }

  // -- Starting assets (CAPACITY-PLAN §1 *Starting domains*) ---------------------
  // Deterministic and ordered: settlements walked by descending tier, then by id,
  // so the same world always yields the same founding domains. Records chain
  // *names* — the compiler does not know the content pack, so createCampaign
  // resolves each chain to its tier-1 building. T0 settlements are skipped: a
  // hamlet starts with nothing, and is the raw material the Develop path works on.
  const formOfFaction = new Map<number, string>([...factionById.values()].map(f => [f.id, f.form]));
  // (factionOfRegion removed: regions are resolved through formOfRegion)
  const formOfRegion = new Map<number, string>(regions.map(r => [r.id, formOfFaction.get(r.factionId) ?? ""]));
  const settlementOfRegion = new Map<number, Settlement[]>();
  for (const st of settlements) {
    const list = settlementOfRegion.get(st.regionId) ?? [];
    list.push(st);
    settlementOfRegion.set(st.regionId, list);
  }
  const startingAssets: StartingAsset[] = [];
  // A region's Military assets are a property of the *region* (§4.5): its
  // wartime footing follows the people it governs, not the tier of its
  // settlement. The need is therefore carried on the region's entry, and the
  // tier is resolved against the content at campaign creation.
  const needOfRegion = new Map<number, number>();
  for (const region of regions) {
    const own = settlementOfRegion.get(region.id) ?? [];
    // A region with no town has nothing to garrison or fortify — a hamlet
    // starts with nothing at all, and is the raw material the Develop path
    // works on. Its people are real, but a province with no city has no
    // Domain to hold an asset.
    if (!own.some(st => st.tier > 0)) continue;
    const need = foundingMilitaryNeedFor(region.stats.population);
    if (need > 0) needOfRegion.set(region.id, need);
  }
  const footprintHost = new Map<number, Settlement>();
  for (const region of regions) {
    const own = (settlementOfRegion.get(region.id) ?? []).slice();
    own.sort((a, b) => b.tier - a.tier || a.id - b.id);
    const host = own.find(st => st.capital) ?? own[0];
    if (host) footprintHost.set(region.id, host);
  }
  for (const st of [...settlements].sort((a, b) => b.tier - a.tier || a.id - b.id)) {
    if (st.tier <= 0) continue;
    const chains = settleChainsFor(st.tier, {
      capital: st.capital,
      port: st.port,
      form: formOfRegion.get(st.regionId) ?? ""
    });
    const need = needOfRegion.get(st.regionId);
    const hosts = footprintHost.get(st.regionId)?.id === st.id;
    if (chains.length === 0 && !(need !== undefined && hosts)) continue;
    const entry: StartingAsset = { regionId: st.regionId, chains };
    // The region's Military need (§4.5): how many points its walls and its
    // barracks must cover between them, because its people can mobilise that
    // many men at the founding alert.
    if (need !== undefined && hosts) entry.militaryNeed = need;
    startingAssets.push(entry);
  }

  // -- POIs + zones (§3.1 step 6) ---------------------------------------------
  const pois: Poi[] = (pack.markers ?? []).map(mk => ({
    id: mk.i,
    type: mk.type,
    name: mk.name,
    cell: mk.cell,
    pos: [mk.x, mk.y],
    ...(mk.note !== undefined ? { note: mk.note } : {}),
    ...(poiCapacityType(mk.type) ? { capacityType: poiCapacityType(mk.type) } : {})
  }));

  // Fold POI capacity into the regions that contain them. Regions were assembled
  // before markers were read, so this is a second pass — a marker's cell carries
  // its province, the same basis used to attribute burgs above.
  const regionById = new Map(regions.map(r => [r.id, r]));
  for (const poi of pois) {
    if (!poi.capacityType) continue;
    const province = cells[poi.cell]?.province ?? 0;
    if (province === 0) continue;
    const region = regionById.get(province);
    if (!region) continue;
    region.stats.capacity[poi.capacityType] += 1;
  }

  const zones: Zone[] = (pack.zones ?? []).map(z => ({
    id: z.i,
    name: z.name,
    type: z.type,
    cells: [...new Set(z.cells)]
  }));

  // -- Name pools (§3.3): settlement + ruler names per nameBase ----------------
  const namePools: Record<string, string[]> = {};
  for (const nb of raw.nameBases ?? []) {
    const names = [
      ...String(nb.b ?? "")
        .split(",")
        .map(n => n.trim()),
      ...(typeof nb.m === "string" ? nb.m.split(",").map(n => n.trim()) : [])
    ].filter(n => n.length > 0);
    namePools[String(nb.i)] = [...new Set(names)].slice(0, MAX_NAMES_PER_POOL);
  }

  // Trade good names, so a unit gate can say which good is missing.
  const goods: Record<string, string> = {};
  for (const g of raw.pack.goods ?? []) {
    if (g?.name) goods[String(g.i)] = g.name;
  }

  // -- Assemble ---------------------------------------------------------------
  return {
    meta: {
      mapId: String(raw.info.mapId ?? raw.info.seed),
      name: raw.info.mapName ?? "unnamed",
      azgaarSeed: raw.info.seed ?? "",
      azgaarVersion: raw.info.version ?? "unknown",
      compilerVersion: COMPILER_VERSION,
      sourceFile: "",
      compiledAt: "",
      width: raw.info.width,
      height: raw.info.height,
      contentHash: ""
    },
    biomeLegend,
    goods,
    cultures: (pack.cultures ?? [])
      .filter((c): c is AzgaarCulture => Boolean(c) && typeof c === "object" && "i" in c)
      .map(c => ({ i: c.i, name: c.name, base: typeof c.base === "number" ? c.base : -1 })),
    graph: {
      land: { cells: landCells, edges: landEdges },
      sea: { cells: seaCells, edges: seaEdges },
      embark
    },
    regions,
    settlements,
    factions: [...factionById.values()],
    armies,
    pois,
    zones,
    startingAssets,
    namePools
  };
}

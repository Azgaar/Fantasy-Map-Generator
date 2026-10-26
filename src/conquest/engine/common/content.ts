/**
 * Content pack contracts + validation + inheritance resolution (total-war/.plans/PLAN.md §6).
 *
 * Pure layer: no filesystem access. The server's contentService reads YAML files,
 * feeds parsed structures to `validateAndResolve`, and gets a deterministic
 * ContentPack back — or every validation error at once, with did-you-mean hints.
 *
 * Principle §6.2: YAML reconfigures systems, it cannot add new ones.
 * Principle §6.1: base → culture → faction inheritance; unbound states fall back
 * to the default roster so *any* Azgaar map works.
 */
import { canonicalHash } from "./prng";
import type { CapacityPoints } from "./types";

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

export type UnitCategory = "melee" | "ranged" | "cavalry" | "artillery" | "monster" | "spellcaster";

/**
 * Declarative battle powers, each a fraction (or count) per unit at full strength.
 * Scaled by the unit's fill and clamped by `battle.magic` caps; see openconquest-magic-system.md.
 */
export interface UnitPowers {
  /** Fraction off the owner's casualty rate. */
  ward?: number;
  /** Fraction added to the enemy's casualty rate. */
  hex?: number;
  /** Men restored per round, never past the battle-start count. */
  heal?: number;
  /** Added to the enemy's rout threshold. */
  terror?: number;
  /** Wall tiers ignored when assaulting. */
  arcaneSiege?: number;
}

/**
 * Men represented by one AER **block** — the CAPACITY-PLAN Phase 4b
 * conversion, and the single knob that turns a mobilisation alert into a
 * capacity load.
 *
 * "Block" is AER's own word for a military unit: p1557 calls them *"blocks of
 * 1,000 or even 10,000 men"*. The codebase's "unit" is a *soldier type*
 * (`sword`, `spear`), so the two are named apart: a unit is what a player
 * recruits, a block is what AER's tables price.
 *
 * AER p1557: *"Military units might represent blocks of 1,000 or even 10,000
 * men."* 1,000 is AER's own stated floor, and it is a *measured* choice. On
 * `sample-world.json` the founding assets generate **M 392**, the world fields
 * **56,017 men** in 525 units — 0.171 % of its 32.8M people — and those units
 * load **M 88.9** at this constant. Solving `392 = alert × 32.8M × 1.75 ÷ 1,000`
 * puts balance at a **~0.7 %** alert: under one man in a hundred under arms,
 * which is the standing-force war AER is written for. The ladder above it:
 *
 * ```
 *   war alert     MPU that balances     an AER "unit" is
 *        0.7 %                 1,000    — AER's own floor, 1,000 men
 *        1.0 %                 1,445    ~AER's "1,000"
 *        5.0 %                 7,224    a regiment
 *       10.0 %                14,447    ~AER's "10,000"
 * ```
 *
 * The load is literally `mobilised men ÷ MEN_PER_BLOCK × capacity-per-block`, so
 * this constant — and no capacity value anywhere — is what converts men into
 * points. Raising it makes every block bigger, so the same mobilised host spans
 * fewer of them; AER is explicit that a unit costs the same points whatever a
 * unit happens to contain (p1557). Buying more barracks is the other lever, and
 * unlike this one it costs gold. Neither touches a point value.
 *
 * Lives beside {@link UnitType} because it is what derives `UnitType.men` from
 * `UnitType.blocks`; re-exported from the compiler, which is where the rest of
 * the capacity knobs (`SETTLEMENT_TIER_STEPS`, `REGION_TIER_STEPS`) are tuned.
 */
export const MEN_PER_BLOCK = 1000;

/** A recruitable/garrison unit archetype (rosters define these in JSON). */
export interface UnitType {
  id: string;
  name: string;
  category: UnitCategory;
  /**
   * AER **blocks** this unit represents at full strength — **the authored
   * primitive** (CAPACITY-PLAN Phase 4b).
   *
   * AER p1557: *"Military units might represent blocks of 1,000 or even 10,000
   * men."* An AER unit is therefore a **block**, and an FMG regiment of 150
   * swordsmen is `0.15` of one. That fraction is the honest number: the roster
   * authors how much of a block a unit *is*, and {@link MEN_PER_BLOCK} decides
   * how many men that is. Raise the constant to 10,000 and the same unit
   * stands for 1,500 men — which is exactly the high-alert lever §4.4 describes,
   * without editing a single roster.
   *
   * Named `blocks`, not `units`, because "unit" already means a *soldier type*
   * everywhere else in the codebase — `UnitType`, `unitTypes`, `army.units`,
   * `roster.units` — and AER's own "unit" is the block. Two nouns for the
   * pricing unit, one for the soldier.
   */
  blocks: number;
  /**
   * Men at full strength — **derived** as `blocks × MEN_PER_BLOCK`. Combat reads
   * this (`battle.ts` `fill = count / men`, `economy.ts` `upkeep × count / men`)
   * and both sides scale together, so the conversion is an arithmetic no-op for
   * combat and for gold: it changes only how many *capacity points* a unit
   * loads.
   */
  men: number;
  attack: number;
  defense: number;
  charge: number;
  missile: number;
  cost: number;
  upkeep: number;
  /**
   * Capacity this unit **loads** on its holder, per pool (CAPACITY-PLAN §1).
   *
   * Named `capacityCost`, not `capacity`, because the same word means
   * *production* on a building's `effects.capacity` — a barracks generates 2 M,
   * a swordsman unit *costs* 0.3 M to keep. Reading one as the other is how a
   * model ends up charging a realm for its own output.
   *
   * Gold `upkeep` is the retired cash-flow model's cost; this is the capacity
   * model's, priced from the AER asset and unit tables — **per AER block**, so a
   * unit loads `(count ÷ MEN_PER_BLOCK) × capacityCost`. Absent ⇒ loads nothing,
   * so a mod that has not been converted yet simply contributes 0 rather than
   * crashing.
   */
  capacityCost?: CapacityPoints;
  /**
   * A trade good this unit needs — the Azgaar good id (CAPACITY-PLAN Phase 6).
   *
   * A realm may only raise the unit if it **holds** a region that yields the
   * good: cavalry needs horses, artillery and heavy troops need iron. The gate
   * is the point — a good that every realm holds gates nothing, and a good a
   * realm must fight for makes its holdings decide what it can field.
   */
  requiresGood?: number;
  /**
   * The wall tier this unit needs standing somewhere in the realm — the
   * fortification units' gate (CAPACITY-PLAN Phase 6). A unit that needs tier 2
   * cannot be raised until the realm holds a region with Stone Walls.
   */
  requiresWallTier?: number;
  /** Battle powers; valid on any category, so monsters and elites can carry them. */
  powers?: UnitPowers;
  /** 0..1 damping of enemy `hex`, `terror` and `arcaneSiege`. */
  resistArcane?: number;
}

/** A roster: a unit pool + how Azgaar regiment categories map onto it. */
export interface ResolvedRoster {
  id: string;
  name?: string;
  /** All unit types defined by this roster (including inherited). */
  units: Record<string, UnitType>;
  /** Unit ids players may recruit, in roster order. */
  recruitable: string[];
  /** Garrison unit ids: {melee, ranged}. */
  garrison: { melee: string; ranged: string };
  /** Azgaar regiment category → unit type id. */
  regimentMap: { infantry: string; archers: string; cavalry: string; artillery: string };
  /** Max units of a type per army (total-war/.plans/PLAN.md §5.3 caps). Absent = uncapped. */
  caps: Record<string, number>;
}

interface CultureBinding {
  /** Bind by Azgaar culture name (portable across maps). */
  cultureName?: string;
  /** Or by numeric culture id (map-specific). */
  cultureId?: number;
  /** Or by the race suffix of "<Name> (Race)" — portable across every world. */
  cultureRace?: string;
  roster: string;
  victory?: string;
  traits?: string[];
}

interface FactionDef {
  /**
   * How this def attaches to a pack faction. Most specific wins:
   * stateId/stateName (hand-tuned, map-specific) > cultureId/cultureName >
   * cultureRace (portable across every world — Azgaar names cultures
   * "<Name> (Race)", so the race suffix matches worlds we've never seen).
   */
  bind: { stateId?: number; stateName?: string; cultureName?: string; cultureId?: number; cultureRace?: string };
  /**
   * Assign this state a culture group outright (a roster id). Most specific
   * roster decision there is — beats the culture binding and the race inference,
   * which is what makes a per-state editor possible.
   */
  rosterId?: string;
  traits?: string[];
  mechanics?: Partial<FactionMechanics>;
  roster?: {
    /** Extra unit ids made recruitable (must exist in the roster's unit pool). */
    include?: string[];
    /** Unit ids removed from recruitable. */
    exclude?: string[];
    /**
     * Per-state stat overrides, merged over the group's unit of the same id.
     * Any subset of the unit's fields; this is how "this empire's swordsmen
     * are cheaper" is expressed without forking the whole roster.
     */
    units?: Record<string, Partial<UnitType>>;
  };
  /**
   * Building availability for this state, on top of its group's set:
   * `exclude` hides entries the group would otherwise grant; `include` grants
   * entries from anywhere in the pool (another group's, or common).
   */
  buildings?: { include?: string[]; exclude?: string[] };
  /** Same contract as `buildings`, for the research tree. */
  tech?: { include?: string[]; exclude?: string[] };
  victory?: string;
  player?: string;
  aiType?: "balanced" | "aggressive" | "defensive" | "economic";
}

interface FactionMechanics {
  corruption: boolean;
  /** cultureGroup | never — confederation eligibility (engine hook, Phase 3+ AI). */
  confederation: "cultureGroup" | "never";
}

export type AssetKind = "structure" | "custom" | "unchained" | "resource";

interface BuildingEffects {
  /** Adds fortification tiers in assaults (§5.5). */
  walls?: number;
  /** Multiplies region tax income. */
  incomePct?: number;
  /** Public order per turn. */
  orderPerTurn?: number;
  /** Unit ids recruitable only while this building stands in the region (§5.3 pools). */
  unlock?: string[];
  /** Roster IDs accessible for recruitment while this asset stands (e.g. Burning Creed -> elfBase). */
  unlockRoster?: string[];
  /**
   * Capacity this building *generates* for its holder, per pool (CAPACITY-PLAN
   * §1). Omitted keys default to 0, so a barracks writes `{"m": 2}` and nothing
   * else. Shadow data until Phase 3 gates play on it.
   */
  capacity?: CapacityPoints;
  /**
   * Capacity this building *loads* on its holder, per pool — the upkeep column
   * of the AER asset table (line 1719). Every AER asset pays upkeep for
   * something other than its own output: Stone Walls produces 4 M but costs 1 W,
   * a Great Temple produces 8 S but costs 2 W.
   *
   * Written as a positive magnitude, unlike the source table, which marks costs
   * with a leading minus. This is the half of the model that makes building
   * spam self-limiting: without it, assets only ever add capacity.
   */
  upkeep?: CapacityPoints;
  /** Number of military units stationed in this region whose capacity upkeep is waived (Barracks 1/2/4). */
  freeGarrisonUnits?: number;
  /** Temporary defensive units spawned automatically when this location is attacked (Militia 1/2/3). */
  militiaDefense?: {
    unitType: string;
    count: number;
  };
  /** Scales the capacity output of all buildings in a target chain across the Domain (Customs). */
  chainMultiplier?: {
    chain: string;
    pool: "m" | "w" | "s" | "c";
    factor: number;
  };
  /** Waives the upkeep of N building assets per region across the Domain (Slavery = 1). */
  freeBuildingUpkeepPerRegion?: number;
  /** Converts location capacity from one pool into another (Community Aid, Military Spending, Processing Camp, United Efforts). */
  conversion?: {
    from: "w" | "s";
    to: "m" | "w" | "s";
    ratio: number;
  };
  /** Siege supply hit dice stored (Siege Supplies = 20 HD). */
  siegeSupplies?: number;
  /** Atrocity points ignored by the Domain while this asset stands (Hell Shrine = 5). */
  atrocityIgnore?: number;
  /** Atrocity modifiers (Brutal Tyranny, Devil Worshipers, Necromantic Cult). */
  atrocityMod?: {
    gainMultiplier?: number;
    revoltMultiplier?: number;
    perTurnDelta?: number;
    perRecruitPenalty?: number;
  };
  /** If true, regions in the Domain generate 0 capacity unless garrisoned by a friendly army (Devil Worshipers). */
  requiresGarrisonToProduce?: boolean;
  /** Bonus available once per turn to a Domain value check or save (Democratic Traditions = +3). */
  rollBonusPerTurn?: number;
}

export interface BuildingDef {
  id: string;
  name: string;
  /** Asset kind: "structure" (default chain building), "custom" (Domain-wide), "unchained" (standalone), or "resource". */
  kind?: AssetKind;
  chain: string;
  tier: number;
  settlementKinds: ("major" | "minor")[];
  /** Maximum copies allowed in a single region (default 1; 2 for Siege Supplies). */
  maxInstances?: number;
  /** Mutually exclusive asset IDs (e.g. Dwarf Friend vs. Slavery). */
  incompatibleWith?: string[];
  cost: number;
  /** Turns to construct (default 1). */
  turns?: number;
  /** Previous building id required in the same chain. */
  requires?: string;
  /**
   * The culture group (a roster id) this building belongs to. Absent = common:
   * every faction can build it. A faction may build its own group's buildings
   * plus every common one, unless its state def overrides availability.
   */
  group?: string;
  effects: BuildingEffects;
}

interface TechEffects {
  incomePct?: number;
  /** Fraction of upkeep removed faction-wide. */
  upkeepReduction?: number;
  unlock?: string[];
}

export interface TechDef {
  id: string;
  name: string;
  era?: number;
  cost: number;
  requires?: string[];
  /** Owning culture group (a roster id); absent = common to every faction. */
  group?: string;
  effects: TechEffects;
}

export type VictoryObjective =
  | { type: "controlRegions"; count?: number; fraction?: number }
  | { type: "eliminateFactions"; factions: number[] }
  | { type: "holdCapitals"; count: number };

interface VictorySet {
  id: string;
  name?: string;
  objectives: VictoryObjective[];
}

/** YAML-scripted event/dilemma (total-war/.plans/PLAN.md §5.9) — trigger → choices → effects. */
interface EventTrigger {
  type: "turn" | "season" | "regionCaptured" | "factionEliminated" | "warDeclared" | "poiDiscovered";
  /** turn trigger: exact turn. */
  turn?: number;
  /** turn trigger: fire every N turns. */
  every?: number;
  /** season trigger: season name (Spring/Summer/Autumn/Winter). */
  season?: string;
  /** poiDiscovered trigger: filter by POI type. */
  poiType?: string;
}

export interface EventEffects {
  /** Flat treasury delta for the scoped faction. */
  treasury?: number;
  /** Public order delta for the context region. */
  order?: number;
  /** Relations delta toward the event's counterpart faction. */
  relations?: number;
}

interface EventChoice {
  text: string;
  effects: EventEffects;
}

export interface EventDef {
  id: string;
  title: string;
  text?: string;
  trigger: EventTrigger;
  /** player = dilemma for the human faction; all = every faction (AI auto-chooses first). */
  scope: "player" | "all";
  /** Fire once per faction (default true). */
  once?: boolean;
  choices: EventChoice[];
}

/** Validated, inheritance-resolved content (pack-independent). */
export interface ContentPack {
  /** Canonical content hash — part of campaign identity (§6 principle 3). */
  hash: string;
  unitTypes: Record<string, UnitType>;
  rosters: Record<string, ResolvedRoster>;
  cultures: CultureBinding[];
  factions: FactionDef[];
  buildings: BuildingDef[];
  tech: TechDef[];
  victory: Record<string, VictorySet>;
  events: EventDef[];
  defaultRoster: string;
  defaultVictory: string;
}

/** Content bound to a specific map pack: every state id → its resolved roster. */
interface ResolvedFaction {
  stateId: number;
  rosterId: string;
  roster: ResolvedRoster;
  victorySetId: string;
  traits: string[];
  mechanics: FactionMechanics;
  /**
   * What this state may build and research: its group's entries plus common
   * ones, adjusted by the state's own include/exclude. Effects of anything
   * already built stay global — availability gates new construction only.
   */
  buildings: BuildingDef[];
  tech: TechDef[];
  controller: "player" | "ai";
  aiType: "balanced" | "aggressive" | "defensive" | "economic";
}

export interface ResolvedContent {
  pack: ContentPack;
  /** state id → resolved faction content. Guaranteed entry for every state. */
  factions: Record<string, ResolvedFaction>;
  /** Non-fatal binding notes (unknown culture/state names on THIS map). */
  bindingWarnings: string[];
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const CATEGORIES: UnitCategory[] = ["melee", "ranged", "cavalry", "artillery", "monster", "spellcaster"];

const POWER_KEYS = ["ward", "hex", "heal", "terror", "arcaneSiege"] as const;
/** Powers expressed as 0..1 fractions; `heal` and `arcaneSiege` are counts. */
const FRACTIONAL_POWERS: readonly string[] = ["ward", "hex", "terror"];

/**
 * Matchup multiplier matrix[attackerCategory][defenderCategory] (total-war/.plans/PLAN.md §5.4):
 * cavalry shred ranged, spears hold melee, artillery punishes dense infantry; casters
 * shred massed foot but die to cavalry, monsters maul everything but are shot down.
 */
export const MATCHUP: Record<UnitCategory, Record<UnitCategory, number>> = {
  melee: { melee: 1.0, ranged: 1.1, cavalry: 0.8, artillery: 1.2, monster: 0.8, spellcaster: 1.4 },
  ranged: { melee: 1.1, ranged: 1.0, cavalry: 0.7, artillery: 1.0, monster: 1.25, spellcaster: 1.2 },
  cavalry: { melee: 0.9, ranged: 1.3, cavalry: 1.0, artillery: 1.4, monster: 0.85, spellcaster: 1.5 },
  artillery: { melee: 1.2, ranged: 1.1, cavalry: 0.6, artillery: 1.0, monster: 1.3, spellcaster: 0.9 },
  monster: { melee: 1.3, ranged: 0.8, cavalry: 1.1, artillery: 1.4, monster: 1.0, spellcaster: 1.4 },
  spellcaster: { melee: 1.25, ranged: 1.0, cavalry: 0.5, artillery: 1.2, monster: 1.1, spellcaster: 1.0 }
};

export function didYouMean(input: string, candidates: string[]): string {
  const lower = input.toLowerCase();
  let best: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const d = levenshtein(lower, c.toLowerCase());
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  if (best && (bestDist <= 2 || best.toLowerCase().startsWith(lower.slice(0, 3)))) {
    return ` — did you mean '${best}'?`;
  }
  return best ? ` (known: ${candidates.slice(0, 8).join(", ")})` : "";
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length]![b.length]!;
}

class Validator {
  errors: string[] = [];
  warn(file: string, message: string): void {
    this.errors.push(`${file}: ${message}`);
  }
  num(file: string, obj: Record<string, unknown>, key: string, min = 0): number {
    const v = obj[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min) {
      this.warn(file, `field '${key}' must be a number ≥ ${min}${v === undefined ? "" : `, got ${JSON.stringify(v)}`}`);
      return 0;
    }
    return v;
  }
  /** Any finite number — for effects that may legitimately be negative. */
  numSigned(file: string, obj: Record<string, unknown>, key: string): number {
    const v = obj[key];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      this.warn(file, `field '${key}' must be a finite number${v === undefined ? "" : `, got ${JSON.stringify(v)}`}`);
      return 0;
    }
    return v;
  }
  str(file: string, obj: Record<string, unknown>, key: string): string {
    const v = obj[key];
    if (typeof v !== "string" || v.length === 0) {
      this.warn(
        file,
        `field '${key}' must be a non-empty string${v === undefined ? "" : `, got ${JSON.stringify(v)}`}`
      );
      return "";
    }
    return v;
  }
  strList(file: string, obj: Record<string, unknown>, key: string): string[] {
    const v = obj[key];
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.some(x => typeof x !== "string")) {
      this.warn(file, `field '${key}' must be a list of strings`);
      return [];
    }
    return v as string[];
  }
  numList(file: string, obj: Record<string, unknown>, key: string): number[] {
    const v = obj[key];
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.some(x => typeof x !== "number")) {
      this.warn(file, `field '${key}' must be a list of numbers`);
      return [];
    }
    return v as number[];
  }
  bool(file: string, obj: Record<string, unknown>, key: string, fallback = false): boolean {
    const v = obj[key];
    if (v === undefined) return fallback;
    if (typeof v !== "boolean") {
      this.warn(file, `field '${key}' must be a boolean`);
      return fallback;
    }
    return v;
  }
  unknownKeys(file: string, obj: Record<string, unknown>, allowed: string[], warnings: string[]): void {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) {
        warnings.push(`${file}: unknown key '${key}' ignored (allowed: ${allowed.join(", ")})`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Roster parsing + inheritance
// ---------------------------------------------------------------------------

interface RawRoster {
  id: string;
  name?: string;
  file: string;
  extends?: string;
  units: Record<string, Record<string, unknown>>;
  recruitable?: string[];
  garrison?: { melee?: string; ranged?: string };
  regimentMap?: Partial<ResolvedRoster["regimentMap"]>;
  caps?: Record<string, number>;
}

/** A number in [0, 1]. */
function unitFraction(file: string, obj: Record<string, unknown>, key: string, v: Validator): number {
  const value = v.num(file, obj, key);
  if (value > 1) {
    v.warn(file, `field '${key}' must be between 0 and 1, got ${value}`);
    return 0;
  }
  return value;
}

function parsePowers(file: string, raw: unknown, v: Validator, warnings: string[]): UnitPowers {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    v.warn(file, "field 'powers' must be an object");
    return {};
  }
  const body = raw as Record<string, unknown>;
  v.unknownKeys(`${file}.powers`, body, [...POWER_KEYS], warnings);
  const out: UnitPowers = {};
  for (const key of POWER_KEYS) {
    if (body[key] === undefined) continue;
    out[key] = FRACTIONAL_POWERS.includes(key)
      ? unitFraction(`${file}.powers`, body, key, v)
      : v.num(`${file}.powers`, body, key);
  }
  return out;
}

function parseRoster(file: string, doc: unknown, v: Validator, warnings: string[]): RawRoster | null {
  const root = doc as Record<string, unknown>;
  const body = (root?.roster as Record<string, unknown> | undefined) ?? root;
  if (!root?.roster && !root?.units) {
    v.warn(file, "expected top-level 'roster:' section");
    return null;
  }
  v.unknownKeys(file, body, ["id", "extends", "units", "recruitable", "garrison", "regimentMap", "caps"], warnings);
  const id =
    (typeof body.id === "string" && body.id ? body.id : typeof root?.id === "string" && root.id ? root.id : "") ||
    v.str(file, body, "id");
  const name = typeof root?.name === "string" ? root.name : undefined;
  const unitsRaw = (body.units ?? {}) as Record<string, Record<string, unknown>>;
  const units: Record<string, Record<string, unknown>> = {};
  const allowedUnitKeys = [
    "name",
    "category",
    "blocks",
    "attack",
    "defense",
    "charge",
    "missile",
    "cost",
    "upkeep",
    "capacityCost",
    "requiresGood",
    "requiresWallTier",
    "powers",
    "resistArcane"
  ];
  for (const [uid, def] of Object.entries(unitsRaw)) {
    const d = (def ?? {}) as Record<string, unknown>;
    // `men` did not merely become "unknown" — it became *wrong*. Phase 4b makes
    // `blocks` the authored primitive, so an ignored `men: 150` would either be
    // rejected for being absent or read as a fresh unit: a 6.7× inflation of
    // every load that unit touches, reported only as a warning. Refuse it with
    // the conversion written out instead.
    const unitBody: Record<string, unknown> = { ...d };
    if (unitBody.men !== undefined) {
      const authored = unitBody.men;
      delete unitBody.men;
      v.warn(
        `${file}#${uid}`,
        `field 'men' was retired by the military conversion — author 'blocks' ` +
          `(AER blocks of ${MEN_PER_BLOCK} men, CAPACITY-PLAN Phase 4b) instead: ` +
          `men: ${String(authored)} ⇒ blocks: ${Number(authored) / MEN_PER_BLOCK}`
      );
    }
    // `capacity` on a *unit* is the same trap `men` was: the same word means
    // production on a building, and a unit has no production. Accepting it
    // silently would leave the unit costing what it earns. Refuse it by name.
    if (unitBody.capacity !== undefined) {
      delete unitBody.capacity;
      v.warn(
        `${file}#${uid}`,
        `field 'capacity' was renamed 'capacityCost' — a unit *loads* capacity, it never ` +
          `generates it (a building's 'effects.capacity' is the opposite direction).`
      );
    }
    v.unknownKeys(`${file}#${uid}`, unitBody, allowedUnitKeys, warnings);
    const name = v.str(`${file}#${uid}`, d, "name");
    const category = d.category;
    if (typeof category !== "string" || !CATEGORIES.includes(category as UnitCategory)) {
      v.warn(`${file}#${uid}`, `field 'category' must be one of ${CATEGORIES.join(", ")}`);
      continue;
    }
    // `blocks` is authored (CAPACITY-PLAN Phase 4b) and required; `men` derives
    // from it. The floor is one *man*, not one block: a 150-man regiment is
    // 0.15 of an AER block and has to be authorable as such, while a unit type
    // representing no men at all would divide by zero in every fill ratio.
    const blocksAtFullStrength = v.num(`${file}#${uid}`, d, "blocks", 1 / MEN_PER_BLOCK);
    const unit: Record<string, unknown> = {
      id: uid,
      name,
      category,
      blocks: blocksAtFullStrength,
      men: blocksAtFullStrength * MEN_PER_BLOCK,
      attack: v.num(`${file}#${uid}`, d, "attack"),
      defense: v.num(`${file}#${uid}`, d, "defense"),
      charge: v.num(`${file}#${uid}`, d, "charge"),
      missile: v.num(`${file}#${uid}`, d, "missile"),
      cost: v.num(`${file}#${uid}`, d, "cost"),
      upkeep: v.num(`${file}#${uid}`, d, "upkeep"),
      ...(d.capacityCost !== undefined
        ? { capacityCost: parseCapacity(`${file}#${uid}`, "capacityCost", d.capacityCost, v, warnings) }
        : {}),
      ...(d.requiresGood !== undefined ? { requiresGood: v.num(`${file}#${uid}`, d, "requiresGood", 1) } : {}),
      ...(d.requiresWallTier !== undefined
        ? { requiresWallTier: v.num(`${file}#${uid}`, d, "requiresWallTier", 1) }
        : {}),
      ...(d.powers !== undefined ? { powers: parsePowers(`${file}#${uid}`, d.powers, v, warnings) } : {}),
      ...(d.resistArcane !== undefined ? { resistArcane: unitFraction(`${file}#${uid}`, d, "resistArcane", v) } : {})
    };
    units[uid] = unit;
  }
  const garrison = (body.garrison ?? {}) as Record<string, unknown>;
  const capsRaw = (body.caps ?? {}) as Record<string, unknown>;
  const caps: Record<string, number> = {};
  for (const [k, val] of Object.entries(capsRaw)) {
    if (typeof val === "number" && val > 0) caps[k] = val;
    else v.warn(file, `caps['${k}'] must be a positive number`);
  }
  return {
    id,
    ...(name !== undefined ? { name } : {}),
    file,
    extends: typeof body.extends === "string" ? body.extends : undefined,
    units,
    ...(body.recruitable !== undefined ? { recruitable: v.strList(file, body, "recruitable") } : {}),
    ...(typeof garrison.melee === "string" || typeof garrison.ranged === "string"
      ? { garrison: { melee: String(garrison.melee ?? ""), ranged: String(garrison.ranged ?? "") } }
      : {}),
    ...(body.regimentMap !== undefined
      ? { regimentMap: body.regimentMap as Partial<ResolvedRoster["regimentMap"]> }
      : {}),
    ...(Object.keys(caps).length > 0 ? { caps } : {})
  };
}

/** Resolve roster inheritance (extends chains, cycle-safe), then validate refs. */
function resolveRosters(
  raws: RawRoster[],
  v: Validator,
  _warnings: string[],
  allUnitCandidates: string[]
): Record<string, ResolvedRoster> {
  const byId = new Map<string, RawRoster>();
  for (const r of raws) {
    if (!r.id) continue;
    if (byId.has(r.id)) v.warn(r.file, `duplicate roster id '${r.id}'`);
    byId.set(r.id, r);
  }

  const resolved: Record<string, ResolvedRoster> = {};
  const resolving = new Set<string>();

  const merge = (id: string): ResolvedRoster | null => {
    if (resolved[id]) return resolved[id]!;
    const raw = byId.get(id);
    if (!raw) return null;
    if (resolving.has(id)) {
      v.warn(raw.file, `roster inheritance cycle at '${id}'`);
      return null;
    }
    resolving.add(id);
    const parent = raw.extends ? merge(raw.extends) : null;
    if (raw.extends && !parent) {
      v.warn(
        raw.file,
        `roster '${id}' extends unknown roster '${raw.extends}'${didYouMean(raw.extends, [...byId.keys()])}`
      );
      resolving.delete(id);
      return null;
    }
    const units: Record<string, UnitType> = {};
    for (const u of Object.values(parent?.units ?? {})) units[u.id] = { ...u };
    for (const u of Object.values(raw.units)) units[String(u.id)] = u as unknown as UnitType;

    const unitIds = Object.keys(units);
    // Unknown recruitable refs are flagged below; keep defaults crash-safe.
    const rawRecruitable = raw.recruitable ?? unitIds.filter(uid => !uid.startsWith("levy"));
    const recruitable = rawRecruitable.filter(uid => units[uid]);
    const garrison = {
      melee:
        raw.garrison?.melee ??
        unitIds.find(uid => uid.startsWith("levy") && units[uid]!.category === "melee") ??
        recruitable[0] ??
        "",
      ranged:
        raw.garrison?.ranged ??
        unitIds.find(uid => uid.startsWith("levy") && units[uid]!.category === "ranged") ??
        recruitable.find(uid => units[uid]?.category === "ranged") ??
        ""
    };
    const categoryDefault = (cat: UnitCategory): string =>
      unitIds.find(uid => !uid.startsWith("levy") && units[uid]!.category === cat) ?? "";
    const regimentMap = {
      infantry: raw.regimentMap?.infantry ?? categoryDefault("melee"),
      archers: raw.regimentMap?.archers ?? categoryDefault("ranged"),
      cavalry: raw.regimentMap?.cavalry ?? categoryDefault("cavalry"),
      artillery: raw.regimentMap?.artillery ?? categoryDefault("artillery")
    };
    // Validate refs against the merged pool (raw recruitable — unknown ids must error).
    for (const uid of [...rawRecruitable, garrison.melee, garrison.ranged, ...Object.values(regimentMap)]) {
      if (uid && !units[uid]) {
        v.warn(raw.file, `roster '${id}' references unknown unit '${uid}'${didYouMean(uid, allUnitCandidates)}`);
      }
    }
    for (const uid of Object.keys(raw.caps ?? {})) {
      if (!units[uid]) v.warn(raw.file, `caps reference unknown unit '${uid}'${didYouMean(uid, allUnitCandidates)}`);
    }
    resolving.delete(id);
    const out: ResolvedRoster = {
      id,
      ...((raw.name ?? parent?.name) ? { name: raw.name ?? parent?.name } : {}),
      units,
      recruitable: recruitable.filter(uid => units[uid]),
      garrison,
      regimentMap,
      caps: { ...(parent?.caps ?? {}), ...(raw.caps ?? {}) }
    };
    resolved[id] = out;
    return out;
  };

  for (const id of byId.keys()) merge(id);
  return resolved;
}

// ---------------------------------------------------------------------------
// Other sections
// ---------------------------------------------------------------------------

function parseBuildingsDoc(
  file: string,
  doc: unknown,
  v: Validator,
  warnings: string[],
  defaultGroup?: string
): BuildingDef[] {
  const list = (doc as Record<string, unknown>)?.buildings;
  if (!Array.isArray(list)) {
    v.warn(file, "expected top-level 'buildings:' list");
    return [];
  }
  const allowed = [
    "id",
    "name",
    "kind",
    "chain",
    "tier",
    "settlementKinds",
    "maxInstances",
    "incompatibleWith",
    "cost",
    "turns",
    "requires",
    "group",
    "effects"
  ];
  const out: BuildingDef[] = [];
  for (const entry of list) {
    const b = (entry ?? {}) as Record<string, unknown>;
    v.unknownKeys(file, b, allowed, warnings);
    const id = v.str(file, b, "id");
    const effectsRaw = (b.effects ?? {}) as Record<string, unknown>;
    v.unknownKeys(
      `${file}#${id}.effects`,
      effectsRaw,
      [
        "walls",
        "incomePct",
        "orderPerTurn",
        "unlock",
        "unlockRoster",
        "capacity",
        "upkeep",
        "freeGarrisonUnits",
        "militiaDefense",
        "chainMultiplier",
        "freeBuildingUpkeepPerRegion",
        "conversion",
        "siegeSupplies",
        "atrocityIgnore",
        "atrocityMod",
        "requiresGarrisonToProduce",
        "rollBonusPerTurn"
      ],
      warnings
    );
    const kinds = v
      .strList(file, b, "settlementKinds")
      .filter((k): k is "major" | "minor" => k === "major" || k === "minor");

    let militiaDefense: BuildingEffects["militiaDefense"];
    if (effectsRaw.militiaDefense !== undefined) {
      const md = (effectsRaw.militiaDefense ?? {}) as Record<string, unknown>;
      v.unknownKeys(`${file}#${id}.effects.militiaDefense`, md, ["unitType", "count"], warnings);
      militiaDefense = {
        unitType: v.str(`${file}#${id}.effects.militiaDefense`, md, "unitType"),
        count: v.num(`${file}#${id}.effects.militiaDefense`, md, "count", 1)
      };
    }

    let chainMultiplier: BuildingEffects["chainMultiplier"];
    if (effectsRaw.chainMultiplier !== undefined) {
      const cm = (effectsRaw.chainMultiplier ?? {}) as Record<string, unknown>;
      v.unknownKeys(`${file}#${id}.effects.chainMultiplier`, cm, ["chain", "pool", "factor"], warnings);
      chainMultiplier = {
        chain: v.str(`${file}#${id}.effects.chainMultiplier`, cm, "chain"),
        pool: v.str(`${file}#${id}.effects.chainMultiplier`, cm, "pool") as "m" | "w" | "s" | "c",
        factor: v.num(`${file}#${id}.effects.chainMultiplier`, cm, "factor", 1)
      };
    }

    let conversion: BuildingEffects["conversion"];
    if (effectsRaw.conversion !== undefined) {
      const cv = (effectsRaw.conversion ?? {}) as Record<string, unknown>;
      v.unknownKeys(`${file}#${id}.effects.conversion`, cv, ["from", "to", "ratio"], warnings);
      conversion = {
        from: v.str(`${file}#${id}.effects.conversion`, cv, "from") as "w" | "s",
        to: v.str(`${file}#${id}.effects.conversion`, cv, "to") as "m" | "w" | "s",
        ratio: v.num(`${file}#${id}.effects.conversion`, cv, "ratio", 1)
      };
    }

    let atrocityMod: BuildingEffects["atrocityMod"];
    if (effectsRaw.atrocityMod !== undefined) {
      const am = (effectsRaw.atrocityMod ?? {}) as Record<string, unknown>;
      v.unknownKeys(
        `${file}#${id}.effects.atrocityMod`,
        am,
        ["gainMultiplier", "revoltMultiplier", "perTurnDelta", "perRecruitPenalty"],
        warnings
      );
      atrocityMod = {
        ...(am.gainMultiplier !== undefined
          ? { gainMultiplier: v.num(`${file}#${id}.effects.atrocityMod`, am, "gainMultiplier", 0) }
          : {}),
        ...(am.revoltMultiplier !== undefined
          ? { revoltMultiplier: v.num(`${file}#${id}.effects.atrocityMod`, am, "revoltMultiplier", 0) }
          : {}),
        ...(am.perTurnDelta !== undefined
          ? { perTurnDelta: v.numSigned(`${file}#${id}.effects.atrocityMod`, am, "perTurnDelta") }
          : {}),
        ...(am.perRecruitPenalty !== undefined
          ? { perRecruitPenalty: v.num(`${file}#${id}.effects.atrocityMod`, am, "perRecruitPenalty", 0) }
          : {})
      };
    }

    out.push({
      id,
      name: v.str(file, b, "name"),
      ...(b.kind !== undefined ? { kind: v.str(file, b, "kind") as AssetKind } : {}),
      chain: v.str(file, b, "chain"),
      tier: v.num(file, b, "tier", 1),
      settlementKinds: kinds,
      cost: v.num(file, b, "cost"),
      ...(b.maxInstances !== undefined ? { maxInstances: v.num(file, b, "maxInstances", 1) } : {}),
      ...(b.incompatibleWith !== undefined ? { incompatibleWith: v.strList(file, b, "incompatibleWith") } : {}),
      ...(b.turns !== undefined ? { turns: v.num(file, b, "turns", 1) } : {}),
      ...(b.requires !== undefined ? { requires: v.str(file, b, "requires") } : {}),
      ...(b.group !== undefined ? { group: v.str(file, b, "group") } : defaultGroup ? { group: defaultGroup } : {}),
      effects: {
        ...(effectsRaw.walls !== undefined ? { walls: v.num(`${file}#${id}`, effectsRaw, "walls") } : {}),
        ...(effectsRaw.incomePct !== undefined ? { incomePct: v.num(`${file}#${id}`, effectsRaw, "incomePct") } : {}),
        ...(effectsRaw.orderPerTurn !== undefined
          ? { orderPerTurn: v.num(`${file}#${id}`, effectsRaw, "orderPerTurn") }
          : {}),
        ...(effectsRaw.unlock !== undefined ? { unlock: v.strList(`${file}#${id}`, effectsRaw, "unlock") } : {}),
        ...(effectsRaw.unlockRoster !== undefined
          ? { unlockRoster: v.strList(`${file}#${id}`, effectsRaw, "unlockRoster") }
          : {}),
        ...(effectsRaw.capacity !== undefined
          ? { capacity: parseCapacity(`${file}#${id}.effects`, "capacity", effectsRaw.capacity, v, warnings) }
          : {}),
        ...(effectsRaw.upkeep !== undefined
          ? { upkeep: parseCapacity(`${file}#${id}.effects`, "upkeep", effectsRaw.upkeep, v, warnings) }
          : {}),
        ...(effectsRaw.freeGarrisonUnits !== undefined
          ? { freeGarrisonUnits: v.num(`${file}#${id}.effects`, effectsRaw, "freeGarrisonUnits", 0) }
          : {}),
        ...(militiaDefense ? { militiaDefense } : {}),
        ...(chainMultiplier ? { chainMultiplier } : {}),
        ...(effectsRaw.freeBuildingUpkeepPerRegion !== undefined
          ? { freeBuildingUpkeepPerRegion: v.num(`${file}#${id}.effects`, effectsRaw, "freeBuildingUpkeepPerRegion", 0) }
          : {}),
        ...(conversion ? { conversion } : {}),
        ...(effectsRaw.siegeSupplies !== undefined
          ? { siegeSupplies: v.num(`${file}#${id}.effects`, effectsRaw, "siegeSupplies", 0) }
          : {}),
        ...(effectsRaw.atrocityIgnore !== undefined
          ? { atrocityIgnore: v.num(`${file}#${id}.effects`, effectsRaw, "atrocityIgnore", 0) }
          : {}),
        ...(atrocityMod ? { atrocityMod } : {}),
        ...(effectsRaw.requiresGarrisonToProduce !== undefined
          ? { requiresGarrisonToProduce: v.bool(`${file}#${id}.effects`, effectsRaw, "requiresGarrisonToProduce") }
          : {}),
        ...(effectsRaw.rollBonusPerTurn !== undefined
          ? { rollBonusPerTurn: v.num(`${file}#${id}.effects`, effectsRaw, "rollBonusPerTurn", 0) }
          : {})
      }
    });
  }
  return out;
}

/**
 * A building's or unit's per-pool capacity figures. Omitted pools are 0, not
 * undefined, so content writes only the pools it means.
 *
 * Both blocks are non-negative magnitudes. `field` exists only to label the
 * validation site, so an error in upkeep points at the upkeep column.
 */
function parseCapacity(
  at: string,
  field: "capacity" | "capacityCost" | "upkeep",
  raw: unknown,
  v: Validator,
  warnings: string[]
): CapacityPoints {
  at = `${at}.${field}`;
  const o = (raw ?? {}) as Record<string, unknown>;
  v.unknownKeys(at, o, ["m", "w", "s", "c"], warnings);
  // Pools are optional — a barracks writes {"m": 2} and means it. Only a key
  // that is *present* is validated; absent pools are 0, never a warning.
  // `v.num` requires >= 0, which is what makes upkeep a magnitude: the AER
  // table writes costs as "-1", and copying that sign into content is an error
  // rather than a silently *generating* capacity.
  const pool = (key: string): number => (key in o ? v.num(at, o, key, 0) : 0);
  return { m: pool("m"), w: pool("w"), s: pool("s"), c: pool("c") };
}

function parseTechDoc(file: string, doc: unknown, v: Validator, warnings: string[], defaultGroup?: string): TechDef[] {
  const list = (doc as Record<string, unknown>)?.tech;
  if (!Array.isArray(list)) {
    v.warn(file, "expected top-level 'tech:' list");
    return [];
  }
  const allowed = ["id", "name", "era", "cost", "requires", "group", "effects"];
  const out: TechDef[] = [];
  for (const entry of list) {
    const t = (entry ?? {}) as Record<string, unknown>;
    v.unknownKeys(file, t, allowed, warnings);
    const id = v.str(file, t, "id");
    const effectsRaw = (t.effects ?? {}) as Record<string, unknown>;
    v.unknownKeys(`${file}#${id}.effects`, effectsRaw, ["incomePct", "upkeepReduction", "unlock"], warnings);
    out.push({
      id,
      name: v.str(file, t, "name"),
      ...(t.era !== undefined ? { era: v.num(file, t, "era", 1) } : {}),
      cost: v.num(file, t, "cost"),
      ...(t.requires !== undefined ? { requires: v.strList(file, t, "requires") } : {}),
      ...(t.group !== undefined ? { group: v.str(file, t, "group") } : defaultGroup ? { group: defaultGroup } : {}),
      effects: {
        ...(effectsRaw.incomePct !== undefined ? { incomePct: v.num(`${file}#${id}`, effectsRaw, "incomePct") } : {}),
        ...(effectsRaw.upkeepReduction !== undefined
          ? { upkeepReduction: v.num(`${file}#${id}`, effectsRaw, "upkeepReduction") }
          : {}),
        ...(effectsRaw.unlock !== undefined ? { unlock: v.strList(`${file}#${id}`, effectsRaw, "unlock") } : {})
      }
    });
  }
  return out;
}

function parseVictorySets(
  docs: { file: string; doc: unknown }[],
  v: Validator,
  warnings: string[]
): Record<string, VictorySet> {
  const out: Record<string, VictorySet> = {};
  for (const { file, doc } of docs) {
    const list = (doc as Record<string, unknown>)?.victory;
    if (!Array.isArray(list)) {
      v.warn(file, "expected top-level 'victory:' list");
      continue;
    }
    for (const entry of list) {
      const s = (entry ?? {}) as Record<string, unknown>;
      v.unknownKeys(file, s, ["id", "name", "objectives"], warnings);
      const id = v.str(file, s, "id");
      const name = s.name !== undefined ? v.str(file, s, "name") : undefined;
      const objectives: VictoryObjective[] = [];
      for (const o of (s.objectives ?? []) as Record<string, unknown>[]) {
        const type = o.type;
        if (type === "controlRegions") {
          const count = typeof o.count === "number" ? o.count : undefined;
          const fraction = typeof o.fraction === "number" ? o.fraction : undefined;
          if (count === undefined && fraction === undefined) {
            v.warn(file, "controlRegions needs 'count' or 'fraction'");
            continue;
          }
          objectives.push({
            type,
            ...(count !== undefined ? { count } : {}),
            ...(fraction !== undefined ? { fraction } : {})
          });
        } else if (type === "eliminateFactions") {
          const factions = v.numList(file, o, "factions");
          if (factions.length === 0) {
            v.warn(file, "eliminateFactions needs a non-empty 'factions' list");
            continue;
          }
          objectives.push({ type, factions });
        } else if (type === "holdCapitals") {
          objectives.push({ type, count: v.num(file, o, "count", 1) });
        } else {
          v.warn(
            file,
            `unknown objective type '${String(type)}' (known: controlRegions, eliminateFactions, holdCapitals)`
          );
        }
      }
      if (id && objectives.length > 0) {
        out[id] = { id, ...(name !== undefined ? { name } : {}), objectives };
      }
    }
  }
  return out;
}

function parseEvents(docs: { file: string; doc: unknown }[], v: Validator, warnings: string[]): EventDef[] {
  const out: EventDef[] = [];
  const triggerTypes = ["turn", "season", "regionCaptured", "factionEliminated", "warDeclared", "poiDiscovered"];
  for (const { file, doc } of docs) {
    const list = (doc as Record<string, unknown>)?.events;
    if (!Array.isArray(list)) {
      v.warn(file, "expected top-level 'events:' list");
      continue;
    }
    for (const entry of list) {
      const e = (entry ?? {}) as Record<string, unknown>;
      v.unknownKeys(file, e, ["id", "title", "text", "trigger", "scope", "once", "choices"], warnings);
      const id = v.str(file, e, "id");
      const title = v.str(file, e, "title");
      const triggerRaw = (e.trigger ?? {}) as Record<string, unknown>;
      v.unknownKeys(`${file}#${id}.trigger`, triggerRaw, ["type", "turn", "every", "season", "poiType"], warnings);
      const type = triggerRaw.type;
      if (typeof type !== "string" || !triggerTypes.includes(type)) {
        v.warn(`${file}#${id}`, `trigger.type must be one of ${triggerTypes.join(", ")}`);
        continue;
      }
      const trigger: EventTrigger = { type: type as EventTrigger["type"] };
      if (triggerRaw.turn !== undefined) trigger.turn = v.num(`${file}#${id}`, triggerRaw, "turn", 1);
      if (triggerRaw.every !== undefined) trigger.every = v.num(`${file}#${id}`, triggerRaw, "every", 1);
      if (triggerRaw.season !== undefined) trigger.season = v.str(`${file}#${id}`, triggerRaw, "season");
      if (triggerRaw.poiType !== undefined) trigger.poiType = v.str(`${file}#${id}`, triggerRaw, "poiType");

      const scope = e.scope === "all" ? "all" : "player";
      const choices: EventChoice[] = [];
      for (const c of (e.choices ?? []) as Record<string, unknown>[]) {
        const ch = (c ?? {}) as Record<string, unknown>;
        v.unknownKeys(`${file}#${id}.choice`, ch, ["text", "effects"], warnings);
        const effRaw = (ch.effects ?? {}) as Record<string, unknown>;
        v.unknownKeys(`${file}#${id}.choice.effects`, effRaw, ["treasury", "order", "relations"], warnings);
        choices.push({
          text: v.str(`${file}#${id}.choice`, ch, "text"),
          effects: {
            ...(effRaw.treasury !== undefined
              ? { treasury: v.numSigned(`${file}#${id}.choice`, effRaw, "treasury") }
              : {}),
            ...(effRaw.order !== undefined ? { order: v.numSigned(`${file}#${id}.choice`, effRaw, "order") } : {}),
            ...(effRaw.relations !== undefined
              ? { relations: v.numSigned(`${file}#${id}.choice`, effRaw, "relations") }
              : {})
          }
        });
      }
      if (choices.length < 2) {
        v.warn(`${file}#${id}`, "events need at least 2 choices (dilemmas)");
        continue;
      }
      if (id && title) {
        out.push({
          id,
          title,
          ...(e.text !== undefined ? { text: v.str(file, e, "text") } : {}),
          trigger,
          scope,
          ...(e.once !== undefined ? { once: e.once === true } : {}),
          choices
        });
      }
    }
  }
  return out;
}

function parseFactionDef(file: string, body: Record<string, unknown>, v: Validator, warnings: string[]): FactionDef {
  v.unknownKeys(
    file,
    body,
    ["bind", "rosterId", "traits", "mechanics", "roster", "buildings", "tech", "victory", "player", "aiType"],
    warnings
  );
  const bindRaw = (body.bind ?? {}) as Record<string, unknown>;
  v.unknownKeys(`${file}#bind`, bindRaw, ["stateId", "stateName", "cultureName", "cultureId", "cultureRace"], warnings);
  const bind: FactionDef["bind"] = {};
  if (bindRaw.stateId !== undefined) {
    const id = v.num(`${file}#bind`, bindRaw, "stateId", 1);
    if (id > 0) bind.stateId = id;
  }
  if (bindRaw.stateName !== undefined) bind.stateName = v.str(`${file}#bind`, bindRaw, "stateName");
  if (bindRaw.cultureName !== undefined) bind.cultureName = v.str(`${file}#bind`, bindRaw, "cultureName");
  if (bindRaw.cultureRace !== undefined) bind.cultureRace = v.str(`${file}#bind`, bindRaw, "cultureRace");
  if (bindRaw.cultureId !== undefined) {
    const cid = v.num(`${file}#bind`, bindRaw, "cultureId", 0);
    if (cid >= 0) bind.cultureId = cid;
  }

  const mechanicsRaw = (body.mechanics ?? {}) as Record<string, unknown>;
  v.unknownKeys(`${file}#mechanics`, mechanicsRaw, ["corruption", "confederation"], warnings);
  const mechanics: Partial<FactionMechanics> = {};
  if (mechanicsRaw.corruption !== undefined) mechanics.corruption = mechanicsRaw.corruption === true;
  if (mechanicsRaw.confederation !== undefined) {
    if (mechanicsRaw.confederation === "cultureGroup" || mechanicsRaw.confederation === "never") {
      mechanics.confederation = mechanicsRaw.confederation;
    } else {
      v.warn(
        file,
        `mechanics.confederation must be 'cultureGroup' or 'never', got ${JSON.stringify(mechanicsRaw.confederation)}`
      );
    }
  }

  const rosterRaw = (body.roster ?? {}) as Record<string, unknown>;
  v.unknownKeys(`${file}#roster`, rosterRaw, ["include", "exclude", "units"], warnings);
  const unitsRaw = (rosterRaw.units ?? {}) as Record<string, Record<string, unknown>>;
  const unitOverrides: Record<string, Partial<UnitType>> = {};
  for (const [uid, patch] of Object.entries(unitsRaw)) {
    if (!patch || typeof patch !== "object") {
      v.warn(`${file}#roster.units`, `override for '${uid}' must be an object`);
      continue;
    }
    const overrideBody: Record<string, unknown> = { ...patch };
    if (overrideBody.men !== undefined) {
      const authored = overrideBody.men;
      delete overrideBody.men;
      v.warn(
        `${file}#roster.units.${uid}`,
        `field 'men' was retired by the military conversion — author 'blocks' ` +
          `(AER blocks of ${MEN_PER_BLOCK} men, CAPACITY-PLAN Phase 4b) instead: ` +
          `men: ${String(authored)} ⇒ blocks: ${Number(authored) / MEN_PER_BLOCK}`
      );
    }
    v.unknownKeys(
      `${file}#roster.units.${uid}`,
      overrideBody,
      ["id", "name", "category", "units", "attack", "defense", "charge", "missile", "cost", "upkeep"],
      warnings
    );
    const out: Record<string, unknown> = {};
    for (const key of ["blocks", "attack", "defense", "charge", "missile", "cost", "upkeep"] as const) {
      if (overrideBody[key] !== undefined)
        out[key] = v.num(`${file}#roster.units.${uid}`, overrideBody, key, key === "blocks" ? 1 / MEN_PER_BLOCK : 0);
    }
    if (overrideBody.name !== undefined) out.name = v.str(`${file}#roster.units.${uid}`, overrideBody, "name");
    if (overrideBody.category !== undefined) {
      const category = overrideBody.category;
      if (typeof category === "string" && CATEGORIES.includes(category as UnitCategory)) out.category = category;
      else v.warn(`${file}#roster.units.${uid}`, `category must be one of ${CATEGORIES.join(", ")}`);
    }
    unitOverrides[uid] = out as Partial<UnitType>;
  }
  const roster: FactionDef["roster"] | undefined =
    rosterRaw.include !== undefined || rosterRaw.exclude !== undefined || Object.keys(unitOverrides).length > 0
      ? {
          ...(rosterRaw.include !== undefined ? { include: v.strList(`${file}#roster`, rosterRaw, "include") } : {}),
          ...(rosterRaw.exclude !== undefined ? { exclude: v.strList(`${file}#roster`, rosterRaw, "exclude") } : {}),
          ...(Object.keys(unitOverrides).length > 0 ? { units: unitOverrides } : {})
        }
      : undefined;

  const buildingsAvail = parseAvailability(`${file}#buildings`, body.buildings, v, warnings);
  const techAvail = parseAvailability(`${file}#tech`, body.tech, v, warnings);

  return {
    bind,
    ...(body.rosterId !== undefined ? { rosterId: v.str(file, body, "rosterId") } : {}),
    ...(body.traits !== undefined ? { traits: v.strList(file, body, "traits") } : {}),
    ...(Object.keys(mechanics).length > 0 ? { mechanics } : {}),
    ...(roster !== undefined ? { roster } : {}),
    ...(buildingsAvail !== undefined ? { buildings: buildingsAvail } : {}),
    ...(techAvail !== undefined ? { tech: techAvail } : {}),
    ...(body.victory !== undefined ? { victory: v.str(file, body, "victory") } : {}),
    ...(body.player !== undefined ? { player: v.str(file, body, "player") } : {}),
    ...(body.aiType !== undefined
      ? { aiType: v.str(file, body, "aiType") as "balanced" | "aggressive" | "defensive" | "economic" }
      : {})
  };
}

/** The `{ include?, exclude? }` shape shared by the buildings and tech overrides. */
function parseAvailability(
  file: string,
  raw: unknown,
  v: Validator,
  warnings: string[]
): { include?: string[]; exclude?: string[] } | undefined {
  if (raw === undefined) return undefined;
  const body = (raw ?? {}) as Record<string, unknown>;
  v.unknownKeys(file, body, ["include", "exclude"], warnings);
  const include = body.include !== undefined ? v.strList(file, body, "include") : undefined;
  const exclude = body.exclude !== undefined ? v.strList(file, body, "exclude") : undefined;
  if (include === undefined && exclude === undefined) return undefined;
  return {
    ...(include !== undefined ? { include } : {}),
    ...(exclude !== undefined ? { exclude } : {})
  };
}

// ---------------------------------------------------------------------------
// Top-level validate + resolve
// ---------------------------------------------------------------------------

export interface RawContentDocs {
  rosterDocs: { file: string; doc: unknown }[];
  culturesDocs?: { file: string; doc: unknown }[];
  factionDocs: { file: string; doc: unknown }[];
  buildingsDocs?: { file: string; doc: unknown }[];
  techDocs?: { file: string; doc: unknown }[];
  victoryDocs: { file: string; doc: unknown }[];
  eventsDocs?: { file: string; doc: unknown }[];
  meta: { defaultRoster: string; defaultVictory: string };
}

export function validateAndResolve(docs: RawContentDocs): {
  content: ContentPack | null;
  errors: string[];
  warnings: string[];
} {
  const v = new Validator();
  const warnings: string[] = [];

  // Rosters: parse docs → RawRosters, then resolve inheritance.
  const rawRosters: RawRoster[] = [];
  for (const { file, doc } of docs.rosterDocs) {
    const parsed = parseRoster(file, doc, v, warnings);
    if (parsed) rawRosters.push(parsed);
  }
  const allUnitCandidates = [...new Set(rawRosters.flatMap(r => Object.keys(r.units)))];
  const rosters = resolveRosters(rawRosters, v, warnings, allUnitCandidates);

  // Cultures: bind by name or id.
  const cultures: CultureBinding[] = [];
  for (const { file, doc } of docs.culturesDocs ?? []) {
    const list = (doc as Record<string, unknown>)?.cultures;
    if (!Array.isArray(list)) {
      v.warn(file, "expected top-level 'cultures:' list");
      continue;
    }
    for (const entry of list) {
      const c = (entry ?? {}) as Record<string, unknown>;
      v.unknownKeys(file, c, ["cultureName", "cultureId", "cultureRace", "roster", "victory", "traits"], warnings);
      const binding: CultureBinding = {
        roster: v.str(file, c, "roster"),
        ...(c.cultureName !== undefined ? { cultureName: v.str(file, c, "cultureName") } : {}),
        ...(c.cultureId !== undefined ? { cultureId: v.num(file, c, "cultureId", 0) } : {}),
        ...(c.cultureRace !== undefined ? { cultureRace: v.str(file, c, "cultureRace") } : {}),
        ...(c.victory !== undefined ? { victory: v.str(file, c, "victory") } : {}),
        ...(c.traits !== undefined ? { traits: v.strList(file, c, "traits") } : {})
      };
      if (binding.roster) cultures.push(binding);
    }
  }

  // Factions: docs may provide a top-level 'faction' object or a 'factions' array.
  const factions: FactionDef[] = [];
  for (const { file, doc } of docs.factionDocs) {
    const root = (doc ?? {}) as Record<string, unknown>;
    if (Array.isArray(root.factions)) {
      for (let i = 0; i < root.factions.length; i++) {
        const item = root.factions[i];
        if (item && typeof item === "object") {
          factions.push(parseFactionDef(`${file}#factions[${i}]`, item as Record<string, unknown>, v, warnings));
        }
      }
    } else if (root.faction && typeof root.faction === "object") {
      factions.push(parseFactionDef(file, root.faction as Record<string, unknown>, v, warnings));
    } else {
      v.warn(file, "expected top-level 'faction:' section or 'factions:' list");
    }
  }

  // Buildings + tech + victory.
  const rosterBuildingDocs = docs.rosterDocs.filter(
    ({ doc }) => (doc as Record<string, unknown>)?.buildings !== undefined
  );
  const allBuildingDocs = [
    ...rosterBuildingDocs.map(({ file, doc }) => {
      const rId =
        ((doc as Record<string, unknown>)?.id as string) ??
        ((doc as Record<string, unknown>)?.roster as { id?: string })?.id;
      const defaultGroup = rId && rId !== docs.meta.defaultRoster ? rId : undefined;
      return { file, doc, defaultGroup };
    }),
    ...(docs.buildingsDocs ?? []).map(({ file, doc }) => ({ file, doc, defaultGroup: undefined }))
  ];
  const buildings: BuildingDef[] = allBuildingDocs.flatMap(({ file, doc, defaultGroup }) =>
    parseBuildingsDoc(file, doc, v, warnings, defaultGroup)
  );

  const rosterTechDocs = docs.rosterDocs.filter(({ doc }) => (doc as Record<string, unknown>)?.tech !== undefined);
  const allTechDocs = [
    ...rosterTechDocs.map(({ file, doc }) => {
      const rId =
        ((doc as Record<string, unknown>)?.id as string) ??
        ((doc as Record<string, unknown>)?.roster as { id?: string })?.id;
      const defaultGroup = rId && rId !== docs.meta.defaultRoster ? rId : undefined;
      return { file, doc, defaultGroup };
    }),
    ...(docs.techDocs ?? []).map(({ file, doc }) => ({ file, doc, defaultGroup: undefined }))
  ];
  const tech: TechDef[] = allTechDocs.flatMap(({ file, doc, defaultGroup }) =>
    parseTechDoc(file, doc, v, warnings, defaultGroup)
  );
  const victory = parseVictorySets(docs.victoryDocs, v, warnings);
  const events = parseEvents(docs.eventsDocs ?? [], v, warnings);
  const eventIds = new Set<string>();
  for (const ev of events) {
    if (eventIds.has(ev.id)) v.warn("events/*.yaml", `duplicate event id '${ev.id}'`);
    eventIds.add(ev.id);
  }

  if (!rosters[docs.meta.defaultRoster]) {
    v.warn(
      "content meta",
      `defaultRoster '${docs.meta.defaultRoster}' does not exist${didYouMean(docs.meta.defaultRoster, Object.keys(rosters))}`
    );
  }
  if (!victory[docs.meta.defaultVictory]) {
    v.warn(
      "content meta",
      `defaultVictory '${docs.meta.defaultVictory}' does not exist${didYouMean(docs.meta.defaultVictory, Object.keys(victory))}`
    );
  }

  // Cross-references: cultures → rosters/victory, factions → victory/roster units.
  const allUnitIds = new Set<string>();
  for (const r of Object.values(rosters)) for (const uid of Object.keys(r.units)) allUnitIds.add(uid);
  for (const c of cultures) {
    if (c.cultureName === undefined && c.cultureId === undefined && c.cultureRace === undefined) {
      v.warn("cultures.yaml", "culture binding needs 'cultureName', 'cultureId' or 'cultureRace'");
    }
    if (!rosters[c.roster]) {
      v.warn(
        "cultures.yaml",
        `culture binding references unknown roster '${c.roster}'${didYouMean(c.roster, Object.keys(rosters))}`
      );
    }
    if (c.victory && !victory[c.victory]) {
      v.warn(
        "cultures.yaml",
        `culture binding references unknown victory set '${c.victory}'${didYouMean(c.victory, Object.keys(victory))}`
      );
    }
  }
  for (const f of factions) {
    const hasBind =
      f.bind &&
      (f.bind.stateId !== undefined ||
        f.bind.stateName !== undefined ||
        f.bind.cultureName !== undefined ||
        f.bind.cultureId !== undefined ||
        f.bind.cultureRace !== undefined);
    if (!hasBind) {
      v.warn(
        "factions/*.yaml",
        "faction needs 'bind: { stateId | stateName | cultureName | cultureId | cultureRace }'"
      );
    }
    if (f.victory && !victory[f.victory]) {
      v.warn(
        "factions/*.yaml",
        `faction references unknown victory set '${f.victory}'${didYouMean(f.victory, Object.keys(victory))}`
      );
    }
    if (f.rosterId && !rosters[f.rosterId]) {
      v.warn(
        "factions/*.yaml",
        `faction rosterId references unknown roster '${f.rosterId}'${didYouMean(f.rosterId, Object.keys(rosters))}`
      );
    }
    if (f.roster?.include) {
      for (const uid of f.roster.include) {
        if (!allUnitIds.has(uid)) {
          v.warn(
            "factions/*.yaml",
            `faction include references unknown unit '${uid}'${didYouMean(uid, [...allUnitIds])}`
          );
        }
      }
    }
    if (f.roster?.exclude) {
      for (const uid of f.roster.exclude) {
        if (!allUnitIds.has(uid)) {
          v.warn(
            "factions/*.yaml",
            `faction exclude references unknown unit '${uid}'${didYouMean(uid, [...allUnitIds])}`
          );
        }
      }
    }
    if (f.roster?.units) {
      for (const [uid, patch] of Object.entries(f.roster.units)) {
        if (!allUnitIds.has(uid)) {
          v.warn(
            "factions/*.yaml",
            `faction unit override references unknown unit '${uid}'${didYouMean(uid, [...allUnitIds])}`
          );
        }
        if (Object.keys(patch).length === 0) {
          v.warn("factions/*.yaml", `faction unit override for '${uid}' overrides nothing`);
        }
      }
    }
    for (const [key, poolIds] of [
      ["buildings", buildings],
      ["tech", tech]
    ] as const) {
      for (const pass of ["include", "exclude"] as const) {
        for (const id of f[key]?.[pass] ?? []) {
          if (!poolIds.some(x => x.id === id)) {
            v.warn(
              "factions/*.yaml",
              `faction ${key}.${pass} references unknown ${key === "tech" ? "tech" : "building"} '${id}'`
            );
          }
        }
      }
    }
  }
  // Buildings: chain prereqs + duplicate chains/tiers.
  const seenChainTier = new Set<string>();
  const buildingIds = new Set(buildings.map(b => b.id));
  for (const b of buildings) {
    if ((!b.kind || b.kind === "structure") && b.chain !== "custom" && b.chain !== "unchained" && b.chain !== "resource") {
      const key = `${b.group ?? ""}:${b.chain}:${b.tier}`;
      if (seenChainTier.has(key)) v.warn("buildings.yaml", `duplicate chain/tier ${b.chain}:${b.tier} on '${b.id}'`);
      seenChainTier.add(key);
    }
    if (b.requires && !buildingIds.has(b.requires)) {
      v.warn(
        "buildings.yaml",
        `building '${b.id}' requires unknown building '${b.requires}'${didYouMean(b.requires, [...buildingIds])}`
      );
    }
    if (b.requires) {
      const req = buildings.find(x => x.id === b.requires && (x.group === b.group || !x.group));
      if (req && req.chain !== b.chain) {
        v.warn(
          "buildings.yaml",
          `building '${b.id}' requires '${b.requires}' from a different chain ('${req.chain}' vs '${b.chain}')`
        );
      }
    }
    if (b.group && !rosters[b.group]) {
      v.warn(
        "buildings.yaml",
        `building '${b.id}' names unknown group '${b.group}'${didYouMean(b.group, Object.keys(rosters))}`
      );
    }
    if (b.effects.unlock) {
      for (const uid of b.effects.unlock) {
        if (!allUnitIds.has(uid))
          v.warn("buildings.yaml", `unlock references unknown unit '${uid}'${didYouMean(uid, [...allUnitIds])}`);
      }
    }
    if (b.effects.militiaDefense) {
      if (!allUnitIds.has(b.effects.militiaDefense.unitType)) {
        v.warn(
          "buildings.yaml",
          `militiaDefense references unknown unit '${b.effects.militiaDefense.unitType}'${didYouMean(b.effects.militiaDefense.unitType, [...allUnitIds])}`
        );
      }
    }
    if (b.effects.unlockRoster) {
      for (const rId of b.effects.unlockRoster) {
        if (!rosters[rId]) {
          v.warn(
            "buildings.yaml",
            `unlockRoster references unknown roster '${rId}'${didYouMean(rId, Object.keys(rosters))}`
          );
        }
      }
    }
    if (b.incompatibleWith) {
      for (const otherId of b.incompatibleWith) {
        if (!buildingIds.has(otherId)) {
          v.warn(
            "buildings.yaml",
            `incompatibleWith references unknown building '${otherId}'${didYouMean(otherId, [...buildingIds])}`
          );
        }
      }
    }
  }
  for (const t of tech) {
    for (const req of t.requires ?? []) {
      if (!tech.some(x => x.id === req)) {
        v.warn(
          "tech.yaml",
          `tech '${t.id}' requires unknown tech '${req}'${didYouMean(
            req,
            tech.map(x => x.id)
          )}`
        );
      }
    }
    if (t.group && !rosters[t.group]) {
      v.warn(
        "tech.yaml",
        `tech '${t.id}' names unknown group '${t.group}'${didYouMean(t.group, Object.keys(rosters))}`
      );
    }
    if (t.effects.unlock) {
      for (const uid of t.effects.unlock) {
        if (!allUnitIds.has(uid))
          v.warn("tech.yaml", `unlock references unknown unit '${uid}'${didYouMean(uid, [...allUnitIds])}`);
      }
    }
  }

  if (v.errors.length > 0 || Object.keys(rosters).length === 0) {
    return { content: null, errors: v.errors, warnings };
  }

  // Flatten unit types (union of all rosters).
  const unitTypes: Record<string, UnitType> = {};
  for (const r of Object.values(rosters)) {
    for (const u of Object.values(r.units)) unitTypes[u.id] = u;
  }

  const content: ContentPack = {
    hash: "",
    unitTypes,
    rosters,
    cultures,
    factions,
    buildings,
    tech,
    victory,
    events,
    defaultRoster: rosters[docs.meta.defaultRoster] ? docs.meta.defaultRoster : Object.keys(rosters)[0]!,
    defaultVictory: victory[docs.meta.defaultVictory]
      ? docs.meta.defaultVictory
      : (Object.keys(victory)[0] ?? "standardShort")
  };
  content.hash = canonicalHash({
    unitTypes: content.unitTypes,
    rosters: content.rosters,
    cultures: content.cultures,
    factions: content.factions,
    buildings: content.buildings,
    tech: content.tech,
    victory: content.victory,
    events: content.events,
    defaultRoster: content.defaultRoster,
    defaultVictory: content.defaultVictory
  });
  return { content, errors: [], warnings };
}

// ---------------------------------------------------------------------------
// Map binding (per Azgaar pack)
// ---------------------------------------------------------------------------

/**
 * Azgaar culture names carry their race in parentheses — "Voth (Orkish)" —
 * which is the only part of a culture name that survives a world switch.
 * Returns the lowercased race, or "" when the name has no "(Race)" suffix.
 */
function raceOf(cultureName: string | undefined): string {
  const m = /\(([^()]+)\)\s*$/.exec(cultureName ?? "");
  return m ? m[1]!.trim().toLowerCase() : "";
}

export const DEFAULT_ROSTER_MAP: Record<string, boolean> = {
  commonBase: true,
  dwarfBase: true,
  elfBase: true,
  orcBase: true,
  steppeBase: true,
  eastAsiaBase: true,
  mughalBase: true,
  ottomanBase: true,
  renaissanceBase: true,
  empireBase: true,
  chivalricBase: true,
  woodElfBase: true,
  tombKingsBase: true,
  vampireBase: true,
  chaosBase: true,
  darkElfBase: true,
  skavenBase: true,
  lizardmenBase: true,
  infernalDwarfBase: true,
  ogreBase: true,
  demonBase: true,
  beastfolkBase: true,
  halflingBase: true,
  feyBase: true,
  dragonbornBase: true,
  celestialBase: true,
  merfolkBase: true,
  elementalBase: true,
  constructBase: true,
  eldritchBase: true,
  tribalBase: true,
  arachnidBase: true
};

/**
 * Infer the roster for an active map culture based on its name or race tag
 * (e.g. Azgaar's "Name (Race)" convention or custom culture names like "Wood Elves"),
 * optionally taking culture/state type into account.
 */
export function inferRosterForCulture(
  cultureName: string | undefined,
  rosters: Record<string, unknown>,
  defaultRoster: string,
  cultureType?: string,
  stateType?: string
): string {
  if (!cultureName && !cultureType && !stateType) return defaultRoster;
  const race = raceOf(cultureName) || (cultureName ? cultureName.toLowerCase() : "");
  const name = cultureName ? cultureName.toLowerCase() : "";
  const matches = (rx: RegExp) => rx.test(race) || rx.test(name);

  for (const id of Object.keys(rosters)) {
    if (name?.includes(id.toLowerCase())) return id;
  }

  // 1. Undead factions (Tomb Kings / Lich before Vampire)
  if (matches(/(tomb|khemri|nehekhar|mummy|pharaoh|lich|necromanc)/i) && rosters.tombKingsBase) {
    return "tombKingsBase";
  }
  if (matches(/(vampir|nightblood|undead|sylvania|sylvanian|barrow)/i) && rosters.vampireBase) {
    return "vampireBase";
  }

  // 2. Specialized Dwarfs & Elves before generic archetypes
  if (matches(/(infernal|chaos dwarf|hashut|zharr|duergar|deep dwarf)/i) && rosters.infernalDwarfBase) {
    return "infernalDwarfBase";
  }
  if (matches(/(dark elf|dark elvish|trow|lothian|drow|corsair|druchii)/i) && rosters.darkElfBase) {
    return "darkElfBase";
  }
  if (matches(/(wood elf|wood elvish|sylvan|weald|glade|asrai)/i) && rosters.woodElfBase) {
    return "woodElfBase";
  }
  if (matches(/(sea elf|pelagic|merfolk|aelvar|triton|aquatic)/i) && rosters.merfolkBase) {
    return "merfolkBase";
  }

  // 3. Specialized Under-Empire, Dragonborn & Beast/Monster factions
  if (matches(/(arachnid|arago|rakhnid|spider|brood hive|chitin)/i)) {
    if (rosters.arachnidBase) return "arachnidBase";
    if (rosters.skavenBase) return "skavenBase";
  }
  if (matches(/(skaven|ratmen|vermin|blight|under-empire|thaggoraki)/i) && rosters.skavenBase) {
    return "skavenBase";
  }
  if (matches(/(dragonborn|drakonic|wyrm|dragon)/i) && rosters.dragonbornBase) {
    return "dragonbornBase";
  }
  if (matches(/(lizard|saurian|serpent|snaga|rake)/i) && rosters.lizardmenBase) {
    return "lizardmenBase";
  }
  if (matches(/(ogre|troll|stonehorn|mournfang|gutbuster)/i) && rosters.ogreBase) {
    return "ogreBase";
  }
  if (
    matches(/(beastfolk|beastmen|minotaur|bullkin|lionkin|catfolk|wolfkin|werefolk|aarakocra|birdfolk|brayherd)/i) &&
    rosters.beastfolkBase
  ) {
    return "beastfolkBase";
  }
  if (matches(/(demon|daemon|fiend|tiefling|hellblade|abyssal)/i) && rosters.demonBase) {
    return "demonBase";
  }
  if (matches(/(halfling|hobbit|gnome|tinker|moot)/i) && rosters.halflingBase) {
    return "halflingBase";
  }
  if (matches(/(fey|fae|fair folk|sidhe|sprite|pixie|seelie|unseelie)/i) && rosters.feyBase) {
    return "feyBase";
  }
  if (matches(/(celestial|aasimar|chosen|oracle|angelic|seraph)/i) && rosters.celestialBase) {
    return "celestialBase";
  }
  if (matches(/(elemental|genasi|primordial)/i) && rosters.elementalBase) {
    return "elementalBase";
  }
  if (matches(/(construct|warforged|automaton|golem|clockwork)/i) && rosters.constructBase) {
    return "constructBase";
  }
  if (matches(/(eldritch|aboleth|mindflayer|illithid|aberration)/i) && rosters.eldritchBase) {
    return "eldritchBase";
  }

  // 4. Specialized Human Realms & Regional Traditions
  if (
    matches(/(eastern empire|east asia|cathay|yamoto|hantzu|koryo|guantzu|oriental|nihon)/i) &&
    rosters.eastAsiaBase
  ) {
    return "eastAsiaBase";
  }
  if (matches(/(empire|imperial|elector|sigmar|schwarzen)/i) && rosters.empireBase) {
    return "empireBase";
  }
  if (matches(/(chivalr|feudal|breton|grail|luarian)/i) && rosters.chivalricBase) {
    return "chivalricBase";
  }
  if (matches(/(ottoman|desert nomad|arabi|eurabic|turchian|turan)/i) && rosters.ottomanBase) {
    return "ottomanBase";
  }
  if (matches(/(mughal|southern kingdom|kiswaili|yoruba|indus)/i) && rosters.mughalBase) {
    return "mughalBase";
  }
  if (matches(/(renaissance|pike and shot|condottieri|borgia)/i) && rosters.renaissanceBase) {
    return "renaissanceBase";
  }
  if (matches(/(tribal|jungle tribe|tundra tribe|islander)/i) && rosters.tribalBase) {
    return "tribalBase";
  }
  if (matches(/(chaos|yotunn|norse|norsca|nordlander|wasteland|ruin)/i) && rosters.chaosBase) {
    return "chaosBase";
  }

  // 5. Core Fantasy & Historical Fallbacks
  if (matches(/(dwarf|dwarv|dunirr|khazad)/i) && rosters.dwarfBase) {
    return "dwarfBase";
  }
  if (matches(/(elf|elv|eldar|quenian|quenar)/i) && rosters.elfBase) {
    return "elfBase";
  }
  if (matches(/(orc|ork|goblin|uruk|ugluk|kobold)/i) && rosters.orcBase) {
    return "orcBase";
  }
  if (matches(/(steppe|nomad)/i) || cultureType === "Nomadic" || stateType === "Nomadic") {
    if (rosters.steppeBase) return "steppeBase";
  }
  if ((cultureType === "Highland" || stateType === "Highland") && matches(/(mountain|hill|stone|rock)/i)) {
    if (rosters.dwarfBase) return "dwarfBase";
  }

  return defaultRoster;
}

/**
 * Determine a state's unit roster, preserving an existing rosterId or inferring
 * from its culture name, race tag, culture type, or state type.
 */
export function assignStateRoster(
  state: { rosterId?: string; culture?: number; type?: string },
  cultures?: Array<{ i?: number; name?: string; type?: string } | undefined>,
  rosters: Record<string, unknown> = DEFAULT_ROSTER_MAP,
  defaultRoster = "commonBase"
): string {
  if (state.rosterId && rosters[state.rosterId]) return state.rosterId;
  const culture = state.culture && cultures ? cultures[state.culture] : undefined;
  const cultureName = culture?.name;
  const cultureType = culture?.type;
  return inferRosterForCulture(cultureName, rosters, defaultRoster, cultureType, state.type);
}

export function resolveForPack(
  pack: {
    cultures: { i: number; name: string }[];
    factions: { id: number; name: string; culture: number; rosterId?: string }[];
  },
  content: ContentPack
): ResolvedContent {
  const bindingWarnings: string[] = [];
  const cultureNameToId = new Map<string, number>();
  for (const c of pack.cultures) cultureNameToId.set(c.name, c.i);
  const cultureById = new Map<number, (typeof pack.cultures)[number]>();
  for (const c of pack.cultures) cultureById.set(c.i, c);

  const factionDefsByState = new Map<string, FactionDef>();
  const factionDefsByCultureId = new Map<number, FactionDef>();
  const factionDefsByCultureName = new Map<string, FactionDef>();
  const factionDefsByRace = new Map<string, FactionDef>();
  for (const def of content.factions) {
    if (def.bind.stateName !== undefined) {
      const state = pack.factions.find(s => s.name === def.bind.stateName);
      if (!state) {
        bindingWarnings.push(
          `faction YAML binds unknown state name '${def.bind.stateName}' on this map${didYouMean(
            def.bind.stateName,
            pack.factions.map(s => s.name)
          )}`
        );
        continue;
      }
      factionDefsByState.set(String(state.id), def);
    } else if (def.bind.stateId !== undefined) {
      factionDefsByState.set(String(def.bind.stateId), def);
    } else if (def.bind.cultureName !== undefined) {
      const id = cultureNameToId.get(def.bind.cultureName);
      if (id === undefined) {
        bindingWarnings.push(
          `faction YAML binds unknown culture name '${def.bind.cultureName}' on this map${didYouMean(
            def.bind.cultureName,
            pack.cultures.map(c => c.name)
          )}`
        );
        continue;
      }
      factionDefsByCultureName.set(def.bind.cultureName.toLowerCase(), def);
    } else if (def.bind.cultureId !== undefined) {
      factionDefsByCultureId.set(def.bind.cultureId, def);
    } else if (def.bind.cultureRace !== undefined) {
      // Portable binding: Azgaar names every culture "<Name> (Race)", so the
      // race suffix matches on any world — including ones we've never seen.
      const race = def.bind.cultureRace.toLowerCase();
      if (!pack.cultures.some(c => raceOf(c.name) === race)) {
        bindingWarnings.push(
          `faction YAML binds culture race '${def.bind.cultureRace}' — no culture on this map matches it`
        );
        continue;
      }
      factionDefsByRace.set(race, def);
    }
  }

  /**
   * Most specific def for a state: hand-tuned state binding, else a culture
   * binding (exact name → id → race). Unbound factions fall through to the
   * culture traits + default roster below.
   */
  const defFor = (state: { id: number; culture: number }): FactionDef | undefined => {
    const byState = factionDefsByState.get(String(state.id));
    if (byState) return byState;
    const culture = cultureById.get(state.culture);
    return (
      factionDefsByCultureId.get(state.culture) ??
      (culture ? factionDefsByCultureName.get(culture.name.toLowerCase()) : undefined) ??
      factionDefsByRace.get(raceOf(culture?.name))
    );
  };

  const rosterForCulture = (cultureId: number): { rosterId: string; victory?: string; traits: string[] } => {
    const culture = cultureById.get(cultureId);
    if (culture) {
      const race = raceOf(culture.name);
      const binding =
        content.cultures.find(c => c.cultureId === cultureId) ??
        content.cultures.find(c => c.cultureName === culture.name) ??
        content.cultures.find(c => c.cultureRace !== undefined && c.cultureRace.toLowerCase() === race);
      if (binding) {
        if (!content.rosters[binding.roster]) {
          bindingWarnings.push(`culture '${culture.name}' binds missing roster '${binding.roster}' — using default`);
        } else {
          return { rosterId: binding.roster, victory: binding.victory, traits: binding.traits ?? [] };
        }
      }
      return { rosterId: inferRosterForCulture(culture.name, content.rosters, content.defaultRoster), traits: [] };
    }
    return { rosterId: content.defaultRoster, traits: [] };
  };

  /**
   * A state's view of a pool: common entries plus its own group's, adjusted by
   * the state's availability overrides. Already-built content is unaffected —
   * this gates new construction and research only.
   */
  const scoped = <T extends { id: string; group?: string }>(
    pool: T[],
    groupId: string,
    avail: { include?: string[]; exclude?: string[] } | undefined
  ): T[] => {
    const byId = new Map<string, T>();
    for (const entry of pool) if (!entry.group) byId.set(entry.id, entry);
    for (const entry of pool) if (entry.group === groupId) byId.set(entry.id, entry);
    const base = [...byId.values()];
    if (!avail) return base;
    const out = base.filter(entry => !(avail.exclude ?? []).includes(entry.id));
    for (const id of avail.include ?? []) {
      const entry = pool.find(candidate => candidate.id === id);
      if (entry && !out.some(present => present.id === id)) out.push(entry);
    }
    return out;
  };

  const factions: Record<string, ResolvedFaction> = {};
  for (const state of pack.factions) {
    const def = defFor(state);
    const fromCulture = rosterForCulture(state.culture);
    const culture = cultureById.get(state.culture);
    const explicitBinding = culture
      ? (content.cultures.find(c => c.cultureId === state.culture) ??
        content.cultures.find(c => c.cultureName === culture.name) ??
        content.cultures.find(c => c.cultureRace !== undefined && c.cultureRace.toLowerCase() === raceOf(culture.name)))
      : undefined;
    // Most specific roster decision wins: an explicit per-state assignment on state or def,
    // then the culture-group binding, then race inference, then the default.
    const baseRosterId =
      (state.rosterId && content.rosters[state.rosterId] ? state.rosterId : undefined) ??
      (def?.rosterId && content.rosters[def.rosterId] ? def.rosterId : undefined) ??
      (explicitBinding && content.rosters[explicitBinding.roster] ? explicitBinding.roster : undefined) ??
      fromCulture.rosterId;
    const roster = content.rosters[baseRosterId]!;

    // Apply faction include/exclude on a per-faction view of the roster.
    // Include may draw from ANY content unit type (cross-roster includes, e.g.
    // an elite guard defined in the base roster for an elf-culture faction).
    const recruitable = roster.recruitable.filter(uid => !(def?.roster?.exclude ?? []).includes(uid));
    const included: Record<string, UnitType> = {};
    for (const uid of def?.roster?.include ?? []) {
      const t = content.unitTypes[uid];
      if (t) {
        included[uid] = t;
        if (!recruitable.includes(uid)) recruitable.push(uid);
      }
    }
    // Per-state stat patches merge over whatever the state's unit view is —
    // a group unit or an included one, either can be tuned for this state.
    const units: Record<string, UnitType> = { ...roster.units, ...included };
    for (const [uid, patch] of Object.entries(def?.roster?.units ?? {})) {
      const base = units[uid];
      if (base) {
        const merged = { ...base, ...patch, id: base.id };
        // `men` is derived, so re-derive it whenever the override moves `units`
        // — otherwise a faction that declares 0.3 of a block would inherit the
        // base roster's men ceiling and the two would silently disagree.
        merged.men = merged.blocks * MEN_PER_BLOCK;
        units[uid] = merged;
      }
    }
    const perFactionRoster: ResolvedRoster = { ...roster, units, recruitable };

    const traits = [...(fromCulture.traits ?? []), ...(def?.traits ?? [])];
    const hasCorruption =
      def?.mechanics?.corruption !== undefined
        ? def.mechanics.corruption
        : def?.traits !== undefined
          ? def.traits.includes("corruption")
          : true;

    if (hasCorruption && !traits.includes("corruption")) {
      traits.push("corruption");
    }

    const mechanics: FactionMechanics = {
      corruption: hasCorruption,
      confederation: def?.mechanics?.confederation ?? "cultureGroup"
    };

    let controller: "player" | "ai" = "ai";
    let aiType: "balanced" | "aggressive" | "defensive" | "economic" = "balanced";
    const p = def?.player;
    if (p === "player") {
      controller = "player";
    } else if (typeof p === "string" && p.startsWith("ai-")) {
      controller = "ai";
      const sub = p.slice(3) as "balanced" | "aggressive" | "defensive" | "economic";
      if (["balanced", "aggressive", "defensive", "economic"].includes(sub)) aiType = sub;
    } else if (def?.aiType && ["balanced", "aggressive", "defensive", "economic"].includes(def.aiType)) {
      controller = "ai";
      aiType = def.aiType;
    } else if (!p) {
      const anyPlayerSet = (pack.factions ?? []).some(other => {
        const otherDef = (content.factions ?? []).find(d => d.bind.stateId === other.id);
        return otherDef?.player !== undefined;
      });
      if (!anyPlayerSet && state.id === pack.factions[0]?.id) {
        controller = "player";
      }
    }

    factions[String(state.id)] = {
      stateId: state.id,
      rosterId: baseRosterId,
      roster: perFactionRoster,
      victorySetId: def?.victory ?? explicitBinding?.victory ?? fromCulture.victory ?? content.defaultVictory,
      traits,
      mechanics,
      buildings: scoped(content.buildings, baseRosterId, def?.buildings),
      tech: scoped(content.tech, baseRosterId, def?.tech),
      controller,
      aiType
    };
  }

  return { pack: content, factions, bindingWarnings };
}

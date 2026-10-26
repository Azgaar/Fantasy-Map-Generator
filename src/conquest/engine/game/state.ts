/**
 * Campaign state + creation (total-war/.plans/PLAN.md §4). Mutable state is minimal and JSON-round-trippable:
 * the map pack holds statics, the content pack holds rules; the campaign only what changes.
 */

import type { ContentPack, ResolvedContent } from "../common/content";
import { canonicalHash } from "../common/prng";
import type { ArmyUnit, FactionCapacity, MapPack } from "../common/types";
import type { CampaignConfig } from "./config";
import type { GameEvent, TreatyType } from "./events";
import { regimentToUnits } from "./units";

export type Stance = "normal" | "march" | "encamp" | "ambush" | "raid";

/** Synthetic faction id for brigand/rebel armies (hostile to everyone). */
export const BRIGAND_FACTION = 999;

type TreatyTypeT = TreatyType;

export interface Army {
  id: string;
  factionId: number;
  name: string;
  cell: number;
  stance: Stance;
  movementLeft: number;
  units: ArmyUnit[];
  fleet: boolean; // Phase 1: fleets are immobile (transports arrive later)
}

interface FactionState {
  id: number;
  treasury: number;
  alive: boolean;
  /** Researched tech ids. */
  tech: string[];
  /** Resolved victory set id (from faction/culture YAML or default). */
  victorySetId: string;
  /** 0..100 — broken promises cost reliability, AI weighs it in deal-making (§5.7). */
  reliability: number;
  /** Economy telemetry from the last tick (AI budget guard, §5.11 Phase 4). */
  lastIncome: number;
  lastExpenses: number;
  /**
   * Capacity ledger (CAPACITY-PLAN §1) — shadow until Phase 3. Recomputed every
   * economy tick; nothing in the gold path reads it yet.
   */
  capacity?: FactionCapacity;
  /**
   * **The purse** (CAPACITY-PLAN Phase 5) — gold for diplomacy and nothing
   * else: gifts, tributes, ransoms, mercenary hire. In the capacity model the
   * pools are the economy and gold survives only as a purse, so this is where a
   * realm's *spendable* wealth lives.
   *
   * It is filled by converting free **Wealth** into gold (`WithdrawTreasure`),
   * by discovering a POI, and by taking what a raider or a sacker had.
   */
  purse: number;
  /**
   * Wealth permanently converted into purse gold. It is a permanent load on the
   * realm's W pool, so a realm's gold income is bounded by the Wealth it
   * generates — the conversion spends capacity, it does not print it.
   */
  withdrawnW: number;
  /**
   * Wealth permanently committed to **research** (CAPACITY-PLAN Phase 6) — a
   * permanent load on the realm's W pool, like the purse conversion. A tech
   * that bought nothing would be free, and one that bought everything would be
   * a realm's whole economy.
   */
  techW: number;
  /**
   * Conversions made this turn. AER's escalating extraction: the n-th
   * conversion in a turn costs n W, so a realm is paid best for converting
   * one at a time and punished for bursting.
   */
  withdrawalsThisTurn: number;
  eliminatedOnTurn?: number;
}

interface RegionState {
  id: number;
  owner: number;
  order: number;
  /** Completed building ids. */
  buildings: string[];
  /** Single-slot construction queue. */
  construction: { buildingId: string; turnsLeft: number } | null;
  /**
   * A development in progress (CAPACITY-PLAN Phase 3): the settlement being
   * grown, and the turns left. It commits Wealth for as long as it runs — the
   * price of growing a town — and promotes the settlement's tier on
   * completion, never before.
   */
  development: { settlementId: number; turnsLeft: number } | null;
  /**
   * **Stability** — the province's own stock of order and workingness
   * (CAPACITY-PLAN Phase 3). A region holding a friendly unit gains it every
   * turn, and a town that grows of its own accord gains it too; a `Develop`
   * commitment *spends* it. It is the second half of "build capacity and pay to
   * use": the garrison that keeps a province orderly is what funds its growth.
   */
  stability: number;
  /** Consecutive turns below the rebellion order threshold. */
  unrestTurns: number;
  /** Multiplier on the region's static population (razing halves it, §5.5). */
  populationScale: number;
  /**
   * Turns left on a **sabotage** (CAPACITY-PLAN Phase 6): while this is
   * positive the region's generation is suppressed — AER's saboteurs hit
   * *generation*, not load, so the region's people still work and its garrison
   * still stands; what stops is the output.
   */
  suppressedTurns?: number;
  /** Last tick's tax income (post-raid, pre-faction multipliers) — for the region panel. */
  lastIncome?: number;
  /** Corruption fraction applied last tick (§5.6) — for the region panel. */
  corruption?: number;
}

interface ActiveWar {
  between: [number, number];
  sinceTurn: number;
}

interface Treaty {
  type: TreatyTypeT;
  between: [number, number];
  sinceTurn: number;
}

export interface Truce {
  between: [number, number];
  untilTurn: number;
}

interface DiplomaticOffer {
  id: number;
  from: number;
  to: number;
  treaty: TreatyTypeT;
  /** Gold included in the offer (peace bribes etc.). */
  gold?: number;
  turn: number;
}

export interface Siege {
  regionId: number;
  byArmyId: string;
  byFaction: number;
  sinceTurn: number;
  /** Escalation ticks — each weakens the garrison (§5.5). */
  progress: number;
}

export type SkillBranch = "combat" | "campaign" | "economy";

export interface Character {
  id: string;
  factionId: number;
  name: string;
  /**
   * lord | assassin | diplomat | bodyguard.
   *
   * A **bodyguard** is a retainer rather than an operative: it is stationed with
   * a lord and hardens him against assassination (CAPACITY-PLAN Phase 6).
   */
  kind: "lord" | "assassin" | "diplomat" | "bodyguard";
  cell: number;
  level: number;
  xp: number;
  skillPoints: number;
  skills: { combat: number; campaign: number; economy: number };
  traits: string[];
  /** Army commanded (lords). */
  armyId?: string;
  /** Turn the character may act again (agent action cooldown). */
  cooldownUntil?: number;
  /** 0..9 — agents die when an attempt goes badly wrong. */
  alive: boolean;
}

interface PendingDilemma {
  key: string;
  eventId: string;
  factionId: number;
  title: string;
  text: string;
  choices: { text: string }[];
  /** Region context for order effects (captured region, capital…). */
  regionId?: number;
}

export interface Campaign {
  id: string;
  mapPackId: string;
  factionId: number; // the human player
  seed: number;
  configHash: string;
  /** Hash of the content pack this campaign was created under (§6 principle 3). */
  contentHash: string;
  turn: number; // 1-based
  year: number;
  seasonIndex: number;
  /** Serialized mulberry32 state — all engine randomness flows through here. */
  rngState: number;
  factions: Record<string, FactionState>;
  regions: Record<string, RegionState>;
  armies: Record<string, Army>;
  nextArmyId: number;
  wars: ActiveWar[];
  status: "active" | "finished";
  victor?: number;
  /** Events in order (excluded from the state hash — see stateHash). */
  log: GameEvent[];
  // -- Phase 3 ---------------------------------------------------------------
  /** Symmetric relations: [a][b] = score −100..+100. */
  relations: Record<string, Record<string, number>>;
  treaties: Treaty[];
  truces: Truce[];
  offers: DiplomaticOffer[];
  nextOfferId: number;
  sieges: Siege[];
  characters: Record<string, Character>;
  nextCharacterId: number;
  /** Fired dilemma keys (once-semantics). */
  firedEventKeys: string[];
  /** Player (and AI-resolvable) dilemmas awaiting an answer. */
  pendingEvents: PendingDilemma[];
  /** poi id → discovering faction ids. */
  discoveredPois: Record<string, number[]>;
  /** Log index up to which the event trigger scanner has processed. */
  eventScanIndex: number;
  /**
   * Settlement id → development points (CAPACITY-PLAN Phase 3). A settlement's
   * **effective tier** is `min(5, base tier + development)`, so a T0 hamlet
   * developed twice is a T2 town. Development is what the capacity model earns:
   * each point adds +1 W and +1 S to the settlement's region, and organic
   * growth only reaches a settlement whose province can carry it.
   */
  settlementDevelopment: Record<string, number>;
  /** Opt-in AI decision logging (AiRationale events) for replay debugging. */
  aiRationale: boolean;
  /** Player-controlled faction IDs. Empty array = spectator mode (all AI). */
  playerFactionIds?: number[];
}

interface CreateOptions {
  mapPackId: string;
  pack: MapPack;
  factionId: number;
  seed: number;
  config: CampaignConfig;
  content: ContentPack;
  resolved: ResolvedContent;
  id?: string;
  /** Emit AiRationale events for every AI decision (debugging/tests). */
  aiRationale?: boolean;
  playerFactionIds?: number[];
}

/** Deterministic campaign bootstrap (total-war/.plans/PLAN.md §3.1 step 5 / Phase 1 item 1). */
export function createCampaign(opts: CreateOptions): Campaign {
  const { pack, config, resolved } = opts;
  const anyPlayerSet = (pack.factions ?? []).some(other => {
    const otherDef = (opts.content?.factions ?? []).find(d => d.bind.stateId === other.id);
    return otherDef?.player !== undefined;
  });

  const playerFactionIds =
    opts.playerFactionIds ??
    (anyPlayerSet
      ? pack.factions.map(f => f.id).filter(id => resolved.factions[String(id)]?.controller === "player")
      : opts.factionId > 0
        ? [opts.factionId]
        : []);

  const effectiveFactionId =
    opts.factionId === 0 ? (playerFactionIds.length > 0 ? playerFactionIds[0]! : 0) : opts.factionId;

  if (effectiveFactionId !== 0 && !pack.factions.some(f => f.id === effectiveFactionId)) {
    throw new Error(`Unknown faction ${effectiveFactionId} (map has ${pack.factions.map(f => f.id).join(", ")})`);
  }

  const factions: Record<string, FactionState> = {};
  for (const f of pack.factions) {
    const rf = resolved.factions[String(f.id)]!;
    factions[String(f.id)] = {
      id: f.id,
      // CAPACITY-PLAN Phase 5: in the capacity model the gold economy is dead,
      // so the realm's starting gold moves into the **purse** — the one place
      // gold is still spendable. Flag-off it stays in the treasury, untouched.
      treasury: config.economy.capacityMode ? 0 : Math.round(f.treasury),
      purse: config.economy.capacityMode ? Math.round(f.treasury) : 0,
      withdrawnW: 0,
      techW: 0,
      withdrawalsThisTurn: 0,
      alive: true,
      tech: [],
      victorySetId: rf.victorySetId,
      reliability: 100,
      lastIncome: 0,
      lastExpenses: 0
    };
  }
  // Synthetic brigand faction — hostile to everyone, never in victory/AI scans.
  factions[String(BRIGAND_FACTION)] = {
    id: BRIGAND_FACTION,
    treasury: 0,
    purse: 0,
    withdrawnW: 0,
    techW: 0,
    withdrawalsThisTurn: 0,
    alive: true,
    tech: [],
    victorySetId: resolved.pack.defaultVictory,
    reliability: 100,
    lastIncome: 0,
    lastExpenses: 0
  };

  const regions: Record<string, RegionState> = {};
  for (const r of pack.regions) {
    regions[String(r.id)] = {
      id: r.id,
      owner: r.factionId,
      order: config.economy.startOrder,
      buildings: [],
      construction: null,
      development: null,
      stability: 0,
      unrestTurns: 0,
      populationScale: 1
    };
  }

  // -- Founding assets (CAPACITY-PLAN §1 *Starting domains*) -------------------
  // The pack records *chain names* per region (the compiler does not know the
  // content pack); resolve each chain to its tier-1 building here, against the
  // live ruleset. Unknown chains and tiers-1 buildings that do not exist are
  // skipped rather than throwing, so a mod whose roster lacks a chain simply
  // starts without it. Deterministic: pack order, content order.
  const tier1ByChain = new Map<string, string>();
  for (const b of opts.content?.buildings ?? []) {
    if (b.tier !== 1) continue;
    if (b.kind && b.kind !== "structure") continue;
    if (tier1ByChain.has(b.chain)) continue;
    tier1ByChain.set(b.chain, b.id);
  }
  // The compiler names chains by what they *are* ("market"), not by whatever a
  // given ruleset happens to call them ("economy"). Translate here, where the
  // ruleset is known. An unrecognised concept resolves to nothing, so a mod with
  // no market chain simply starts without markets rather than crashing.
  const conceptToChain: Record<string, string> = {
    market: "economy",
    harbor: "maritime",
    temple: "order",
    shadows: "shadows",
    school: "school",
    militia: "militia",
    // "walls" and "barracks" are not recipe chains: since §4.5 they are a
    // province's *footing*, a tier resolved below against the content.
    walls: "defense",
    barracks: "military"
  };
  for (const entry of pack.startingAssets) {
    const rs = regions[String(entry.regionId)];
    if (!rs) continue;
    for (const concept of entry.chains) {
      const buildingId = tier1ByChain.get(conceptToChain[concept] ?? concept);
      if (!buildingId || rs.buildings.includes(buildingId)) continue;
      rs.buildings.push(buildingId);
    }
  }

  // Founding Military assets (CAPACITY-PLAN §4.5): a province's *wartime
  // footing* — the tier of fortification and of garrison its people oblige it
  // to keep. The pack carries the **need** in capacity points; the tier is
  // resolved here, against the live ruleset, because the tier ladder is
  // content (AER's Palisade / Stone Walls / Layered Walls are 2 / 4 / 8 M, but
  // a mod may price its own).
  //
  // A province at a higher footing has **both** better walls and a bigger
  // barracks: they are of a piece, and between them they must cover the men
  // the province can field. AER p1591 — *"assets with a level higher than 1
  // consume the lesser asset"* — means a footing of 3 places a Layered Walls
  // and *not* a Palisade under it, so the tier is placed instead of, never
  // alongside, its predecessor.
  const byChainTier = new Map<string, Map<number, string>>();
  for (const b of opts.content?.buildings ?? []) {
    const tiers = byChainTier.get(b.chain) ?? new Map<number, string>();
    if (!tiers.has(b.tier)) tiers.set(b.tier, b.id);
    byChainTier.set(b.chain, tiers);
  }
  /** The building of `chain` at `tier`, falling back to the nearest lower one. */
  const buildingAt = (chain: string, tier: number): string | undefined => {
    const tiers = byChainTier.get(chain);
    if (!tiers) return undefined;
    for (let t = tier; t >= 1; t--) {
      const id = tiers.get(t);
      if (id) return id;
    }
    return undefined;
  };
  /** Military points a chain contributes at a tier. */
  const pointsAt = (chain: string, tier: number): number => {
    // Same fallback as `buildingAt`, so a ruleset missing a tier is measured
    // by the tier it will actually place, not by one it cannot.
    const id = buildingAt(chain, tier);
    const b = id ? (opts.content?.buildings ?? []).find(x => x.id === id) : undefined;
    return b?.effects.capacity?.m ?? 0;
  };
  for (const entry of pack.startingAssets) {
    if (entry.militaryNeed === undefined) continue;
    const rs = regions[String(entry.regionId)];
    if (!rs) continue;
    // Walls and barracks stand in a major settlement; a region without one has
    // nowhere to put them.
    const hasMajor = pack.settlements.some(s => s.regionId === entry.regionId && s.kind === "major");
    if (!hasMajor) continue;
    const wallChain = conceptToChain.walls;
    const barrackChain = conceptToChain.barracks;
    let tier = 1;
    while (tier < 3 && pointsAt(wallChain, tier) + pointsAt(barrackChain, tier) < entry.militaryNeed) {
      tier++;
    }
    for (const chain of [wallChain, barrackChain]) {
      const id = buildingAt(chain, tier);
      // The tier *replaces* its predecessor (AER p1591), so never both.
      if (!id || rs.buildings.includes(id)) continue;
      rs.buildings = rs.buildings.filter(existing => {
        const other = (opts.content?.buildings ?? []).find(x => x.id === existing);
        return other?.chain !== chain;
      });
      rs.buildings.push(id);
    }
  }

  const armies: Record<string, Army> = {};
  let nextArmyId = 1;
  for (const reg of pack.armies) {
    const rf = resolved.factions[String(reg.factionId)]!;
    const units =
      reg.slots && reg.slots.length > 0
        ? reg.slots.map(u => ({ ...u }))
        : regimentToUnits(
            rf.roster,
            resolved.pack.unitTypes,
            reg.units,
            reg.strength,
            reg.fleet,
            config.military.maxUnitsPerArmy
          ).units;
    if (units.length === 0) continue;
    const id = `a${nextArmyId++}`;
    armies[id] = {
      id,
      factionId: reg.factionId,
      name: reg.name,
      cell: reg.cell,
      stance: "normal",
      movementLeft: 0, // first refresh happens on first endTurn
      units,
      fleet: reg.fleet
    };
  }

  const wars: ActiveWar[] = pack.factions
    .flatMap(f => f.wars.map(w => w.between))
    .map(([a, b]) => ({ between: [a, b] as [number, number], sinceTurn: 0 }))
    .filter((w, i, arr) => arr.findIndex(x => x.between[0] === w.between[0] && x.between[1] === w.between[1]) === i);

  // Relations matrix from the map's diplomacy layer (scores already mapped by the compiler).
  const relations: Record<string, Record<string, number>> = {};
  for (const f of pack.factions) {
    relations[String(f.id)] = {};
    for (const r of f.relations) {
      relations[String(f.id)]![String(r.factionId)] = r.score;
    }
  }

  const seedHex = opts.seed.toString(36).padStart(7, "0");
  const campaign: Campaign = {
    id: opts.id ?? `${opts.mapPackId}-${seedHex}`,
    mapPackId: opts.mapPackId,
    factionId: effectiveFactionId,
    playerFactionIds,
    seed: opts.seed,
    configHash: "", // patched by caller via finalizeConfigHash
    contentHash: opts.content.hash,
    turn: 1,
    year: config.turn.startYear,
    seasonIndex: 0,
    rngState: opts.seed | 0,
    factions,
    regions,
    armies,
    nextArmyId,
    wars,
    status: "active",
    log: [{ type: "CampaignCreated", factionId: effectiveFactionId, seed: opts.seed }],
    relations,
    treaties: [],
    truces: [],
    offers: [],
    nextOfferId: 1,
    sieges: [],
    characters: {},
    nextCharacterId: 1,
    firedEventKeys: [],
    pendingEvents: [],
    discoveredPois: {},
    settlementDevelopment: {},
    eventScanIndex: 1, // CampaignCreated already scanned
    aiRationale: opts.aiRationale ?? false
  };
  return campaign;
}

/** Check if a faction is controlled by a human player. */
export function isPlayerFaction(campaign: Campaign, factionId: number, resolved?: ResolvedContent): boolean {
  if (campaign.playerFactionIds !== undefined) {
    return campaign.playerFactionIds.includes(factionId);
  }
  if (campaign.factionId > 0 && factionId === campaign.factionId) {
    return true;
  }
  if (resolved?.factions[String(factionId)]?.controller) {
    return resolved.factions[String(factionId)]!.controller === "player";
  }
  return false;
}

/** mulberry32 step over the campaign's serialized state. */
export function rng(campaign: Campaign): number {
  const s = (campaign.rngState + 0x6d2b79f5) | 0;
  campaign.rngState = s;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Random integer [0, n). Deterministic via campaign rng. */
export function rngInt(campaign: Campaign, n: number): number {
  return Math.floor(rng(campaign) * n);
}

/** Structural hash of mutable state (identity labels and the event log excluded).
 *  Two campaigns with the same seed/config/content/commands hash identically. */
export function stateHash(campaign: Campaign): string {
  const { log, id, ...rest } = campaign;
  void log;
  void id;
  return canonicalHash(rest);
}

export const season = (c: Campaign, config: CampaignConfig): string =>
  SEASON_NAMES[c.seasonIndex % Math.max(1, config.turn.seasonsPerYear)]!;

const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"];

// Living World seasonal simulation engine. See docs/plans/living-world.md
import { currentContent } from "@/conquest/content/store";
import {
  assignStateRoster,
  type BuildingDef,
  inferRosterForCulture,
  MEN_PER_BLOCK,
  type ResolvedRoster,
  type UnitType
} from "@/conquest/engine/common/content";
import type { ArmyUnit, CapacityPoints } from "@/conquest/engine/common/types";
import { REGION_TIER_STEPS, SETTLEMENT_TIER_STEPS } from "@/conquest/engine/compiler";
import {
  type BattleModifiers,
  type BattleOutcome,
  estimateOdds,
  finalizeBattle,
  initBattleSession,
  stepBattleRound
} from "@/conquest/engine/game/battle";
import { assetCheckDifficulties, valueModifier } from "@/conquest/engine/game/saves";
import { garrisonUnits, minorGarrisonUnits } from "@/conquest/engine/game/units";
import type { Alignment } from "@/data/culture-traits";
import { aggressiveTraits, drawVice, rollAlignment, rollFigureTraits, traitsRng } from "@/data/culture-traits";
import {
  createProvinceLair,
  getLairDef,
  growLair,
  instantiateLairUnits,
  isLairStateCapable,
  LAIR_NATURE_IDS,
  pickLairForTrouble
} from "@/data/living-lairs";
import {
  formatPetitionText,
  getPetitionDef,
  type PetitionContext,
  type PetitionDef,
  type PetitionEffect,
  petitionsForAnchor
} from "@/data/living-petitions";
import {
  equippedRelic,
  formatRelicLore,
  formatRelicName,
  isExcavationMarker,
  RELIC_CATALOG,
  RELIC_LEASE_TRIBUTE,
  relicCategoriesForMarker,
  relicGoldMultiplier,
  relicSurvivalBonus,
  relicXpMultiplier,
  vaultBonuses
} from "@/data/living-relics";
import {
  BURG_TROUBLE_IDS,
  getTroubleDef,
  isTroubleStatePromotable,
  RESOURCE_TROUBLE_IDS,
  RUIN_TROUBLE_IDS,
  troubleUnitMatchMultiplier,
  UNIT_ROLE_POOLS
} from "@/data/living-troubles";
import { type Burg, Burgs } from "@/model/political/burgs-generator";
import {
  Military,
  type Regiment,
  reconcileRegimentBlocks,
  syncRegimentTotals
} from "@/model/political/military-generator";
import type { Province } from "@/model/political/provinces-generator";
import { type State, States } from "@/model/political/states-generator";
import { Names } from "@/model/society/names-generator";
import type { Marker } from "@/model/story/markers-generator";
import type { HistoricalFigure, HistoryEventType, HistRef, Realm } from "@/types/history";
import {
  type ActiveGuildMission,
  type BurgSimState,
  type CapacityLedger,
  type GrudgeReason,
  type GuildMissionKind,
  type GuildState,
  type HistoricalRelic,
  type IdleDoctrine,
  type LivingNewsItem,
  type LivingNewsKind,
  type LivingPopup,
  type LivingPopupKind,
  type LivingWorldState,
  type ProvinceLair,
  type ProvinceSimState,
  type ProvinceTrouble,
  SEASON_NAMES,
  type SeasonId,
  type StateAgenda,
  type StatePolitySim,
  type TroubleTheme,
  type TroubleUnitRole
} from "@/types/living";
import { minmax } from "@/utils";
import { createRng, type Rng } from "@/utils/rng";
import { Chronicle } from "./history-generator";

const MAX_RECENT_NEWS = 50;
const MAX_LIVING_POPUPS = 6;
const POPUP_LIFETIME_SEASONS = 3;

/** Renown required for each Guild tier, index 0 = tier 1 */
export const GUILD_RENOWN_THRESHOLDS = [0, 50, 150, 350, 700] as const;
export const GUILD_TIER_TITLES = [
  "Wayfarers' Lodge",
  "Chartered Company",
  "Grand Adventurers' Guild",
  "Sovereign Order",
  "Immortal Conclave"
] as const;
export const GUILD_MAX_HEROES = [3, 4, 6, 8, 10] as const;

const GUILD_DUES_PER_CHAPTER = 2;
const GUILD_CANDIDATES_PER_YEAR = 3;
const HERO_RETIREMENT_AGE = 55;
const WHEEL_YEAR_LEAP = 150;
const GIANT_PROVINCE_LIMIT = 3;

const ERA_EPITHETS = [
  "Ash",
  "the Guild Compact",
  "Drowned Kings",
  "Iron and Salt",
  "Quiet Stars",
  "Broken Crowns"
] as const;
const ERA_ORDINALS = [
  "First",
  "Second",
  "Third",
  "Fourth",
  "Fifth",
  "Sixth",
  "Seventh",
  "Eighth",
  "Ninth",
  "Tenth"
] as const;

export function guildTierForRenown(renown: number): number {
  let tier = 1;
  for (let i = 1; i < GUILD_RENOWN_THRESHOLDS.length; i++) {
    if (renown >= GUILD_RENOWN_THRESHOLDS[i]!) tier = i + 1;
  }
  return tier;
}

export const maxHeroesForTier = (tier: number): number => GUILD_MAX_HEROES[Math.min(4, Math.max(0, tier - 1))]!;

/** Guild hall passive: +1 to checks at tier 2, +2 from tier 4 */
export const guildCheckBonus = (tier: number): number => (tier >= 4 ? 2 : tier >= 2 ? 1 : 0);

/** Hero level from lifetime xp: 40 + 20 × level per level */
export function figureLevel(xp = 0): number {
  let level = 1;
  let remaining = xp;
  let needed = 40 + 20 * level;
  while (remaining >= needed && level < 20) {
    remaining -= needed;
    level += 1;
    needed = 40 + 20 * level;
  }
  return level;
}

export interface FigureCheck {
  roll: number;
  total: number;
  dc: number;
  success: boolean;
}

interface GuildTarget {
  kind: GuildMissionKind;
  cell: number;
  provinceId?: number;
  burgId?: number;
  markerId?: number;
  pool: "m" | "w" | "s" | "c";
  dc: number;
  rewardGold: number;
  rewardRenown: number;
  priority: number;
  level: number;
  /** excavate missions: success mints a named HistoricalRelic */
  wantsRelic?: boolean;
}

/** A petitionable crisis matched to one of its anchor's petition definitions */
interface PetitionTarget {
  def: PetitionDef;
  cell: number;
  provinceId?: number;
  burgId?: number;
  stateId?: number;
  context: PetitionContext;
}

/** Unified figure roll: 1d20 + pool skill + domain modifier + traits + guild bonus + relic bonus */
export function figureCheckRoll(
  rng: Rng,
  figure: HistoricalFigure,
  pool: "m" | "w" | "s" | "c",
  poolGen: number,
  dc: number,
  guildTierBonus = 0,
  relicBonus = 0
): FigureCheck {
  const roll = rng.d(20);
  const skill = figure.skills?.[pool] ?? 0;
  const traits = (figure.virtues?.length ?? 0) - (figure.vices?.length ?? 0);
  const total = roll + skill + valueModifier(poolGen) + traits + guildTierBonus + relicBonus;
  return { roll, total, dc, success: total >= dc };
}

/** Boolean form of the unified figure check */
export function figureCheck(
  rng: Rng,
  figure: HistoricalFigure,
  pool: "m" | "w" | "s" | "c",
  poolGen: number,
  dc: number,
  guildTierBonus = 0,
  relicBonus = 0
): boolean {
  return figureCheckRoll(rng, figure, pool, poolGen, dc, guildTierBonus, relicBonus).success;
}

export function settlementTierFromPop(populationThousands: number): number {
  let tier = 0;
  for (const step of SETTLEMENT_TIER_STEPS) {
    if (populationThousands >= step) tier++;
  }
  return tier;
}

export function regionTierFromPop(populationThousands: number): number {
  let tier = 0;
  for (const step of REGION_TIER_STEPS) {
    if (populationThousands >= step) tier++;
  }
  return tier;
}

export function emptyCapacityLedger(): CapacityLedger {
  return {
    m: { gen: 0, load: 0 },
    w: { gen: 0, load: 0 },
    s: { gen: 0, load: 0 },
    c: { gen: 0, load: 0 }
  };
}

/** how much each remembered humiliation weighs on the casus belli ledger */
const GRUDGE_WEIGHTS: Record<GrudgeReason, number> = {
  conquest: 40,
  sacked: 30,
  slain_ruler: 35,
  slain_general: 35,
  repulsed: 20
};

export interface FigureBias {
  martial: number;
  civic: number;
  pious: number;
  cruel: number;
}

const MARTIAL_TRAITS = ["brave", "daring", "decisive", "wrathful", "vengeful", "boastful", "reckless"];
const CIVIC_TRAITS = ["just", "diligent", "temperate", "thrifty", "methodical", "prudent"];
const PIOUS_TRAITS = ["reverent", "zealous", "faithful", "tolerant", "merciful"];
const CRUEL_TRAITS = ["cruel", "greedy", "merciless", "callous", "domineering", "paranoid", "selfish", "bigoted"];

/** Weight a ruler's traits and their culture's values towards war, works, faith or cruelty. */
export function figureBias(
  figure: { alignment?: Alignment; virtues?: string[]; vices?: string[] },
  values: readonly string[] = []
): FigureBias {
  const words = new Set([...(figure.virtues ?? []), ...(figure.vices ?? [])]);
  const held = new Set(values);
  const bias: FigureBias = { martial: 0.1, civic: 0.1, pious: 0.1, cruel: 0 };

  const add = (key: keyof FigureBias, list: string[], cultural: string[]) => {
    for (const word of list) if (words.has(word)) bias[key] += 0.12;
    for (const value of cultural) if (held.has(value)) bias[key] += 0.1;
  };

  add("martial", MARTIAL_TRAITS, ["conflict", "power", "subjugation", "hatred"]);
  add("civic", CIVIC_TRAITS, ["investment", "advancement", "knowledge", "balance"]);
  add("pious", PIOUS_TRAITS, ["order", "honor", "loyalty", "truth"]);
  add("cruel", CRUEL_TRAITS, ["greed", "control", "subjugation"]);

  if (figure.alignment === "evil") {
    bias.martial += 0.15;
    bias.cruel += 0.15;
  } else if (figure.alignment === "chaotic") {
    bias.martial += 0.1;
  } else if (figure.alignment === "lawful") {
    bias.civic += 0.1;
  } else if (figure.alignment === "good") {
    bias.civic += 0.05;
    bias.pious += 0.05;
  }

  for (const key of ["martial", "civic", "pious", "cruel"] as const) {
    bias[key] = Math.min(0.8, Math.round(bias[key] * 100) / 100);
  }
  return bias;
}

/** Reconcile Conquest building IDs from FMG Burg feature flags (walls, plaza, temple, citadel) */
export function syncBurgBuildingsFromFlags(burg: Burg, existing: string[]): string[] {
  const set = new Set(existing);
  const wallTier = Number(burg.walls ?? 0);
  if (wallTier >= 3) {
    set.delete("walls1");
    set.delete("walls2");
    set.add("walls3");
  } else if (wallTier === 2 || (wallTier === 1 && burg.citadel)) {
    set.delete("walls1");
    if (!set.has("walls3")) set.add("walls2");
  } else if (wallTier === 1 && !set.has("walls2") && !set.has("walls3")) {
    set.add("walls1");
  } else if (wallTier === 0) {
    set.delete("walls1");
    set.delete("walls2");
    set.delete("walls3");
  }

  if (burg.plaza && !set.has("market1") && !set.has("market2") && !set.has("market3")) {
    set.add("market1");
  }
  if (burg.temple && !set.has("temple1") && !set.has("temple2") && !set.has("temple3")) {
    set.add("temple1");
  }
  if (burg.citadel && !set.has("barracks1") && !set.has("barracks2") && !set.has("barracks3")) {
    set.add("barracks1");
  }
  return Array.from(set);
}

/** Push completed Conquest buildings back onto FMG Burg flags */
export function syncBurgFlagsFromBuildings(burg: Burg, buildings: string[]): void {
  if (buildings.includes("walls3")) {
    burg.walls = 3;
    burg.citadel = 1;
  } else if (buildings.includes("walls2")) {
    burg.walls = Math.max(Number(burg.walls ?? 0), 2);
    burg.citadel = 1;
  } else if (buildings.includes("walls1")) {
    burg.walls = Math.max(Number(burg.walls ?? 0), 1);
  }

  if (buildings.some(id => id.startsWith("market"))) burg.plaza = 1;
  if (buildings.some(id => id.startsWith("temple"))) burg.temple = 1;
  if (buildings.includes("barracks2") || buildings.includes("barracks3")) burg.citadel = 1;
}

class LivingModel {
  /** Initialize or reconcile the Living World state on `pack.history.living` */
  init(opts?: { seed?: string; snapshotIntervalYears?: number }): LivingWorldState {
    const history = Chronicle.sync();
    const seed = String(opts?.seed ?? history.living?.seed ?? options.map?.seed ?? "living-seed");

    history.living ??= {
      enabled: true,
      tick: 0,
      season: 0,
      seed,
      snapshotIntervalYears: opts?.snapshotIntervalYears ?? 10,
      promptOnPlayerBattles: false,
      states: {},
      provinces: {},
      burgs: {},
      recentNews: []
    };

    history.living.provinces ??= {};
    history.living.recentNews ??= [];

    if (opts?.seed !== undefined) history.living.seed = String(opts.seed);
    if (opts?.snapshotIntervalYears !== undefined) {
      history.living.snapshotIntervalYears = opts.snapshotIntervalYears;
    }

    this.syncWorld();
    this.ensureCommanders();
    return history.living;
  }

  /** Return the active LivingWorldState, initializing it lazily if needed */
  getState(): LivingWorldState {
    return pack.history?.living ?? this.init();
  }

  /** Return the guild wallet, initializing it lazily for maps saved before the Guild existed */
  getGuild(): GuildState {
    const living = this.getState();
    if (!living.guild) living.guild = this.emptyGuild();

    const guild = living.guild;
    guild.tier ??= 1;
    guild.gold ??= 0;
    guild.renown ??= 0;
    guild.ageCount ??= 0;
    guild.sandboxGodMode ??= false;
    guild.doctrine ??= "auto_bounties";
    guild.chapterBurgIds ??= [];
    guild.roster ??= [];
    guild.candidates ??= [];
    guild.missions ??= [];
    guild.relics ??= [];
    guild.cooldowns ??= {};
    guild.excavatedMarkers ??= [];
    guild.popups ??= [];

    if (guild.hqBurgId === undefined) guild.hqBurgId = this.pickGuildHq();
    if (guild.chapterBurgIds.length === 0 && guild.hqBurgId) guild.chapterBurgIds = [guild.hqBurgId];
    if (guild.favoredStateId === undefined) {
      guild.favoredStateId = pack.states?.find(state => state?.i && !state.removed)?.i;
    }
    return guild;
  }

  /** On-map popups currently waiting to be claimed */
  getPopups(): LivingPopup[] {
    return this.getGuild().popups;
  }

  /** Active guild hero missions */
  getMissions(): ActiveGuildMission[] {
    return this.getGuild().missions;
  }

  /** Every discovered relic, whatever its current holder */
  getRelics(): HistoricalRelic[] {
    return this.getGuild().relics ?? [];
  }

  setDoctrine(doctrine: IdleDoctrine): void {
    this.getGuild().doctrine = doctrine;
  }

  setSandboxGodMode(enabled: boolean): void {
    this.getGuild().sandboxGodMode = enabled;
  }

  setFavoredState(stateId: number): void {
    const state = pack.states?.[stateId];
    if (!state?.i || state.removed) return;
    this.getGuild().favoredStateId = stateId;
  }

  /** Gold cost to recruit the next hero */
  recruitCost(): number {
    const guild = this.getGuild();
    return 40 + guild.tier * 20;
  }

  /** Recruit a tavern candidate into the hero roster. */
  recruitCandidate(figureId: number): boolean {
    const living = this.getState();
    const guild = this.getGuild();
    if (!guild.candidates.includes(figureId)) return false;
    if (guild.roster.length >= maxHeroesForTier(guild.tier)) return false;

    const cost = this.recruitCost();
    if (guild.gold < cost) return false;

    const figure = this.findFigure(figureId);
    if (!figure || figure.death !== undefined) return false;

    guild.gold -= cost;
    guild.candidates = guild.candidates.filter(id => id !== figureId);
    guild.roster.push(figureId);
    figure.cell ??= guild.hqBurgId ? pack.burgs[guild.hqBurgId]?.cell : undefined;

    this.pushNews(living, {
      kind: "muster",
      text: `${figure.name} joined the Guild for ${cost} gold.`,
      cell: figure.cell,
      burgId: guild.hqBurgId
    });
    return true;
  }

  /** Click-dispatch: send one hero to the trouble or lair in a province. */
  dispatchHero(figureId: number, provinceId: number): boolean {
    const living = this.getState();
    const guild = this.getGuild();
    if (!guild.roster.includes(figureId) || !this.isHeroIdle(guild, figureId)) return false;

    const figure = this.findFigure(figureId);
    const target = this.provinceTarget(living, guild, provinceId);
    if (!figure || figure.death !== undefined || !target) return false;

    this.createMission(living, guild, figure, target);
    return true;
  }

  /** Send the best idle hero to a province (used by the HUD guild operations). */
  dispatchBestHero(provinceId: number): boolean {
    const living = this.getState();
    const guild = this.getGuild();
    const target = this.provinceTarget(living, guild, provinceId);
    if (!target) return false;

    const hero = guild.roster
      .filter(id => this.isHeroIdle(guild, id))
      .map(id => this.findFigure(id))
      .filter((figure): figure is HistoricalFigure => Boolean(figure) && figure!.death === undefined)
      .sort((a, b) => this.heroScore(b, target.pool) - this.heroScore(a, target.pool) || a.i - b.i)[0];
    if (!hero) return false;

    this.createMission(living, guild, hero, target);
    return true;
  }

  /** Click-dispatch: send one idle hero to excavate a landmark. */
  dispatchHeroToMarker(figureId: number, markerId: number): boolean {
    const living = this.getState();
    const guild = this.getGuild();
    if (!guild.roster.includes(figureId) || !this.isHeroIdle(guild, figureId)) return false;

    const figure = this.findFigure(figureId);
    if (!figure || figure.death !== undefined) return false;

    const marker = (pack.markers ?? []).find(entry => entry?.i === markerId);
    const target = marker ? this.excavationTarget(guild, marker) : null;
    if (!target) return false;

    this.createMission(living, guild, figure, target);
    return true;
  }

  /** Send the best idle Culture hero to excavate a landmark. */
  dispatchBestHeroToMarker(markerId: number): boolean {
    const living = this.getState();
    const guild = this.getGuild();
    const marker = (pack.markers ?? []).find(entry => entry?.i === markerId);
    const target = marker ? this.excavationTarget(guild, marker) : null;
    if (!target) return false;

    const hero = guild.roster
      .filter(id => this.isHeroIdle(guild, id))
      .map(id => this.findFigure(id))
      .filter((figure): figure is HistoricalFigure => Boolean(figure) && figure!.death === undefined)
      .sort((a, b) => this.heroScore(b, target.pool) - this.heroScore(a, target.pool) || a.i - b.i)[0];
    if (!hero) return false;

    this.createMission(living, guild, hero, target);
    return true;
  }

  /** Place a vault relic in a hero's hands (one relic per hero). */
  equipRelic(relicId: number, figureId: number): boolean {
    const guild = this.getGuild();
    if (!guild.roster.includes(figureId)) return false;
    if (this.findFigure(figureId)?.death !== undefined) return false;

    const relic = guild.relics?.find(entry => entry.id === relicId);
    if (!relic) return false;

    for (const held of guild.relics ?? []) {
      if (held.holder.kind === "figure" && held.holder.id === figureId) held.holder = { kind: "vault" };
    }
    relic.holder = { kind: "figure", id: figureId };
    return true;
  }

  /** Enshrine a relic in the Guild Vault, up to one relic per guild tier. */
  enshrineRelic(relicId: number): boolean {
    const guild = this.getGuild();
    const relic = guild.relics?.find(entry => entry.id === relicId);
    if (!relic) return false;
    if (relic.holder.kind === "vault") return true;

    const vaulted = guild.relics.filter(entry => entry.holder.kind === "vault").length;
    if (vaulted >= guild.tier) return false;

    relic.holder = { kind: "vault" };
    return true;
  }

  /** Lease a vault relic to a sovereign state: +gen, -1 unravel/season, tribute gold. */
  leaseRelic(relicId: number, stateId: number): boolean {
    const state = pack.states?.[stateId];
    if (!state?.i || state.removed) return false;

    const guild = this.getGuild();
    const relic = guild.relics?.find(entry => entry.id === relicId);
    if (relic?.holder.kind !== "vault") return false;

    relic.holder = { kind: "state", id: stateId };
    const sSim = this.getState().states[stateId];
    if (sSim) sSim.capacity = this.recomputeStateCapacity(stateId);
    return true;
  }

  /** Return a relic from any holder to the Guild Vault. */
  recallRelic(relicId: number): boolean {
    const guild = this.getGuild();
    const relic = guild.relics?.find(entry => entry.id === relicId);
    if (!relic || relic.holder.kind === "vault" || relic.holder.kind === "ruin") return false;

    const previous = relic.holder;
    relic.holder = { kind: "vault" };
    if (previous.kind === "state") {
      const sSim = this.getState().states[previous.id];
      if (sSim) sSim.capacity = this.recomputeStateCapacity(previous.id);
    }
    return true;
  }

  /** Sandbox god action: excavate a site immediately, minting its seeded relic. */
  excavateMarker(markerId: number): boolean {
    const living = this.getState();
    const guild = this.getGuild();
    const marker = (pack.markers ?? []).find(entry => entry?.i === markerId);
    if (!marker || !isExcavationMarker(marker) || guild.excavatedMarkers.includes(markerId)) return false;

    guild.excavatedMarkers.push(markerId);
    this.recoverRelicsFromMarker(guild, marker.i);

    if (marker.chronicle || this.rng("guild:excavate", marker.i).chance(0.5)) {
      const relic = this.mintRelicFromMarker(marker, marker.i * 7919 + living.tick);
      this.pushNews(living, {
        kind: "develop",
        text: `The Guild excavated ${marker.name} and recovered ${relic.name}.`,
        cell: marker.cell
      });
    }
    return true;
  }

  /** The Wheel of Ages: bake the epoch, retire fallen empires, and open the next era. */
  turnAge(): { era: string; year: number; realms: number; successorStates: number } {
    const living = this.init();
    const history = Chronicle.sync();
    const guild = this.getGuild();
    const yearBefore = options.map?.lore?.calendar?.year ?? 1000;

    // 1. bake the completed age so Legends can scrub back through it
    this.bakeEpoch(living, yearBefore);

    // 2. overextended empires fall, their capitals seeding chronicle relic ruins
    const realms = this.retireFallenEmpires(living, yearBefore);

    // 3. the calendar leaps forward and the political map is reshaped
    const year = yearBefore + WHEEL_YEAR_LEAP;
    options.map.lore.calendar.year = year;
    const eraName = this.nextEraName(guild.ageCount);
    history.eras ??= [];
    const currentEra = history.eras.at(-1);
    if (currentEra) currentEra.to = year;
    history.eras.push({ name: eraName, from: year, to: year });

    this.syncWorld();
    const shattered = this.fractureGiantEmpires(living);

    for (const state of pack.states) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states[state.i];
      if (!sSim) continue;
      sSim.unravel = 0;
      sSim.warExhaustion = 0;
      this.crownFreshRuler(state, sSim, living, year);
    }
    this.syncWorld();

    // 4. prestige carryover: heroes pass into legend, veteran bloodlines spawn scions
    guild.ageCount += 1;
    guild.legacyTier = (guild.legacyTier ?? 0) + 1;
    const nextRoster: number[] = [];
    for (const id of guild.roster) {
      const hero = this.findFigure(id);
      if (!hero || hero.death !== undefined) continue;
      hero.death = year;
      for (const role of hero.roles) {
        if (role.to === undefined) role.to = year;
      }
      for (const held of guild.relics ?? []) {
        if (held.holder.kind === "figure" && held.holder.id === id) held.holder = { kind: "vault" };
      }
      if (figureLevel(hero.xp ?? 0) < 3 || nextRoster.length >= maxHeroesForTier(guild.tier)) continue;
      nextRoster.push(this.spawnScion(living, hero, guild.legacyTier).i);
    }
    guild.roster = nextRoster;
    guild.candidates = [];

    living.eschaton = 0;

    const text = `${eraName} dawns in ${year}: ${realms.length} ${
      realms.length === 1 ? "realm" : "realms"
    } fell and ${shattered} provinces broke away as the Wheel turned.`;
    this.pushNews(living, {
      kind: "muster",
      text,
      cell: guild.hqBurgId !== undefined ? pack.burgs[guild.hqBurgId]?.cell : undefined
    });
    this.pushHistory("goldenAge", [], undefined, text);

    return { era: eraName, year, realms: realms.length, successorStates: shattered };
  }

  /** Force-bake the current borders as one epoch spanning the played age. */
  private bakeEpoch(living: LivingWorldState, year: number): void {
    const history = Chronicle.sync();
    history.snapshots ??= [];
    history.epochs ??= [];

    const owned = new Map<number, number>();
    for (const owner of pack.cells.state) owned.set(owner, (owned.get(owner) ?? 0) + 1);

    const eraFrom = pack.history?.eras?.at(-1)?.from ?? year - 100;
    const polities = pack.states
      .filter(state => state?.i && !state.removed)
      .map(state => ({
        id: state.i,
        name: state.name,
        form: state.formName ?? state.form ?? "State",
        capital: state.capital ?? 0,
        cells: owned.get(state.i) ?? 0,
        color: state.color ?? "#8a8a8a",
        founded: eraFrom
      }));

    history.snapshots.push(new Uint16Array(pack.cells.state));
    history.epochs.push({
      i: history.epochs.length,
      from: eraFrom,
      to: year,
      era: options.map?.lore?.calendar?.era ?? "Present Age",
      polities,
      snapshot: history.snapshots.length - 1
    });
    living.lastSnapshotTick = living.tick;
  }

  /** Overextended empires (unravel >= 50) are retired into `history.realms`. */
  private retireFallenEmpires(living: LivingWorldState, year: number): Realm[] {
    const realms: Realm[] = [];
    for (const state of [...pack.states]) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states[state.i];
      if (!sSim || sSim.unravel < 50) continue;
      realms.push(this.retireStateToRealm(state, sSim, living, year));
    }
    return realms;
  }

  private retireStateToRealm(state: State, sSim: StatePolitySim, living: LivingWorldState, year: number): Realm {
    const history = Chronicle.sync();
    history.realms ??= [];

    const ruler = sSim.rulerId !== undefined ? this.findFigure(sSim.rulerId) : undefined;
    const realm: Realm = {
      i: history.realms.reduce((max, realm) => Math.max(max, realm.i), -1) + 1,
      name: state.name,
      coa: state.coa,
      center: state.center,
      capital: state.capital || undefined,
      founded: year - 100 - ((state.i * 37) % 80),
      fallen: year,
      cause: "collapse",
      successors: [],
      remnantCulture: state.culture
    };
    history.realms.push(realm);

    // its lands go wild and its simulation is dismissed
    const cells: number[] = [];
    for (let cell = 0; cell < pack.cells.state.length; cell++) {
      if (pack.cells.state[cell] === state.i) cells.push(cell);
    }
    this.transferCells(0, cells);
    for (const burg of pack.burgs) {
      if (burg?.i && !burg.removed && burg.state === state.i) burg.state = 0;
    }
    state.removed = true;
    delete living.states[state.i];

    if (ruler && ruler.death === undefined) {
      ruler.death = year;
      for (const role of ruler.roles) {
        if (role.to === undefined) role.to = year;
      }
    }

    // a chronicle ruin at the fallen capital, hiding a realm-named relic (a +2-tier find)
    const capital = state.capital ? pack.burgs[state.capital] : undefined;
    const cell = capital?.cell ?? state.center ?? 0;
    const markerId = this.addRuinMarker(cell, `Ruins of ${state.name}`);
    const marker = (pack.markers ?? [])[markerId]!;
    const relic = this.mintRelicFromMarker(marker, year * 1000 + state.i);
    relic.holder = { kind: "ruin", markerId, cell };

    // relics the fallen state leased from the Guild are buried in the same ruin
    for (const held of this.getGuild().relics ?? []) {
      if (held.holder.kind === "state" && held.holder.id === state.i) {
        held.holder = { kind: "ruin", markerId, cell };
      }
    }

    this.pushHistory(
      "collapse",
      [{ kind: "state", id: state.i }],
      state.center,
      `${state.name} crumbled at the turning of the age.`
    );
    return realm;
  }

  /** Giant empires shatter along provincial lines into successor states and free burgs. */
  private fractureGiantEmpires(living: LivingWorldState): number {
    let released = 0;
    for (const state of [...pack.states]) {
      if (!state?.i || state.removed) continue;
      const provinces = this.ownedProvinces(state.i).sort((a, b) => a.i - b.i);
      if (provinces.length <= GIANT_PROVINCE_LIMIT) continue;

      const keep = new Set(provinces.slice(0, GIANT_PROVINCE_LIMIT).map(province => province.i));
      for (const province of provinces) {
        if (keep.has(province.i)) continue;
        if (this.releaseProvince(state, province, living)) released += 1;
      }
    }
    return released;
  }

  /** One province leaves a fracturing state: secession where a settlement stands, wilds otherwise. */
  private releaseProvince(state: State, province: Province, living: LivingWorldState): boolean {
    const settlementId =
      province.burg !== undefined && pack.burgs[province.burg]?.state === state.i
        ? province.burg
        : this.pickProvinceSettlement(province.i, state.i);
    const burg = settlementId !== undefined ? pack.burgs[settlementId] : undefined;
    if (burg?.i && !burg.removed && burg.state === state.i) {
      this.breakAway(state, burg, living);
      return true;
    }

    const provinceCells = pack.cells.province;
    if (!provinceCells) return false;
    const cells: number[] = [];
    for (let cell = 0; cell < provinceCells.length; cell++) {
      if (provinceCells[cell] === province.i) cells.push(cell);
    }
    this.transferCells(0, cells);
    for (const cell of cells) provinceCells[cell] = 0;
    return true;
  }

  /** The calendar leap ages every ruler away; each surviving state crowns a fresh young ruler. */
  private crownFreshRuler(state: State, sSim: StatePolitySim, living: LivingWorldState, year: number): void {
    const ruler = sSim.rulerId !== undefined ? this.findFigure(sSim.rulerId) : undefined;
    if (ruler && ruler.death === undefined) {
      ruler.death = year;
      for (const role of ruler.roles) {
        if (role.to === undefined) role.to = year;
      }
    }
    sSim.rulerId = this.spawnRuler(state, living, year);
  }

  /** A founder's scion: carries the bloodline and its legacy skill into the new era. */
  private spawnScion(living: LivingWorldState, ancestor: HistoricalFigure, legacyTier: number): HistoricalFigure {
    const history = Chronicle.sync();
    history.figures ??= [];
    const figures = history.figures;
    const index = figures.length;
    const year = options.map?.lore?.calendar?.year ?? 1000;
    const rng = createRng(`${living.seed}:guild:scion:${index + ancestor.i * 1000}`);
    const culture = ancestor.culture;
    const alignment = rollAlignment(rng, pack.cultures?.[culture]?.alignment);
    const traits = rollFigureTraits(rng, alignment);
    const signatureVirtue = ancestor.virtues?.[0];
    const virtues =
      signatureVirtue && !traits.virtues.includes(signatureVirtue)
        ? [signatureVirtue, ...traits.virtues]
        : traits.virtues;

    const skills = {
      m: ancestor.skills?.m ?? 0,
      w: ancestor.skills?.w ?? 0,
      s: ancestor.skills?.s ?? 0,
      c: ancestor.skills?.c ?? 0
    };
    const pools = ["m", "w", "s", "c"] as const;
    const best = pools.reduce((chosen, pool) => (skills[pool] > skills[chosen] ? pool : chosen), pools[0]!);
    skills[best] = Math.min(5, skills[best] + 1 + legacyTier);
    const guild = this.getGuild();

    const scion: HistoricalFigure = {
      i: index,
      name: Names.getCulture(culture),
      culture,
      birth: year - rng.int(18, 24),
      roles: [{ type: "adventurer", target: { kind: "culture", id: culture }, from: year }],
      alignment,
      virtues,
      vices: traits.vices,
      cell: guild.hqBurgId !== undefined ? pack.burgs[guild.hqBurgId]?.cell : undefined,
      xp: 0,
      skills
    };
    figures.push(scion);
    return scion;
  }

  /** Poetic name for the era that dawns after the given number of wheel turns. */
  private nextEraName(ageCount: number): string {
    const rng = createRng(`${this.getState().seed}:turnAge:${ageCount}`);
    const epithet = ERA_EPITHETS[rng.int(0, ERA_EPITHETS.length - 1)]!;
    const ordinal = ERA_ORDINALS[Math.min(ageCount, ERA_ORDINALS.length - 1)] ?? `${ageCount + 1}th`;
    return rng.chance(0.5) ? `The ${ordinal} Age of ${epithet}` : `The Era of ${epithet}`;
  }

  /** Retire a veteran hero and mint a protege carrying one skill point forward. */
  retireHero(figureId: number): number | null {
    const living = this.getState();
    const guild = this.getGuild();
    const figure = this.findFigure(figureId);
    if (!figure || figure.death !== undefined || !guild.roster.includes(figureId)) return null;

    const year = options.map?.lore?.calendar?.year ?? 1000;
    if (year - figure.birth < HERO_RETIREMENT_AGE) return null;

    guild.roster = guild.roster.filter(id => id !== figureId);
    guild.missions = guild.missions.filter(mission => mission.figureId !== figureId);
    for (const role of figure.roles) {
      if (role.to === undefined) role.to = year;
    }

    const protege = this.spawnProtege(living, figure);
    if (protege && guild.roster.length < maxHeroesForTier(guild.tier)) guild.roster.push(protege.i);

    this.pushNews(living, {
      kind: "succession",
      text: `${figure.name} retired from the Guild and passed the torch to ${protege?.name ?? "a new protege"}.`,
      cell: figure.cell
    });
    return protege?.i ?? null;
  }

  /** Deterministic PRNG for a given tick and domain tag */
  rng(tag: string, id = 0, _salt = 0): Rng {
    const living = this.getState();
    return createRng(`${living.seed}:living:${living.tick}:${tag}:${id}`);
  }

  /** Advance the world by `seasons` ticks (1 tick = 1 season, 4 ticks = 1 year) */
  tick(seasons = 1): LivingWorldState {
    const living = this.init();
    const steps = Math.max(1, Math.floor(seasons));

    for (let step = 0; step < steps; step++) {
      living.tick += 1;
      living.season = ((living.season + 1) % 4) as SeasonId;
      this.expirePopups(living);

      if (living.season === 0) {
        options.map.lore.calendar.year += 1;
        const currentEra = pack.history?.eras?.at(-1);
        if (currentEra) currentEra.to = options.map.lore.calendar.year;
        this.stepRulers(living);
        this.stepGrudges(living);
        this.captureSnapshot(living);
      }

      this.syncWorld();
      this.stepBurgUnrest(living);
      this.stepProvinces(living);
      this.stepLairs(living);
      this.stepStates(living);
      this.stepRebellions(living);
      this.recomputeAllCapacities(living);
      this.stepGuild(living);
      this.stepRelics(living);
      this.stepEschaton(living);
      this.refreshPopups(living);
    }

    return living;
  }

  /** Synchronize `living.burgs` and `living.states` with the live `pack` */
  syncWorld(): void {
    const history = Chronicle.sync();
    const living = history.living;
    if (!living) return;

    living.provinces ??= {};
    living.recentNews ??= [];
    this.syncBurgs(living);
    this.syncProvinces(living);
    this.syncStates(living);
    this.ensureCommanders();
    this.recomputeAllCapacities(living);
  }

  /** Check whether a burg shares culture OR religion with a state (Free Burg peaceful integration rule) */
  sharesKinshipOrFaith(stateId: number, burgId: number): boolean {
    const state = pack.states[stateId];
    const burg = pack.burgs[burgId];
    if (!state?.i || state.removed || !burg?.i || burg.removed) return false;

    if ((burg.culture ?? 0) > 0 && burg.culture === state.culture) return true;

    const stateReligion = this.getStateReligion(state);
    const burgReligion = pack.cells.religion?.[burg.cell] ?? 0;
    return stateReligion > 0 && burgReligion === stateReligion;
  }

  /** Dominant religion of a state (measured at its capital or center cell) */
  getStateReligion(state: State): number {
    if (!pack.cells.religion) return 0;
    const capitalCell = state.capital ? pack.burgs[state.capital]?.cell : undefined;
    const cell = capitalCell ?? state.center ?? 0;
    return pack.cells.religion[cell] ?? 0;
  }

  /** Recompute a single state's M / W / S / C capacity pools from live pack holdings, buildings, and regiments */
  recomputeStateCapacity(stateId: number): CapacityLedger {
    const ledger = emptyCapacityLedger();
    const state = pack.states[stateId];
    if (!state?.i || state.removed) return ledger;

    const living = pack.history?.living;
    const sSim = living?.states?.[stateId];
    const { content, config } = currentContent();
    const capacityConfig = config.capacity;
    const buildingById = new Map<string, BuildingDef>(content.buildings.map(b => [b.id, b]));
    const unitTypes: Record<string, UnitType> = Military.getUnitTypes();

    // 1. Group owned cells and population by province (or state fallback if no provinces)
    const provincePop = new Map<number, number>();
    const cellCount = pack.cells.i.length;

    for (let c = 0; c < cellCount; c++) {
      if (pack.cells.state[c] !== stateId) continue;
      const provId = pack.cells.province?.[c] || -stateId;
      const pop = pack.cells.pop?.[c] ?? 0;
      provincePop.set(provId, (provincePop.get(provId) ?? 0) + pop);
    }

    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      const provId = pack.cells.province?.[burg.cell] || -stateId;
      const pop = burg.population ?? 0;
      provincePop.set(provId, (provincePop.get(provId) ?? 0) + pop);
    }

    // Every held province/region grants +1 M levy base and +regionTier W & S
    provincePop.forEach(popThousands => {
      ledger.m.gen += 1;
      const rTier = regionTierFromPop(popThousands);
      ledger.w.gen += rTier;
      ledger.s.gen += rTier;
    });

    // Earned province development adds +1 W and +1 S per point; a running
    // development commits `developWPerTurn` Wealth until it completes.
    for (const provId of provincePop.keys()) {
      if (provId <= 0) continue;
      const pSim = living?.provinces?.[provId];
      if (!pSim) continue;
      if (pSim.development > 0) {
        ledger.w.gen += pSim.development;
        ledger.s.gen += pSim.development;
      }
      if (pSim.developmentProgress) ledger.w.load += capacityConfig.developWPerTurn;
      if (pSim.trouble) {
        const troubleLoad = Math.ceil(pSim.trouble.level / 2);
        ledger.m.load += troubleLoad;
        ledger.w.load += troubleLoad;
        ledger.s.load += troubleLoad;
      }
      if (pSim.lair) {
        const lairLoad = Math.ceil(pSim.lair.level / 2);
        ledger.m.load += lairLoad;
        ledger.w.load += lairLoad;
        ledger.s.load += lairLoad;
      }
    }

    // Capital court grants +2 C
    if (state.capital && pack.burgs[state.capital]?.state === stateId) {
      ledger.c.gen += 2;
    }

    // Active adventurer contract commits +1 Wealth load
    if (sSim?.agenda?.kind === "hire_adventurers") {
      ledger.w.load += 1;
    }

    // 2. Burgs: earned development, standing buildings, and occupation unrest
    let freeGarrisonWaiver = 0;
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      const bSim = living?.burgs[burg.i];
      if (!bSim) continue;

      // A running construction commits Wealth until it completes.
      if (bSim.construction) ledger.w.load += capacityConfig.constructionWPerTurn;

      // Occupation unrest drains -1 S and suppresses earned W bonus while unrest > 4
      if (bSim.unrest > 0) {
        ledger.s.load += 1;
      }
      if (bSim.development > 0) {
        if (bSim.unrest <= 4) ledger.w.gen += bSim.development;
        ledger.s.gen += bSim.development;
      }

      for (const bid of bSim.buildings) {
        const bDef = buildingById.get(bid);
        if (!bDef) continue;
        const gen = bDef.effects.capacity;
        if (gen) {
          ledger.m.gen += gen.m ?? 0;
          if (bSim.unrest <= 4) ledger.w.gen += gen.w ?? 0;
          ledger.s.gen += gen.s ?? 0;
          ledger.c.gen += gen.c ?? 0;
        }
        const up = bDef.effects.upkeep;
        if (up) {
          ledger.m.load += up.m ?? 0;
          ledger.w.load += up.w ?? 0;
          ledger.s.load += up.s ?? 0;
          ledger.c.load += up.c ?? 0;
        }
        if (bDef.effects.freeGarrisonUnits) {
          freeGarrisonWaiver += bDef.effects.freeGarrisonUnits;
        }
      }
    }

    // 3. Regiments: load capacity per unit block, waiving up to `freeGarrisonWaiver` units
    let waivedUnits = 0;
    for (const reg of state.military ?? []) {
      if (!reg.units || reg.units.length === 0) {
        reconcileRegimentBlocks(reg, unitTypes);
      }
      for (const unit of reg.units ?? []) {
        if (unit.count <= 0) continue;
        if (waivedUnits < freeGarrisonWaiver) {
          waivedUnits += 1;
          continue;
        }
        const uType = unitTypes[unit.type];
        const cost = uType?.capacityCost;
        if (!cost) continue;
        const blocks = unit.count / MEN_PER_BLOCK;
        ledger.m.load += (cost.m ?? 0) * blocks;
        ledger.w.load += (cost.w ?? 0) * blocks;
        ledger.s.load += (cost.s ?? 0) * blocks;
        ledger.c.load += (cost.c ?? 0) * blocks;
      }
    }

    // 4. Relics leased to this state add straight to generation
    for (const relic of living?.guild?.relics ?? []) {
      if (relic.holder.kind !== "state" || relic.holder.id !== stateId) continue;
      ledger.m.gen += relic.bonuses.m ?? 0;
      ledger.w.gen += relic.bonuses.w ?? 0;
      ledger.s.gen += relic.bonuses.s ?? 0;
      ledger.c.gen += relic.bonuses.c ?? 0;
    }

    // Round to 2 decimal places for clean display and deterministic comparisons
    for (const pool of ["m", "w", "s", "c"] as const) {
      ledger[pool].gen = Math.round(ledger[pool].gen * 100) / 100;
      ledger[pool].load = Math.round(ledger[pool].load * 100) / 100;
    }

    return ledger;
  }

  /** Append a headline to the seasonal news ticker */
  pushNews(
    living: LivingWorldState,
    item: { kind: LivingNewsKind; text: string; cell?: number; stateId?: number; burgId?: number }
  ): LivingNewsItem {
    const entry: LivingNewsItem = {
      tick: living.tick,
      year: options.map.lore.calendar.year,
      season: living.season,
      ...item
    };
    living.recentNews.unshift(entry);
    if (living.recentNews.length > MAX_RECENT_NEWS) {
      living.recentNews.length = MAX_RECENT_NEWS;
    }
    return entry;
  }

  /** Format current season and year label (e.g. "Spring, 1024 Era") */
  formatSeasonDate(living = this.getState()): string {
    const seasonName = SEASON_NAMES[living.season] ?? "Spring";
    const year = options.map?.lore?.calendar?.year ?? 1000;
    const eraShort = options.map?.lore?.calendar?.eraShort ?? "";
    return eraShort ? `${seasonName}, ${year} ${eraShort}` : `${seasonName}, ${year}`;
  }

  /** Claim an on-map popup before it expires, banking its bonus Gold and Renown. */
  claimPopup(id: number): LivingPopup | null {
    const living = this.getState();
    const guild = this.getGuild();
    const index = guild.popups.findIndex(popup => popup.id === id);
    if (index === -1) return null;

    const [popup] = guild.popups.splice(index, 1);
    if (!popup || popup.expiresAtTick <= living.tick) return null;
    // petitions are decided, never claimed; put it back for resolvePetition
    if (popup.kind === "guild_petition") {
      guild.popups.push(popup);
      return null;
    }

    guild.gold += popup.rewardGold;
    guild.renown += popup.rewardRenown;
    this.syncGuildTier(living, guild);
    this.pushNews(living, {
      kind: popup.kind === "bounty_trouble" ? "trouble" : popup.kind === "bounty_lair" ? "lair" : "succession",
      text: `Guild bounty claimed: ${popup.title} (+${popup.rewardGold}g, +${popup.rewardRenown} renown).`,
      cell: popup.cell,
      stateId: popup.stateId
    });
    return popup;
  }

  /** Drop popups whose countdown ran out. They auto-resolve without a reward. */
  private expirePopups(living: LivingWorldState): void {
    const guild = living.guild;
    if (!guild?.popups?.length) return;
    guild.popups = guild.popups.filter(popup => popup.expiresAtTick > living.tick);
  }

  /** Inspect the live world after a tick and queue urgent-bounty popups (deduplicated, capped). */
  private refreshPopups(living: LivingWorldState): void {
    const guild = this.getGuild();
    const candidates: Array<Omit<LivingPopup, "id" | "createdTick" | "expiresAtTick"> & { priority: number }> = [];

    for (const province of pack.provinces ?? []) {
      if (!province?.i || province.removed) continue;
      const pSim = living.provinces?.[province.i];
      if (!pSim) continue;

      const trouble = pSim.trouble;
      const lair = pSim.lair;
      const cell = trouble?.cell ?? lair?.cell ?? province.center ?? 0;
      const stateId = province.state;

      if (trouble && trouble.level >= 4) {
        candidates.push({
          kind: "bounty_trouble",
          cell,
          title: `${trouble.name} in ${province.name ?? "the province"}`,
          subtitle: `Level ${trouble.level} ${trouble.theme} trouble`,
          provinceId: province.i,
          stateId,
          rewardGold: 12 + trouble.level * 4,
          rewardRenown: 3,
          priority: trouble.level
        });
      }

      if (lair?.raidPending) {
        candidates.push({
          kind: "bounty_lair",
          cell,
          title: `${lair.name} prepares a raid`,
          subtitle: `Level ${lair.level} lair in ${province.name ?? "the province"}`,
          provinceId: province.i,
          stateId,
          rewardGold: 20 + lair.level * 5,
          rewardRenown: 8,
          priority: lair.level + 10
        });
      }

      const troubleImminent =
        Boolean(trouble) &&
        isTroubleStatePromotable(trouble!.id) &&
        trouble!.level >= 7 &&
        trouble!.seasonsUnchecked >= 3 &&
        pSim.order <= 30;
      const lairImminent =
        Boolean(lair) && isLairStateCapable(lair!.id) && lair!.level >= 8 && lair!.seasonsActive >= 7;
      if (troubleImminent || lairImminent) {
        candidates.push({
          kind: "ascension_warning",
          cell,
          title: `${lair ? lair.name : trouble!.name} is about to rise`,
          subtitle: "A new sovereign state may be born next season",
          provinceId: province.i,
          stateId,
          rewardGold: 25,
          rewardRenown: 12,
          priority: 100
        });
      }
    }

    candidates.sort((a, b) => b.priority - a.priority);
    for (const candidate of candidates) {
      if (guild.popups.length >= MAX_LIVING_POPUPS) break;
      if (this.hasPopup(guild, candidate.kind, candidate.provinceId)) continue;
      const { priority: _priority, ...popup } = candidate;
      guild.popups.push({
        ...popup,
        id: this.nextPopupId(guild),
        createdTick: living.tick,
        expiresAtTick: living.tick + POPUP_LIFETIME_SEASONS
      });
    }

    this.spawnPetitionPopup(living);
  }

  /** Queue a one-off popup (e.g. a battle unearthing a relic) without waiting for the next scan. */
  private queuePopup(partial: Omit<LivingPopup, "id" | "createdTick" | "expiresAtTick">): LivingPopup | null {
    const living = this.getState();
    const guild = this.getGuild();
    if (guild.popups.length >= MAX_LIVING_POPUPS) return null;
    if (this.hasPopup(guild, partial.kind, partial.provinceId, partial.cell)) return null;

    const entry: LivingPopup = {
      ...partial,
      id: this.nextPopupId(guild),
      createdTick: living.tick,
      expiresAtTick: living.tick + POPUP_LIFETIME_SEASONS
    };
    guild.popups.push(entry);
    return entry;
  }

  private hasPopup(guild: GuildState, kind: LivingPopupKind, provinceId?: number, cell?: number): boolean {
    return guild.popups.some(popup => {
      if (popup.kind !== kind) return false;
      if (provinceId !== undefined) return popup.provinceId === provinceId;
      return cell !== undefined && popup.cell === cell;
    });
  }

  /** Queue a guild petition from a ruler or burg every ~5 seasons, anchored to an active crisis. */
  private spawnPetitionPopup(living: LivingWorldState): void {
    const guild = this.getGuild();
    if (guild.popups.some(popup => popup.kind === "guild_petition")) return;
    if (guild.popups.length >= MAX_LIVING_POPUPS) return;

    const phase = createRng(`${living.seed}:guild:petition:phase`).int(0, 4);
    if ((living.tick + phase) % 5 !== 0) return;

    const rng = this.rng("guild:petition", living.tick);
    const target = this.findPetitionAnchor(living, rng);
    if (!target) return;

    this.queuePopup({
      kind: "guild_petition",
      cell: target.cell,
      title: formatPetitionText(target.def.title, target.context),
      subtitle: formatPetitionText(target.def.text, target.context),
      provinceId: target.provinceId,
      burgId: target.burgId,
      stateId: target.stateId,
      petitionId: target.def.id,
      rewardGold: 0,
      rewardRenown: 0
    });
  }

  /** A petitionable crisis matching an awaiting petition definition. */
  private findPetitionAnchor(living: LivingWorldState, rng: Rng): PetitionTarget | null {
    const targets: PetitionTarget[] = [];

    for (const province of pack.provinces ?? []) {
      if (!province?.i || province.removed) continue;
      const pSim = living.provinces?.[province.i];
      if (!pSim) continue;
      const stateId = province.state;
      const state = stateId ? pack.states[stateId] : undefined;
      const context = {
        province: province.name,
        state: state?.i && !state.removed ? state.name : undefined,
        burg: pSim.trouble?.burgId !== undefined ? pack.burgs[pSim.trouble.burgId]?.name : undefined,
        trouble: pSim.trouble?.name,
        lair: pSim.lair?.name
      };

      if (pSim.trouble) {
        for (const def of petitionsForAnchor("trouble")) {
          if (def.promotableOnly && !isTroubleStatePromotable(pSim.trouble.id)) continue;
          targets.push({
            def,
            cell: pSim.trouble.cell ?? province.center ?? 0,
            provinceId: province.i,
            burgId: pSim.trouble.burgId,
            stateId,
            context
          });
        }
      }
      if (pSim.lair) {
        for (const def of petitionsForAnchor("lair")) {
          targets.push({
            def,
            cell: pSim.lair.cell,
            provinceId: province.i,
            burgId: pSim.lair.burgId,
            stateId,
            context: {
              ...context,
              burg: pSim.lair.burgId !== undefined ? pack.burgs[pSim.lair.burgId]?.name : undefined
            }
          });
        }
      }
    }

    for (const burg of pack.burgs ?? []) {
      if (!burg?.i || burg.removed || !burg.state) continue;
      const bSim = living.burgs?.[burg.i];
      const state = pack.states[burg.state];
      if (!bSim || bSim.unrest < 5 || !state?.i || state.removed) continue;
      for (const def of petitionsForAnchor("unrest")) {
        targets.push({
          def,
          cell: burg.cell,
          burgId: burg.i,
          stateId: burg.state,
          context: { burg: burg.name, state: state.name }
        });
      }
    }

    for (const state of pack.states ?? []) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states?.[state.i];
      const ruler = sSim && sSim.rulerId !== undefined ? this.findFigure(sSim.rulerId) : undefined;
      if (!ruler || ruler.death !== undefined) continue;
      const capital = state.capital ? pack.burgs[state.capital] : undefined;
      for (const def of petitionsForAnchor("state")) {
        targets.push({
          def,
          cell: capital?.cell ?? state.center ?? 0,
          stateId: state.i,
          burgId: capital?.i,
          context: { state: state.name, ruler: ruler.name, burg: capital?.name }
        });
      }
    }

    const guild = this.getGuild();
    for (const relic of guild.relics ?? []) {
      if (!relic.cursed) continue;
      for (const def of petitionsForAnchor("cursedRelic")) {
        targets.push({
          def,
          cell: guild.hqBurgId ? (pack.burgs[guild.hqBurgId]?.cell ?? 0) : 0,
          context: { relic: relic.name }
        });
      }
    }

    return targets.length > 0 ? rng.choice(targets) : null;
  }

  /** Apply the player's petition choice: guild gold/renown plus world outcomes. */
  resolvePetition(popupId: number, choiceIndex: number): { summary: string; gold: number; renown: number } | null {
    const living = this.getState();
    const guild = this.getGuild();
    const index = guild.popups.findIndex(popup => popup.id === popupId && popup.kind === "guild_petition");
    if (index === -1) return null;

    const popup = guild.popups[index]!;
    const def = getPetitionDef(popup.petitionId);
    const choice = def?.choices[choiceIndex];
    if (!def || !choice || popup.expiresAtTick <= living.tick) return null;

    guild.popups.splice(index, 1);
    guild.gold = Math.max(0, guild.gold + choice.gold);
    guild.renown = Math.max(0, guild.renown + choice.renown);
    this.syncGuildTier(living, guild);

    const outcomes = this.applyPetitionEffects(living, popup, choice.effects ?? []);
    const summary =
      outcomes.length > 0 ? `${choice.label}: ${outcomes.join(", ")}.` : `${choice.label}: the Guild takes its cut.`;

    const signed = (value: number): string => `${value >= 0 ? "+" : ""}${value}`;
    this.pushNews(living, {
      kind: "develop",
      text: `Petition resolved — ${popup.title}: ${choice.label} (${signed(choice.gold)}g, ${signed(choice.renown)} renown).`,
      cell: popup.cell,
      stateId: popup.stateId,
      burgId: popup.burgId
    });
    return { summary, gold: choice.gold, renown: choice.renown };
  }

  private applyPetitionEffects(living: LivingWorldState, popup: LivingPopup, effects: PetitionEffect[]): string[] {
    const outcomes: string[] = [];
    for (const effect of effects) {
      switch (effect.kind) {
        case "quellTrouble": {
          if (popup.provinceId !== undefined && this.quellTrouble(popup.provinceId)) {
            outcomes.push("the trouble was quelled");
          }
          break;
        }
        case "promoteTrouble": {
          const newStateId =
            popup.provinceId !== undefined ? this.promoteTroubleToState(popup.provinceId, popup.burgId) : null;
          if (newStateId !== null)
            outcomes.push(`${pack.states[newStateId]?.name ?? "a new realm"} rose from the coup`);
          break;
        }
        case "purgeLair": {
          const pSim = popup.provinceId !== undefined ? living.provinces[popup.provinceId] : undefined;
          const lair = pSim?.lair;
          if (pSim && lair) {
            this.removeLairMarker(lair.markerId);
            pSim.lair = null;
            pSim.order = Math.min(100, pSim.order + 12);
            this.relieveEschaton(living);
            outcomes.push(`${lair.name} was broken up`);
          }
          break;
        }
        case "pacifyBurg": {
          if (popup.burgId !== undefined && this.pacifyBurg(popup.burgId)) outcomes.push("the burg was pacified");
          break;
        }
        case "unrest": {
          const bSim = popup.burgId !== undefined ? living.burgs[popup.burgId] : undefined;
          if (bSim) {
            bSim.unrest = minmax(bSim.unrest + effect.amount, 0, 100);
            outcomes.push(effect.amount >= 0 ? "unrest grew" : "unrest eased");
          }
          break;
        }
        case "unravel": {
          const sSim = popup.stateId !== undefined ? living.states[popup.stateId] : undefined;
          if (sSim) {
            sSim.unravel = minmax(sSim.unravel + effect.amount, 0, 100);
            outcomes.push(effect.amount >= 0 ? "the realm frayed" : "the realm stabilized");
          }
          break;
        }
        case "smiteRuler": {
          if (popup.stateId !== undefined && this.smiteRuler(popup.stateId)) outcomes.push("the ruler fell");
          break;
        }
        case "destroyRelic": {
          const relicIndex = (this.getGuild().relics ?? []).findIndex(relic => relic.cursed);
          if (relicIndex !== -1) {
            const [relic] = this.getGuild().relics.splice(relicIndex, 1);
            outcomes.push(`${relic.name} was destroyed`);
          }
          break;
        }
        case "setPatron": {
          if (popup.stateId !== undefined) {
            this.setFavoredState(popup.stateId);
            outcomes.push("the state is now the Guild's patron");
          }
          break;
        }
      }
    }
    return outcomes;
  }

  private nextPopupId(guild: GuildState): number {
    return guild.popups.reduce((max, popup) => Math.max(max, popup.id), 0) + 1;
  }

  private emptyGuild(): GuildState {
    return {
      tier: 1,
      gold: 0,
      renown: 0,
      ageCount: 0,
      sandboxGodMode: false,
      doctrine: "auto_bounties",
      chapterBurgIds: [],
      roster: [],
      candidates: [],
      missions: [],
      relics: [],
      cooldowns: {},
      excavatedMarkers: [],
      popups: []
    };
  }

  /** Guild headquarters: the largest capital, else the largest burg */
  private pickGuildHq(): number | undefined {
    const living = (pack.burgs ?? []).filter(burg => burg?.i && !burg.removed);
    const capitals = living.filter(burg => burg.capital);
    const pool = capitals.length > 0 ? capitals : living;
    return pool.sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || a.i - b.i)[0]?.i;
  }

  private findFigure(figureId: number): HistoricalFigure | undefined {
    return Chronicle.sync().figures?.find(figure => figure.i === figureId);
  }

  private heroScore(figure: HistoricalFigure, pool: "m" | "w" | "s" | "c"): number {
    return (figure.skills?.[pool] ?? 0) + (figure.virtues?.length ?? 0) - (figure.vices?.length ?? 0);
  }

  private isHeroIdle(guild: GuildState, figureId: number): boolean {
    if (guild.missions.some(mission => mission.figureId === figureId)) return false;
    return (guild.cooldowns[figureId] ?? 0) <= this.getState().tick;
  }

  private hasTargetMission(guild: GuildState, kind: GuildMissionKind, provinceId?: number, markerId?: number): boolean {
    return guild.missions.some(mission => {
      if (mission.kind !== kind) return false;
      return markerId !== undefined ? mission.markerId === markerId : mission.provinceId === provinceId;
    });
  }

  /** The best mission available in one province (trouble before lair). */
  private provinceTarget(living: LivingWorldState, guild: GuildState, provinceId: number): GuildTarget | null {
    const province = pack.provinces?.[provinceId];
    const pSim = living.provinces?.[provinceId];
    if (!province?.i || province.removed || !pSim) return null;

    const trouble = pSim.trouble;
    if (trouble && !this.hasTargetMission(guild, "trouble", provinceId)) {
      const def = getTroubleDef(trouble.id);
      return {
        kind: "trouble",
        cell: trouble.cell ?? province.center ?? 0,
        provinceId,
        burgId: trouble.burgId,
        pool: def.pool,
        dc: 14 + trouble.level,
        rewardGold: 15 + trouble.level * 5,
        rewardRenown: 5,
        priority: 2,
        level: trouble.level
      };
    }

    const lair = pSim.lair;
    if (lair && !this.hasTargetMission(guild, "lair", provinceId)) {
      return {
        kind: "lair",
        cell: lair.cell,
        provinceId,
        burgId: lair.burgId,
        pool: "m",
        dc: 14 + lair.level,
        rewardGold: 30 + lair.level * 10,
        rewardRenown: 15,
        priority: 1,
        level: lair.level
      };
    }
    return null;
  }

  /** An excavate mission against an unexcavated ruin, battlefield, dungeon, necropolis, statue or library */
  private excavationTarget(guild: GuildState, marker: Marker): GuildTarget | null {
    if (!marker || !isExcavationMarker(marker)) return null;
    if (guild.excavatedMarkers.includes(marker.i)) return null;
    if (this.hasTargetMission(guild, "excavate", undefined, marker.i)) return null;

    const rng = this.rng("guild:excavate", marker.i);
    // chronicle sites always hide a named relic; wild ruins yield a relic half the time, else a cache
    const wantsRelic = Boolean(marker.chronicle) || rng.chance(0.5);
    return {
      kind: "excavate",
      cell: marker.cell,
      markerId: marker.i,
      pool: "c",
      dc: 13 + guild.tier,
      rewardGold: wantsRelic ? 20 + rng.int(0, 20) : 40 + rng.int(0, 40),
      rewardRenown: 20,
      priority: 1,
      level: 0,
      wantsRelic
    };
  }

  /** Pick the next mission for the guild's current doctrine */
  private pickMissionTarget(living: LivingWorldState, guild: GuildState): GuildTarget | null {
    if (guild.doctrine === "manual") return null;

    const targets: GuildTarget[] = [];
    if (guild.doctrine !== "auto_excavate") {
      for (const province of pack.provinces ?? []) {
        if (!province?.i || province.removed) continue;
        if (guild.doctrine === "auto_patron" && province.state !== guild.favoredStateId) continue;
        const target = this.provinceTarget(living, guild, province.i);
        if (target) targets.push(target);
      }
    } else {
      for (const marker of pack.markers ?? []) {
        const target = this.excavationTarget(guild, marker);
        if (target) targets.push(target);
      }
    }

    for (const target of targets) {
      if (guild.doctrine === "auto_lairs") target.priority = target.kind === "lair" ? 3 : 2;
      else if (guild.doctrine === "auto_bounties") target.priority = target.kind === "trouble" ? 3 : 2;
      else target.priority = target.kind === "trouble" ? 2 : 1;
    }

    targets.sort(
      (a, b) =>
        b.priority - a.priority ||
        b.level - a.level ||
        (a.provinceId ?? a.markerId ?? 0) - (b.provinceId ?? b.markerId ?? 0)
    );
    return targets[0] ?? null;
  }

  private createMission(
    living: LivingWorldState,
    guild: GuildState,
    figure: HistoricalFigure,
    target: GuildTarget
  ): ActiveGuildMission {
    const id = guild.missions.reduce((max, mission) => Math.max(max, mission.id), 0) + 1;
    const mission: ActiveGuildMission = {
      id,
      kind: target.kind,
      figureId: figure.i,
      targetCell: target.cell,
      provinceId: target.provinceId,
      burgId: target.burgId,
      markerId: target.markerId,
      pool: target.pool,
      dc: target.dc,
      progress: 0,
      required: guild.tier >= 3 ? 1 : 2,
      rewardGold: target.rewardGold,
      rewardRenown: target.rewardRenown,
      ...(target.wantsRelic ? { rewardRelic: true } : {})
    };
    guild.missions.push(mission);
    figure.cell = target.cell;

    this.pushNews(living, {
      kind: target.kind === "lair" ? "lair" : target.kind === "trouble" ? "trouble" : "develop",
      text: `${figure.name} set out on a Guild ${target.kind} mission.`,
      cell: target.cell,
      stateId: target.provinceId !== undefined ? pack.provinces?.[target.provinceId]?.state : undefined
    });
    return mission;
  }

  private missionStillValid(living: LivingWorldState, mission: ActiveGuildMission): boolean {
    const pSim = mission.provinceId !== undefined ? living.provinces?.[mission.provinceId] : undefined;
    switch (mission.kind) {
      case "trouble":
        return Boolean(pSim?.trouble);
      case "lair":
        return Boolean(pSim?.lair);
      case "excavate":
        return (pack.markers ?? []).some(marker => marker.i === mission.markerId && !marker.hidden);
      case "pacify": {
        const burg = mission.burgId ? pack.burgs?.[mission.burgId] : undefined;
        return Boolean(burg?.i && !burg.removed);
      }
    }
  }

  /** One season of guild bookkeeping: dues, tier, cooldowns, mission travel and idle dispatch. */
  private stepGuild(living: LivingWorldState): void {
    const guild = this.getGuild();

    const hq = guild.hqBurgId !== undefined ? pack.burgs?.[guild.hqBurgId] : undefined;
    if (!hq || hq.removed) {
      guild.hqBurgId = this.pickGuildHq();
      if (guild.hqBurgId !== undefined && !guild.chapterBurgIds.includes(guild.hqBurgId)) {
        guild.chapterBurgIds.push(guild.hqBurgId);
      }
    }

    guild.gold += GUILD_DUES_PER_CHAPTER * guild.chapterBurgIds.length;
    this.syncGuildTier(living, guild);

    for (const key of Object.keys(guild.cooldowns)) {
      const figureId = Number(key);
      if ((guild.cooldowns[figureId] ?? 0) <= living.tick) delete guild.cooldowns[figureId];
    }

    guild.roster = guild.roster.filter(id => {
      const figure = this.findFigure(id);
      return Boolean(figure) && figure!.death === undefined;
    });

    for (const mission of [...guild.missions]) {
      mission.progress += 1;
      if (mission.progress >= mission.required) this.resolveMission(living, mission);
    }

    if (living.season === 0) this.refreshCandidates(living);
    this.autoDispatch(living);
  }

  /** Spring: refresh the tavern with up to three free adventurers. */
  private refreshCandidates(living: LivingWorldState): void {
    const guild = this.getGuild();
    const history = Chronicle.sync();
    history.figures ??= [];
    const figures = history.figures;

    const free = figures.filter(
      figure =>
        figure.death === undefined &&
        !guild.roster.includes(figure.i) &&
        !guild.candidates.includes(figure.i) &&
        figure.roles.some(role => role.type === "adventurer" && role.target.kind === "culture" && role.to === undefined)
    );

    guild.candidates = free.slice(0, GUILD_CANDIDATES_PER_YEAR).map(figure => figure.i);
    while (guild.candidates.length < GUILD_CANDIDATES_PER_YEAR) {
      guild.candidates.push(this.mintCandidate(living).i);
    }
  }

  /** A fresh, unaffiliated adventurer for the tavern. */
  private mintCandidate(living: LivingWorldState): HistoricalFigure {
    const history = Chronicle.sync();
    history.figures ??= [];
    const figures = history.figures;
    const index = figures.length;
    const rng = createRng(`${living.seed}:guild:candidate:${index}`);
    const cultures = (pack.cultures ?? []).filter(culture => culture?.i && !culture.removed);
    const culture = cultures.length > 0 ? cultures[rng.int(0, cultures.length - 1)]!.i : 0;
    const alignment = rollAlignment(rng, pack.cultures?.[culture]?.alignment);
    const { virtues, vices } = rollFigureTraits(rng, alignment);
    const year = options.map?.lore?.calendar?.year ?? 1000;
    const skills = { m: 0, w: 0, s: 0, c: 0 };
    const pools = ["m", "w", "s", "c"] as const;
    skills[pools[rng.int(0, pools.length - 1)]!] = rng.int(1, 3);
    const guild = this.getGuild();

    const figure: HistoricalFigure = {
      i: index,
      name: Names.getCulture(culture),
      culture,
      birth: year - rng.int(20, 38),
      roles: [{ type: "adventurer", target: { kind: "culture", id: culture }, from: year }],
      alignment,
      virtues,
      vices,
      cell: guild.hqBurgId !== undefined ? pack.burgs[guild.hqBurgId]?.cell : undefined,
      xp: 0,
      skills
    };
    figures.push(figure);
    return figure;
  }

  /** A retired veteran's protege: one point in the veteran's best pool carried forward. */
  private spawnProtege(living: LivingWorldState, veteran: HistoricalFigure): HistoricalFigure | undefined {
    const history = Chronicle.sync();
    history.figures ??= [];
    const figures = history.figures;
    const index = figures.length;
    const rng = createRng(`${living.seed}:guild:protege:${index + veteran.i * 1000}`);
    const culture = veteran.culture;
    const alignment = rollAlignment(rng, pack.cultures?.[culture]?.alignment);
    const { virtues, vices } = rollFigureTraits(rng, alignment);
    const year = options.map?.lore?.calendar?.year ?? 1000;

    const skills = {
      m: veteran.skills?.m ?? 0,
      w: veteran.skills?.w ?? 0,
      s: veteran.skills?.s ?? 0,
      c: veteran.skills?.c ?? 0
    };
    const pools = ["m", "w", "s", "c"] as const;
    const best = pools.reduce((chosen, pool) => (skills[pool] > skills[chosen] ? pool : chosen), pools[0]!);
    skills[best] = Math.min(5, skills[best] + 1);

    const protege: HistoricalFigure = {
      i: index,
      name: Names.getCulture(culture),
      culture,
      birth: year - rng.int(18, 24),
      roles: [{ type: "adventurer", target: { kind: "culture", id: culture }, from: year }],
      alignment,
      virtues,
      vices,
      cell: veteran.cell,
      xp: 0,
      skills
    };
    figures.push(protege);
    return protege;
  }

  private syncGuildTier(living: LivingWorldState, guild: GuildState): void {
    const tier = guildTierForRenown(guild.renown);
    if (tier <= guild.tier) return;

    guild.tier = tier;
    this.pushNews(living, {
      kind: "muster",
      text: `The Guild Hall was raised to tier ${tier}: ${GUILD_TIER_TITLES[tier - 1]}.`
    });
  }

  private autoDispatch(living: LivingWorldState): void {
    const guild = this.getGuild();
    if (guild.doctrine === "manual") return;

    const idle = guild.roster
      .filter(id => this.isHeroIdle(guild, id))
      .map(id => this.findFigure(id))
      .filter((figure): figure is HistoricalFigure => Boolean(figure) && figure!.death === undefined)
      .sort((a, b) => a.i - b.i);

    for (const figure of idle) {
      const target = this.pickMissionTarget(living, guild);
      if (!target) return;
      this.createMission(living, guild, figure, target);
    }
  }

  /** Seasonal bookkeeping for leased relics: tribute gold and unravel relief. */
  private stepRelics(living: LivingWorldState): void {
    const guild = living.guild;
    if (!guild?.relics?.length) return;

    for (const relic of guild.relics) {
      if (relic.holder.kind !== "state") continue;
      guild.gold += RELIC_LEASE_TRIBUTE;
      const sSim = living.states[relic.holder.id];
      if (sSim) sSim.unravel = Math.max(0, sSim.unravel - 1);
    }
  }

  /** The current eschaton reading, lazily initialized for old saves */
  getEschaton(): number {
    return this.getState().eschaton ?? 0;
  }

  /** Each season, every level 8+ lair pushes the world one step closer to the finale. */
  private stepEschaton(living: LivingWorldState): void {
    let doom = 0;
    for (const pSim of Object.values(living.provinces)) {
      if (pSim.lair && pSim.lair.level >= 8) doom += 1;
    }
    if (doom > 0) this.exaltEschaton(living, doom);
  }

  private exaltEschaton(living: LivingWorldState, amount: number): void {
    living.eschaton = minmax((living.eschaton ?? 0) + amount, 0, 100);
  }

  /** Purging lairs buys the world time. */
  private relieveEschaton(living: LivingWorldState, amount = 5): void {
    living.eschaton = Math.max(0, (living.eschaton ?? 0) - amount);
  }

  private resolveMission(living: LivingWorldState, mission: ActiveGuildMission): void {
    const guild = this.getGuild();
    const index = guild.missions.findIndex(entry => entry.id === mission.id);
    if (index === -1) return;
    guild.missions.splice(index, 1);

    const figure = this.findFigure(mission.figureId);
    const province = mission.provinceId !== undefined ? pack.provinces?.[mission.provinceId] : undefined;
    if (!figure || figure.death !== undefined || !this.missionStillValid(living, mission)) {
      if (figure && figure.death === undefined) {
        this.pushNews(living, {
          kind: mission.kind === "lair" ? "lair" : mission.kind === "trouble" ? "trouble" : "develop",
          text: `${figure.name}'s Guild contract ended with nothing left to resolve.`,
          cell: mission.targetCell,
          stateId: province?.state
        });
      }
      return;
    }

    const pSim = mission.provinceId !== undefined ? living.provinces?.[mission.provinceId] : undefined;
    const sSim = province?.state ? living.states[province.state] : undefined;
    const poolGen = sSim?.capacity[mission.pool]?.gen ?? 0;
    const rng = this.rng("guild:mission", mission.id * 1000 + mission.figureId);
    const carried = equippedRelic(guild.relics ?? [], figure.i);
    const check = figureCheckRoll(
      rng,
      figure,
      mission.pool,
      poolGen,
      mission.dc,
      guildCheckBonus(guild.tier),
      carried?.bonuses[mission.pool] ?? 0
    );

    if (check.success) {
      this.completeMission(living, guild, mission, figure, rng, province, pSim, sSim);
    } else {
      this.failMission(living, guild, mission, figure, rng, check, province, sSim);
    }
  }

  private completeMission(
    living: LivingWorldState,
    guild: GuildState,
    mission: ActiveGuildMission,
    figure: HistoricalFigure,
    _rng: Rng,
    province: Province | undefined,
    pSim: ProvinceSimState | undefined,
    sSim: StatePolitySim | undefined
  ): void {
    // reward multipliers are frozen before resolution so a freshly minted relic does not boost itself
    const carried = equippedRelic(guild.relics ?? [], figure.i);
    const vault = vaultBonuses(guild.relics ?? []);
    let text = "";
    switch (mission.kind) {
      case "trouble": {
        const trouble = pSim?.trouble;
        if (!pSim || !trouble) return;
        const def = getTroubleDef(trouble.id);
        trouble.level -= 2;
        if (trouble.level <= 0) {
          pSim.trouble = null;
          pSim.order = Math.min(100, pSim.order + 10);
          pSim.stability += 1;
          text = `${figure.name} quelled ${def.name} in ${province?.name ?? "the province"}.`;
        } else {
          text = `${figure.name} broke ${def.name} in ${province?.name ?? "the province"} (reduced to level ${trouble.level}).`;
        }
        break;
      }
      case "lair": {
        const lair = pSim?.lair;
        if (!pSim || !lair) return;
        this.removeLairMarker(lair.markerId);
        pSim.lair = null;
        pSim.order = Math.min(100, pSim.order + 12);
        pSim.stability += 1;
        this.relieveEschaton(living);
        text = `${figure.name} purged ${lair.name} in ${province?.name ?? "the province"}.`;
        break;
      }
      case "excavate": {
        const marker =
          mission.markerId !== undefined
            ? (pack.markers ?? []).find(entry => entry?.i === mission.markerId)
            : undefined;
        if (mission.markerId !== undefined && !guild.excavatedMarkers.includes(mission.markerId)) {
          guild.excavatedMarkers.push(mission.markerId);
        }
        // relics buried here by a fallen capital are recovered alongside any new find
        this.recoverRelicsFromMarker(guild, mission.markerId);
        if (mission.rewardRelic && marker) {
          const relic = this.mintRelicFromMarker(marker, mission.id);
          text = `${figure.name} excavated ${marker.name} and recovered ${relic.name}.`;
        } else {
          text = `${figure.name} excavated ${marker?.name ?? "a ruin site"} and recovered ${mission.rewardGold} gold in relics.`;
        }
        break;
      }
      case "pacify": {
        const burg = mission.burgId !== undefined ? pack.burgs[mission.burgId] : undefined;
        const bSim = mission.burgId !== undefined ? living.burgs[mission.burgId] : undefined;
        if (bSim) bSim.unrest = 0;
        text = `${figure.name} pacified ${burg?.name ?? "the burg"}.`;
        break;
      }
    }

    // vault relics grant +10% gold per W point, +10% renown per S point; tomes boost hero xp
    const paidGold = Math.round(mission.rewardGold * (1 + 0.1 * (vault.w ?? 0)) * relicGoldMultiplier(carried));
    const paidRenown = Math.round(mission.rewardRenown * (1 + 0.1 * (vault.s ?? 0)));
    const xp = Math.round(
      (mission.kind === "lair" ? 50 : mission.kind === "excavate" ? 30 : 25) *
        (1 + 0.1 * (vault.c ?? 0)) *
        relicXpMultiplier(carried)
    );

    guild.gold += paidGold;
    guild.renown += paidRenown;
    figure.xp = (figure.xp ?? 0) + xp;
    figure.cell = mission.targetCell;
    if (sSim && province?.state) sSim.capacity = this.recomputeStateCapacity(province.state);
    this.syncGuildTier(living, guild);

    this.pushNews(living, {
      kind: mission.kind === "lair" ? "lair" : mission.kind === "trouble" ? "trouble" : "develop",
      text: `${text} (+${paidGold}g, +${paidRenown} renown)`,
      cell: mission.targetCell,
      stateId: province?.state
    });
    this.pushHistory(
      "deed",
      [
        { kind: "figure", id: figure.i },
        ...(province?.state ? [{ kind: "state", id: province.state } as HistRef] : [])
      ],
      mission.targetCell,
      text
    );
  }

  private failMission(
    living: LivingWorldState,
    guild: GuildState,
    mission: ActiveGuildMission,
    figure: HistoricalFigure,
    rng: Rng,
    check: FigureCheck,
    province: Province | undefined,
    sSim: StatePolitySim | undefined
  ): void {
    guild.cooldowns[figure.i] = living.tick + rng.int(1, 2);
    let aftermath = "";

    if (check.roll === 1 || check.total <= check.dc - 8) {
      aftermath = this.fumbleAftermath(living, guild, figure, rng, equippedRelic(guild.relics ?? [], figure.i));
    }

    if (sSim && province?.state) sSim.capacity = this.recomputeStateCapacity(province.state);
    this.pushNews(living, {
      kind: mission.kind === "lair" ? "lair" : mission.kind === "trouble" ? "trouble" : "develop",
      text: `${figure.name}'s Guild mission failed (rolled ${check.total} vs DC ${check.dc}).${aftermath}`,
      cell: mission.targetCell,
      stateId: province?.state
    });
  }

  /** Fumble aftermath: a DC 12 survival save (aided by weapons) decides between death and a lasting scar. */
  private fumbleAftermath(
    living: LivingWorldState,
    guild: GuildState,
    figure: HistoricalFigure,
    rng: Rng,
    relic: HistoricalRelic | undefined
  ): string {
    const year = options.map?.lore?.calendar?.year ?? 1000;
    if (rng.d(20) + relicSurvivalBonus(relic) < 12) {
      figure.death = year;
      for (const role of figure.roles) {
        if (role.to === undefined) role.to = year;
      }
      guild.roster = guild.roster.filter(id => id !== figure.i);
      for (const held of guild.relics ?? []) {
        if (held.holder.kind === "figure" && held.holder.id === figure.i) held.holder = { kind: "vault" };
      }
      let aftermath = ` ${figure.name} did not survive the mission.`;

      if (guild.tier >= 2) {
        const protege = this.spawnProtege(living, figure);
        if (protege && guild.roster.length < maxHeroesForTier(guild.tier)) {
          guild.roster.push(protege.i);
          aftermath += ` ${protege.name} took up the Guild's colours.`;
        }
      }
      return aftermath;
    }

    const vice = drawVice(rng, figure);
    if (vice) {
      figure.vices ??= [];
      figure.vices.push(vice);
      return ` The ordeal left ${figure.name} ${vice}.`;
    }
    if (relic?.cursed) {
      const curseVice = drawVice(rng, figure);
      if (curseVice) {
        figure.vices ??= [];
        figure.vices.push(curseVice);
        return ` The cursed ${relic.name} whispered to ${figure.name}, leaving them ${curseVice}.`;
      }
    }
    return ` ${figure.name} barely survived the ordeal.`;
  }

  private syncBurgs(living: LivingWorldState): void {
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed) {
        if (burg?.i && living.burgs[burg.i]) delete living.burgs[burg.i];
        continue;
      }

      const baseTier = settlementTierFromPop(burg.population ?? 0);
      const existing = living.burgs[burg.i];
      if (!existing) {
        living.burgs[burg.i] = {
          burgId: burg.i,
          baseTier,
          development: 0,
          developmentProgress: 0,
          buildings: syncBurgBuildingsFromFlags(burg, []),
          construction: null,
          unrest: 0,
          originalOwner: burg.state ?? 0,
          originalCulture: burg.culture,
          originalReligion: pack.cells.religion?.[burg.cell] ?? 0
        };
      } else {
        existing.baseTier = baseTier;
        existing.buildings = syncBurgBuildingsFromFlags(burg, existing.buildings);
        syncBurgFlagsFromBuildings(burg, existing.buildings);
      }
    }
  }

  private syncStates(living: LivingWorldState): void {
    const { content } = currentContent();
    const availableRosters = new Set(Object.keys(content.rosters));

    for (const state of pack.states) {
      if (!state?.i || state.removed) {
        if (state?.i && living.states[state.i]) delete living.states[state.i];
        continue;
      }

      if (!state.rosterId || !availableRosters.has(state.rosterId)) {
        state.rosterId = assignStateRoster(state, pack.cultures);
      }

      const rulerId = this.ensureStateRuler(state, living);
      const existing = living.states[state.i];
      if (!existing) {
        living.states[state.i] = {
          stateId: state.i,
          rulerId,
          agenda: null,
          unravel: 0,
          warExhaustion: 0,
          capacity: emptyCapacityLedger(),
          claims: [],
          grudges: []
        };
      } else {
        existing.rulerId = rulerId;
      }
    }
  }

  private syncProvinces(living: LivingWorldState): void {
    const startOrder = currentContent().config.economy.startOrder;

    for (const province of pack.provinces ?? []) {
      if (!province?.i || province.removed || !province.state || pack.states[province.state]?.removed) {
        if (province?.i && living.provinces[province.i]) delete living.provinces[province.i];
        continue;
      }

      if (!living.provinces[province.i]) {
        living.provinces[province.i] = {
          provinceId: province.i,
          order: startOrder,
          stability: 0,
          development: 0,
          developmentProgress: null,
          trouble: null
        };
      } else {
        living.provinces[province.i].trouble ??= null;
      }
    }
  }

  private ensureStateRuler(state: State, living: LivingWorldState): number {
    const history = Chronicle.sync();
    history.figures ??= [];

    const active = history.figures.find(
      fig =>
        fig.death === undefined &&
        fig.roles.some(
          role =>
            role.type === "ruler" && role.to === undefined && role.target.kind === "state" && role.target.id === state.i
        )
    );
    if (active) return active.i;
    return this.spawnRuler(state, living);
  }

  /** A new ruler for the state; called at init and after a death. */
  private spawnRuler(state: State, living: LivingWorldState, accession?: number): number {
    const history = Chronicle.sync();
    history.figures ??= [];

    const year = options.map?.lore?.calendar?.year ?? 1000;
    const figIndex = history.figures.length;
    const rng = traitsRng(living.seed, "figure", figIndex + state.i * 1000);
    const age = rng.int(20, 50);
    const from = accession ?? year - Math.min(age - 16, rng.int(1, 12));

    const cultureId = state.culture ?? 0;
    const alignment = rollAlignment(rng, pack.cultures[cultureId]?.alignment);
    const { virtues, vices } = rollFigureTraits(rng, alignment);

    const figure: HistoricalFigure = {
      i: figIndex,
      name: Names.getCulture(cultureId),
      culture: cultureId,
      birth: year - age,
      roles: [{ type: "ruler", target: { kind: "state", id: state.i }, from }],
      alignment,
      virtues,
      vices
    };
    history.figures.push(figure);
    return figure.i;
  }

  /** Once a year: rulers age, die and are succeeded; a weak court turns a funeral into a crisis. */
  private stepRulers(living: LivingWorldState): void {
    const history = Chronicle.sync();
    const year = options.map?.lore?.calendar?.year ?? 1000;

    for (const state of pack.states) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states[state.i];
      if (!sSim) continue;

      const ruler = history.figures?.find(figure => figure.i === sSim.rulerId);
      if (!ruler || ruler.death !== undefined) {
        sSim.rulerId = this.ensureStateRuler(state, living);
        continue;
      }

      const age = year - ruler.birth;
      const lifespan = createRng(`${living.seed}:living:lifespan:${ruler.i}`).int(55, 95);
      if (age < lifespan) continue;
      this.succeedRuler(state, sSim, ruler, living, year);
    }
  }

  private succeedRuler(
    state: State,
    sSim: StatePolitySim,
    ruler: HistoricalFigure,
    living: LivingWorldState,
    year: number
  ): void {
    const history = Chronicle.sync();
    ruler.death = year;
    for (const role of ruler.roles) {
      if (
        role.type === "ruler" &&
        role.to === undefined &&
        role.target.kind === "state" &&
        role.target.id === state.i
      ) {
        role.to = year;
      }
    }

    const successorId = this.spawnRuler(state, living, year);
    const successor = history.figures?.find(figure => figure.i === successorId);
    sSim.rulerId = successorId;

    const crisis = this.successionCrisis(sSim, successor);
    let text = `${ruler.name} of ${state.name} died; ${successor?.name ?? "a successor"} took the crown.`;
    if (crisis) {
      sSim.unravel = minmax(sSim.unravel + 10, 0, 100);
      for (const province of this.ownedProvinces(state.i)) {
        const pSim = living.provinces[province.i];
        if (pSim) pSim.order = Math.max(0, pSim.order - 10);
      }
      text += " A succession crisis follows.";
    }

    this.pushNews(living, { kind: "succession", text, cell: state.center, stateId: state.i });
    this.pushHistory(
      "succession",
      [
        { kind: "figure", id: ruler.i },
        ...(successor ? [{ kind: "figure", id: successor.i } as HistRef] : []),
        { kind: "state", id: state.i }
      ],
      state.center,
      text
    );
  }

  private successionCrisis(sSim: StatePolitySim, successor: HistoricalFigure | undefined): boolean {
    if (sSim.capacity.s.load > sSim.capacity.s.gen) return true;
    const vices = new Set(successor?.vices ?? []);
    return ["cruel", "greedy", "slothful", "cowardly", "vengeful", "wrathful", "paranoid"].some(vice =>
      vices.has(vice)
    );
  }

  /** Once a year: old grudges fade and the war weariness of the court eases. */
  private stepGrudges(living: LivingWorldState): void {
    for (const sSim of Object.values(living.states)) {
      for (const grudge of sSim.grudges) grudge.weight -= 1;
      sSim.grudges = sSim.grudges.filter(grudge => grudge.weight > 0);
      sSim.warExhaustion = minmax(sSim.warExhaustion - 5, 0, 100);
    }
  }

  /** Every `snapshotIntervalYears`, keep the borders as an epoch for the Legends time slider. */
  private captureSnapshot(living: LivingWorldState): void {
    const interval = Math.max(1, Math.floor(living.snapshotIntervalYears || 10));
    if (living.tick - (living.lastSnapshotTick ?? 0) < interval * 4) return;

    const history = Chronicle.sync();
    history.snapshots ??= [];
    history.epochs ??= [];
    const year = options.map?.lore?.calendar?.year ?? 1000;

    const owned = new Map<number, number>();
    for (const owner of pack.cells.state) owned.set(owner, (owned.get(owner) ?? 0) + 1);

    const polities = pack.states
      .filter(state => state?.i && !state.removed)
      .map(state => ({
        id: state.i,
        name: state.name,
        form: state.formName ?? state.form ?? "State",
        capital: state.capital ?? 0,
        cells: owned.get(state.i) ?? 0,
        color: state.color ?? "#8a8a8a",
        founded: year - interval
      }));

    history.snapshots.push(new Uint16Array(pack.cells.state));
    history.epochs.push({
      i: history.epochs.length,
      from: year - interval,
      to: year,
      era: options.map?.lore?.calendar?.era ?? "Present Age",
      polities,
      snapshot: history.snapshots.length - 1
    });
    living.lastSnapshotTick = living.tick;
  }

  private recomputeAllCapacities(living: LivingWorldState): void {
    for (const key of Object.keys(living.states)) {
      const stateId = Number(key);
      const sSim = living.states[stateId];
      if (sSim) {
        sSim.capacity = this.recomputeStateCapacity(stateId);
      }
    }
  }

  /** Step post-conquest occupation unrest on burgs and apply unravel pressure to owning states */
  private stepBurgUnrest(living: LivingWorldState): void {
    const restiveCountByState = new Map<number, number>();

    for (const key of Object.keys(living.burgs)) {
      const bSim = living.burgs[Number(key)];
      if (!bSim) continue;

      const burg = pack.burgs[bSim.burgId];
      if (!burg || burg.removed || !burg.state) {
        bSim.unrest = 0;
        continue;
      }

      const ownerState = pack.states[burg.state];
      if (!ownerState || ownerState.removed) {
        bSim.unrest = 0;
        continue;
      }

      const provId = pack.cells.province?.[burg.cell] ?? 0;
      const pSim = provId ? living.provinces?.[provId] : null;
      const trouble = pSim?.trouble;
      const lair = pSim?.lair;

      if (bSim.unrest <= 0 && !trouble && !lair) continue;

      if (trouble) {
        bSim.unrest = Math.max(trouble.level, bSim.unrest);
      }
      if (lair) {
        bSim.unrest = Math.max(lair.level, bSim.unrest);
      }

      restiveCountByState.set(burg.state, (restiveCountByState.get(burg.state) ?? 0) + 1);

      const agenda = living.states[ownerState.i]?.agenda;
      const pacifying = agenda?.kind === "pacify" && agenda.targetBurgId === burg.i;

      let decay = 1;
      const isGarrisoned = (ownerState.military ?? []).some(reg => reg.cell === burg.cell && reg.a > 0);
      if (isGarrisoned) decay += 1;
      if (bSim.buildings.some(id => id.startsWith("temple"))) decay += 1;
      if (pacifying) decay += 2;

      const floor = Math.max(trouble ? trouble.level : 0, lair ? lair.level : 0);
      bSim.unrest = Math.max(floor, bSim.unrest - decay);
      if (pacifying && bSim.unrest === 0) this.assimilateBurg(ownerState, burg, bSim);
    }

    // Apply seasonal unravel clock changes from unrest & stability balance
    for (const key of Object.keys(living.states)) {
      const sSim = living.states[Number(key)];
      if (!sSim) continue;

      const restiveCount = restiveCountByState.get(sSim.stateId) ?? 0;
      const sDeficit = sSim.capacity.s.load > sSim.capacity.s.gen;

      let delta = 0;
      if (restiveCount > 0) delta += restiveCount * 4;
      if (sDeficit) delta += 4;
      if (sSim.warExhaustion >= 50) delta += 2;
      if (restiveCount === 0 && !sDeficit && sSim.unravel > 0) delta -= 2;

      sSim.unravel = minmax(sSim.unravel + delta, 0, 100);
      sSim.warExhaustion = minmax(sSim.warExhaustion - 1, 0, 100);
    }
  }

  /** A pacified burg may adopt its conqueror's faith and, over time, its culture. */
  private assimilateBurg(state: State, burg: Burg, bSim: BurgSimState): void {
    const rng = this.rng("pacify:assimilate", burg.i);
    const religion = pack.cells.religion?.[state.center] ?? 0;
    if (religion && pack.cells.religion?.[burg.cell] !== religion && rng.chance(0.5)) {
      pack.cells.religion[burg.cell] = religion;
      bSim.originalReligion = religion;
    }
    if (burg.culture !== state.culture && rng.chance(0.25)) {
      burg.culture = state.culture;
      for (const cell of this.burgHinterland(burg)) pack.cells.culture[cell] = state.culture;
      bSim.originalCulture = state.culture;
    }
  }

  /** Start a development project in an owned province. */
  startDevelop(stateId: number, provinceId: number): boolean {
    const living = this.getState();
    const state = pack.states[stateId];
    const province = pack.provinces?.[provinceId];
    if (!state?.i || state.removed || !province?.i || province.removed || province.state !== stateId) return false;

    const sSim = living.states[stateId];
    const pSim = living.provinces?.[provinceId];
    if (!sSim || !pSim || pSim.developmentProgress) return false;

    const capacityConfig = currentContent().config.capacity;
    if (pSim.stability < capacityConfig.developStabilityCost) return false;
    if (pSim.development >= this.provinceDevelopmentCap(provinceId)) return false;

    const settlementId = this.pickProvinceSettlement(provinceId, stateId);
    if (!settlementId) return false;
    if (this.freeCapacity(sSim).w < capacityConfig.developWPerTurn) return false;

    pSim.stability -= capacityConfig.developStabilityCost;
    pSim.developmentProgress = { settlementId, turnsLeft: capacityConfig.developTurns };
    const settlement = pack.burgs[settlementId];
    sSim.agenda = {
      kind: "develop",
      label: `Developing ${settlement?.name ?? province.name ?? "a settlement"}`,
      targetProvinceId: provinceId,
      targetBurgId: settlementId,
      progress: 0,
      required: capacityConfig.developTurns
    };
    return true;
  }

  /** Begin constructing an asset in one of the state's burgs. */
  startBuild(stateId: number, burgId: number, buildingId: string): boolean {
    const living = this.getState();
    const state = pack.states[stateId];
    const burg = pack.burgs[burgId];
    if (!state?.i || state.removed || !burg?.i || burg.removed || burg.state !== stateId) return false;

    const sSim = living.states[stateId];
    const bSim = living.burgs[burgId];
    if (!sSim || !bSim || bSim.construction) return false;

    const { content } = currentContent();
    const building = content.buildings.find(b => b.id === buildingId);
    if (!building || !this.canBuild(state, burg, bSim, building)) return false;

    bSim.construction = {
      buildingId,
      turnsLeft: building.turns ?? 1,
      checks: { m: false, w: false, s: false },
      pityBonus: 0
    };
    sSim.agenda = {
      kind: "build",
      label: `Building ${building.name}`,
      targetBurgId: burgId,
      targetProvinceId: pack.cells.province?.[burg.cell] || undefined,
      buildingId,
      progress: 0,
      required: 3
    };
    return true;
  }

  /** Muster one roster unit into a state's field regiment. */
  muster(stateId: number): boolean {
    const state = pack.states[stateId];
    if (!state?.i || state.removed) return false;

    const choice = this.pickMusterUnit(state);
    if (!choice) return false;

    const regiment = choice.regiment ?? this.createRegiment(state);
    regiment.units ??= [];
    regiment.units.push({ type: choice.unit.id, count: choice.unit.men, exp: 0 });
    syncRegimentTotals(regiment, Military.getUnitTypes());
    if (choice.unit.troubleRole) this.commanderFor(state, regiment, choice.unit.troubleRole);

    const living = this.getState();
    const burg = pack.burgs[pack.cells.burg?.[regiment.cell] ?? 0];
    this.pushNews(living, {
      kind: "muster",
      text: `${state.name} mustered ${choice.unit.name} in ${burg?.name ?? "the field"}.`,
      cell: regiment.cell,
      stateId,
      burgId: burg?.i
    });
    return true;
  }

  /**
   * unified-figures slice 1: every specialist unit in the field serves under a
   * named commander figure. Backfills on init and each sync, and is what a
   * fresh muster calls; idempotent through `regiment.crew`.
   */
  ensureCommanders(): void {
    const unitTypes = Military.getUnitTypes();
    for (const state of pack.states) {
      if (!state?.i || state.removed || !state.military) continue;
      for (const regiment of state.military) {
        for (const unit of regiment.units ?? []) {
          const specialty = unitTypes[unit.type]?.troubleRole;
          if (!specialty) continue;
          this.commanderFor(state, regiment, specialty);
        }
      }
    }
  }

  /** The living commander figure for a regiment's specialty, minting one on first need. */
  private commanderFor(state: State, regiment: Regiment, specialty: TroubleUnitRole): number | undefined {
    if (specialty === "military") return undefined;
    const history = Chronicle.sync();
    history.figures ??= [];
    const figures = history.figures;
    regiment.crew ??= [];

    const crewed = regiment.crew.find(id => {
      const figure = figures[id];
      return figure && !figure.death && figure.roles.some(r => r.type === "specialist" && r.specialty === specialty);
    });
    if (crewed !== undefined) return crewed;

    // a commander of the same state and specialty may already serve elsewhere (a merged-away regiment)
    const existing = figures.find(
      figure =>
        !figure.death &&
        figure.roles.some(
          r =>
            r.type === "specialist" && r.specialty === specialty && r.target.kind === "state" && r.target.id === state.i
        )
    );
    if (existing) {
      regiment.crew.push(existing.i);
      return existing.i;
    }

    const index = figures.length;
    const culture = state.culture ?? 0;
    const year = options.map?.lore?.calendar?.year ?? 1000;
    const rng = traitsRng(this.getState().seed, "figure", index);
    const alignment = rollAlignment(rng, pack.cultures[culture]?.alignment);
    const { virtues, vices } = rollFigureTraits(rng, alignment);
    const skills = { m: 0, w: 0, s: 0, c: 0 };
    skills[UNIT_ROLE_POOLS[specialty]] = 1;
    const figure: HistoricalFigure = {
      i: index,
      name: Names.getCulture(culture),
      culture,
      birth: year - rng.int(25, 45),
      roles: [{ type: "specialist", specialty, target: { kind: "state", id: state.i }, from: year }],
      alignment,
      virtues,
      vices,
      cell: regiment.cell,
      xp: 0,
      skills
    };
    figures.push(figure);
    regiment.crew.push(figure.i);
    return figure.i;
  }

  /** Annex a Free Burg: peacefully when it shares the state's culture or faith, else by assault. */
  colonize(stateId: number, burgId: number): boolean {
    const state = pack.states[stateId];
    const burg = pack.burgs[burgId];
    if (!state?.i || state.removed || !burg?.i || burg.removed || burg.state !== 0) return false;

    if (this.sharesKinshipOrFaith(stateId, burgId)) {
      this.annexBurg(stateId, burg, false);
      this.logConquest(state, burg, false);
      return true;
    }
    return this.assaultBurg(state, burg);
  }

  /** Declare war on a rival and storm one of its border burgs. */
  conquerBurg(stateId: number, burgId: number): boolean {
    const state = pack.states[stateId];
    const burg = pack.burgs[burgId];
    if (!state?.i || state.removed || !burg?.i || burg.removed) return false;

    const defenderId = burg.state;
    if (!defenderId || defenderId === stateId) return false;
    if (!pack.states[defenderId]?.i || pack.states[defenderId].removed || burg.capital) return false;
    if (!this.bordersState(stateId, burg)) return false;

    if (!this.isAtWar(stateId, defenderId)) this.declareWar(stateId, defenderId);
    if (!this.assaultBurg(state, burg)) return false;

    this.removeClaim(stateId, burg.i);
    this.recordClaim(defenderId, burg, stateId);
    this.recordGrudge(defenderId, burg, "conquest", `${state.name} took ${burg.name}`, stateId);
    return true;
  }

  /** Retake a burg recorded on the state's claim list. */
  reclaimBurg(stateId: number, burgId: number): boolean {
    const sSim = this.getState().states[stateId];
    const burg = pack.burgs[burgId];
    if (!sSim || !burg?.i || burg.removed || !burg.state || burg.state === stateId) return false;
    if (!sSim.claims.some(claim => claim.burgId === burgId)) return false;

    const defenderId = burg.state;
    if (!this.isAtWar(stateId, defenderId)) this.declareWar(stateId, defenderId);
    if (!this.assaultBurg(pack.states[stateId], burg)) return false;

    sSim.claims = sSim.claims.filter(claim => claim.burgId !== burgId);
    sSim.grudges = sSim.grudges.filter(
      grudge => !(grudge.againstStateId === defenderId && grudge.targetBurgId === burgId)
    );
    this.recordClaim(defenderId, burg, stateId);
    return true;
  }

  /** God mode: set a state's most restive burg (or the given one) on the path to secession. */
  sparkRebellion(stateId: number, burgId?: number): boolean {
    const living = this.getState();
    const state = pack.states[stateId];
    const sSim = living.states[stateId];
    if (!state?.i || state.removed || !sSim) return false;

    const burg =
      burgId !== undefined
        ? pack.burgs[burgId]
        : pack.burgs.find(
            candidate => candidate?.i && !candidate.removed && candidate.state === stateId && !candidate.capital
          );
    if (!burg?.i || burg.removed || burg.state !== stateId || burg.capital) return false;

    const bSim = living.burgs[burg.i];
    if (bSim) bSim.unrest = 100;
    sSim.unravel = 100;
    this.stepRebellions(living);
    return true;
  }

  /** God mode: kill the current ruler and let the succession play out. */
  smiteRuler(stateId: number): boolean {
    const living = this.getState();
    const state = pack.states[stateId];
    const sSim = living.states[stateId];
    if (!state?.i || state.removed || !sSim) return false;

    const ruler = pack.history?.figures?.find(figure => figure.i === sSim.rulerId);
    if (!ruler || ruler.death !== undefined) return false;

    this.succeedRuler(state, sSim, ruler, living, options.map?.lore?.calendar?.year ?? 1000);
    return true;
  }

  /** God mode: declare war on a rival, or on the first neighbour not already at war. */
  forceWar(stateId: number, otherId?: number): boolean {
    const state = pack.states[stateId];
    if (!state?.i || state.removed) return false;

    const other = otherId !== undefined ? pack.states[otherId] : this.pickWarRival(state);
    if (!other?.i || other.removed || other.i === stateId) return false;
    if (this.isAtWar(stateId, other.i)) return false;

    this.declareWar(stateId, other.i);
    return true;
  }

  /** God mode: end a burg's unrest at once and start its assimilation. */
  pacifyBurg(burgId: number): boolean {
    const living = this.getState();
    const burg = pack.burgs[burgId];
    const bSim = living.burgs[burgId];
    if (!burg?.i || burg.removed || !burg.state || !bSim || bSim.unrest <= 0) return false;

    const state = pack.states[burg.state];
    if (!state?.i || state.removed) return false;

    bSim.unrest = 0;
    const sSim = living.states[state.i];
    if (sSim) sSim.unravel = Math.max(0, sSim.unravel - 20);
    this.assimilateBurg(state, burg, bSim);

    this.pushNews(living, {
      kind: "pacify",
      text: `${state.name} pacified ${burg.name ?? "a restive burg"}.`,
      cell: burg.cell,
      stateId: state.i,
      burgId
    });
    return true;
  }

  /** God mode: finish the burg's construction, or start and finish the best available asset. */
  completeAsset(burgId: number): boolean {
    const living = this.getState();
    const burg = pack.burgs[burgId];
    const bSim = living.burgs[burgId];
    if (!burg?.i || burg.removed || !burg.state || !bSim) return false;

    const state = pack.states[burg.state];
    const sSim = state?.i && !state.removed ? living.states[state.i] : undefined;
    if (!state?.i || state.removed || !sSim) return false;

    const { content } = currentContent();
    const construction = bSim.construction;
    const built = construction ? content.buildings.find(entry => entry.id === construction.buildingId) : undefined;
    const candidates = content.buildings.filter(entry => this.canBuild(state, burg, bSim, entry));
    const building = built ?? candidates.find(entry => entry.id === sSim.agenda?.buildingId) ?? candidates[0];
    if (!building) return false;

    this.completeConstruction(state, sSim, living, burg, bSim, building);
    return true;
  }

  /** Send military or specialist units to quell a provincial trouble with a domain saving throw. */
  resolveTrouble(stateId: number, provinceId: number): boolean {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed || province.state !== stateId) return false;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim?.trouble || pSim.lair) return false;

    const state = pack.states[stateId];
    const sSim = living.states[stateId];
    if (!state?.i || state.removed || !sSim) return false;

    const troubleDef = getTroubleDef(pSim.trouble.id);
    const unitTypes = Military.getUnitTypes();

    let bestUnit: ArmyUnit | null = null;
    let bestReg: Regiment | null = null;
    let bestMult = 3;
    let bestDisruption = 999;

    for (const reg of state.military ?? []) {
      for (const unit of reg.units ?? []) {
        if (unit.count <= 0) continue;
        const uType = unitTypes[unit.type];
        const role: TroubleUnitRole = uType?.troubleRole ?? "military";
        const mult = troubleUnitMatchMultiplier(troubleDef, role);
        const dis = unit.disruption ?? 0;
        if (mult < bestMult || (mult === bestMult && dis < bestDisruption)) {
          bestMult = mult;
          bestDisruption = dis;
          bestUnit = unit;
          bestReg = reg;
        }
      }
    }

    // unified-figures slice 2: when the state fields a matching specialist, its
    // named commander leads the attempt and the roll carries the person.
    const history = Chronicle.sync();
    const figures = (history.figures ??= []);
    const commander = bestReg?.crew
      ?.map(id => figures[id])
      .find(
        f => f && !f.death && f.roles.some(r => r.type === "specialist" && r.specialty === troubleDef.requiredRole)
      );

    const rng = this.rng("trouble:resolve", provinceId, living.tick);
    const roll = rng.d(20);
    const poolGen = sSim.capacity[troubleDef.pool]?.gen ?? 0;
    const domainMod = valueModifier(poolGen);
    const skillBonus = commander?.skills?.[troubleDef.pool] ?? 0;
    const traitBonus = commander ? (commander.virtues?.length ?? 0) - (commander.vices?.length ?? 0) : 0;
    const unitDisruption = bestUnit?.disruption ?? 0;
    const total = roll + skillBonus + domainMod + traitBonus - unitDisruption;
    const dc = 16 + bestMult * pSim.trouble.level;
    const year = options.map?.lore?.calendar?.year ?? 1000;
    const cell = province.center ?? state.center;

    const success = total >= dc;
    if (success) {
      const reduction = rng.d(4);
      pSim.trouble.level -= reduction;
      if (pSim.trouble.level <= 0) {
        pSim.trouble = null;
        pSim.order = Math.min(100, pSim.order + 10);
        pSim.stability += 1;
        if (commander) {
          commander.xp = (commander.xp ?? 0) + 25;
          this.pushNews(living, {
            kind: "trouble",
            text: `${commander.name} overcame ${troubleDef.name} in ${province.name}!`,
            cell,
            stateId
          });
          this.pushHistory(
            "deed",
            [
              { kind: "figure", id: commander.i },
              { kind: "state", id: stateId }
            ],
            cell,
            `${commander.name} eliminated the ${troubleDef.name} affliction in ${province.name}.`
          );
        } else {
          this.pushNews(living, {
            kind: "trouble",
            text: `${state.name} overcame ${troubleDef.name} in ${province.name}!`,
            cell,
            stateId
          });
          this.pushHistory(
            "conquest",
            [{ kind: "state", id: stateId }],
            cell,
            `${state.name} eliminated the ${troubleDef.name} affliction in ${province.name}.`
          );
        }
      } else {
        if (commander) commander.xp = (commander.xp ?? 0) + 10;
        const who = commander ? commander.name : state.name;
        this.pushNews(living, {
          kind: "trouble",
          text: `${who} quelled ${troubleDef.name} in ${province.name} (reduced to level ${pSim.trouble.level}).`,
          cell,
          stateId
        });
      }
    } else {
      if (bestUnit) {
        bestUnit.disruption = Math.min(3, (bestUnit.disruption ?? 0) + 1);
      }
      // unified-figures: a disastrous attempt (≤ dc − 6) breaks or slays the commander
      let aftermath = "";
      if (commander && total <= dc - 6) {
        if (rng.d(2) === 1) {
          commander.death = year;
          for (const role of commander.roles) if (role.to === undefined) role.to = year;
          if (bestReg?.crew) bestReg.crew = bestReg.crew.filter(id => id !== commander.i);
          aftermath = ` ${commander.name} did not survive the attempt.`;
        } else {
          const vice = drawVice(rng, commander);
          if (vice) {
            commander.vices ??= [];
            commander.vices.push(vice);
            aftermath = ` The struggle left ${commander.name} ${vice}.`;
          }
        }
      }
      const who = commander ? `${commander.name}'s attempt` : `${state.name}'s attempt`;
      this.pushNews(living, {
        kind: "trouble",
        text: `${who} to resolve ${troubleDef.name} in ${province.name} failed (rolled ${total} vs DC ${dc}).${aftermath}`,
        cell,
        stateId
      });

      if (
        pSim.trouble &&
        isTroubleStatePromotable(pSim.trouble.id) &&
        pSim.trouble.level >= 6 &&
        pSim.order <= 30 &&
        (roll === 1 || total <= dc - 10)
      ) {
        this.promoteTroubleToState(provinceId);
      }
    }

    sSim.capacity = this.recomputeStateCapacity(stateId);
    return success;
  }

  /** Spawn a trouble in a province. If troubleId/theme/level are omitted, rolls them procedurally. */
  spawnTrouble(provinceId: number, troubleId?: string, theme?: TroubleTheme, level?: number): ProvinceTrouble | null {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed) return null;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim) return null;

    const rng = this.rng("trouble:spawn", provinceId, living.tick);

    let finalTheme = theme;
    if (!finalTheme) {
      const provCells = this.provinceCells(provinceId);
      const hasBurg = pack.burgs.some(b => b?.i && !b.removed && pack.cells.province?.[b.cell] === provinceId);
      const hasRuin = (pack.markers ?? []).some(
        m =>
          !m.hidden &&
          m.cell &&
          provCells.includes(m.cell) &&
          ["ruins", "cave", "dungeon", "battlefields", "volcano"].includes(m.type)
      );
      const hasResource = provCells.some(c => Boolean(pack.cells.good?.[c]));

      const candidates: TroubleTheme[] = [];
      if (hasBurg) candidates.push("burg", "burg");
      if (hasRuin) candidates.push("ruin", "ruin");
      if (hasResource) candidates.push("resource", "resource");
      if (candidates.length === 0) candidates.push("burg");
      finalTheme = rng.choice(candidates) ?? "burg";
    }

    let finalTroubleId = troubleId;
    if (!finalTroubleId) {
      const table =
        finalTheme === "burg" ? BURG_TROUBLE_IDS : finalTheme === "ruin" ? RUIN_TROUBLE_IDS : RESOURCE_TROUBLE_IDS;
      finalTroubleId = rng.choice(table) ?? "monsters";
    }

    const finalLevel = minmax(level ?? rng.d(4) + 1, 1, 10);
    const tDef = getTroubleDef(finalTroubleId);
    const cell = province.center ?? pack.states[province.state]?.center ?? 0;
    pSim.trouble = {
      id: finalTroubleId,
      name: tDef.name,
      theme: finalTheme,
      pool: tDef.pool,
      save: tDef.save,
      requiredRole: tDef.requiredRole,
      level: finalLevel,
      seasonsUnchecked: 0,
      cell
    };

    if (province.state && living.states[province.state]) {
      living.states[province.state].capacity = this.recomputeStateCapacity(province.state);
    }

    this.pushNews(living, {
      kind: "trouble",
      text: `${tDef.name} arose in ${province.name}! (${finalTheme} trouble, level ${finalLevel})`,
      cell,
      stateId: province.state
    });

    return pSim.trouble ?? null;
  }

  /** God-mode / debug helper: clears trouble from a province. */
  quellTrouble(provinceId: number): boolean {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed) return false;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim?.trouble) return false;

    pSim.trouble = null;
    if (province.state && living.states[province.state]) {
      living.states[province.state].capacity = this.recomputeStateCapacity(province.state);
    }
    this.pushNews(living, {
      kind: "trouble",
      text: `Trouble in ${province.name} was quelled.`,
      cell: province.center ?? 0,
      stateId: province.state
    });
    return true;
  }

  /** Send the state's field army to storm and destroy a provincial lair. */
  assaultLair(stateId: number, provinceId: number): boolean {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed || province.state !== stateId) return false;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim?.lair) return false;

    const state = pack.states[stateId];
    const sSim = living.states[stateId];
    if (!state?.i || state.removed || !sSim) return false;

    const army = this.fieldArmy(state);
    if (!army) return false;

    const lair = pSim.lair;
    const { config } = currentContent();
    const attackerUnits = (army.units ?? []).filter(u => u.count > 0).map(u => ({ ...u }));
    const defenderUnits = lair.defenders.filter(u => u.count > 0).map(u => ({ ...u }));

    if (attackerUnits.length === 0) return false;

    const session = initBattleSession({
      config,
      unitTypes: Military.getUnitTypes(),
      attacker: { factionId: stateId, armyId: null, units: attackerUnits },
      defender: { factionId: 0, armyId: null, units: defenderUnits },
      cell: lair.cell,
      regionId: provinceId,
      assault: lair.fortified,
      modifiers: {
        walls: lair.fortified ? 1 : 0,
        defenderEncamped: lair.fortified,
        defenderAmbushed: false,
        attackerCrossedRiver: false,
        labels: [lair.fortified ? `${lair.name} (fortified walls)` : lair.name]
      }
    });

    const rng = this.rng("lair:assault", stateId * 1000 + provinceId, living.tick);
    while (session.status === "active" && session.round < config.battle.maxRounds) {
      stepBattleRound(session, rng.next);
    }
    const outcome = finalizeBattle(session, rng.next);

    this.applyArmySurvivors(state, army, outcome.attacker.units);
    this.addBattleMarker(lair.cell, lair.name);

    if (outcome.winner === "attacker") {
      this.removeLairMarker(lair.markerId);
      const lairName = lair.name;
      pSim.lair = null;
      pSim.order = Math.min(100, pSim.order + 15);
      pSim.stability += 2;
      sSim.warExhaustion = Math.max(0, sSim.warExhaustion - 2);
      sSim.capacity = this.recomputeStateCapacity(stateId);
      this.relieveEschaton(living);

      this.pushNews(living, {
        kind: "lair",
        text: `${state.name}'s army conquered and destroyed ${lairName} in ${province.name}!`,
        cell: lair.cell,
        stateId
      });
      this.pushHistory(
        "conquest",
        [{ kind: "state", id: stateId }],
        lair.cell,
        `${state.name}'s legions conquered and dismantled the ${lairName} in ${province.name}.`
      );
      return true;
    }

    // Defenders repulsed the assault: surviving defenders persist for attrition
    lair.defenders = outcome.defender.units.filter(u => u.count > 0).map(u => ({ ...u }));
    if (lair.defenders.length === 0) {
      this.removeLairMarker(lair.markerId);
      const lairName = lair.name;
      pSim.lair = null;
      pSim.order = Math.min(100, pSim.order + 10);
      sSim.capacity = this.recomputeStateCapacity(stateId);
      this.pushNews(living, {
        kind: "lair",
        text: `${state.name}'s army destroyed ${lairName} in ${province.name} at immense cost!`,
        cell: lair.cell,
        stateId
      });
      return true;
    }

    for (const u of army.units ?? []) {
      u.disruption = Math.min(3, (u.disruption ?? 0) + 1);
    }
    sSim.warExhaustion = Math.min(100, sSim.warExhaustion + 4);

    this.pushNews(living, {
      kind: "lair",
      text: `${state.name}'s assault on ${lair.name} was repulsed with heavy losses!`,
      cell: lair.cell,
      stateId
    });
    this.pushHistory(
      "battle",
      [{ kind: "state", id: stateId }],
      lair.cell,
      `${state.name}'s expedition against ${lair.name} was repulsed.`
    );
    return false;
  }

  /** Dispatch an adventuring band to execute a decapitation delve into a lair. */
  sendAdventurersToLair(stateId: number, provinceId: number): boolean {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed || province.state !== stateId) return false;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim?.lair) return false;

    const state = pack.states[stateId];
    const sSim = living.states[stateId];
    if (!state?.i || state.removed || !sSim) return false;

    const lair = pSim.lair;
    const history = Chronicle.sync();
    history.figures ??= [];

    let adventurer = history.figures.find(
      f =>
        !f.death && f.roles.some(r => r.type === "adventurer" && r.target.kind === "state" && r.target.id === stateId)
    );

    const year = options.map?.lore?.calendar?.year ?? 1000;
    if (!adventurer) {
      const culture = state.culture ?? 0;
      const index = history.figures.length;
      const rng = traitsRng(living.seed, "adventurer", index + state.i * 500);
      const alignment = rollAlignment(rng, pack.cultures[culture]?.alignment);
      const { virtues, vices } = rollFigureTraits(rng, alignment);
      adventurer = {
        i: index,
        name: Names.getCulture(culture),
        culture,
        birth: year - rng.int(22, 40),
        roles: [{ type: "adventurer", target: { kind: "state", id: state.i }, from: year }],
        alignment,
        virtues,
        vices
      };
      history.figures.push(adventurer);
    }

    const domainMod = valueModifier(Math.max(sSim.capacity.w.gen, sSim.capacity.c.gen));
    const traitBonus = (adventurer.virtues?.length ?? 0) - (adventurer.vices?.length ?? 0);
    const rng = this.rng("adventurer:delve", stateId * 500 + provinceId, living.tick);
    const roll = rng.d(20);
    const total = roll + domainMod + traitBonus;
    const dc = 14 + lair.level;

    if (total >= dc) {
      // Full Success: decapitation strike slays the lair master
      this.removeLairMarker(lair.markerId);
      const lairName = lair.name;
      pSim.lair = null;
      pSim.order = Math.min(100, pSim.order + 12);
      pSim.stability += 1;
      sSim.capacity = this.recomputeStateCapacity(stateId);
      this.relieveEschaton(living);

      this.pushNews(living, {
        kind: "lair",
        text: `${adventurer.name} and their adventuring band purged ${lairName} in ${province.name}!`,
        cell: lair.cell,
        stateId
      });
      this.pushHistory(
        "conquest",
        [
          { kind: "figure", id: adventurer.i },
          { kind: "state", id: stateId }
        ],
        lair.cell,
        `${adventurer.name} and their adventuring band slew the master of ${lairName} in ${province.name}.`
      );
      return true;
    }

    if (total >= dc - 3) {
      // Partial Success / Near Miss: thinned defenders and retreated
      for (const u of lair.defenders) {
        u.count = Math.max(1, Math.round(u.count * (0.5 + rng.next() * 0.25)));
      }
      lair.level = Math.max(4, lair.level - 1);
      sSim.capacity = this.recomputeStateCapacity(stateId);

      this.pushNews(living, {
        kind: "lair",
        text: `${adventurer.name}'s band struck deep into ${lair.name}, culling defenders before withdrawing (reduced to level ${lair.level}).`,
        cell: lair.cell,
        stateId
      });
      return false;
    }

    // Failure: disastrous delve, potential death, triggers retaliatory raid
    if (rng.d(2) === 1) {
      adventurer.death = year;
      for (const role of adventurer.roles) {
        if (role.type === "adventurer" && role.to === undefined) role.to = year;
      }
    }
    lair.raidPending = true;

    this.pushNews(living, {
      kind: "lair",
      text: `${adventurer.name}'s delve into ${lair.name} failed disastrously!`,
      cell: lair.cell,
      stateId
    });
    return false;
  }

  /** Metastasize an active trouble into a full lair stronghold. */
  metastasizeTroubleToLair(provinceId: number, lairId?: string): ProvinceLair | null {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed) return null;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim) return null;
    if (!pSim.trouble && !lairId) return null;

    const trouble = pSim.trouble;
    const rng = this.rng("lair:metastasize", provinceId, living.tick);
    const chosenLairId = lairId ?? (trouble ? pickLairForTrouble(trouble.id, rng) : LAIR_NATURE_IDS[0]!);
    const originCell = trouble?.cell ?? province.center ?? pack.states[province.state]?.center ?? 0;
    const level = Math.max(4, trouble?.level ?? 4);
    const theme = trouble?.theme ?? "ruin";

    const lair = createProvinceLair(chosenLairId, originCell, level, theme, trouble?.burgId, Military.getUnitTypes());
    const markerId = this.addLairMarker(lair, originCell);
    lair.markerId = markerId;

    pSim.lair = lair;
    pSim.trouble = null;

    if (province.state) {
      const sSim = living.states[province.state];
      if (sSim) {
        if (sSim.agenda?.kind === "resolve_trouble" && sSim.agenda.targetProvinceId === provinceId) {
          sSim.agenda = null;
        }
        sSim.capacity = this.recomputeStateCapacity(province.state);
      }
    }

    const lairDef = getLairDef(chosenLairId);
    this.pushNews(living, {
      kind: "lair",
      text: `Unchecked trouble in ${province.name} has festered into a ${lairDef.name}!`,
      cell: originCell,
      stateId: province.state
    });
    this.pushHistory(
      "collapse",
      [{ kind: "state", id: province.state }],
      originCell,
      `A ${lairDef.name} took root in ${province.name}, defying lawful authority.`
    );

    return lair;
  }

  /** Directly spawn a lair in a province. */
  spawnLair(provinceId: number, lairId?: string, level?: number, cell?: number): ProvinceLair | null {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed) return null;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim) return null;

    const rng = this.rng("lair:spawn", provinceId, living.tick);
    const chosenLairId = lairId ?? rng.choice(LAIR_NATURE_IDS) ?? "ancient_evil";
    const originCell = cell ?? province.center ?? pack.states[province.state]?.center ?? 0;
    const finalLevel = minmax(level ?? 4 + rng.d(4), 4, 10);

    const lair = createProvinceLair(chosenLairId, originCell, finalLevel, "ruin", undefined, Military.getUnitTypes());
    const markerId = this.addLairMarker(lair, originCell);
    lair.markerId = markerId;

    if (pSim.lair) {
      this.removeLairMarker(pSim.lair.markerId);
    }
    pSim.lair = lair;
    pSim.trouble = null;

    if (province.state && living.states[province.state]) {
      living.states[province.state].capacity = this.recomputeStateCapacity(province.state);
    }

    const lairDef = getLairDef(chosenLairId);
    this.pushNews(living, {
      kind: "lair",
      text: `A ${lairDef.name} arose in ${province.name}! (Lair level ${finalLevel})`,
      cell: originCell,
      stateId: province.state
    });

    return lair;
  }

  /** God-mode / cleanup helper: destroys a lair from a province. */
  smiteLair(provinceId: number): boolean {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed) return false;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    if (!pSim?.lair) return false;

    this.removeLairMarker(pSim.lair.markerId);
    const lairName = pSim.lair.name;
    pSim.lair = null;

    if (province.state && living.states[province.state]) {
      living.states[province.state].capacity = this.recomputeStateCapacity(province.state);
    }

    this.pushNews(living, {
      kind: "lair",
      text: `The ${lairName} in ${province.name} was destroyed.`,
      cell: province.center ?? 0,
      stateId: province.state
    });
    return true;
  }

  /** Promote an eligible provincial trouble directly into an emergent sovereign state. */
  promoteTroubleToState(provinceId: number, burgId?: number): number | null {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed) return null;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    const trouble = pSim?.trouble;
    if (!trouble || !isTroubleStatePromotable(trouble.id)) return null;

    const tDef = getTroubleDef(trouble.id);
    const lairDef = getLairDef(tDef.stateLairId ?? "aspiring_warlord");
    const unitTypes = Military.getUnitTypes();
    const scale = Math.max(1, Math.min(2, Math.round(trouble.level / 5)));
    const templates = lairDef.defenderUnits.map(t => ({ ...t, count: Math.max(1, Math.round(t.count * scale)) }));
    const units = instantiateLairUnits(templates, unitTypes);
    const originCell = trouble.cell || province.center || pack.states[province.state]?.center || 0;

    return this.spawnEmergentState({
      province,
      pSim,
      living,
      originKind: "trouble",
      originName: trouble.name,
      originCell,
      requestedBurgId: burgId ?? trouble.burgId,
      rosterId: lairDef.stateRosterId,
      stateForm: tDef.stateForm ?? lairDef.stateForm,
      alignment: lairDef.defaultAlignment,
      units
    });
  }

  /** Ascend an eligible entrenched lair into an emergent sovereign state. */
  ascendLairToState(provinceId: number, burgId?: number): number | null {
    const province = pack.provinces?.[provinceId];
    if (!province?.i || province.removed) return null;
    const living = this.getState();
    const pSim = living.provinces[provinceId];
    const lair = pSim?.lair;
    if (!lair || !isLairStateCapable(lair.id)) return null;

    const lairDef = getLairDef(lair.id);
    const unitTypes = Military.getUnitTypes();
    let units = [...lair.defenders, ...lair.raidUnits].filter(u => u.count > 0).map(u => ({ ...u }));
    if (units.length === 0) {
      units = instantiateLairUnits(lairDef.defenderUnits, unitTypes);
    }
    const originCell = lair.cell || province.center || pack.states[province.state]?.center || 0;

    return this.spawnEmergentState({
      province,
      pSim,
      living,
      originKind: "lair",
      originName: lair.name,
      originCell,
      requestedBurgId: burgId ?? lair.burgId,
      markerId: lair.markerId,
      rosterId: lairDef.stateRosterId,
      stateForm: lairDef.stateForm,
      alignment: lairDef.defaultAlignment,
      units
    });
  }

  private spawnEmergentState(opts: {
    province: Province;
    pSim: ProvinceSimState;
    living: LivingWorldState;
    originKind: "trouble" | "lair";
    originName: string;
    originCell: number;
    requestedBurgId?: number;
    markerId?: number;
    rosterId?: string;
    stateForm?: string;
    alignment?: Alignment;
    units: ArmyUnit[];
  }): number | null {
    const { province, pSim, living, originKind, originName, originCell, requestedBurgId, markerId } = opts;
    const oldOwnerId = province.state ?? 0;
    const oldOwner = oldOwnerId ? pack.states[oldOwnerId] : undefined;
    const rng = this.rng(`emergent:${originKind}`, province.i, living.tick);

    const capital = this.resolveEmergentCapital(province, originKind, originCell, rng, requestedBurgId);
    if (!capital) return null;

    const culture =
      capital.culture ?? pack.cells.culture?.[capital.cell] ?? oldOwner?.culture ?? pack.states[1]?.culture ?? 0;
    const baseName = Names.getState(capital.name ?? Names.getCulture(culture), culture);
    const fullName = opts.stateForm ? `${opts.stateForm} of ${capital.name ?? baseName}` : baseName;

    const { content } = currentContent();
    const availableRosters = new Set(Object.keys(content.rosters));
    const resolvedRosterId =
      opts.rosterId && opts.rosterId !== "local" && availableRosters.has(opts.rosterId)
        ? opts.rosterId
        : assignStateRoster({ culture, type: "Generic" }, pack.cultures);

    const newStateId = pack.states.length;
    const relations: string[] = [];
    for (const other of pack.states) {
      if (!other) continue;
      if (!other.i || other.removed) {
        relations[other.i] = "x";
        continue;
      }
      const relation = other.i === oldOwnerId ? "Enemy" : "Neutral";
      other.diplomacy ??= [];
      other.diplomacy[newStateId] = relation;
      relations[other.i] = relation;
    }
    relations[newStateId] = "x";

    const color = this.emergentStateColor(opts.rosterId, opts.alignment, oldOwner?.color);
    const newState: State = {
      i: newStateId,
      name: baseName,
      formName: opts.stateForm,
      fullName,
      diplomacy: relations,
      provinces: [],
      color,
      expansionism: 0.8,
      capital: capital.i,
      type: "Generic",
      center: capital.cell,
      culture,
      rosterId: resolvedRosterId,
      military: [],
      coa: oldOwner?.coa ?? ({} as State["coa"]),
      salesTax: oldOwner?.salesTax ?? 0,
      pollTax: oldOwner?.pollTax ?? 0,
      treasury: 150
    };
    pack.states.push(newState);
    capital.capital = 1;
    capital.state = newStateId;

    const territoryCells = this.emergentTerritoryCells(province, capital, oldOwnerId);
    this.transferCells(newStateId, territoryCells);
    capital.state = newStateId;

    // Ensure the province transfers cleanly if its center or non-capital cells were seized
    const oldCapitalCell = oldOwner?.capital ? pack.burgs[oldOwner.capital]?.cell : oldOwner?.center;
    const provinceCells = this.provinceCells(province.i);
    const holdsOldCapital = oldCapitalCell !== undefined && provinceCells.includes(oldCapitalCell);
    if (!holdsOldCapital) {
      if (oldOwner?.provinces) {
        oldOwner.provinces = oldOwner.provinces.filter(id => id !== province.i);
      }
      province.state = newStateId;
      province.burg = capital.i;
      province.center = capital.cell;
      if (!newState.provinces?.includes(province.i)) {
        newState.provinces = [...(newState.provinces ?? []), province.i];
      }
      for (const c of territoryCells) {
        if (pack.cells.province) pack.cells.province[c] = province.i;
      }
    } else {
      this.assignProvince(newStateId, territoryCells);
    }

    if (markerId !== undefined) {
      this.removeLairMarker(markerId);
    }

    pSim.trouble = null;
    pSim.lair = null;
    pSim.order = 75;
    pSim.stability = 3;

    const ruler = this.spawnEmergentRuler(newState, living, opts.alignment);

    // Sync world burgs/provinces/states and scaffold capital infrastructure
    this.syncBurgs(living);
    this.syncProvinces(living);
    this.syncStates(living);

    const bSim = living.burgs[capital.i];
    if (bSim) {
      bSim.unrest = 0;
      bSim.conqueredBy = undefined;
      const scaffold = ["walls2", "barracks1", "market1", "temple1"];
      const bSet = new Set(bSim.buildings);
      bSet.delete("walls1");
      for (const bid of scaffold) bSet.add(bid);
      bSim.buildings = Array.from(bSet);
      syncBurgFlagsFromBuildings(capital, bSim.buildings);
    }

    const sSim = living.states[newStateId];
    if (sSim) {
      sSim.rulerId = ruler.i;
      sSim.unravel = 0;
      sSim.warExhaustion = 0;
    }

    // Clear stale agendas on former owner targeting this province
    if (oldOwnerId && living.states[oldOwnerId]) {
      const oldSim = living.states[oldOwnerId]!;
      const kind = oldSim.agenda?.kind;
      if (
        (kind === "resolve_trouble" || kind === "clear_lair" || kind === "hire_adventurers") &&
        oldSim.agenda?.targetProvinceId === province.i
      ) {
        oldSim.agenda = null;
      }
    }

    // Form 1st Regiment at capital and trim excess blocks to guarantee capacity viability
    const unitTypes = Military.getUnitTypes();
    const regiment = this.createRegiment(newState);
    regiment.name = `1st Host of ${newState.name}`;
    this.moveArmy(regiment, capital);
    regiment.units = opts.units.map(u => ({ ...u }));
    syncRegimentTotals(regiment, unitTypes);
    this.ensureCommanders();

    let capacity = this.recomputeStateCapacity(newStateId);
    while (
      (capacity.m.load > capacity.m.gen || capacity.w.load > capacity.w.gen || capacity.s.load > capacity.s.gen) &&
      regiment.units &&
      regiment.units.length > 1
    ) {
      regiment.units.pop();
      syncRegimentTotals(regiment, unitTypes);
      capacity = this.recomputeStateCapacity(newStateId);
    }
    if (sSim) sSim.capacity = capacity;
    if (oldOwnerId && living.states[oldOwnerId]) {
      living.states[oldOwnerId]!.capacity = this.recomputeStateCapacity(oldOwnerId);
    }

    // Claims and mutual high-weight grudges with the former sovereign
    if (oldOwnerId && oldOwner && !oldOwner.removed) {
      this.recordClaim(oldOwnerId, capital, newStateId);
      this.recordGrudge(
        oldOwnerId,
        capital,
        "conquest",
        `${newState.name} seized ${capital.name ?? "the province"} from ${oldOwner.name}`,
        newStateId
      );
      const lastOldGrudge = living.states[oldOwnerId]?.grudges.at(-1);
      if (lastOldGrudge) lastOldGrudge.weight = 60;

      this.recordGrudge(
        newStateId,
        capital,
        "conquest",
        `${ruler.name} vowed to cast down ${oldOwner.name}`,
        oldOwnerId
      );
      const lastNewGrudge = living.states[newStateId]?.grudges.at(-1);
      if (lastNewGrudge) lastNewGrudge.weight = 60;
    }

    const provLabel = province.name ?? capital.name ?? "the province";
    const text =
      originKind === "lair"
        ? `${ruler.name} of the ${originName} in ${provLabel} has proclaimed the ${fullName}!`
        : `${originName} in ${provLabel} erupted into revolution, proclaiming the ${fullName} under ${ruler.name}!`;
    this.pushNews(living, {
      kind: originKind === "lair" ? "lair" : "revolt",
      text,
      cell: capital.cell,
      stateId: newStateId,
      burgId: capital.i
    });
    this.pushHistory(
      "independence",
      [
        { kind: "figure", id: ruler.i },
        { kind: "burg", id: capital.i },
        { kind: "state", id: newStateId },
        ...(oldOwnerId ? [{ kind: "state", id: oldOwnerId } as HistRef] : [])
      ],
      capital.cell,
      text
    );

    return newStateId;
  }

  private resolveEmergentCapital(
    province: Province,
    originKind: "trouble" | "lair",
    originCell: number,
    rng: Rng,
    requestedBurgId?: number
  ): Burg | null {
    if (requestedBurgId) {
      const target = pack.burgs?.[requestedBurgId];
      if (target?.i && !target.removed && !target.capital) return target;
    }

    const cellBurgId = pack.cells.burg?.[originCell];
    if (cellBurgId) {
      const cellBurg = pack.burgs?.[cellBurgId];
      if (cellBurg?.i && !cellBurg.removed && !cellBurg.capital) return cellBurg;
    }

    if (originKind === "trouble") {
      if (province.burg) {
        const pBurg = pack.burgs?.[province.burg];
        if (pBurg?.i && !pBurg.removed && !pBurg.capital) return pBurg;
      }
      const candidates = (pack.burgs ?? []).filter(
        b =>
          b?.i &&
          !b.removed &&
          !b.capital &&
          (pack.cells.province?.[b.cell] === province.i || (province.state && b.state === province.state))
      );
      if (candidates.length > 0) {
        candidates.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
        return candidates[0]!;
      }
    }

    return this.foundEmergentBurg(province, originCell, rng);
  }

  private foundEmergentBurg(province: Province, originCell: number, rng: Rng): Burg {
    const occupiedCells = new Set<number>();
    for (const b of pack.burgs ?? []) {
      if (b?.i && !b.removed) occupiedCells.add(b.cell);
    }

    let cell = originCell;
    if (occupiedCells.has(cell)) {
      const neighbor = (pack.cells.c?.[originCell] ?? []).find(
        c => !occupiedCells.has(c) && (!pack.cells.h || pack.cells.h[c] >= 20)
      );
      if (neighbor !== undefined) cell = neighbor;
    }

    const [x, y] = pack.cells.p?.[cell] ?? [0, 0];
    const culture =
      pack.cells.culture?.[cell] ??
      (province.state ? pack.states[province.state]?.culture : undefined) ??
      pack.states[1]?.culture ??
      0;
    const pop = Math.round(rng.range(1.5, 3.0) * 10) / 10;

    try {
      const addedId = Burgs.add(x, y);
      const added = pack.burgs[addedId];
      if (added) {
        added.population = Math.max(added.population ?? 0, pop);
        return added;
      }
    } catch {
      // Fallback for stubbed test packs without full Voronoi grid or Routes
    }

    const burgId = pack.burgs.length;
    const burg: Burg = {
      i: burgId,
      cell,
      x,
      y,
      state: province.state ?? 0,
      culture,
      name: Names.getCulture(culture),
      population: pop,
      capital: 0,
      port: 0,
      walls: 1,
      plaza: 1,
      temple: 1,
      citadel: 1,
      tags: []
    };
    pack.burgs.push(burg);
    if (pack.cells.burg) pack.cells.burg[cell] = burgId;
    return burg;
  }

  private emergentTerritoryCells(province: Province, capital: Burg, oldOwnerId: number): number[] {
    const cells = new Set<number>(this.burgHinterland(capital));
    cells.add(capital.cell);

    const stateCenters = new Set<number>();
    const stateCapitalCells = new Set<number>();
    for (const s of pack.states ?? []) {
      if (!s?.i || s.removed) continue;
      if (s.center !== undefined) stateCenters.add(s.center);
      if (s.capital && pack.burgs[s.capital]) stateCapitalCells.add(pack.burgs[s.capital].cell);
    }

    for (const c of this.provinceCells(province.i)) {
      if (c === capital.cell) continue;
      if (stateCenters.has(c) || stateCapitalCells.has(c)) continue;
      const cellBurgId = pack.cells.burg?.[c];
      if (cellBurgId && pack.burgs[cellBurgId]?.capital) continue;
      if (!oldOwnerId || pack.cells.state?.[c] === oldOwnerId || pack.cells.state?.[c] === 0) {
        cells.add(c);
      }
    }
    return Array.from(cells);
  }

  private emergentStateColor(rosterId?: string, alignment?: Alignment, fallback?: string): string {
    if (rosterId === "tombKingsBase") return "#d6ccb2";
    if (rosterId === "vampireBase" || rosterId === "darkElfBase") return "#5e3c6e";
    if (rosterId === "demonBase" || rosterId === "chaosBase") return "#9e2a2b";
    if (rosterId === "infernalDwarfBase" || rosterId === "skavenBase") return "#5c646d";
    if (rosterId === "orcBase" || rosterId === "tribalBase") return "#8c4a27";
    if (alignment === "evil") return "#8b2635";
    if (alignment === "chaotic") return "#b5532a";
    if (alignment === "lawful") return "#4a5d73";
    return fallback ?? "#7a6855";
  }

  private spawnEmergentRuler(state: State, living: LivingWorldState, preferredAlignment?: Alignment): HistoricalFigure {
    const history = Chronicle.sync();
    history.figures ??= [];
    const year = options.map?.lore?.calendar?.year ?? 1000;
    const culture = state.culture ?? 0;
    const index = history.figures.length;
    const rng = traitsRng(living.seed, "figure", index + state.i * 1000);
    const alignment = preferredAlignment ?? rollAlignment(rng, pack.cultures[culture]?.alignment ?? "chaotic");
    const { virtues, vices } = aggressiveTraits(rollFigureTraits(rng, alignment));
    const figure: HistoricalFigure = {
      i: index,
      name: Names.getCulture(culture),
      culture,
      birth: year - rng.int(22, 48),
      roles: [{ type: "ruler", target: { kind: "state", id: state.i }, from: year }],
      alignment,
      virtues,
      vices
    };
    history.figures.push(figure);
    return figure;
  }

  private addLairMarker(lair: ProvinceLair, cell: number): number {
    pack.markers ??= [];
    const markers = pack.markers;
    const [x, y] = pack.cells.p[cell] ?? [0, 0];
    const markerIndex = markers.length;
    const def = getLairDef(lair.id);
    markers.push({
      i: markerIndex,
      type: "dungeon",
      icon: def.markerIcon || "☠️",
      x,
      y,
      cell,
      name: `${lair.name} (Lair Lvl ${lair.level})`
    });
    return markerIndex;
  }

  private removeLairMarker(markerId?: number): void {
    if (markerId === undefined || !pack.markers) return;
    const marker = pack.markers[markerId];
    if (marker) marker.hidden = true;
  }

  private addRuinMarker(cell: number, name: string): number {
    pack.markers ??= [];
    const markers = pack.markers;
    const [x, y] = pack.cells.p[cell] ?? [0, 0];
    const markerIndex = markers.length;
    markers.push({
      i: markerIndex,
      type: "ruins",
      icon: "🏛️",
      x,
      y,
      cell,
      name,
      chronicle: true
    });
    return markerIndex;
  }

  /** Mint a lore-linked relic named after the nearest fallen realm, a dead hero, or the site itself */
  private mintRelicFromMarker(marker: Marker, seedId: number): HistoricalRelic {
    const guild = this.getGuild();
    const rng = this.rng("guild:relic", seedId);
    const history = Chronicle.sync();

    // the nearest fallen realm lends its name; else a dead figure of the chronicle
    const realms = history.realms ?? [];
    const point = pack.cells.p?.[marker.cell];
    let realm: Realm | undefined;
    let bestDist = Infinity;
    for (const candidate of realms) {
      const center = pack.cells.p?.[candidate.center];
      if (!center || !point) continue;
      const dist = Math.hypot(center[0] - point[0], center[1] - point[1]);
      if (dist < bestDist) {
        bestDist = dist;
        realm = candidate;
      }
    }

    const dead = (history.figures ?? []).filter(figure => figure.death !== undefined);
    const deadFigure = dead.length > 0 ? dead[rng.int(0, dead.length - 1)] : undefined;
    const province = pack.cells.province?.[marker.cell];
    const place = marker.name ?? (province ? pack.provinces?.[province]?.name : undefined) ?? "the wilds";

    const category = rng.choice(relicCategoriesForMarker(marker.type));
    const context = {
      realm: realm?.name,
      figure: deadFigure?.name,
      place,
      year: realm?.fallen ?? deadFigure?.death ?? options.map?.lore?.calendar?.year ?? 1000
    };

    const relic: HistoricalRelic = {
      id: guild.relics.reduce((max, entry) => Math.max(max, entry.id), 0) + 1,
      name: formatRelicName(category, context, rng),
      category,
      lore: formatRelicLore(category, context, rng),
      originYear: context.year,
      ...(realm ? { originRealmId: realm.i } : {}),
      ...(deadFigure ? { originFigureId: deadFigure.i } : {}),
      bonuses: { ...RELIC_CATALOG[category].bonuses },
      cursed: RELIC_CATALOG[category].cursed,
      holder: { kind: "vault" }
    };
    guild.relics.push(relic);
    return relic;
  }

  /** Recover any relics a fallen capital buried at this marker */
  private recoverRelicsFromMarker(guild: GuildState, markerId: number | undefined): void {
    if (markerId === undefined) return;
    for (const relic of guild.relics ?? []) {
      if (relic.holder.kind === "ruin" && relic.holder.markerId === markerId) relic.holder = { kind: "vault" };
    }
  }

  /** A fallen capital forces the state's leased relics into a fresh chronicle ruin at the capital cell. */
  dropStateRelicsToRuin(stateId: number, burg: Burg): HistoricalRelic[] {
    const living = this.getState();
    const guild = this.getGuild();
    const dropped = guild.relics.filter(relic => relic.holder.kind === "state" && relic.holder.id === stateId);
    if (dropped.length === 0) return [];

    const markerId = this.addRuinMarker(burg.cell, `Ruins of ${burg.name ?? "the fallen capital"}`);
    for (const relic of dropped) relic.holder = { kind: "ruin", markerId, cell: burg.cell };

    const sSim = living.states[stateId];
    if (sSim) sSim.capacity = this.recomputeStateCapacity(stateId);

    this.pushNews(living, {
      kind: "develop",
      text: `${burg.name ?? "The capital"} fell; ${dropped.length} leased Guild relic${
        dropped.length === 1 ? "" : "s"
      } lay buried in the ruins.`,
      cell: burg.cell,
      stateId
    });
    return dropped;
  }

  private pickWarRival(state: State): State | undefined {
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || !burg.state || burg.state === state.i) continue;
      if (!this.bordersState(state.i, burg) || this.isAtWar(state.i, burg.state)) continue;
      const rival = pack.states[burg.state];
      if (rival?.i && !rival.removed) return rival;
    }
    return undefined;
  }

  /** Strongest land regiment with living troops, reconciling legacy compositions on the way. */
  private fieldArmy(state: State): Regiment | null {
    const unitTypes = Military.getUnitTypes();
    let best: Regiment | null = null;
    let bestMen = 0;
    for (const regiment of state.military ?? []) {
      if (regiment.n) continue;
      if (!regiment.units?.length) reconcileRegimentBlocks(regiment, unitTypes);
      const men = (regiment.units ?? []).reduce((sum, unit) => sum + Math.max(0, unit.count), 0);
      if (men > bestMen) {
        best = regiment;
        bestMen = men;
      }
    }
    return best;
  }

  /** Attack a settlement with the state's strongest field regiment. */
  private assaultBurg(state: State, burg: Burg): boolean {
    const army = this.fieldArmy(state);
    if (!army) return false;

    const defenders = this.burgDefenders(burg);
    if (defenders.length === 0) {
      this.annexBurg(state.i, burg, false);
      this.moveArmy(army, burg);
      this.logConquest(state, burg, true);
      return true;
    }

    const outcome = this.resolveAssault(state.i, burg, army, defenders);
    this.applyArmySurvivors(state, army, outcome.attacker.units);
    this.addBattleMarker(burg);

    const sSim = this.getState().states[state.i];
    if (sSim) sSim.warExhaustion = minmax(sSim.warExhaustion + (outcome.winner === "attacker" ? 2 : 8), 0, 100);

    if (outcome.winner === "attacker") {
      this.annexBurg(state.i, burg, true);
      if (army.a > 0) this.moveArmy(army, burg);
      this.logConquest(state, burg, true);
      return true;
    }

    this.recordGrudge(state.i, burg, "repulsed", `${burg.name} repulsed ${state.name}`);
    this.pushNews(this.getState(), {
      kind: "resist",
      text: `${burg.name ?? "The free town"} repulsed ${state.name}'s assault.`,
      cell: burg.cell,
      stateId: state.i,
      burgId: burg.i
    });
    this.pushHistory(
      "battle",
      [
        { kind: "state", id: state.i },
        { kind: "burg", id: burg.i }
      ],
      burg.cell,
      `${burg.name ?? "The free town"} repulsed ${state.name}'s assault.`
    );
    return false;
  }

  private resolveAssault(stateId: number, burg: Burg, army: Regiment, defenders: ArmyUnit[]): BattleOutcome {
    const { config } = currentContent();
    const session = initBattleSession({
      config,
      unitTypes: Military.getUnitTypes(),
      attacker: { factionId: stateId, armyId: null, units: army.units ?? [] },
      defender: { factionId: burg.state ?? 0, armyId: null, units: defenders },
      cell: burg.cell,
      regionId: pack.cells.province?.[burg.cell] ?? 0,
      assault: Number(burg.walls ?? 0) > 0,
      modifiers: this.assaultModifiers(burg)
    });
    const rng = this.rng("battle", stateId * 10000 + burg.i);
    while (session.status === "active" && session.round < config.battle.maxRounds) {
      stepBattleRound(session, rng.next);
    }
    return finalizeBattle(session, rng.next);
  }

  private assaultModifiers(burg: Burg): BattleModifiers {
    return {
      walls: Number(burg.walls ?? 0),
      defenderEncamped: false,
      defenderAmbushed: false,
      attackerCrossedRiver: Boolean(pack.cells.r?.[burg.cell]),
      labels: [`${burg.name ?? "settlement"} (walls ${burg.walls ?? 0})`]
    };
  }

  /** Win chance for the AI's war picking; 100 when the settlement is undefended. */
  private assaultOdds(stateId: number, burg: Burg, army: Regiment): number {
    const defenders = this.burgDefenders(burg);
    if (defenders.length === 0) return 100;
    return estimateOdds(
      currentContent().config,
      { factionId: stateId, armyId: null, units: army.units ?? [] },
      { factionId: burg.state ?? 0, armyId: null, units: defenders },
      this.assaultModifiers(burg),
      Military.getUnitTypes()
    ).attackerWinPct;
  }

  /** The burg's roster and its Conquest militia garrison. */
  private burgDefenders(burg: Burg): ArmyUnit[] {
    const roster = this.burgDefenderRoster(burg);
    const unitTypes = Military.getUnitTypes();
    if (!roster) return [];
    const tier = settlementTierFromPop(burg.population ?? 0);
    const walls = Number(burg.walls ?? 0);
    return burg.capital ? garrisonUnits(roster, unitTypes, walls) : minorGarrisonUnits(roster, unitTypes, tier, walls);
  }

  private burgDefenderRoster(burg: Burg): ResolvedRoster | undefined {
    if (burg.state) {
      const owner = pack.states[burg.state];
      if (owner?.i && !owner.removed) return Military.getRoster(owner);
    }
    const { content } = currentContent();
    const culture = pack.cultures?.[burg.culture ?? 0];
    const rosterId = inferRosterForCulture(culture?.name, content.rosters, content.defaultRoster, culture?.type);
    return content.rosters[rosterId] ?? content.rosters[content.defaultRoster] ?? Object.values(content.rosters)[0];
  }

  private applyArmySurvivors(state: State, regiment: Regiment, units: ArmyUnit[]): void {
    regiment.units = units.filter(unit => unit.count > 0).map(unit => ({ ...unit }));
    syncRegimentTotals(regiment, Military.getUnitTypes());
    if (regiment.a <= 0) state.military = (state.military ?? []).filter(entry => entry !== regiment);
  }

  private moveArmy(regiment: Regiment, burg: Burg): void {
    regiment.cell = burg.cell;
    regiment.x = burg.x;
    regiment.y = burg.y;
    regiment.bx = burg.x;
    regiment.by = burg.y;
  }

  /** Flip the burg and its hinterland to the state and seed occupation unrest. */
  private annexBurg(stateId: number, burg: Burg, restless: boolean): void {
    const living = this.getState();
    const bSim = living.burgs[burg.i];
    if (bSim) bSim.originalOwner ??= burg.state ?? 0;

    const previousState = burg.state ?? 0;
    const wasCapital = burg.capital === 1;
    const loserProvinces = previousState > 0 ? this.ownedProvinces(previousState).length : 0;
    const cells = this.burgHinterland(burg);
    this.transferCells(stateId, cells);
    burg.state = stateId;
    this.assignProvince(stateId, cells);

    // a conquered capital forces its state's leased relics into a ruin at the capital cell
    if (wasCapital && previousState > 0 && previousState !== stateId) this.dropStateRelicsToRuin(previousState, burg);

    // a major state losing its last holding collapses — and hastens the eschaton
    if (previousState > 0 && previousState !== stateId) {
      const stillHolds = pack.burgs.some(entry => entry?.i && !entry.removed && entry.state === previousState);
      if (!stillHolds && loserProvinces >= 4) this.exaltEschaton(living, 5);
    }

    // conquests by evil sovereigns push the world toward its finale
    const conquerorSim = living.states[stateId];
    const conquerorRuler =
      conquerorSim && conquerorSim.rulerId !== undefined ? this.findFigure(conquerorSim.rulerId) : undefined;
    if (conquerorRuler?.alignment === "evil") this.exaltEschaton(living, 2);

    if (!bSim) return;
    bSim.originalCulture ??= burg.culture;
    bSim.originalReligion ??= pack.cells.religion?.[burg.cell] ?? 0;
    bSim.conqueredBy = restless ? stateId : undefined;
    bSim.unrest = restless ? this.initialUnrest(stateId, burg) : 0;

    if (restless) {
      const provId = pack.cells.province?.[burg.cell] ?? 0;
      const prov = provId ? pack.provinces?.[provId] : null;
      const pSim = provId ? this.getState().provinces?.[provId] : null;
      if (prov && pSim && !pSim.trouble) {
        const conquestLevel = this.rng("conquest:trouble", burg.i).d(6) + 2;
        this.spawnTrouble(provId, undefined, "burg", conquestLevel);
      }
    }
  }

  /** The burg cell plus adjacent cells of the same (wild or defending) owner. */
  private burgHinterland(burg: Burg): number[] {
    const from = burg.state ?? 0;
    const cells = [burg.cell];
    const burgCells = new Set<number>();
    for (const entry of pack.burgs ?? []) {
      if (entry?.i && !entry.removed) burgCells.add(entry.cell);
    }
    const centers = new Set<number>();
    for (const state of pack.states ?? []) {
      if (state?.i && !state.removed) centers.add(state.center);
    }

    for (const neighbor of pack.cells.c?.[burg.cell] ?? []) {
      if (pack.cells.state?.[neighbor] !== from) continue;
      if (pack.cells.h && pack.cells.h[neighbor] < 20) continue;
      if (burgCells.has(neighbor) || centers.has(neighbor)) continue;
      cells.push(neighbor);
    }
    return cells;
  }

  /** Prefer the state's own SetCells (provinces, statistics); fall back on stripped packs. */
  private transferCells(stateId: number, cells: number[]): void {
    if (cells.length === 0) return;
    try {
      States.setCells(stateId, cells);
      return;
    } catch {
      // Stub packs (tests, stripped saves) have no full grid to validate against.
    }
    for (const cell of cells) {
      if (pack.cells.state[cell] === stateId) continue;
      pack.cells.state[cell] = stateId;
      const burgId = pack.cells.burg?.[cell];
      if (burgId) pack.burgs[burgId].state = stateId;
    }
  }

  /** Put annexed cells in an adjacent province of the conquering state, if it has one. */
  private assignProvince(stateId: number, cells: number[]): void {
    let provinceId = 0;
    for (const cell of cells) {
      for (const neighbor of pack.cells.c?.[cell] ?? []) {
        const candidate = pack.cells.province?.[neighbor] ?? 0;
        if (candidate && pack.provinces?.[candidate]?.state === stateId) {
          provinceId = candidate;
          break;
        }
      }
      if (provinceId) break;
    }
    if (!provinceId) {
      for (const cell of cells) {
        if (pack.cells.province) pack.cells.province[cell] = 0;
      }
      return;
    }
    for (const cell of cells) pack.cells.province[cell] = provinceId;
  }

  /** When a state's unravel clock fills, its most restive burg breaks away. */
  private stepRebellions(living: LivingWorldState): void {
    for (const state of pack.states.slice()) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states[state.i];
      if (!sSim || sSim.unravel < 100) continue;

      const target = this.mostRestiveBurg(state.i, true);
      if (!target) {
        sSim.unravel = 50;
        continue;
      }
      this.breakAway(state, target, living);
      sSim.unravel = 30;
    }
  }

  /** Highest-unrest burg of the state; capitals are only allowed when asked for. */
  private mostRestiveBurg(stateId: number, excludeCapital: boolean): Burg | null {
    let best: Burg | null = null;
    let bestUnrest = 0;
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      if (excludeCapital && burg.capital) continue;
      const unrest = this.getState().burgs[burg.i]?.unrest ?? 0;
      if (unrest <= bestUnrest) continue;
      best = burg;
      bestUnrest = unrest;
    }
    return best;
  }

  /** Restore a Free Burg, rejoin its homeland, defect to kin, or found a secessionist state. */
  private breakAway(state: State, burg: Burg, living: LivingWorldState): void {
    const bSim = living.burgs[burg.i];
    const cells = this.burgHinterland(burg);
    const original = bSim?.originalOwner ?? 0;
    const kin = this.kinNeighborState(state.i, burg);
    const rebel = this.spawnRebel(state, burg, living);

    let heir = 0;
    if (original > 0 && original !== state.i) {
      if (pack.states[original]?.i && !pack.states[original].removed) heir = original;
    } else if (kin) {
      heir = kin;
    } else if (original > 0) {
      heir = this.foundSecessionState(state, burg);
    }

    if (heir) {
      this.transferCells(heir, cells);
      burg.state = heir;
      this.assignProvince(heir, cells);
      this.raiseRebelRegiment(heir, burg);
    } else {
      this.transferCells(0, cells);
      burg.state = 0;
      for (const cell of cells) pack.cells.province[cell] = 0;
    }

    if (bSim) {
      bSim.unrest = 0;
      bSim.conqueredBy = undefined;
    }
    this.recordClaim(state.i, burg, heir);
    this.recordGrudge(state.i, burg, "repulsed", `${burg.name ?? "The burg"} broke away from ${state.name}`);

    const heirState = heir ? pack.states[heir] : undefined;
    const text = heirState
      ? `${burg.name ?? "The burg"} rose in revolt and joined ${heirState.name}.`
      : `${burg.name ?? "The burg"} rose in revolt and restored its independence.`;
    this.pushNews(living, { kind: "revolt", text, cell: burg.cell, stateId: state.i, burgId: burg.i });
    this.pushHistory(
      "independence",
      [
        { kind: "figure", id: rebel.i },
        { kind: "burg", id: burg.i },
        { kind: "state", id: state.i }
      ],
      burg.cell,
      text
    );
  }

  private spawnRebel(state: State, burg: Burg, living: LivingWorldState): HistoricalFigure {
    const history = Chronicle.sync();
    history.figures ??= [];
    const year = options.map?.lore?.calendar?.year ?? 1000;
    const culture = living.burgs[burg.i]?.originalCulture ?? burg.culture ?? state.culture ?? 0;
    const index = history.figures.length;
    const rng = traitsRng(living.seed, "figure", index + state.i * 1000);
    const alignment = rollAlignment(rng, pack.cultures[culture]?.alignment);
    const { virtues, vices } = rollFigureTraits(rng, alignment);
    const figure: HistoricalFigure = {
      i: index,
      name: Names.getCulture(culture),
      culture,
      birth: year - rng.int(20, 50),
      roles: [{ type: "rebel", target: { kind: "burg", id: burg.i }, from: year }],
      alignment,
      virtues,
      vices
    };
    history.figures.push(figure);
    return figure;
  }

  /** A state on a neighbouring cell that shares the burg's culture. */
  private kinNeighborState(ownerId: number, burg: Burg): number {
    const culture = this.getState().burgs[burg.i]?.originalCulture ?? burg.culture ?? 0;
    for (const cell of pack.cells.c?.[burg.cell] ?? []) {
      const stateId = pack.cells.state?.[cell] ?? 0;
      if (!stateId || stateId === ownerId) continue;
      const state = pack.states[stateId];
      if (state?.i && !state.removed && state.culture === culture) return stateId;
    }
    return 0;
  }

  private foundSecessionState(oldOwner: State, burg: Burg): number {
    const i = pack.states.length;
    const culture = burg.culture ?? oldOwner.culture ?? 0;
    const relations: string[] = [];
    for (const other of pack.states) {
      if (!other) continue;
      if (!other.i || other.removed) {
        relations[other.i] = "x";
        continue;
      }
      const relation = other.i === oldOwner.i ? "Enemy" : "Neutral";
      other.diplomacy ??= [];
      other.diplomacy[i] = relation;
      relations[other.i] = relation;
    }
    relations[i] = "x";

    pack.states.push({
      i,
      name: Names.getState(burg.name ?? Names.getCulture(culture), culture),
      diplomacy: relations,
      provinces: [],
      color: oldOwner.color ?? "#8a8a8a",
      expansionism: 0.5,
      capital: burg.i,
      type: "Generic",
      center: burg.cell,
      culture,
      rosterId: assignStateRoster({ culture, type: "Generic" }, pack.cultures),
      military: [],
      coa: oldOwner.coa ?? ({} as State["coa"]),
      salesTax: oldOwner.salesTax ?? 0,
      pollTax: oldOwner.pollTax ?? 0,
      treasury: 0
    });
    burg.capital = 1;
    return i;
  }

  /** Raise a rebel militia at the burg from the local culture's roster. */
  private raiseRebelRegiment(stateId: number, burg: Burg): Regiment | null {
    const state = pack.states[stateId];
    if (!state?.i || state.removed) return null;
    const roster = this.burgDefenderRoster(burg) ?? Military.getRoster(state);
    const unitTypes = Military.getUnitTypes();
    const unitId = roster?.recruitable.find(id => unitTypes[id]) ?? Object.keys(unitTypes)[0];
    const unit = unitId ? unitTypes[unitId] : undefined;
    if (!unit) return null;

    const tier = settlementTierFromPop(burg.population ?? 0);
    const count = Math.max(unit.men, Math.round(unit.men * (1 + tier * 0.5)));
    const regiment = this.createRegiment(state);
    regiment.name = `Rebels of ${burg.name ?? "the wilds"}`;
    this.moveArmy(regiment, burg);
    regiment.units = [{ type: unitId, count, exp: 0 }];
    syncRegimentTotals(regiment, unitTypes);
    return regiment;
  }

  private initialUnrest(stateId: number, burg: Burg): number {
    const tier = settlementTierFromPop(burg.population ?? 0);
    const rulerId = this.getState().states[stateId]?.rulerId;
    const alignment = pack.history?.figures?.find(figure => figure.i === rulerId)?.alignment;
    const cruelty = alignment === "evil" ? 4 : alignment === "chaotic" ? 2 : 0;
    return minmax(8 + tier + cruelty, 8, 16);
  }

  private bordersState(stateId: number, burg: Burg): boolean {
    return (pack.cells.c?.[burg.cell] ?? []).some(cell => pack.cells.state?.[cell] === stateId);
  }

  private isAtWar(stateId: number, otherId: number): boolean {
    return pack.states[stateId]?.diplomacy?.[otherId] === "Enemy";
  }

  private declareWar(stateId: number, otherId: number): void {
    const subject = pack.states[stateId];
    const object = pack.states[otherId];
    if (!subject?.i || subject.removed || !object?.i || object.removed) return;

    subject.diplomacy ??= [];
    object.diplomacy ??= [];
    subject.diplomacy[otherId] = "Enemy";
    object.diplomacy[stateId] = "Enemy";

    const text = `${subject.name} declared war on ${object.name}.`;
    this.pushNews(this.getState(), {
      kind: "war",
      text,
      cell: object.center,
      stateId,
      burgId: object.capital
    });
    this.pushHistory(
      "war",
      [
        { kind: "state", id: stateId },
        { kind: "state", id: otherId }
      ],
      object.center,
      text
    );
  }

  private logConquest(state: State, burg: Burg, forced: boolean): void {
    const text = forced
      ? `${state.name} stormed ${burg.name ?? "a settlement"} and annexed it.`
      : `${state.name} peacefully annexed ${burg.name ?? "a free settlement"}.`;
    this.pushNews(this.getState(), {
      kind: forced ? "conquest" : "colonize",
      text,
      cell: burg.cell,
      stateId: state.i,
      burgId: burg.i
    });
    this.pushHistory(
      "conquest",
      [
        { kind: "state", id: state.i },
        { kind: "burg", id: burg.i }
      ],
      burg.cell,
      text
    );
  }

  private recordClaim(stateId: number, burg: Burg, heldByStateId: number): void {
    const sSim = this.getState().states[stateId];
    if (!sSim || stateId === heldByStateId) return;
    sSim.claims = sSim.claims.filter(claim => claim.burgId !== burg.i);
    sSim.claims.push({
      provinceId: pack.cells.province?.[burg.cell] || undefined,
      burgId: burg.i,
      lostYear: options.map.lore.calendar.year,
      heldByStateId
    });
  }

  private removeClaim(stateId: number, burgId: number): void {
    const sSim = this.getState().states[stateId];
    if (sSim) sSim.claims = sSim.claims.filter(claim => claim.burgId !== burgId);
  }

  private recordGrudge(
    stateId: number,
    burg: Burg,
    reason: GrudgeReason,
    summary: string,
    againstStateId?: number
  ): void {
    const sSim = this.getState().states[stateId];
    if (!sSim) return;
    sSim.grudges.push({
      id: sSim.grudges.length,
      againstStateId,
      targetBurgId: burg.i,
      reason,
      year: options.map.lore.calendar.year,
      weight: GRUDGE_WEIGHTS[reason],
      summary
    });
  }

  private addBattleMarker(burgOrCell: Burg | number, label?: string): void {
    pack.markers ??= [];
    const markers = pack.markers;
    if (typeof burgOrCell === "number") {
      const [x, y] = pack.cells.p[burgOrCell] ?? [0, 0];
      markers.push({
        i: markers.length,
        type: "battlefields",
        icon: "⚔️",
        x,
        y,
        cell: burgOrCell,
        name: `Battle of ${label ?? "the wilds"}`
      });
    } else {
      markers.push({
        i: markers.length,
        type: "battlefields",
        icon: "⚔️",
        x: burgOrCell.x,
        y: burgOrCell.y,
        cell: burgOrCell.cell,
        name: `Battle of ${label ?? burgOrCell.name ?? "the wilds"}`
      });
    }

    // A clash can break open an ancient site: expose a relic cache on the map.
    const cell = typeof burgOrCell === "number" ? burgOrCell : burgOrCell.cell;
    const place = typeof burgOrCell === "number" ? (label ?? "the wilds") : (label ?? burgOrCell.name ?? "the wilds");
    this.queuePopup({
      kind: "relic_exposed",
      cell,
      title: `Relics exposed near ${place}`,
      subtitle: "A clash has broken open an ancient site",
      rewardGold: this.rng("relic:exposed", cell).int(15, 40),
      rewardRenown: 4
    });
  }

  private pushHistory(type: HistoryEventType, actors: HistRef[], cell: number | undefined, text: string): void {
    const history = Chronicle.sync();
    history.events ??= [];
    history.events.push({
      i: history.events.length,
      year: options.map.lore.calendar.year,
      type,
      actors,
      loc: cell,
      text
    });
  }

  /** Development cap for a province: floor(average biome habitability / growthPerHabitability). */
  provinceDevelopmentCap(provinceId: number): number {
    const cells = this.provinceCells(provinceId);
    if (cells.length === 0) return 0;

    let total = 0;
    for (const cell of cells) {
      const biomeId = pack.cells.biome?.[cell];
      total += (biomeId !== undefined ? pack.biomes?.[biomeId]?.habitability : undefined) ?? 50;
    }
    const perPoint = Math.max(1, currentContent().config.capacity.growthPerHabitability);
    return Math.floor(total / cells.length / perPoint);
  }

  private provinceCells(provinceId: number): number[] {
    const cells: number[] = [];
    const provinces = pack.cells.province;
    if (!provinces) return cells;
    for (let cell = 0; cell < provinces.length; cell++) {
      if (provinces[cell] === provinceId) cells.push(cell);
    }
    return cells;
  }

  private ownedProvinces(stateId: number): Province[] {
    return (pack.provinces ?? []).filter(province => province?.i && !province.removed && province.state === stateId);
  }

  private isProvinceGarrisoned(stateId: number, provinceId: number): boolean {
    const military = pack.states[stateId]?.military ?? [];
    return military.some(
      regiment =>
        regiment.a > 0 &&
        (pack.cells.province?.[regiment.cell] ?? 0) === provinceId &&
        (pack.cells.state?.[regiment.cell] ?? 0) === stateId
    );
  }

  private pickProvinceSettlement(provinceId: number, stateId: number): number | undefined {
    const province = pack.provinces?.[provinceId];
    const capital = province?.burg ? pack.burgs[province.burg] : undefined;
    if (capital && !capital.removed && capital.state === stateId) return capital.i;

    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      if ((pack.cells.province?.[burg.cell] ?? 0) === provinceId) return burg.i;
    }
    return undefined;
  }

  private freeCapacity(sSim: { capacity: CapacityLedger }): CapacityPoints {
    const out = { m: 0, w: 0, s: 0, c: 0 };
    for (const pool of ["m", "w", "s", "c"] as const) {
      out[pool] = sSim.capacity[pool].gen - sSim.capacity[pool].load;
    }
    return out;
  }

  private hasFreeCapacity(sSim: { capacity: CapacityLedger }, load?: CapacityPoints): boolean {
    if (!load) return true;
    const free = this.freeCapacity(sSim);
    for (const pool of ["m", "w", "s", "c"] as const) {
      if (free[pool] - (load[pool] ?? 0) < 0) return false;
    }
    return true;
  }

  private pickMusterUnit(state: State): { unit: UnitType; regiment: Regiment | null } | null {
    const roster = Military.getRoster(state);
    const unitTypes = Military.getUnitTypes();
    if (!roster) return null;

    const living = this.getState();
    const sSim = living.states[state.i];
    if (!sSim) return null;

    const { content, config } = currentContent();
    const maxUnits = config.military.maxUnitsPerArmy;
    const free = this.freeCapacity(sSim);
    const heldBuildings = this.heldBuildings(state.i);
    const unlockSources = new Map<string, string[]>();
    for (const building of content.buildings) {
      for (const unitId of building.effects.unlock ?? []) {
        const sources = unlockSources.get(unitId) ?? [];
        sources.push(building.id);
        unlockSources.set(unitId, sources);
      }
    }
    const heldGoods = this.heldGoods(state.i);
    const maxWalls = this.maxOwnedWallTier(state.i);

    for (const unitId of roster.recruitable) {
      const unit = unitTypes[unitId];
      if (!unit) continue;
      const sources = unlockSources.get(unitId);
      if (sources && !sources.some(id => heldBuildings.has(id))) continue;
      if (unit.requiresGood !== undefined && !heldGoods.has(unit.requiresGood)) continue;
      if (unit.requiresWallTier !== undefined && maxWalls < unit.requiresWallTier) continue;

      const cost = unit.capacityCost;
      if (cost) {
        let refused = false;
        for (const pool of ["m", "w", "s", "c"] as const) {
          if (free[pool] - (cost[pool] ?? 0) * unit.blocks < 0) {
            refused = true;
            break;
          }
        }
        if (refused) continue;
      }

      const regiment = this.findRegimentForUnit(state, unitId, maxUnits, roster.caps[unitId]);
      return { unit, regiment };
    }
    return null;
  }

  private findRegimentForUnit(state: State, unitId: string, maxUnits: number, cap?: number): Regiment | null {
    const unitTypes = Military.getUnitTypes();
    for (const regiment of state.military ?? []) {
      if (regiment.n) continue;
      if (!regiment.units) reconcileRegimentBlocks(regiment, unitTypes);
      const slots = regiment.units ?? [];
      if (slots.length >= maxUnits) continue;
      if (cap !== undefined && slots.filter(slot => slot.type === unitId).length >= cap) continue;
      return regiment;
    }
    return null;
  }

  private createRegiment(state: State): Regiment {
    state.military ??= [];
    const military = state.military;
    const i = military.length ? Math.max(...military.map(regiment => regiment.i)) + 1 : 0;
    const capital = state.capital ? pack.burgs[state.capital] : undefined;
    const cell = capital?.cell ?? state.center ?? 0;
    const point = pack.cells.p?.[cell];
    const x = point?.[0] ?? capital?.x ?? 0;
    const y = point?.[1] ?? capital?.y ?? 0;
    const regiment: Regiment = {
      i,
      name: `${state.name} Levy`,
      a: 0,
      cell,
      x,
      y,
      bx: x,
      by: y,
      u: {},
      units: [],
      n: 0,
      icon: "⚔️",
      state: state.i
    };
    military.push(regiment);
    return regiment;
  }

  private heldBuildings(stateId: number): Set<string> {
    const ids = new Set<string>();
    const living = pack.history?.living;
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      for (const id of living?.burgs[burg.i]?.buildings ?? []) ids.add(id);
    }
    return ids;
  }

  private heldGoods(stateId: number): Set<number> {
    const goods = new Set<number>();
    if (!pack.cells.good) return goods;
    const living = pack.history?.living;
    for (let cell = 0; cell < pack.cells.good.length; cell++) {
      if (pack.cells.state?.[cell] !== stateId) continue;
      const provId = pack.cells.province?.[cell] ?? 0;
      const pSim = provId ? living?.provinces?.[provId] : null;
      if (pSim?.trouble?.theme === "resource" || pSim?.lair?.theme === "resource") continue;
      const good = pack.cells.good[cell];
      if (good) goods.add(good);
    }
    return goods;
  }

  private maxOwnedWallTier(stateId: number): number {
    let best = 0;
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      best = Math.max(best, Number(burg.walls ?? 0));
    }
    return best;
  }

  private canBuild(state: State, burg: Burg, bSim: BurgSimState, building: BuildingDef): boolean {
    const { content, config } = currentContent();
    if (building.kind && building.kind !== "structure") return false;
    if (building.group && building.group !== state.rosterId) return false;

    const kind = burg.capital ? "major" : "minor";
    if (!building.settlementKinds.includes(kind)) return false;
    if (building.requires && !bSim.buildings.includes(building.requires)) return false;

    const sameChain = bSim.buildings
      .map(id => content.buildings.find(entry => entry.id === id))
      .filter(
        (entry): entry is BuildingDef =>
          entry !== undefined && (!entry.kind || entry.kind === "structure") && entry.chain === building.chain
      );
    if (sameChain.some(entry => entry.tier >= building.tier)) return false;

    const sSim = pack.history?.living?.states[state.i];
    if (!sSim) return false;
    if (!this.hasFreeCapacity(sSim, building.effects.upkeep)) return false;
    return this.freeCapacity(sSim).w >= config.capacity.constructionWPerTurn;
  }

  private pickBuildTarget(state: State): { burgId: number; buildingId: string } | null {
    const { content } = currentContent();
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== state.i) continue;
      const bSim = pack.history?.living?.burgs[burg.i];
      if (!bSim || bSim.construction) continue;
      for (const building of content.buildings) {
        if (this.canBuild(state, burg, bSim, building)) return { burgId: burg.i, buildingId: building.id };
      }
    }
    return null;
  }

  private hasDevelopment(living: LivingWorldState, stateId: number): boolean {
    return this.ownedProvinces(stateId).some(province => Boolean(living.provinces[province.i]?.developmentProgress));
  }

  private hasConstruction(living: LivingWorldState, stateId: number): boolean {
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      if (living.burgs[burg.i]?.construction) return true;
    }
    return false;
  }

  private pickDevelopProvince(stateId: number, sSim: StatePolitySim, living: LivingWorldState): number | undefined {
    const capacityConfig = currentContent().config.capacity;
    for (const province of this.ownedProvinces(stateId)) {
      const pSim = living.provinces[province.i];
      if (!pSim || pSim.developmentProgress) continue;
      if (pSim.stability < capacityConfig.developStabilityCost) continue;
      if (pSim.development >= this.provinceDevelopmentCap(province.i)) continue;
      if (!this.pickProvinceSettlement(province.i, stateId)) continue;
      if (this.freeCapacity(sSim).w < capacityConfig.developWPerTurn) continue;
      return province.i;
    }
    return undefined;
  }

  /** War options: press an ongoing war, calm a restive burg, retake a claim, absorb a free burg, or expand. */
  private warAgenda(state: State, sSim: StatePolitySim): StateAgenda | null {
    const army = this.fieldArmy(state);
    const bias = this.traitBias(state, sSim);
    const target = army ? this.pickWarTarget(state, army) : null;
    if (target) return this.conquerAgenda(target);

    const restive = this.mostRestiveBurg(state.i, false);
    if (restive && this.rng("agenda:pacify", state.i).chance(0.15 + bias.pious * 0.35 + bias.civic * 0.15)) {
      return {
        kind: "pacify",
        label: `Pacifying ${restive.name ?? "a burg"}`,
        targetBurgId: restive.i,
        progress: 0,
        required: 1
      };
    }

    const reclaim = army ? this.pickReclaimTarget(state, sSim, army) : null;
    if (reclaim && this.rng("agenda:reclaim", state.i).chance(0.45 + bias.martial * 0.3)) {
      return {
        kind: "reclaim",
        label: `Reclaiming ${reclaim.name ?? "a burg"}`,
        targetBurgId: reclaim.i,
        progress: 0,
        required: 1
      };
    }

    const free = this.pickFreeBurgTarget(state, army);
    if (free && this.rng("agenda:colonize", state.i).chance(0.25 + bias.civic * 0.3 + bias.pious * 0.1)) {
      return {
        kind: "colonize",
        label: `Colonizing ${free.name ?? "a free town"}`,
        targetBurgId: free.i,
        progress: 0,
        required: 1
      };
    }

    const neighbour = army ? this.pickConquerTarget(state, army) : null;
    if (neighbour && this.rng("agenda:conquer", state.i).chance(0.12 + bias.martial * 0.5)) {
      return this.conquerAgenda(neighbour);
    }
    return null;
  }

  private traitBias(state: State, sSim: StatePolitySim): FigureBias {
    const figure = pack.history?.figures?.find(entry => entry.i === sSim.rulerId);
    return figureBias(figure ?? {}, pack.cultures?.[state.culture ?? 0]?.values);
  }

  /** Grudges and claims against a state weigh its burgs up in target selection. */
  private casusBelli(stateId: number, otherId: number): number {
    const sSim = this.getState().states[stateId];
    if (!sSim || !otherId) return 0;
    const grudges = sSim.grudges
      .filter(grudge => grudge.againstStateId === otherId)
      .reduce((sum, grudge) => sum + grudge.weight, 0);
    const claims = sSim.claims.filter(claim => claim.heldByStateId === otherId).length * 20;
    return grudges + claims;
  }

  private conquerAgenda(burg: Burg): StateAgenda {
    return {
      kind: "conquer",
      label: `Attacking ${burg.name ?? "a burg"}`,
      targetBurgId: burg.i,
      targetStateId: burg.state,
      progress: 0,
      required: 1
    };
  }

  /** Best defended border burg of a state already at war. */
  private pickWarTarget(state: State, army: Regiment): Burg | null {
    return this.pickAssaultTarget(
      state,
      army,
      burg => this.isAtWar(state.i, burg.state ?? 0) && this.bordersState(state.i, burg),
      50,
      burg => this.casusBelli(state.i, burg.state ?? 0)
    );
  }

  /** Best border burg of a neighbour the state has not fought yet. */
  private pickConquerTarget(state: State, army: Regiment): Burg | null {
    return this.pickAssaultTarget(
      state,
      army,
      burg => !this.isAtWar(state.i, burg.state ?? 0) && this.bordersState(state.i, burg),
      50,
      burg => this.casusBelli(state.i, burg.state ?? 0)
    );
  }

  private pickAssaultTarget(
    state: State,
    army: Regiment,
    accept: (burg: Burg) => boolean,
    minOdds: number,
    score: (burg: Burg) => number = () => 0
  ): Burg | null {
    let best: Burg | null = null;
    let bestValue = 0;
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || !burg.state || burg.state === state.i || burg.capital) continue;
      if (!accept(burg)) continue;
      const odds = this.assaultOdds(state.i, burg, army);
      if (odds < minOdds) continue;
      const value = odds + score(burg);
      if (value <= bestValue) continue;
      best = burg;
      bestValue = value;
    }
    return best;
  }

  /** A burg on the state's claim list still held by its conqueror. */
  private pickReclaimTarget(state: State, sSim: StatePolitySim, army: Regiment): Burg | null {
    let best: Burg | null = null;
    let bestOdds = 0;
    for (const claim of sSim.claims) {
      const burg = pack.burgs[claim.burgId];
      if (!burg?.i || burg.removed || !burg.state || burg.state !== claim.heldByStateId) continue;
      if (burg.state === state.i) continue;
      const odds = this.assaultOdds(state.i, burg, army);
      if (odds < 45 || odds <= bestOdds) continue;
      best = burg;
      bestOdds = odds;
    }
    return best;
  }

  /** Adjacent Free Burg: kin or co-religionists always, strangers only if the army can win. */
  private pickFreeBurgTarget(state: State, army: Regiment | null): Burg | null {
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== 0) continue;
      if (!this.bordersState(state.i, burg)) continue;
      if (this.sharesKinshipOrFaith(state.i, burg.i)) return burg;
      if (army && this.assaultOdds(state.i, burg, army) >= 50) return burg;
    }
    return null;
  }

  private chooseAgenda(state: State, sSim: StatePolitySim, living: LivingWorldState): StateAgenda | null {
    const capacityConfig = currentContent().config.capacity;
    const hasFieldArmy = this.fieldArmy(state) !== null;
    if (!hasFieldArmy && this.pickMusterUnit(state)) {
      return { kind: "muster", label: "Mustering troops", progress: 0, required: 1 };
    }

    const lairProvince = this.ownedProvinces(state.i)
      .map(p => ({ province: p, lair: living.provinces[p.i]?.lair }))
      .filter((entry): entry is { province: Province; lair: ProvinceLair } => Boolean(entry.lair))
      .sort((a, b) => b.lair.level - a.lair.level)[0];

    if (lairProvince) {
      const army = this.fieldArmy(state);
      const armyMen = army ? (army.units ?? []).reduce((s, u) => s + u.count, 0) : 0;
      const defMen = lairProvince.lair.defenders.reduce((s, u) => s + u.count, 0);
      if (army && (armyMen >= defMen * 0.85 || sSim.warExhaustion < 40)) {
        return {
          kind: "clear_lair",
          label: `Marching against ${lairProvince.lair.name} in ${lairProvince.province.name}`,
          targetProvinceId: lairProvince.province.i,
          progress: 0,
          required: 1
        };
      }
      if (sSim.capacity.w.gen >= sSim.capacity.w.load || sSim.capacity.c.gen >= 4) {
        return {
          kind: "hire_adventurers",
          label: `Hiring adventurers against ${lairProvince.lair.name} in ${lairProvince.province.name}`,
          targetProvinceId: lairProvince.province.i,
          progress: 0,
          required: 1
        };
      }
    }

    const troubledProvince = this.ownedProvinces(state.i)
      .map(p => ({ province: p, trouble: living.provinces[p.i]?.trouble }))
      .filter((entry): entry is { province: Province; trouble: ProvinceTrouble } => Boolean(entry.trouble))
      .sort((a, b) => b.trouble.level - a.trouble.level)[0];

    if (troubledProvince) {
      const tDef = getTroubleDef(troubledProvince.trouble.id);
      return {
        kind: "resolve_trouble",
        label: `Resolving ${tDef.name} in ${troubledProvince.province.name}`,
        targetProvinceId: troubledProvince.province.i,
        progress: 0,
        required: 1
      };
    }

    const war = this.warAgenda(state, sSim);
    if (war) return war;

    const provinceId = this.pickDevelopProvince(state.i, sSim, living);
    if (provinceId !== undefined) {
      const province = pack.provinces?.[provinceId];
      return {
        kind: "develop",
        label: `Developing ${province?.name ?? "a province"}`,
        targetProvinceId: provinceId,
        progress: 0,
        required: capacityConfig.developTurns
      };
    }

    const build = this.pickBuildTarget(state);
    if (build) {
      const building = currentContent().content.buildings.find(entry => entry.id === build.buildingId);
      return {
        kind: "build",
        label: `Building ${building?.name ?? build.buildingId}`,
        targetBurgId: build.burgId,
        buildingId: build.buildingId,
        progress: 0,
        required: 3
      };
    }

    if (this.pickMusterUnit(state)) {
      return { kind: "muster", label: "Mustering troops", progress: 0, required: 1 };
    }
    return null;
  }

  private stepAgenda(state: State, sSim: StatePolitySim, living: LivingWorldState): void {
    const agenda = sSim.agenda;
    if (!agenda) return;

    switch (agenda.kind) {
      case "clear_lair": {
        const provinceId = agenda.targetProvinceId;
        if (provinceId === undefined) {
          sSim.agenda = null;
          return;
        }
        const pSim = living.provinces[provinceId];
        if (!pSim?.lair) {
          sSim.agenda = null;
          return;
        }
        this.assaultLair(state.i, provinceId);
        agenda.progress += 1;
        if (agenda.progress >= agenda.required || !pSim.lair) {
          sSim.agenda = null;
        }
        return;
      }
      case "hire_adventurers": {
        const provinceId = agenda.targetProvinceId;
        if (provinceId === undefined) {
          sSim.agenda = null;
          return;
        }
        const pSim = living.provinces[provinceId];
        if (!pSim?.lair) {
          sSim.agenda = null;
          return;
        }
        this.sendAdventurersToLair(state.i, provinceId);
        agenda.progress += 1;
        if (agenda.progress >= agenda.required || !pSim.lair) {
          sSim.agenda = null;
        }
        return;
      }
      case "resolve_trouble": {
        const provinceId = agenda.targetProvinceId;
        if (provinceId === undefined) {
          sSim.agenda = null;
          return;
        }
        const pSim = living.provinces[provinceId];
        if (!pSim?.trouble) {
          sSim.agenda = null;
          return;
        }
        this.resolveTrouble(state.i, provinceId);
        agenda.progress += 1;
        if (agenda.progress >= agenda.required || !pSim.trouble) {
          sSim.agenda = null;
        }
        return;
      }
      case "develop": {
        if (this.hasDevelopment(living, state.i)) return;
        const provinceId = agenda.targetProvinceId ?? this.pickDevelopProvince(state.i, sSim, living);
        if (provinceId === undefined || !this.startDevelop(state.i, provinceId)) sSim.agenda = null;
        return;
      }
      case "build": {
        if (this.hasConstruction(living, state.i)) return;
        const target =
          agenda.targetBurgId !== undefined && agenda.buildingId
            ? { burgId: agenda.targetBurgId, buildingId: agenda.buildingId }
            : this.pickBuildTarget(state);
        if (!target || !this.startBuild(state.i, target.burgId, target.buildingId)) sSim.agenda = null;
        return;
      }
      case "muster": {
        if (this.muster(state.i)) agenda.progress = Math.min(agenda.required, agenda.progress + 1);
        if (agenda.progress >= agenda.required) sSim.agenda = null;
        return;
      }
      case "colonize": {
        if (agenda.targetBurgId !== undefined) this.colonize(state.i, agenda.targetBurgId);
        sSim.agenda = null;
        return;
      }
      case "conquer": {
        if (agenda.targetBurgId !== undefined) this.conquerBurg(state.i, agenda.targetBurgId);
        sSim.agenda = null;
        return;
      }
      case "reclaim": {
        if (agenda.targetBurgId !== undefined) this.reclaimBurg(state.i, agenda.targetBurgId);
        sSim.agenda = null;
        return;
      }
      case "pacify": {
        const burg = agenda.targetBurgId !== undefined ? pack.burgs[agenda.targetBurgId] : undefined;
        const unrest = burg ? (living.burgs[burg.i]?.unrest ?? 0) : 0;
        if (!burg || burg.removed || burg.state !== state.i || unrest <= 0) sSim.agenda = null;
        return;
      }
      default:
        sSim.agenda = null;
    }
  }

  private advanceDevelopment(state: State, sSim: StatePolitySim, living: LivingWorldState): void {
    for (const province of this.ownedProvinces(state.i)) {
      const pSim = living.provinces[province.i];
      const progress = pSim?.developmentProgress;
      if (!pSim || !progress) continue;

      progress.turnsLeft = Math.max(0, progress.turnsLeft - 1);
      if (sSim.agenda?.kind === "develop" && sSim.agenda.targetProvinceId === province.i) {
        sSim.agenda.progress = Math.min(sSim.agenda.required, sSim.agenda.required - progress.turnsLeft);
      }
      if (progress.turnsLeft > 0) continue;

      pSim.development += 1;
      const burg = pack.burgs[progress.settlementId];
      if (burg && !burg.removed) {
        const growth = this.rng("develop:growth", burg.i).range(0.05, 0.15);
        burg.population = Math.round((burg.population ?? 0) * (1 + growth) * 100) / 100;
        const bSim = living.burgs[burg.i];
        if (bSim) bSim.baseTier = settlementTierFromPop(burg.population);
      }
      pSim.developmentProgress = null;
      if (sSim.agenda?.kind === "develop" && sSim.agenda.targetProvinceId === province.i) {
        sSim.agenda = null;
      }

      this.pushNews(living, {
        kind: "develop",
        text: `${state.name} completed development in ${province.name ?? "a province"}${
          burg?.name ? ` (${burg.name})` : ""
        }.`,
        cell: burg?.cell,
        stateId: state.i,
        burgId: burg?.i
      });
    }
  }

  private advanceConstructions(state: State, sSim: StatePolitySim, living: LivingWorldState): void {
    const { content } = currentContent();
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== state.i) continue;
      const bSim = living.burgs[burg.i];
      const construction = bSim?.construction;
      if (!bSim || !construction) continue;

      const building = content.buildings.find(entry => entry.id === construction.buildingId);
      if (!building) {
        bSim.construction = null;
        continue;
      }

      construction.turnsLeft = Math.max(0, construction.turnsLeft - 1);
      const checks = construction.checks;
      // One value check per season: pass the next unfinished pool.
      const pool = (["m", "w", "s"] as const).find(entry => !checks[entry]);
      if (pool) {
        const dcs = assetCheckDifficulties(building, construction.pityBonus);
        const modifier = valueModifier(sSim.capacity[pool].gen);
        const roll = this.rng(
          "build-check",
          state.i * 10000 + burg.i * 10 + (pool === "m" ? 1 : pool === "w" ? 2 : 3)
        ).d(20);

        if (roll + modifier >= dcs[pool]) {
          checks[pool] = true;
          if (sSim.agenda?.kind === "build" && sSim.agenda.targetBurgId === burg.i) {
            sSim.agenda.progress = Math.min(sSim.agenda.required, sSim.agenda.progress + 1);
          }
        } else {
          construction.pityBonus += 1;
        }
      }

      // Building time is a floor: all three saves and the advertised turns must pass.
      if (checks.m && checks.w && checks.s && construction.turnsLeft === 0) {
        this.completeConstruction(state, sSim, living, burg, bSim, building);
      }
    }
  }

  private completeConstruction(
    state: State,
    sSim: StatePolitySim,
    living: LivingWorldState,
    burg: Burg,
    bSim: BurgSimState,
    building: BuildingDef
  ): void {
    const { content } = currentContent();
    bSim.buildings = bSim.buildings.filter(id => {
      const other = content.buildings.find(entry => entry.id === id);
      if (!other || other.kind === "custom") return true;
      return other.chain !== building.chain || other.tier > building.tier;
    });
    bSim.buildings.push(building.id);
    syncBurgFlagsFromBuildings(burg, bSim.buildings);
    bSim.construction = null;

    if (sSim.agenda?.kind === "build" && sSim.agenda.targetBurgId === burg.i) sSim.agenda = null;

    this.pushNews(living, {
      kind: "build",
      text: `${state.name} completed ${building.name} in ${burg.name ?? "a settlement"}.`,
      cell: burg.cell,
      stateId: state.i,
      burgId: burg.i
    });
  }

  /** Step province order, stability, and trouble progression. */
  private stepProvinces(living: LivingWorldState): void {
    const { config } = currentContent();
    const unrestByProvince = new Map<number, number>();
    for (const key of Object.keys(living.burgs)) {
      const bSim = living.burgs[Number(key)];
      if (!bSim || bSim.unrest <= 0) continue;
      const burg = pack.burgs[bSim.burgId];
      if (!burg?.i || burg.removed || !burg.state) continue;
      const provinceId = pack.cells.province?.[burg.cell] ?? 0;
      if (!provinceId) continue;
      unrestByProvince.set(provinceId, (unrestByProvince.get(provinceId) ?? 0) + bSim.unrest);
    }

    for (const province of pack.provinces ?? []) {
      if (!province?.i || province.removed) continue;
      const pSim = living.provinces[province.i];
      if (!pSim || !province.state || pack.states[province.state]?.removed) continue;
      const sSim = living.states[province.state];

      if (pSim.trouble) {
        pSim.trouble.seasonsUnchecked = (pSim.trouble.seasonsUnchecked ?? 0) + 1;
        if (pSim.trouble.seasonsUnchecked % 2 === 0) {
          pSim.trouble.level = Math.min(10, pSim.trouble.level + 1);
        }
        if (pSim.trouble.level >= 8 && pSim.trouble.seasonsUnchecked >= 4) {
          if (sSim) sSim.unravel = minmax(sSim.unravel + 3, 0, 100);
          if (pSim.developmentProgress) pSim.developmentProgress = null;
        }

        const unchecked = pSim.trouble.seasonsUnchecked;
        const lvl = pSim.trouble.level;
        if (unchecked >= 3 || lvl >= 5) {
          const metaChance = lvl >= 10 ? 1 : Math.max(0, (unchecked - 2) * 0.06 + Math.max(0, lvl - 4) * 0.04);
          const rngMeta = this.rng("trouble:metastasize", province.i, living.tick);
          if (rngMeta.chance(metaChance)) {
            const canCoup =
              isTroubleStatePromotable(pSim.trouble.id) &&
              (lvl >= 7 || unchecked >= 5) &&
              (pSim.order <= 25 || (sSim ? sSim.unravel >= 60 || sSim.warExhaustion >= 60 : false));
            if (canCoup && this.promoteTroubleToState(province.i) !== null) {
              continue;
            }
            this.metastasizeTroubleToLair(province.i);
          }
        }
      }

      if (pSim.lair) {
        pSim.lair.seasonsActive = (pSim.lair.seasonsActive ?? 0) + 1;
        if (sSim) sSim.unravel = minmax(sSim.unravel + 2, 0, 100);
        if (pSim.lair.level >= 8 && pSim.developmentProgress) pSim.developmentProgress = null;
      }

      if (this.isProvinceGarrisoned(province.state, province.i)) {
        if (!pSim.trouble && !pSim.lair) pSim.stability += config.capacity.stabilityPerGarrison;
        pSim.order = Math.min(100, pSim.order + 2);
      } else if (pSim.order < config.economy.startOrder) {
        pSim.order = Math.min(config.economy.startOrder, pSim.order + 1);
      } else {
        pSim.order = Math.max(config.economy.startOrder, pSim.order - 1);
      }

      const unrest = unrestByProvince.get(province.i) ?? 0;
      if (unrest > 0) pSim.order = Math.max(0, pSim.order - Math.round((15 * unrest) / 12));
      if (pSim.trouble) {
        pSim.order = Math.max(0, pSim.order - pSim.trouble.level * 2);
      }
      if (pSim.lair) {
        pSim.order = Math.max(0, pSim.order - pSim.lair.level * 2);
      }
      pSim.order = minmax(pSim.order, 0, 100);

      // Seasonal trouble spawning
      if (!pSim.trouble && !pSim.lair) {
        const rng = this.rng("trouble:spawn", province.i, living.tick);
        let spawnChance = 0.12;
        if (pSim.order < 50) spawnChance += 0.08;
        if (pSim.order < 25) spawnChance += 0.05;
        if (sSim && sSim.unravel > 50) spawnChance += 0.05;
        if (this.isProvinceGarrisoned(province.state, province.i)) spawnChance -= 0.05;
        spawnChance = minmax(spawnChance, 0.03, 0.4);

        if (rng.chance(spawnChance)) {
          this.spawnTrouble(province.i);
        }
      }
    }
  }

  /** Step seasonal raids and lair activity. */
  private stepLairs(living: LivingWorldState): void {
    for (const province of pack.provinces ?? []) {
      if (!province?.i || province.removed) continue;
      const pSim = living.provinces[province.i];
      const lair = pSim?.lair;
      if (!lair) continue;

      this.tickLairRaid(province, pSim, lair, living);
      if (!pSim.lair) continue;

      // Path B: Entrenched wilderness sovereignty
      if (isLairStateCapable(lair.id) && lair.seasonsActive >= 8 && lair.level >= 8) {
        const sSim = province.state ? living.states[province.state] : undefined;
        const localBurgs = pack.burgs.filter(b => b?.i && !b.removed && pack.cells.province?.[b.cell] === province.i);
        const noBurgs = localBurgs.length === 0;
        const collapsedOrder = pSim.order <= 15;
        const stateInTurmoil = Boolean(sSim && (sSim.unravel >= 50 || sSim.warExhaustion >= 50));
        if (noBurgs || collapsedOrder || stateInTurmoil) {
          const nonCapBurg = collapsedOrder ? localBurgs.find(b => !b.capital) : undefined;
          this.ascendLairToState(province.i, nonCapBurg?.i);
        }
      }
    }
  }

  private tickLairRaid(province: Province, pSim: ProvinceSimState, lair: ProvinceLair, living: LivingWorldState): void {
    const rng = this.rng("lair:raid", province.i, living.tick);
    const shouldRaid = lair.raidPending || rng.d(6) >= lair.raidThreshold;
    if (!shouldRaid) return;

    // 1. Identify target burgs
    const localBurgs = pack.burgs.filter(b => b?.i && !b.removed && pack.cells.province?.[b.cell] === province.i);
    let targetBurgs = localBurgs;
    if (targetBurgs.length === 0) {
      const [lx, ly] = pack.cells.p[lair.cell] ?? [0, 0];
      const withDist = pack.burgs
        .filter(b => b?.i && !b.removed)
        .map(b => ({ burg: b, dist: Math.hypot(b.x - lx, b.y - ly) }))
        .sort((a, b) => a.dist - b.dist);
      targetBurgs = withDist.slice(0, 3).map(d => d.burg);
    }
    if (targetBurgs.length === 0) return;

    // 2. Filter for plausible targets (skip fortresses that are overwhelmingly defended)
    const raidMen = lair.raidUnits.reduce((sum, u) => sum + u.count, 0);
    const plausible = targetBurgs.filter(b => {
      const defenders = this.burgDefenders(b);
      const defMen = defenders.reduce((sum, u) => sum + u.count, 0);
      const walls = Number(b.walls ?? 0);
      if (walls >= 2 && defMen > raidMen * 1.5) return false;
      if (defMen > raidMen * 2.5) return false;
      return true;
    });

    if (plausible.length === 0) {
      lair.raidPending = true;
      return;
    }

    // Sort by easiest target (lowest walls, fewest defenders)
    plausible.sort((a, b) => {
      const wA = Number(a.walls ?? 0);
      const wB = Number(b.walls ?? 0);
      if (wA !== wB) return wA - wB;
      const menA = this.burgDefenders(a).reduce((sum, u) => sum + u.count, 0);
      const menB = this.burgDefenders(b).reduce((sum, u) => sum + u.count, 0);
      return menA - menB;
    });
    const target = plausible[0]!;

    lair.raidPending = false;

    // 3. Resolve raid combat
    const { config } = currentContent();
    const raidUnits = lair.raidUnits.map(u => ({ ...u }));
    const defenders = this.burgDefenders(target);
    const ownerState = pack.states[target.state ?? 0];
    const stationedReg = (ownerState?.military ?? []).find(r => r.cell === target.cell && r.a > 0);
    if (stationedReg?.units) {
      for (const u of stationedReg.units) {
        if (u.count > 0) defenders.push({ ...u });
      }
    }

    const session = initBattleSession({
      config,
      unitTypes: Military.getUnitTypes(),
      attacker: { factionId: 0, armyId: null, units: raidUnits },
      defender: { factionId: target.state ?? 0, armyId: null, units: defenders },
      cell: target.cell,
      regionId: pack.cells.province?.[target.cell] ?? province.i,
      assault: Number(target.walls ?? 0) > 0,
      modifiers: this.assaultModifiers(target)
    });
    while (session.status === "active" && session.round < config.battle.maxRounds) {
      stepBattleRound(session, rng.next);
    }
    const outcome = finalizeBattle(session, rng.next);

    this.addBattleMarker(target);

    if (stationedReg && ownerState) {
      this.applyArmySurvivors(ownerState, stationedReg, outcome.defender.units);
    }

    if (outcome.winner === "defender") {
      pSim.order = Math.min(100, pSim.order + 3);
      this.pushNews(living, {
        kind: "lair",
        text: `${target.name} garrison repulsed raiders from ${lair.name}!`,
        cell: target.cell,
        stateId: target.state ?? 0,
        burgId: target.i
      });
      return;
    }

    // Path A: Opportunistic raid coup when a state-capable lair overwhelms a vulnerable non-capital settlement
    const bSim = living.burgs[target.i];
    if (
      isLairStateCapable(lair.id) &&
      (lair.level >= 7 || lair.seasonsActive >= 6) &&
      !target.capital &&
      (pSim.order <= 20 || Number(target.walls ?? 0) === 0 || (bSim?.buildings.length ?? 0) === 0)
    ) {
      lair.raidUnits = outcome.attacker.units.filter(u => u.count > 0).map(u => ({ ...u }));
      if (this.ascendLairToState(province.i, target.i) !== null) {
        return;
      }
    }

    // Raiders win: destroy 1 asset or pillage development & unrest
    if (bSim?.buildings && bSim.buildings.length > 0) {
      let destroyIndex = bSim.buildings.findIndex(bid => !bid.startsWith("walls"));
      if (destroyIndex === -1) destroyIndex = bSim.buildings.length - 1;
      const destroyed = bSim.buildings.splice(destroyIndex, 1)[0]!;
      syncBurgFlagsFromBuildings(target, bSim.buildings);
      const bDef = currentContent().content.buildings.find(b => b.id === destroyed);
      const bName = bDef?.name ?? destroyed;
      pSim.order = Math.max(0, pSim.order - 6);
      if (target.state && living.states[target.state]) {
        living.states[target.state].capacity = this.recomputeStateCapacity(target.state);
      }
      this.pushNews(living, {
        kind: "lair",
        text: `Raiders from ${lair.name} sacked ${target.name} and destroyed its ${bName}!`,
        cell: target.cell,
        stateId: target.state ?? 0,
        burgId: target.i
      });
      this.pushHistory(
        "sack",
        [
          { kind: "burg", id: target.i },
          { kind: "state", id: target.state ?? 0 }
        ],
        target.cell,
        `Raiders from ${lair.name} sacked ${target.name} and tore down its ${bName}.`
      );
    } else {
      if (bSim) {
        bSim.development = Math.max(0, bSim.development - 1);
        bSim.unrest = Math.min(10, bSim.unrest + 2);
      }
      pSim.development = Math.max(0, pSim.development - 1);
      pSim.order = Math.max(0, pSim.order - 10);
      if (target.state && living.states[target.state]) {
        living.states[target.state].capacity = this.recomputeStateCapacity(target.state);
      }
      this.pushNews(living, {
        kind: "lair",
        text: `Raiders from ${lair.name} pillaged ${target.name}, leaving ruin in their wake.`,
        cell: target.cell,
        stateId: target.state ?? 0,
        burgId: target.i
      });
      this.pushHistory(
        "sack",
        [
          { kind: "burg", id: target.i },
          { kind: "state", id: target.state ?? 0 }
        ],
        target.cell,
        `Raiders from ${lair.name} plundered ${target.name} and terrorized the populace.`
      );
    }
    this.escalateLair(province, lair, living);
  }

  /** A successful raid grows the lair: higher level, more defenders, refreshed marker and owner load. */
  private escalateLair(province: Province, lair: ProvinceLair, living: LivingWorldState): void {
    if (!growLair(lair, Military.getUnitTypes())) return;
    const marker = lair.markerId !== undefined ? pack.markers?.[lair.markerId] : undefined;
    if (marker) marker.name = `${lair.name} (Lair Lvl ${lair.level})`;
    if (province.state && living.states[province.state]) {
      living.states[province.state].capacity = this.recomputeStateCapacity(province.state);
    }
    this.pushNews(living, {
      kind: "lair",
      text: `${lair.name} in ${province.name} grew bolder after its raid (level ${lair.level}).`,
      cell: lair.cell,
      stateId: province.state
    });
  }

  /** Step each active state's projects and seasonal agenda. */
  private stepStates(living: LivingWorldState): void {
    for (const state of pack.states) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states[state.i];
      if (!sSim) continue;

      for (const regiment of state.military ?? []) {
        for (const unit of regiment.units ?? []) {
          if ((unit.disruption ?? 0) > 0) {
            const regProvId = pack.cells.province?.[regiment.cell] ?? 0;
            const provSim = regProvId ? living.provinces?.[regProvId] : null;
            if (!provSim?.trouble && !provSim?.lair) {
              unit.disruption = Math.max(0, unit.disruption! - 1);
            }
          }
        }
      }

      this.advanceDevelopment(state, sSim, living);
      this.advanceConstructions(state, sSim, living);

      if (!sSim.agenda) sSim.agenda = this.chooseAgenda(state, sSim, living);
      if (!sSim.agenda) continue;
      this.stepAgenda(state, sSim, living);
    }
  }
}

declare global {
  var Living: LivingModel;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Living = new LivingModel();
window.Living = Living;

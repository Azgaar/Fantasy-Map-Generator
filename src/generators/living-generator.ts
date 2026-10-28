// Living World seasonal simulation engine. See docs/plans/living-world.md
import { currentContent } from "@/conquest/content/store";
import { assignStateRoster, type BuildingDef, MEN_PER_BLOCK, type UnitType } from "@/conquest/engine/common/content";
import { REGION_TIER_STEPS, SETTLEMENT_TIER_STEPS } from "@/conquest/engine/compiler";
import { rollAlignment, rollFigureTraits, traitsRng } from "@/data/culture-traits";
import type { HistoricalFigure } from "@/types/history";
import {
  type CapacityLedger,
  type LivingNewsItem,
  type LivingNewsKind,
  type LivingWorldState,
  SEASON_NAMES,
  type SeasonId
} from "@/types/living";
import { minmax } from "@/utils";
import { createRng, type Rng } from "@/utils/rng";
import type { Burg } from "./burgs-generator";
import { Chronicle } from "./history-generator";
import { Military, reconcileRegimentBlocks } from "./military-generator";
import { Names } from "./names-generator";
import type { State } from "./states-generator";

const MAX_RECENT_NEWS = 50;

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
      burgs: {},
      recentNews: []
    };

    if (opts?.seed !== undefined) history.living.seed = String(opts.seed);
    if (opts?.snapshotIntervalYears !== undefined) {
      history.living.snapshotIntervalYears = opts.snapshotIntervalYears;
    }

    this.syncWorld();
    return history.living;
  }

  /** Return the active LivingWorldState, initializing it lazily if needed */
  getState(): LivingWorldState {
    return pack.history?.living ?? this.init();
  }

  /** Deterministic PRNG for a given tick and domain tag */
  rng(tag: string, id = 0): Rng {
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

      if (living.season === 0) {
        options.map.lore.calendar.year += 1;
        const currentEra = pack.history?.eras?.at(-1);
        if (currentEra) currentEra.to = options.map.lore.calendar.year;
      }

      this.syncWorld();
      this.stepBurgUnrest(living);
      this.stepStates(living);
      this.recomputeAllCapacities(living);
    }

    return living;
  }

  /** Synchronize `living.burgs` and `living.states` with the live `pack` */
  syncWorld(): void {
    const history = Chronicle.sync();
    const living = history.living;
    if (!living) return;

    this.syncBurgs(living);
    this.syncStates(living);
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
    const { content } = currentContent();
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

    // Capital court grants +2 C
    if (state.capital && pack.burgs[state.capital]?.state === stateId) {
      ledger.c.gen += 2;
    }

    // 2. Burgs: earned development, standing buildings, and occupation unrest
    let freeGarrisonWaiver = 0;
    for (const burg of pack.burgs) {
      if (!burg?.i || burg.removed || burg.state !== stateId) continue;
      const bSim = living?.burgs[burg.i];
      if (!bSim) continue;

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

  private ensureStateRuler(state: State, living: LivingWorldState): number {
    const history = Chronicle.sync();
    history.figures ??= [];

    // Check if there is already a living ruler for this state
    const active = history.figures.find(
      fig =>
        fig.death === undefined &&
        fig.roles.some(
          role =>
            role.type === "ruler" && role.to === undefined && role.target.kind === "state" && role.target.id === state.i
        )
    );
    if (active) return active.i;

    const year = options.map?.lore?.calendar?.year ?? 1000;
    const figIndex = history.figures.length;
    const rng = traitsRng(living.seed, "figure", figIndex + state.i * 1000);
    const age = rng.int(20, 50);
    const reignYears = Math.min(age - 16, rng.int(1, 12));
    const accession = year - reignYears;

    const cultureId = state.culture ?? 0;
    const alignment = rollAlignment(rng, pack.cultures[cultureId]?.alignment);
    const { virtues, vices } = rollFigureTraits(rng, alignment);

    const figure: HistoricalFigure = {
      i: figIndex,
      name: Names.getCulture(cultureId),
      culture: cultureId,
      birth: year - age,
      roles: [{ type: "ruler", target: { kind: "state", id: state.i }, from: accession }],
      alignment,
      virtues,
      vices
    };
    history.figures.push(figure);
    return figure.i;
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
      if (!bSim || bSim.unrest <= 0) continue;

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

      restiveCountByState.set(burg.state, (restiveCountByState.get(burg.state) ?? 0) + 1);

      let decay = 1;
      const isGarrisoned = (ownerState.military ?? []).some(reg => reg.cell === burg.cell && reg.a > 0);
      if (isGarrisoned) decay += 1;
      if (bSim.buildings.some(id => id.startsWith("temple"))) decay += 1;

      bSim.unrest = Math.max(0, bSim.unrest - decay);
    }

    // Apply seasonal unravel clock changes from unrest & stability balance
    for (const key of Object.keys(living.states)) {
      const sSim = living.states[Number(key)];
      if (!sSim) continue;

      const restiveCount = restiveCountByState.get(sSim.stateId) ?? 0;
      const sDeficit = sSim.capacity.s.load > sSim.capacity.s.gen;

      let delta = 0;
      if (restiveCount > 0) delta += restiveCount * 3;
      if (sDeficit) delta += 4;
      if (restiveCount === 0 && !sDeficit && sSim.unravel > 0) delta -= 2;

      sSim.unravel = minmax(sSim.unravel + delta, 0, 100);
    }
  }

  /** Step each active state's seasonal agenda clock */
  private stepStates(living: LivingWorldState): void {
    for (const state of pack.states) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states[state.i];
      if (!sSim) continue;

      if (sSim.agenda) {
        sSim.agenda.progress = Math.min(sSim.agenda.required, sSim.agenda.progress + 1);
      }
    }
  }
}

declare global {
  var Living: LivingModel;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Living = new LivingModel();
window.Living = Living;

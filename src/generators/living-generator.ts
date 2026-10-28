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
import { rollAlignment, rollFigureTraits, traitsRng } from "@/data/culture-traits";
import type { HistoricalFigure, HistoryEventType, HistRef } from "@/types/history";
import {
  type BurgSimState,
  type CapacityLedger,
  type GrudgeReason,
  type LivingNewsItem,
  type LivingNewsKind,
  type LivingWorldState,
  SEASON_NAMES,
  type SeasonId,
  type StateAgenda,
  type StatePolitySim
} from "@/types/living";
import { minmax } from "@/utils";
import { createRng, type Rng } from "@/utils/rng";
import type { Burg } from "./burgs-generator";
import { Chronicle } from "./history-generator";
import { Military, type Regiment, reconcileRegimentBlocks, syncRegimentTotals } from "./military-generator";
import { Names } from "./names-generator";
import type { Province } from "./provinces-generator";
import { type State, States } from "./states-generator";

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
        this.stepRulers(living);
        this.stepGrudges(living);
        this.captureSnapshot(living);
      }

      this.syncWorld();
      this.stepBurgUnrest(living);
      this.stepProvinces(living);
      this.stepStates(living);
      this.stepRebellions(living);
      this.recomputeAllCapacities(living);
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
    }

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
          developmentProgress: null
        };
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

      const agenda = living.states[ownerState.i]?.agenda;
      const pacifying = agenda?.kind === "pacify" && agenda.targetBurgId === burg.i;

      let decay = 1;
      const isGarrisoned = (ownerState.military ?? []).some(reg => reg.cell === burg.cell && reg.a > 0);
      if (isGarrisoned) decay += 1;
      if (bSim.buildings.some(id => id.startsWith("temple"))) decay += 1;
      if (pacifying) decay += 2;

      bSim.unrest = Math.max(0, bSim.unrest - decay);
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
    const bSim = this.getState().burgs[burg.i];
    if (bSim) bSim.originalOwner ??= burg.state ?? 0;

    const cells = this.burgHinterland(burg);
    this.transferCells(stateId, cells);
    burg.state = stateId;
    this.assignProvince(stateId, cells);

    if (!bSim) return;
    bSim.originalCulture ??= burg.culture;
    bSim.originalReligion ??= pack.cells.religion?.[burg.cell] ?? 0;
    bSim.conqueredBy = restless ? stateId : undefined;
    bSim.unrest = restless ? this.initialUnrest(stateId, burg) : 0;
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

  private addBattleMarker(burg: Burg): void {
    pack.markers ??= [];
    const markers = pack.markers;
    markers.push({
      i: markers.length,
      type: "battlefields",
      icon: "⚔️",
      x: burg.x,
      y: burg.y,
      cell: burg.cell,
      name: `Battle of ${burg.name ?? "the wilds"}`
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
    for (let cell = 0; cell < pack.cells.good.length; cell++) {
      if (pack.cells.state?.[cell] !== stateId) continue;
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

  /** Step province order and stability. */
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

      if (this.isProvinceGarrisoned(province.state, province.i)) {
        pSim.stability += config.capacity.stabilityPerGarrison;
        pSim.order = Math.min(100, pSim.order + 2);
      } else if (pSim.order < config.economy.startOrder) {
        pSim.order = Math.min(config.economy.startOrder, pSim.order + 1);
      } else {
        pSim.order = Math.max(config.economy.startOrder, pSim.order - 1);
      }

      const unrest = unrestByProvince.get(province.i) ?? 0;
      if (unrest > 0) pSim.order = Math.max(0, pSim.order - Math.round((15 * unrest) / 12));
      pSim.order = minmax(pSim.order, 0, 100);
    }
  }

  /** Step each active state's projects and seasonal agenda. */
  private stepStates(living: LivingWorldState): void {
    for (const state of pack.states) {
      if (!state?.i || state.removed) continue;
      const sSim = living.states[state.i];
      if (!sSim) continue;

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

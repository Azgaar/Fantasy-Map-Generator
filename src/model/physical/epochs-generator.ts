// Layered political regeneration: real past epochs with collapses between. See docs/plans/history-epochs.md
import {
  COLLAPSE_TEMPLATES,
  EPOCH_ERAS,
  EPOCH_INDEPENDENCE_TEMPLATES,
  EPOCH_WAR_TEMPLATES,
  FALL_BATTLE_TEMPLATES,
  FOUNDING_TEMPLATES,
  GOLDEN_AGE_TEMPLATES
} from "@/data/history-events";
import type { EpochPolity, HistoryEpoch, HistoryEvent, HistRef } from "@/types/history";
import type { TypedArray } from "@/types/packed-graph";
import { P, ra, rand, rn, rw } from "@/utils";
import { getRandomColor } from "@/utils/color-utils";
import type { Burg } from "@/model/political/burgs-generator";
import { Names } from "@/model/society/names-generator";
import { STATE_FORMS, type State, States } from "@/model/political/states-generator";

export interface EpochArtifact {
  epochs: HistoryEpoch[];
  polities: EpochPolity[];
  events: HistoryEvent[];
  /** one `cells.state` snapshot per epoch, holding polity (lineage) ids */
  snapshots: Uint16Array[];
}

interface Profile {
  stateCount: number;
  sizeVariety: number;
  growthRate: number;
  collapse: number;
}

interface Lineage extends EpochPolity {
  type: string;
  culture: number;
  center: number;
  active: boolean;
}

interface Cast {
  lineage: Lineage;
  stateId: number; // epoch-local state id
  territory: number[]; // cell ids
  cells: number;
  neighbors: number[]; // lineage ids
}

interface PendingCollapse {
  lineage: Lineage;
  event: HistoryEvent;
}

interface Saved {
  states: State[];
  cellState: TypedArray;
  burgStates: (number | undefined)[];
  growthRate: number;
}

class EpochsModel {
  /** conservative until the benchmark decides the real K */
  static readonly DEFAULT_COUNT = 4;

  /** regenerate the political layer forward, with collapses between epochs; the live pack is left untouched */
  generate(count = EpochsModel.DEFAULT_COUNT): EpochArtifact {
    const saved = this.save();
    try {
      return this.run(Math.max(2, Math.round(count)));
    } finally {
      this.restore(saved);
    }
  }

  private run(count: number): EpochArtifact {
    const year = options.map.lore.calendar.year;
    const start = year - options.map.lore.history.span;
    const boundaries = this.boundaries(start, year, count);
    const profiles = Array.from({ length: count }, (_, i) => this.profile(i === count - 1));

    const lineages: Lineage[] = [];
    const events: HistoryEvent[] = [];
    const epochs: HistoryEpoch[] = [];
    const snapshots: Uint16Array[] = [];
    const previousAreas = new Map<number, number>();
    const fallenTerritory = new Map<number, Set<number>>();
    const pending: PendingCollapse[] = [];

    this.foundTo(lineages, boundaries[0], profiles[0].stateCount, events);

    for (let i = 0; i < count; i++) {
      const from = boundaries[i];
      const to = boundaries[i + 1];
      const isPresent = i === count - 1;
      const profile = profiles[i];

      if (i > 0) this.foundTo(lineages, from, profile.stateCount, events);

      const active = lineages.filter(lineage => lineage.active);
      const { cast, snapshot } = this.expand(active, profile);
      snapshots.push(snapshot);

      this.noteGrowth(cast, previousAreas, from, to, events);
      const successors = this.assignSuccessors(lineages, cast, pending, fallenTerritory, events, from);
      this.resolveCollapses(pending, successors);
      this.recordCast(cast);
      this.emitWars(cast, from, to, events);

      if (!isPresent) {
        const collapseCount = Math.min(Math.max(1, profile.collapse), Math.max(0, active.length - 2));
        if (collapseCount > 0) this.collapse(cast, to, collapseCount, events, fallenTerritory, pending);
      }

      epochs.push({
        i,
        from,
        to,
        era: isPresent ? options.map.lore.calendar.era : this.eraName(profile, active.length),
        polities: cast.map(entry => this.castOut(entry)),
        snapshot: i
      });
    }

    events.sort((a, b) => a.year - b.year);
    events.forEach((event, i) => {
      event.i = i;
    });

    return { epochs, polities: lineages.map(lineage => this.lineageOut(lineage)), events, snapshots };
  }

  /** run the existing political expansion over a controlled cast, keeping the borders as a snapshot */
  private expand(active: Lineage[], profile: Profile): { cast: Cast[]; snapshot: Uint16Array } {
    const states: State[] = [];
    states[0] = {
      i: 0,
      name: "Neutrals",
      expansionism: 0,
      capital: 0,
      type: "Generic",
      center: 0,
      culture: 0,
      coa: {} as State["coa"],
      salesTax: 0,
      pollTax: 0,
      treasury: 0
    };

    const byState = new Map<number, Lineage>();
    active.forEach((lineage, index) => {
      const stateId = index + 1;
      byState.set(stateId, lineage);
      states[stateId] = {
        i: stateId,
        name: lineage.name,
        expansionism: this.expansionism(profile),
        capital: lineage.capital,
        type: lineage.type,
        center: lineage.center,
        culture: lineage.culture,
        coa: {} as State["coa"],
        salesTax: 0,
        pollTax: 0,
        treasury: 0
      };
    });

    pack.states = states;
    pack.cells.state = new Uint16Array(pack.cells.i.length);
    const savedGrowth = options.generation.states.growthRate;
    options.generation.states.growthRate = profile.growthRate;
    try {
      States.expandStates();
    } finally {
      options.generation.states.growthRate = savedGrowth;
    }

    const local = pack.cells.state;
    const snapshot = Uint16Array.from(local, id => (id ? byState.get(id)!.id : 0));

    const territories = new Map<number, number[]>();
    for (const cellId of pack.cells.i) {
      const id = local[cellId];
      if (!id) continue;
      const list = territories.get(id) ?? [];
      list.push(cellId);
      territories.set(id, list);
    }

    const neighborSets = new Map<number, Set<number>>();
    const addNeighbor = (a: number, b: number) => {
      const set = neighborSets.get(a) ?? new Set<number>();
      set.add(b);
      neighborSets.set(a, set);
    };
    for (const cellId of pack.cells.i) {
      const id = local[cellId];
      if (!id) continue;
      for (const neighbor of pack.cells.c[cellId]) {
        const other = local[neighbor];
        if (!other || other === id) continue;
        addNeighbor(id, other);
        addNeighbor(other, id);
      }
    }

    const cast = Array.from(byState, ([stateId, lineage]) => {
      const territory = territories.get(stateId) ?? [];
      const neighbors = Array.from(neighborSets.get(stateId) ?? []).map(id => byState.get(id)!.id);
      return { lineage, stateId, territory, cells: territory.length, neighbors };
    });

    return { cast, snapshot };
  }

  private foundTo(lineages: Lineage[], year: number, target: number, events: HistoryEvent[]): void {
    let active = lineages.filter(lineage => lineage.active).length;
    const candidates = this.capitalBurgs(lineages, target);
    while (active < target) {
      const burg = candidates.shift();
      if (!burg) break;
      const lineage = this.found(lineages.length, burg, year);
      lineages.push(lineage);
      events.push({
        i: 0,
        year,
        type: "founding",
        actors: [this.ref(lineage)],
        text: ra(FOUNDING_TEMPLATES)(lineage.name, pack.cultures[lineage.culture]?.name ?? "an ancient people")
      });
      active++;
    }
  }

  private capitalBurgs(lineages: Lineage[], target: number): Burg[] {
    const width = options.map.graph.width || 1000;
    const height = options.map.graph.height || 1000;
    const spacing = (width + height) / 2 / Math.max(1, target);
    const active = lineages.filter(lineage => lineage.active);
    const used = new Set(active.map(lineage => lineage.capital));
    const candidates = pack.burgs
      .filter((burg): burg is Burg =>
        Boolean(burg?.i && !burg.removed && !used.has(burg.i) && (burg.population ?? 0) > 0)
      )
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

    const chosen: Burg[] = [];
    for (const burg of candidates) {
      if (active.some(lineage => this.distance(lineage.center, burg.cell) < spacing)) continue;
      if (chosen.some(other => this.distance(other.cell, burg.cell) < spacing)) continue;
      chosen.push(burg);
    }
    return chosen;
  }

  private found(id: number, burg: Burg, year: number): Lineage {
    const culture = burg.culture ?? pack.cells.culture[burg.cell] ?? 0;
    const name = Names.getState(Names.getCultureShort(culture), culture);
    const family = rw({ Monarchy: 5, Republic: 2, Union: 1 }) as keyof typeof STATE_FORMS;
    return {
      id,
      name,
      form: ra(STATE_FORMS[family] ?? STATE_FORMS.Monarchy),
      capital: burg.i,
      cells: 0,
      color: getRandomColor(),
      founded: year,
      type: pack.cultures[culture]?.type ?? "Generic",
      culture,
      center: burg.cell,
      active: true
    };
  }

  /** pick the weakest polities to fall; their land is left empty for the next epoch's growth */
  private collapse(
    cast: Cast[],
    year: number,
    count: number,
    events: HistoryEvent[],
    fallenTerritory: Map<number, Set<number>>,
    pending: PendingCollapse[]
  ): void {
    const order = cast.filter(entry => entry.territory.length > 0).sort((a, b) => this.weakness(a) - this.weakness(b));
    for (let n = 0; n < count && order.length; n++) {
      const poolSize = Math.max(1, Math.ceil(order.length / 3));
      const [entry] = order.splice(Math.floor(Math.random() * poolSize), 1);
      entry.lineage.active = false;
      entry.lineage.fallen = year;
      fallenTerritory.set(entry.lineage.id, new Set(entry.territory));
      this.emitFall(entry, cast, year, events, pending);
    }
  }

  private weakness(entry: Cast): number {
    return entry.cells * (1 + entry.neighbors.length);
  }

  private emitFall(
    entry: Cast,
    cast: Cast[],
    year: HistoryEvent["year"],
    events: HistoryEvent[],
    pending: PendingCollapse[]
  ): void {
    const rival = entry.neighbors
      .map(id => cast.find(candidate => candidate.lineage.id === id))
      .filter((candidate): candidate is Cast => Boolean(candidate))
      .sort((a, b) => b.cells - a.cells)[0];

    if (rival) {
      events.push({
        i: 0,
        year: Math.max(0, year - rand(1, 5)),
        type: "war",
        actors: [this.ref(entry.lineage), this.ref(rival.lineage)],
        text: ra(EPOCH_WAR_TEMPLATES)(entry.lineage.name, rival.lineage.name)
      });
    }

    events.push({
      i: 0,
      year,
      type: "battle",
      actors: rival ? [this.ref(entry.lineage), this.ref(rival.lineage)] : [this.ref(entry.lineage)],
      loc: this.frontier(entry, rival),
      text: ra(FALL_BATTLE_TEMPLATES)(entry.lineage.name)
    });

    const event: HistoryEvent = { i: 0, year, type: "collapse", actors: [this.ref(entry.lineage)], text: "" };
    events.push(event);
    pending.push({ lineage: entry.lineage, event });
  }

  private frontier(entry: Cast, rival?: Cast): number {
    if (!rival) return entry.territory[0];
    const rivalCells = new Set(rival.territory);
    const cells = entry.territory.filter(cell => pack.cells.c[cell].some(neighbor => rivalCells.has(neighbor)));
    return ra(cells.length ? cells : entry.territory);
  }

  /** a polity that grows into a dead polity's land becomes its successor; new heirs are recorded as independences */
  private assignSuccessors(
    lineages: Lineage[],
    cast: Cast[],
    pending: PendingCollapse[],
    fallen: Map<number, Set<number>>,
    events: HistoryEvent[],
    year: number
  ): Map<number, Lineage[]> {
    const successors = new Map<number, Lineage[]>();
    if (!pending.length) return successors;

    const pendingFallen = new Map(
      pending.map(({ lineage }) => [lineage.id, fallen.get(lineage.id)!] as [number, Set<number>])
    );
    const byId = new Map(lineages.map(lineage => [lineage.id, lineage]));
    for (const entry of cast) {
      const heirTo = this.strongestClaim(entry, pendingFallen);
      if (heirTo === undefined) continue;

      const firstInheritance = entry.lineage.successorOf === undefined;
      entry.lineage.successorOf ??= heirTo;
      const heirs = successors.get(heirTo) ?? [];
      heirs.push(entry.lineage);
      successors.set(heirTo, heirs);

      if (!firstInheritance || entry.lineage.founded < year) continue; // a survivor absorbed the land; it did not appear from it
      const fallenLineage = byId.get(heirTo);
      if (!fallenLineage) continue;
      events.push({
        i: 0,
        year: entry.lineage.founded,
        type: "independence",
        actors: [this.ref(entry.lineage), this.ref(fallenLineage)],
        text: ra(EPOCH_INDEPENDENCE_TEMPLATES)(entry.lineage.name, fallenLineage.name)
      });
    }
    return successors;
  }

  private strongestClaim(entry: Cast, fallen: Map<number, Set<number>>): number | undefined {
    let best: number | undefined;
    let bestOverlap = 0;
    fallen.forEach((cells, id) => {
      const overlap = entry.territory.reduce((sum, cell) => sum + (cells.has(cell) ? 1 : 0), 0);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = id;
      }
    });
    return best;
  }

  private resolveCollapses(pending: PendingCollapse[], successors: Map<number, Lineage[]>): void {
    for (const { lineage, event } of pending) {
      const heirs = successors.get(lineage.id) ?? [];
      event.text = ra(COLLAPSE_TEMPLATES.collapse)(lineage.name, event.year, this.joinNames(heirs));
      event.actors.push(...heirs.map(heir => this.ref(heir)));
    }
    pending.length = 0;
  }

  private noteGrowth(
    cast: Cast[],
    previous: Map<number, number>,
    from: number,
    to: number,
    events: HistoryEvent[]
  ): void {
    for (const entry of cast) {
      const before = previous.get(entry.lineage.id);
      if (before !== undefined && entry.cells > before * 1.2 && P(0.4)) {
        events.push({
          i: 0,
          year: rand(from + 1, Math.max(from + 1, to - 1)),
          type: "goldenAge",
          actors: [this.ref(entry.lineage)],
          text: ra(GOLDEN_AGE_TEMPLATES)(entry.lineage.name)
        });
      }
      previous.set(entry.lineage.id, entry.cells);
    }
  }

  private emitWars(cast: Cast[], from: number, to: number, events: HistoryEvent[]): void {
    for (const entry of cast) {
      for (const neighborId of entry.neighbors) {
        if (neighborId <= entry.lineage.id) continue;
        const other = cast.find(candidate => candidate.lineage.id === neighborId);
        if (!other || !P(0.25)) continue;
        events.push({
          i: 0,
          year: rand(from + 1, Math.max(from + 1, to - 1)),
          type: "war",
          actors: [this.ref(entry.lineage), this.ref(other.lineage)],
          text: ra(EPOCH_WAR_TEMPLATES)(entry.lineage.name, other.lineage.name)
        });
      }
    }
  }

  private recordCast(cast: Cast[]): void {
    for (const entry of cast) entry.lineage.cells = entry.cells;
  }

  private profile(isPresent: boolean): Profile {
    const generation = options.generation.states;
    const limit = Math.max(4, generation.limit || 12);
    return {
      stateCount: isPresent ? limit : rand(4, limit),
      sizeVariety: generation.sizeVariety || 3,
      growthRate: (generation.growthRate || 1) * (0.5 + Math.random()),
      collapse: rand(0, 2)
    };
  }

  private expansionism(profile: Profile): number {
    return rn(1 + Math.random() * profile.sizeVariety, 1);
  }

  private boundaries(start: number, end: number, count: number): number[] {
    const step = (end - start) / count;
    return Array.from({ length: count + 1 }, (_, i) =>
      i === 0 ? start : i === count ? end : Math.round(start + step * i)
    );
  }

  private distance(a: number, b: number): number {
    const [ax, ay] = pack.cells.p[a];
    const [bx, by] = pack.cells.p[b];
    return Math.hypot(ax - bx, ay - by);
  }

  private eraName(profile: Profile, activeCount: number): string {
    if (profile.collapse > 0) return ra(EPOCH_ERAS.ruin);
    if (activeCount >= 6) return ra(EPOCH_ERAS.division);
    return ra(EPOCH_ERAS.dominion);
  }

  private joinNames(polities: Lineage[]): string {
    if (!polities.length) return "the wilds";
    const names = polities.map(polity => polity.name);
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  }

  private ref(lineage: Lineage): HistRef {
    return { kind: "polity", id: lineage.id };
  }

  private castOut(entry: Cast): EpochPolity {
    return { ...this.lineageOut(entry.lineage), cells: entry.cells };
  }

  private lineageOut(lineage: Lineage): EpochPolity {
    return {
      id: lineage.id,
      name: lineage.name,
      form: lineage.form,
      capital: lineage.capital,
      cells: lineage.cells,
      color: lineage.color,
      founded: lineage.founded,
      fallen: lineage.fallen,
      successorOf: lineage.successorOf,
      parent: lineage.parent
    };
  }

  private save(): Saved {
    return {
      states: pack.states,
      cellState: pack.cells.state,
      burgStates: pack.burgs.map(burg => burg?.state),
      growthRate: options.generation.states.growthRate
    };
  }

  private restore(saved: Saved): void {
    pack.states = saved.states;
    pack.cells.state = saved.cellState;
    pack.burgs.forEach((burg, i) => {
      if (burg) burg.state = saved.burgStates[i];
    });
    options.generation.states.growthRate = saved.growthRate;
  }
}

export const Epochs = new EpochsModel();

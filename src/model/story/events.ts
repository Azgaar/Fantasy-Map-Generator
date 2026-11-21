// `pack.events`: the map's dated history. The only writer of the list. See docs/prd/events.md
import { Pack } from "@/model/graph/pack-generator";
import { BattleRules, type Side } from "@/model/political/battle/battle-rules";
import type { BattleReplay } from "@/model/political/battle/replay";
import type { State } from "@/model/political/states-generator";
import { Tags } from "@/model/tags";
import { t } from "@/utils/i18n";
import { trimVowels } from "@/utils/language-utils";
import { requireName } from "@/utils/validation-utils";
import { Dates } from "./dates";

const EVENT_TYPES = ["custom", "war", "battle", "alliance", "vassalage"] as const;

interface EventBase {
  i: number;
  type: EventType;
  name: string;
  start: string; // "120", "120-03-14" or "120-03-14T10:00"
  end?: string; // in the same form; none while ongoing
  parent?: number; // the event this one is part of, as a battle of its war
  note?: string;
  tags?: string[];
  auto?: true; // generated and not edited by the user since
}

export interface WarEvent extends EventBase {
  type: "war";
  attackers: number[]; // state ids, the first is the leader
  defenders: number[]; // empty when the foe is gone
}

export interface AllianceEvent extends EventBase {
  type: "alliance";
  states: [number, number];
}

export interface VassalageEvent extends EventBase {
  type: "vassalage";
  suzerain: number;
  vassal: number;
}

export interface BattleEvent extends EventBase {
  type: "battle";
  cell: number;
  x: number;
  y: number;
  attackers: number[];
  defenders: number[];
  winner: Side | null;
  status: [string, string];
  replay?: BattleReplay;
  fought?: Record<number, number>; // replay state id → current state id, 0 when gone
  regiments?: RegimentRef[];
}

export interface RegimentRef {
  state: number;
  i: number;
}

export interface CustomEvent extends EventBase {
  type: "custom";
  states?: number[];
  act?: string; // the generated act that wrote it, such as "cession:12"; dropped once the user edits it
}

export type MapEvent = WarEvent | AllianceEvent | VassalageEvent | BattleEvent | CustomEvent;
export type EventType = (typeof EVENT_TYPES)[number];

type RelationEvent = WarEvent | AllianceEvent | VassalageEvent;
type RelationType = RelationEvent["type"];
type SidedEvent = WarEvent | BattleEvent;

/** What `Events.list` finds: every condition given must hold */
interface EventQuery {
  type?: EventType;
  state?: number; // names the state, on any side
  against?: number; // on the other side from `state`, in a war or a battle
  parent?: number; // a direct part of the event
  regiment?: RegimentRef; // a battle the regiment fought
  ongoing?: boolean; // with no end, or with one
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A new event: the list gives its id */
export type NewEvent = DistributiveOmit<MapEvent, "i">;

/** What the user may change; null clears an optional field, as "" does a note */
export interface EventPatch {
  type?: EventType; // what every kind has is kept; a battle needs cell, x and y with it
  name?: string;
  start?: string;
  end?: string | null;
  parent?: number | null;
  note?: string | null;
  tags?: string[] | string;
  attackers?: number[];
  defenders?: number[];
  states?: number[];
  suzerain?: number;
  vassal?: number;
  winner?: Side | null;
  cell?: number;
  x?: number;
  y?: number;
}

const PATCH_FIELDS = new Set<string>([
  "type",
  "name",
  "start",
  "end",
  "parent",
  "note",
  "tags",
  "attackers",
  "defenders",
  "states",
  "suzerain",
  "vassal",
  "winner",
  "cell",
  "x",
  "y"
] satisfies (keyof EventPatch)[]);

const PLAYED_BATTLE_FIELDS = ["attackers", "defenders", "winner", "cell", "x", "y"] as const;

/** The kind of event a diplomatic relation keeps going */
const RELATION_KINDS = new Map<string, RelationType>([
  ["Enemy", "war"],
  ["Ally", "alliance"],
  ["Vassal", "vassalage"],
  ["Suzerain", "vassalage"]
]);

const isId = (id: unknown): id is number => Number.isInteger(id) && (id as number) >= 0;
const areIds = (ids: unknown): boolean => Array.isArray(ids) && ids.every(isId);

const isRelationType = (type: EventType): type is RelationType =>
  type === "war" || type === "alliance" || type === "vassalage";
const isRelation = (event: MapEvent): event is RelationEvent => isRelationType(event.type);

/** A war or a battle: an event with attackers and defenders */
export const isSided = (event: MapEvent): event is SidedEvent => event.type === "war" || event.type === "battle";

const regimentKey = (ref: RegimentRef): string => `${ref.state}-${ref.i}`;

/** Lookups kept beside a list of events, dropped with it */
interface EventIndex {
  byId: Map<number, MapEvent>;
  byParent: Map<number, Set<number>>;
  lastId: number;
}

class EventsModel {
  private readonly indexes = new WeakMap<MapEvent[], EventIndex>(); // a list's index goes with it

  // reading

  get(id: number): MapEvent | undefined {
    return this.index().byId.get(id);
  }

  /** Every event in order of time, or those the query asks for, all of its conditions met; a kind narrows the type */
  list<T extends EventType>(query: EventQuery & { type: T }): Extract<MapEvent, { type: T }>[];
  list(query?: EventQuery): MapEvent[];
  list(query: EventQuery = {}): MapEvent[] {
    const { type, state, against, parent, regiment, ongoing } = query;
    const events = parent === undefined ? pack.events : this.parts(parent, false);
    if (Object.values(query).every(value => value === undefined)) return events;
    return events.filter(
      event =>
        (type === undefined || event.type === type) &&
        (ongoing === undefined || ongoing === (event.end === undefined)) &&
        (state === undefined || this.statesOf(event).includes(state)) &&
        (against === undefined || (state !== undefined && this.opposes(event, state, against))) &&
        (regiment === undefined ||
          (event.type === "battle" &&
            Boolean(event.regiments?.some(ref => regimentKey(ref) === regimentKey(regiment)))))
    );
  }

  /** The parts of an event in order of time, to any depth unless `deep` is false */
  parts(id: number, deep = true): MapEvent[] {
    const { byId, byParent } = this.index();
    const direct = [...(byParent.get(id) ?? [])].map(part => byId.get(part)!).sort(this.order);
    return deep ? direct.flatMap(part => [part, ...this.parts(part.i)]) : direct;
  }

  /** The events an event is part of, the nearest first */
  parents(event: MapEvent): MapEvent[] {
    const parents: MapEvent[] = [];
    for (let parent = this.parentOf(event); parent && !parents.includes(parent); parent = this.parentOf(parent))
      parents.push(parent);
    return parents;
  }

  /** The states an event names */
  statesOf(event: MapEvent): number[] {
    switch (event.type) {
      case "war":
      case "battle":
        return [...event.attackers, ...event.defenders];
      case "alliance":
        return event.states.filter(Boolean);
      case "vassalage":
        return [event.suzerain, event.vassal].filter(Boolean);
      case "custom":
        return event.states ?? [];
    }
  }

  /** The first and the last year of an event, the present for one going on */
  yearsOf(event: MapEvent): [number, number] {
    return [Dates.year(event.start), Dates.year(event.end ?? this.present())];
  }

  present(): string {
    return Dates.ofYear(options.map.lore.calendar.year);
  }

  /** The event a generated act wrote today, while the user has not edited it */
  currentAct(act: string): CustomEvent | undefined {
    const present = this.present();
    return this.list({ type: "custom" }).findLast(
      event => event.act === act && event.start === present && event.end === present
    );
  }

  /** The state ids a replayed battle was fought by */
  foughtStateIds(replay: BattleReplay): number[] {
    const added = replay.interventions.flatMap(change => (change.kind === "add" ? [change.regiment] : []));
    return [...new Set([...replay.attackers, ...replay.defenders, ...added].map(regiment => regiment.state))];
  }

  /** The current state for a replay's state id; undefined when it is gone */
  currentStateOf(battle: BattleEvent, foughtId: number): State | undefined {
    const state = pack.states?.[battle.fought?.[foughtId] ?? foughtId];
    return state?.i && !state.removed ? state : undefined;
  }

  // writing

  /** Add an event, placed by its start after others of its date; returns its id */
  add(event: NewEvent): number {
    const index = this.index();
    const added = { ...event, i: index.lastId + 1 } as MapEvent;
    this.validate(added);
    if (isRelation(added) && !added.auto && added.end === undefined)
      throw new Error(
        "A war, alliance or vassalage added by hand is over: give it an end. An ongoing one follows a relation"
      );
    if (added.tags) added.tags = Tags.parse(added.tags);
    this.insert(added);
    index.lastId = added.i;
    index.byId.set(added.i, added);
    if (added.parent !== undefined) this.link(index, added.i, added.parent);
    return added.i;
  }

  /** Change an event; it becomes the user's */
  update(id: number, patch: EventPatch): void {
    const event = this.require(id);
    this.checkPatch(event, patch);
    const next = this.patched(event, patch);
    this.guardRelation(event, next);
    this.validate(next);
    this.replace(event, next);
  }

  /** Remove an event with its parts. Returns the ids removed */
  remove(id: number): number[] {
    const ids = new Set([this.require(id).i, ...this.partIds(id)]);
    this.removeIds(ids);
    return [...ids];
  }

  /** Sort and reindex the list after it was written to directly, as by the assistant's proposals */
  reload(): void {
    pack.events.sort((a, b) => Dates.compare(a.start, b.start)); // stable: events of one date keep their order
    this.reindex();
  }

  /** Move every date by the same number of years */
  shiftYears(years: number): void {
    if (!years) return;
    for (const event of this.list()) {
      event.start = Dates.shift(event.start, years);
      if (event.end !== undefined) event.end = Dates.shift(event.end, years);
    }
  }

  /** Follow renumbered states: ids missing from the map are dropped; events left with no state are removed */
  remapStates(renumbered: Map<number, number>): void {
    const keep = (ids: number[]) => ids.flatMap(id => (renumbered.has(id) ? [renumbered.get(id)!] : []));
    const unsetGone = (id: number) => renumbered.get(id) ?? 0;
    const gone: MapEvent[] = [];
    for (const event of this.list()) {
      switch (event.type) {
        case "war":
          event.attackers = keep(event.attackers);
          event.defenders = keep(event.defenders);
          if (!event.attackers.length && !event.defenders.length) gone.push(event);
          break;
        case "battle":
          event.attackers = keep(event.attackers);
          event.defenders = keep(event.defenders);
          this.remapBattle(event, renumbered);
          break;
        case "alliance":
          if (event.states.some(id => !renumbered.has(id))) gone.push(event);
          event.states = event.states.map(unsetGone) as [number, number];
          break;
        case "vassalage":
          if (!renumbered.has(event.suzerain) || !renumbered.has(event.vassal)) gone.push(event);
          [event.suzerain, event.vassal] = [unsetGone(event.suzerain), unsetGone(event.vassal)];
          break;
        case "custom":
          if (!event.states) break;
          event.states = keep(event.states);
          if (!event.states.length) gone.push(event);
      }
    }
    this.removeUnless(gone);
    this.forgetActs(); // the acts' subject ids now name other states
  }

  /** Detach events from their generated acts, so doing an act again adds a new event: all, or those naming a state */
  forgetActs(stateId?: number): void {
    for (const event of this.list({ type: "custom" }))
      if (event.act && (stateId === undefined || event.states?.includes(stateId))) delete event.act;
  }

  /** Point battles at regiments' new ids, as after their state merged into another */
  moveRegiments(moves: [from: RegimentRef, to: RegimentRef][]): void {
    const targets = new Map(moves.map(([from, to]) => [regimentKey(from), to]));
    for (const battle of this.list({ type: "battle" })) {
      if (!battle.regiments?.some(ref => targets.has(regimentKey(ref)))) continue;
      const moved = battle.regiments.map(ref => targets.get(regimentKey(ref)) ?? ref);
      battle.regiments = [...new Map(moved.map(ref => [regimentKey(ref), ref])).values()];
    }
  }

  /** Unlink disbanded or re-raised regiments from their battles, so a reused id inherits none */
  dropRegiments(gone: (ref: RegimentRef) => boolean): void {
    for (const battle of this.list({ type: "battle" })) {
      if (!battle.regiments) continue;
      const kept = battle.regiments.filter(ref => !gone(ref));
      if (kept.length === battle.regiments.length) continue;
      if (kept.length) battle.regiments = kept;
      else delete battle.regiments;
    }
  }

  /** Fix a loaded map's history: unique ids, battles on the cell under them, no links to missing events or regiments.
   * `misplaced` tells a battle cell left from another graph. Returns what was repaired */
  repair(misplaced: (x: number, y: number, cell: number) => boolean): string[] {
    const repairs: string[] = [];
    const ids = new Set<number>();
    let nextId = pack.events.reduce((most, event) => (isId(event.i) ? Math.max(most, event.i) : most), -1) + 1;
    for (const event of pack.events) {
      if (!isId(event.i) || ids.has(event.i)) {
        repairs.push(`Event ${String(event.i).slice(0, 20)} has an invalid or non-unique id. Changing to ${nextId}`);
        event.i = nextId++;
      }
      ids.add(event.i);
    }
    for (const event of pack.events) {
      if (event.type === "battle" && misplaced(event.x, event.y, event.cell)) {
        event.cell = Pack.findCell(event.x, event.y)!;
        repairs.push(`Battle ${event.i} is not linked to the cell under it. Relinking it`);
      }
      if (event.parent !== undefined && !ids.has(event.parent)) {
        repairs.push(`Event ${event.i} is part of missing event ${event.parent}. Removing the link`);
        delete event.parent;
      }
    }
    let unlinked = 0;
    this.dropRegiments(ref => {
      const lost = !pack.states[ref.state]?.military?.some(({ i }) => i === ref.i);
      if (lost) unlinked++;
      return lost;
    });
    if (unlinked) repairs.push(`${unlinked} battle links to missing regiments. Removing them`);
    this.reindex();
    return repairs;
  }

  /** Move battles to their projected place on a rebuilt map; remove those off the map, with their parts */
  relocateBattles(place: (x: number, y: number) => { x: number; y: number; cell: number } | null): void {
    const offMap = new Set<number>();
    for (const battle of this.list({ type: "battle" })) {
      const moved = place(battle.x, battle.y);
      if (moved) {
        Object.assign(battle, moved);
        if (battle.replay) Object.assign(battle.replay, moved); // replayed on the ground as it now lies
      } else offMap.add(battle.i);
    }
    if (offMap.size) this.removeIds(new Set([...offMap].flatMap(id => [id, ...this.partIds(id)])));
  }

  /** Before relations are regenerated: generated ongoing relations are removed, the user's end at the present */
  closeOngoing(): void {
    const ongoing = this.list().filter(event => isRelation(event) && event.end === undefined);
    for (const event of ongoing) if (this.holdsUserWork(event)) event.end = this.present();
    this.removeUnless(ongoing);
  }

  /** Bring the wars, alliances and vassalages of the pairs in line with the relations the states hold now */
  followRelations(pairs: Iterable<[number, number]>): void {
    const seen = new Set<string>();
    const ongoing = this.list().filter((event): event is RelationEvent => isRelation(event) && event.end === undefined);
    for (const [a, b] of pairs) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      this.followPair(a, b, ongoing);
    }
  }

  /** Follow every pair a removed or merged state was in: it holds no relations any more */
  followState(stateId: number): void {
    this.followRelations(
      pack.states.filter(state => state.i && state.i !== stateId).map(({ i }): [number, number] => [stateId, i])
    );
  }

  /** Log a generated act, such as a cession; doing it again today for the same subject updates that event */
  logAct(act: string, details: { name: string; states: number[]; tag: string }): number {
    const previous = this.currentAct(act);
    if (previous) {
      Object.assign(previous, { name: details.name, states: details.states });
      return previous.i;
    }
    const present = this.present();
    return this.add({
      type: "custom",
      name: details.name,
      start: present,
      end: present,
      states: details.states,
      tags: [details.tag],
      act,
      auto: true
    });
  }

  // wording

  /** A state by its current name; a removed one by its id */
  stateName(id: number): string {
    return pack.states?.[id]?.name || t("former state {{id}}", { id });
  }

  stateNames(ids: number[]): string {
    return ids.map(id => this.stateName(id)).join(", ");
  }

  /** "Angria-Tirian War": a name both states of a pair can read as theirs */
  pairName(a: number, b: number, kind: string): string {
    return `${this.stateName(a)}-${trimVowels(this.stateName(b))}ian ${kind}`;
  }

  /** The outcome of a battle */
  describeResult(event: MapEvent): string {
    if (event.type !== "battle") return "";
    if (event.winner === "attackers") return t("Attackers won");
    if (event.winner === "defenders") return t("Defenders won");
    return t("No victor");
  }

  /** How long an ended event lasted, as "3 years"; undefined for one ongoing or that happened at one time */
  durationOf(event: MapEvent): string | undefined {
    return this.lasts(event) ? Dates.formatLength(event.start, event.end!) : undefined;
  }

  /** The dates and, when known, the length: "117 – 120 WE (3 years)", "117 WE –" for one going on */
  describeDates(event: MapEvent): string {
    const duration = this.durationOf(event);
    if (!duration) return Dates.formatRange(event.start, event.end);
    // formatRange shows equal dates once; a relation of one moment still shows both ends
    const range =
      event.end === event.start
        ? `${Dates.format(event.start)} – ${Dates.format(event.end)}`
        : Dates.formatRange(event.start, event.end);
    return `${range} (${duration})`;
  }

  /** An event in a line: its sides, its result and its dates */
  describe(event: MapEvent): string {
    return [this.describeSides(event), this.describeResult(event), this.describeDates(event)]
      .filter(Boolean)
      .map(part => (/[.!?]$/.test(part) ? part : `${part}.`))
      .join(" ");
  }

  private describeSides(event: MapEvent): string {
    switch (event.type) {
      case "war":
      case "battle":
        if (!event.defenders.length)
          return t("{{attackers}} against a vanished foe", { attackers: this.stateNames(event.attackers) });
        return t("{{attackers}} against {{defenders}}", {
          attackers: this.stateNames(event.attackers),
          defenders: this.stateNames(event.defenders)
        });
      case "alliance":
        return t("Alliance of {{states}}", { states: this.stateNames(event.states) });
      case "vassalage":
        return t("{{vassal}} under {{suzerain}}", {
          vassal: this.stateName(event.vassal),
          suzerain: this.stateName(event.suzerain)
        });
      case "custom":
        return this.stateNames(event.states ?? []);
    }
  }

  /** Ended and lasted: a war, alliance or vassalage lasts even when it began and ended at one time */
  private lasts(event: MapEvent): boolean {
    return event.end !== undefined && (event.end !== event.start || isRelation(event));
  }

  // relations

  /** Bring one pair's ongoing relations in line with its diplomacy. `ongoing` is shared across pairs and kept current */
  private followPair(a: number, b: number, ongoing: RelationEvent[]): void {
    const relation = this.relation(a, b);
    const kind = relation ? RELATION_KINDS.get(relation) : undefined;
    const [first, second] = relation === "Vassal" ? [b, a] : [a, b]; // a vassalage names its suzerain first
    const matches = (event: MapEvent): boolean =>
      event.type === kind && (event.type !== "vassalage" || (event.suzerain === first && event.vassal === second));

    const named = ongoing.filter(event => this.names(event, a, b));
    if (!kind && !named.length) return;
    this.endRelations(
      named.filter(event => !matches(event) && (event.type !== "war" || this.leads(event, a, b))),
      ongoing
    );
    if (!kind || named.some(matches)) return;

    const present = this.present();
    const reopened = this.list().findLast(
      (event): event is RelationEvent =>
        isRelation(event) &&
        matches(event) &&
        event.end === present &&
        (event.type === "war" ? this.leads(event, a, b) : this.names(event, a, b))
    );
    if (reopened) delete reopened.end;
    ongoing.push(reopened ?? (this.get(this.add(this.relationEvent(kind, first, second, present))) as RelationEvent));
  }

  /** End relations that no longer hold; a generated one begun today is removed instead */
  private endRelations(ending: RelationEvent[], ongoing: RelationEvent[]): void {
    const present = this.present();
    const begunToday: RelationEvent[] = [];
    for (const event of ending) {
      if (event.start !== present || this.holdsUserWork(event)) event.end = present;
      else begunToday.push(event);
    }
    this.removeUnless(begunToday);
    for (const event of ending) ongoing.splice(ongoing.indexOf(event), 1);
  }

  /** A new generated relation between `first` and `second`: attacker and defender, or suzerain and vassal */
  private relationEvent(kind: RelationType, first: number, second: number, start: string): NewEvent {
    const base = { start, tags: [kind], auto: true as const };
    if (kind === "war")
      return {
        ...base,
        type: "war",
        name: this.pairName(first, second, "War"),
        attackers: [first],
        defenders: [second]
      };
    if (kind === "alliance")
      return { ...base, type: "alliance", name: this.pairName(first, second, "Alliance"), states: [first, second] };
    const name = `${this.stateName(second)} under ${this.stateName(first)}`;
    return { ...base, type: "vassalage", name, suzerain: first, vassal: second };
  }

  /** a's relation towards b, none when either is gone */
  private relation(a: number, b: number): string | undefined {
    const [sa, sb] = [pack.states[a], pack.states[b]];
    if (!sa || !sb || sa.removed || sb.removed) return undefined;
    return sa.diplomacy?.[b];
  }

  /** The event involves both states; a war only with them on opposite sides */
  private names(event: RelationEvent, a: number, b: number): boolean {
    if (event.type === "war") return this.opposes(event, a, b);
    if (event.type === "alliance") return event.states.includes(a) && event.states.includes(b);
    return (event.suzerain === a && event.vassal === b) || (event.suzerain === b && event.vassal === a);
  }

  private opposes(event: MapEvent, a: number, b: number): boolean {
    if (!isSided(event)) return false;
    const { attackers, defenders } = event;
    return (attackers.includes(a) && defenders.includes(b)) || (attackers.includes(b) && defenders.includes(a));
  }

  /** The two states lead the war's sides */
  private leads(war: RelationEvent, a: number, b: number): boolean {
    if (war.type !== "war") return false;
    const [attacker, defender] = [war.attackers[0], war.defenders[0]];
    return (attacker === a && defender === b) || (attacker === b && defender === a);
  }

  /** An ongoing war, alliance or vassalage changes only through diplomacy; an ended one cannot be reopened */
  private guardRelation(event: MapEvent, next: MapEvent): void {
    if (!isRelation(event)) return;
    if (event.end !== undefined) {
      if (next.end === undefined)
        throw new Error("A war, alliance or vassalage that is over cannot be made ongoing: set the relation instead");
      return;
    }
    if (next.end !== undefined)
      throw new Error("An ongoing war, alliance or vassalage ends through the relation of its states");
    if (
      event.type === "war" &&
      next.type === "war" &&
      (next.attackers[0] !== event.attackers[0] || next.defenders[0] !== event.defenders[0])
    )
      throw new Error("The leaders of an ongoing war follow their relation and cannot be changed");
    if (event.type === "alliance" && next.type === "alliance" && next.states.join() !== event.states.join())
      throw new Error("An ongoing alliance follows the relation of its states");
    if (
      event.type === "vassalage" &&
      next.type === "vassalage" &&
      (next.suzerain !== event.suzerain || next.vassal !== event.vassal)
    )
      throw new Error("An ongoing vassalage follows the relation of its states");
  }

  // the list

  private readonly order = (a: MapEvent, b: MapEvent): number => Dates.compare(a.start, b.start) || a.i - b.i;

  private parentOf(event: MapEvent): MapEvent | undefined {
    return event.parent === undefined ? undefined : this.get(event.parent);
  }

  private partIds(id: number): number[] {
    return this.parts(id).map(part => part.i);
  }

  /** The user made or edited the event, or one of its parts */
  private holdsUserWork(event: MapEvent): boolean {
    return !event.auto || this.parts(event.i).some(part => !part.auto);
  }

  /** The patch's own errors, found before anything is built */
  private checkPatch(event: MapEvent, patch: EventPatch): void {
    const unknown = Object.keys(patch).find(field => !PATCH_FIELDS.has(field));
    if (unknown) throw new Error(`An event's ${unknown} cannot be changed`);
    if (event.type === "battle" && event.replay && PLAYED_BATTLE_FIELDS.some(field => patch[field] !== undefined))
      throw new Error("A played battle keeps what was fought: its sides, result and place");
    const { parent } = patch;
    if (parent !== undefined && parent !== null && (parent === event.i || this.partIds(event.i).includes(parent)))
      throw new Error("An event cannot be part of itself or of one of its own parts");
  }

  /** The event with the patch applied, as the user's */
  private patched(event: MapEvent, patch: EventPatch): MapEvent {
    const retyped = patch.type !== undefined && patch.type !== event.type;
    const next = (retyped ? this.retype(event, patch.type!) : { ...event }) as MapEvent & Record<string, unknown>;
    for (const [field, value] of Object.entries(patch)) {
      if (value === null) delete next[field];
      else if (value !== undefined) next[field] = value;
    }
    if (patch.name !== undefined) next.name = requireName(patch.name);
    if (next.type === "battle" && patch.winner !== undefined) next.status = BattleRules.getStatus(0, 0, next.winner); // worded from the winner alone
    if (patch.tags !== undefined) next.tags = Tags.parse(patch.tags);
    if (patch.note === "") delete next.note;
    if (patch.start !== undefined && patch.end === undefined && event.end !== undefined)
      next.end = this.moveEnd(event.start, event.end, next.start);
    delete next.auto;
    if (next.type === "custom") delete next.act; // edited: doing the act again adds a new event
    return next;
  }

  /** The end after the start moved: an instant moves whole, a same-day event keeps its minutes, a longer one its end */
  private moveEnd(start: string, end: string, moved: string): string {
    if (end === start) return moved;
    const minutes = Dates.minutesBetween(start, end);
    if (minutes === null || minutes >= 1440) return end;
    return Dates.minutesBetween(moved, moved) === null ? moved : Dates.addMinutes(moved, minutes);
  }

  /** The event as another kind: name, dates, parent, note and states are kept, the old kind's tag is replaced */
  private retype(event: MapEvent, type: EventType): MapEvent {
    if (event.type === "battle" && event.replay) throw new Error("A played battle stays a battle: its replay is one");
    if (isRelation(event) && event.end === undefined)
      throw new Error("An ongoing war, alliance or vassalage follows the relation of its states and keeps its kind");
    if (isRelationType(type) && event.end === undefined)
      throw new Error("A war, alliance or vassalage set by hand is over: give the event an end first");

    const { i, name, start, end, parent, note } = event;
    const tags = new Set([type, ...(event.tags ?? [])]);
    tags.delete(event.type);
    tags.delete("custom");
    const base = {
      i,
      name,
      start,
      ...(end !== undefined && { end }),
      ...(parent !== undefined && { parent }),
      ...(note && { note }),
      ...(tags.size > 0 && { tags: [...tags] })
    };
    const states = this.statesOf(event);
    const [first = 0, second = 0, ...rest] = states;
    const sides = { attackers: [first].filter(Boolean), defenders: [second, ...rest].filter(Boolean) };
    switch (type) {
      case "war":
        return { ...base, type, ...sides };
      case "alliance":
        return { ...base, type, states: [first, second] };
      case "vassalage":
        return { ...base, type, suzerain: first, vassal: second };
      case "custom":
        return { ...base, type, ...(states.some(Boolean) && { states }) };
      case "battle": {
        const battle = { winner: null, status: BattleRules.getStatus(0, 0, null) };
        return { ...base, type, ...sides, ...battle } as BattleEvent; // the patch gives its place
      }
    }
  }

  private validate(event: MapEvent): void {
    if (!event.name || typeof event.name !== "string") throw new Error("An event needs a name");
    if (!EVENT_TYPES.includes(event.type)) throw new Error(`An event is one of: ${EVENT_TYPES.join(", ")}`);
    Dates.require(event.start);
    if (event.end !== undefined) {
      Dates.require(event.end);
      if (Dates.compareLoosely(event.end, event.start) < 0) throw new Error("An event cannot end before it began");
    }
    if (event.parent !== undefined && !this.index().byId.has(event.parent))
      throw new Error(`Event ${event.parent} does not exist`);
    switch (event.type) {
      case "war":
      case "battle":
        if (!(areIds(event.attackers) && areIds(event.defenders)))
          throw new Error("A war or a battle needs its attackers and defenders: lists of state ids");
        if (
          event.type === "battle" &&
          !(Number.isInteger(event.cell) && Number.isFinite(event.x) && Number.isFinite(event.y))
        )
          throw new Error("A battle needs a place: give its cell, x and y");
        break;
      case "alliance":
        if (!(areIds(event.states) && event.states.length === 2)) throw new Error("An alliance needs its two states");
        break;
      case "vassalage":
        if (!(isId(event.suzerain) && isId(event.vassal))) throw new Error("A vassalage needs its suzerain and vassal");
        break;
      case "custom":
        if (event.states !== undefined && !areIds(event.states))
          throw new Error("An event's states are a list of state ids");
    }
  }

  /** Renumber a battle's regiments and map its replay's states to the current ones */
  private remapBattle(battle: BattleEvent, renumbered: Map<number, number>): void {
    if (battle.regiments) {
      battle.regiments = battle.regiments.flatMap(ref =>
        renumbered.has(ref.state) ? [{ ...ref, state: renumbered.get(ref.state)! }] : []
      );
      if (!battle.regiments.length) delete battle.regiments;
    }
    if (battle.replay) {
      const current = (id: number) => battle.fought?.[id] ?? id;
      battle.fought = Object.fromEntries(
        this.foughtStateIds(battle.replay).map(id => [id, renumbered.get(current(id)) ?? 0])
      );
    }
  }

  private insert(event: MapEvent): void {
    const list = pack.events;
    let [low, high] = [0, list.length];
    while (low < high) {
      const middle = (low + high) >> 1;
      if (Dates.compare(list[middle].start, event.start) <= 0) low = middle + 1;
      else high = middle;
    }
    list.splice(low, 0, event);
  }

  private replace(event: MapEvent, next: MapEvent): void {
    const list = pack.events;
    const position = list.indexOf(event);
    if (next.start !== event.start) {
      list.splice(position, 1);
      this.insert(next);
    } else list[position] = next;
    const index = this.index();
    if (event.parent !== undefined) index.byParent.get(event.parent)?.delete(event.i);
    if (next.parent !== undefined) this.link(index, next.i, next.parent);
    index.byId.set(next.i, next);
  }

  private link(index: EventIndex, id: number, parent: number): void {
    if (!index.byParent.has(parent)) index.byParent.set(parent, new Set());
    index.byParent.get(parent)!.add(id);
  }

  /** Remove, with their parts, the events none of the user's work is in */
  private removeUnless(events: MapEvent[]): void {
    const { byId } = this.index();
    const gone = events.filter(event => byId.has(event.i) && !this.holdsUserWork(event));
    if (gone.length) this.removeIds(new Set(gone.flatMap(event => [event.i, ...this.partIds(event.i)])));
  }

  private removeIds(ids: Set<number>): void {
    const list = pack.events;
    let kept = 0;
    for (const item of list) if (!ids.has(item.i)) list[kept++] = item;
    list.length = kept;
    this.reindex();
  }

  private require(id: number): MapEvent {
    const event = this.get(id);
    if (!event) throw new Error(`Event ${id} does not exist`);
    return event;
  }

  /** The list's index, rebuilt when the list was replaced or resized directly; `reload` after other direct writes */
  private index(): EventIndex {
    const index = this.indexes.get(pack.events);
    return index && index.byId.size === pack.events.length ? index : this.reindex();
  }

  private reindex(): EventIndex {
    const index: EventIndex = { byId: new Map(), byParent: new Map(), lastId: -1 };
    for (const event of pack.events) {
      index.byId.set(event.i, event);
      index.lastId = Math.max(index.lastId, event.i);
      if (event.parent !== undefined) this.link(index, event.i, event.parent);
    }
    this.indexes.set(pack.events, index);
    return index;
  }
}

export const Events = new EventsModel();

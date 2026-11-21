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

interface EventBase {
  i: number;
  type: EventType;
  name: string;
  start: string; // when it happened or began: "120", "120-03-14" or "120-03-14T10:00"
  end?: string; // when it ended, in the same form; none: still going on
  parent?: number; // the event it is part of: a battle's war
  note?: string;
  tags?: string[];
  auto?: true; // made by the app and not touched by the user since
}

export interface WarEvent extends EventBase {
  type: "war";
  attackers: number[]; // state ids, the first led it
  defenders: number[]; // empty for a vanished foe
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
  fought?: Record<number, number>; // the replay's state ids, kept as fought, to the present ones, 0 for one gone
  regiments?: RegimentRef[];
}

export interface RegimentRef {
  state: number;
  i: number;
}

export interface CustomEvent extends EventBase {
  type: "custom";
  states?: number[];
  act?: string; // the political act that wrote it and its subject, such as "cession:12", while it is the app's
}

export type MapEvent = WarEvent | AllianceEvent | VassalageEvent | BattleEvent | CustomEvent;
export type EventType = "war" | "alliance" | "vassalage" | "battle" | "custom";

type RelationEvent = WarEvent | AllianceEvent | VassalageEvent;

/** What `Events.list` finds: every condition given must hold */
interface EventQuery {
  type?: EventType;
  state?: number; // names the state, on any side
  against?: number; // on the other side from `state`, in a war or a battle
  parent?: number; // a direct part of the event
  regiment?: RegimentRef; // a battle the regiment fought
  ongoing?: boolean; // with no end, or with one
}

/** A new event: the id is given by the list */
export type NewEvent = MapEvent extends infer E ? (E extends MapEvent ? Omit<E, "i"> : never) : never;

/** What the user may change; null clears an optional field */
export interface EventPatch {
  type?: EventType; // another kind: what every kind has is kept; a battle needs its place given with it
  name?: string;
  start?: string;
  end?: string | null;
  parent?: number | null;
  note?: string;
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

const EVENT_TYPES: EventType[] = ["custom", "war", "battle", "alliance", "vassalage"];

const isStateId = (id: unknown): boolean => Number.isInteger(id) && (id as number) >= 0;
const areStateIds = (ids: unknown): boolean => Array.isArray(ids) && ids.every(isStateId);

const isRelation = (event: MapEvent): event is RelationEvent =>
  event.type === "war" || event.type === "alliance" || event.type === "vassalage";

/** Lookups kept beside a list of events, dropped with it */
interface EventIndex {
  byId: Map<number, MapEvent>;
  byParent: Map<number, Set<number>>;
  lastId: number;
}

class EventsModel {
  private readonly indexes = new WeakMap<MapEvent[], EventIndex>(); // by list: a map left behind takes its own with it

  get(id: number): MapEvent | undefined {
    return this.index().byId.get(id);
  }

  /** Every event in order of time, or those the query asks for, all of its conditions met; a kind narrows the type */
  list<T extends EventType>(query: EventQuery & { type: T }): Extract<MapEvent, { type: T }>[];
  list(query?: EventQuery): MapEvent[];
  list(query: EventQuery = {}): MapEvent[] {
    this.index();
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
            Boolean(event.regiments?.some(ref => ref.state === regiment.state && ref.i === regiment.i))))
    );
  }

  /** The parts of an event in order of time, to any depth unless `deep` is false */
  parts(id: number, deep = true): MapEvent[] {
    const { byId, byParent } = this.index();
    const direct = [...(byParent.get(id) ?? [])].map(part => byId.get(part)!).sort(this.order);
    return deep ? direct.flatMap(part => [part, ...this.parts(part.i)]) : direct;
  }

  /** The states an event names */
  statesOf(event: MapEvent): number[] {
    if (event.type === "war" || event.type === "battle") return [...event.attackers, ...event.defenders];
    if (event.type === "alliance") return event.states.filter(Boolean);
    if (event.type === "vassalage") return [event.suzerain, event.vassal].filter(Boolean);
    return event.states ?? [];
  }

  /** The first and the last year of an event, the present for one going on */
  yearsOf(event: MapEvent): [number, number] {
    const end = event.end === undefined ? options.map.lore.calendar.year : Dates.year(event.end);
    return [Dates.year(event.start), end];
  }

  /** "Angria-Tirian War": a name both of a pair can read as theirs, as the app names wars and alliances */
  pairName(a: number, b: number, kind: string): string {
    return `${this.stateName(a)}-${trimVowels(this.stateName(b))}ian ${kind}`;
  }

  /** The user's, or with an event of the user's beneath it */
  holdsUserWork(event: MapEvent): boolean {
    return !event.auto || this.parts(event.i).some(part => !part.auto);
  }

  present(): string {
    return Dates.ofYear(options.map.lore.calendar.year);
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
    const PATCH_FIELDS = new Set(
      "type name start end parent note tags attackers defenders states suzerain vassal winner cell x y".split(" ")
    );
    const unknown = Object.keys(patch).find(field => !PATCH_FIELDS.has(field));
    if (unknown) throw new Error(`An event's ${unknown} cannot be changed`);
    const retyped = patch.type !== undefined && patch.type !== event.type;
    const next = (retyped ? this.retype(event, patch.type!) : { ...event }) as MapEvent & Record<string, unknown>;
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (value === null) delete next[field];
      else next[field] = value;
    }
    if (patch.name !== undefined) next.name = requireName(patch.name);
    if (next.type === "battle" && patch.winner !== undefined) next.status = BattleRules.getStatus(0, 0, next.winner); // as the winner alone says
    if (patch.tags !== undefined) next.tags = Tags.parse(patch.tags);
    if (patch.note === "") delete next.note;
    if (patch.start !== undefined && patch.end === undefined && event.end !== undefined)
      next.end = this.moveEnd(event.start, event.end, next.start);
    this.guardRelation(event, next);
    if (event.type === "battle" && event.replay)
      for (const field of ["attackers", "defenders", "winner", "cell", "x", "y"] as const)
        if (patch[field] !== undefined)
          throw new Error("A played battle keeps what was fought: its sides, result and place");
    if (patch.parent !== undefined && patch.parent !== null) {
      if (patch.parent === id || this.parts(id).some(part => part.i === patch.parent))
        throw new Error("An event cannot be part of itself or of one of its own parts");
    }
    delete next.auto;
    if (next.type === "custom") delete next.act; // the user's now: an act done again no longer rewrites it
    this.validate(next);
    this.replace(event, next);
  }

  /** Remove an event with its parts. Returns the ids removed */
  remove(id: number): number[] {
    const event = this.require(id);
    const ids = new Set([event.i, ...this.parts(id).map(part => part.i)]);
    this.removeIds(ids);
    return [...ids];
  }

  /** Move every date by the same number of years */
  shiftYears(years: number): void {
    if (!years) return;
    for (const event of this.list()) {
      event.start = Dates.shift(event.start, years);
      if (event.end !== undefined) event.end = Dates.shift(event.end, years);
    }
  }

  /** Follow a renumbering of states: ids not in the map are dropped; what is left with no state is removed */
  remapStates(ids: Map<number, number>): void {
    const map = (list: number[]) => list.flatMap(id => (ids.has(id) ? [ids.get(id)!] : []));
    const gone: MapEvent[] = [];
    for (const event of this.list()) {
      if (event.type === "war" || event.type === "battle") {
        event.attackers = map(event.attackers);
        event.defenders = map(event.defenders);
        if (event.type === "battle" && event.regiments) {
          event.regiments = event.regiments.flatMap(ref =>
            ids.has(ref.state) ? [{ ...ref, state: ids.get(ref.state)! }] : []
          );
          if (!event.regiments.length) delete event.regiments;
        }
        if (event.type === "battle" && event.replay) {
          const fought = this.getFoughtStates(event.replay);
          event.fought = Object.fromEntries(fought.map(id => [id, ids.get(event.fought?.[id] ?? id) ?? 0]));
        }
        if (event.type === "war" && !event.attackers.length && !event.defenders.length) gone.push(event);
      } else if (event.type === "alliance") {
        if (event.states.some(id => !ids.has(id))) gone.push(event);
        event.states = event.states.map(id => ids.get(id) ?? 0) as [number, number]; // a state gone is unset, the other renumbered
      } else if (event.type === "vassalage") {
        if (!ids.has(event.suzerain) || !ids.has(event.vassal)) gone.push(event);
        [event.suzerain, event.vassal] = [ids.get(event.suzerain) ?? 0, ids.get(event.vassal) ?? 0];
      } else if (event.states) {
        event.states = map(event.states);
        if (event.auto && !event.states.length) gone.push(event);
      }
    }
    this.removeUnless(gone);
    this.forgetActs(); // their subjects' ids now name others
  }

  /** Acts no longer corrected when done again: all of them, as when ids were renumbered, or those naming a state */
  forgetActs(stateId?: number): void {
    for (const event of this.list({ type: "custom" }))
      if (event.act && (stateId === undefined || event.states?.includes(stateId))) delete event.act;
  }

  /** Regiments that took new ids, as when their state merged into another: their battles follow them */
  moveRegiments(moves: [from: RegimentRef, to: RegimentRef][]): void {
    const targets = new Map(moves.map(([from, to]) => [`${from.state}-${from.i}`, to]));
    for (const battle of this.list({ type: "battle" })) {
      if (!battle.regiments?.some(ref => targets.has(`${ref.state}-${ref.i}`))) continue;
      const moved = battle.regiments.map(ref => targets.get(`${ref.state}-${ref.i}`) ?? ref);
      battle.regiments = moved.filter(
        (ref, k) => moved.findIndex(other => other.state === ref.state && other.i === ref.i) === k
      );
    }
  }

  /** Regiments disbanded or raised anew: their battles forget them, so an id given again inherits none */
  dropRegiments(gone: (ref: RegimentRef) => boolean): void {
    for (const battle of this.list({ type: "battle" })) {
      if (!battle.regiments) continue;
      const kept = battle.regiments.filter(ref => !gone(ref));
      if (kept.length === battle.regiments.length) continue;
      if (kept.length) battle.regiments = kept;
      else delete battle.regiments;
    }
  }

  /** A loaded map's history made sound: unique ids, battles on the cell under them, links that lead nowhere dropped.
   * `misplaced` tells a battle's cell left from another graph. Returns what was repaired */
  repair(misplaced: (x: number, y: number, cell: number) => boolean): string[] {
    const repairs: string[] = [];
    const ids = new Set<number>();
    const valid = (id: unknown): id is number => Number.isInteger(id) && (id as number) >= 0;
    let nextId = pack.events.reduce((most, event) => (valid(event.i) ? Math.max(most, event.i) : most), -1) + 1;
    for (const event of pack.events) {
      if (!valid(event.i) || ids.has(event.i)) {
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
    this.indexes.delete(pack.events);
    return repairs;
  }

  /** The battles on a rebuilt map: each moved to its projected place, or removed with its parts when that is off the map */
  relocateBattles(place: (x: number, y: number) => { x: number; y: number; cell: number } | null): void {
    const offMap = new Set<number>();
    for (const battle of this.list({ type: "battle" })) {
      const moved = place(battle.x, battle.y);
      if (moved) {
        Object.assign(battle, moved);
        if (battle.replay) Object.assign(battle.replay, moved); // refought on its ground as it now lies
      } else offMap.add(battle.i);
    }
    if (offMap.size) this.removeIds(new Set([...offMap].flatMap(id => [id, ...this.parts(id).map(part => part.i)])));
  }

  /** Regenerated relations: the app's ongoing wars, alliances and vassalages go, the user's end at the present */
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

  /** Every pair a state is in, for a state removed or merged: it holds no relation any more */
  followState(stateId: number): void {
    this.followRelations(
      pack.states.filter(state => state.i && state.i !== stateId).map(({ i }): [number, number] => [stateId, i])
    );
  }

  /** A political act of the model, written once: done again for the same subject while it is the present, it corrects */
  logAct(key: string, act: { name: string; states: number[]; tag: string }): number {
    const previous = this.currentAct(key);
    if (previous) {
      Object.assign(previous, { name: act.name, states: act.states });
      return previous.i;
    }
    const present = this.present();
    return this.add({
      type: "custom",
      name: act.name,
      start: present,
      end: present,
      states: act.states,
      tags: [act.tag],
      act: key,
      auto: true
    });
  }

  /** The event of an act done for the subject in this sitting, while the app's and dated the present */
  currentAct(key: string): CustomEvent | undefined {
    const present = this.present();
    return this.list({ type: "custom" }).findLast(
      event => event.act === key && event.auto && event.start === present && event.end === present
    );
  }

  // wording

  /** The state ids a replayed battle was fought by */
  getFoughtStates(replay: BattleReplay): number[] {
    const added = replay.interventions.flatMap(change => (change.kind === "add" ? [change.regiment] : []));
    return [...new Set([...replay.attackers, ...replay.defenders, ...added].map(regiment => regiment.state))];
  }

  /** The present state a replayed battle's state id stands for; undefined for one gone */
  getFoughtState(battle: BattleEvent, id: number): State | undefined {
    const state = pack.states[battle.fought?.[id] ?? id];
    return state?.i && !state.removed ? state : undefined;
  }

  /** A state by its present name; a removed one keeps only its id */
  stateName(id: number): string {
    return pack.states?.[id]?.name || t("former state {{id}}", { id });
  }

  /** Who took part, worded from the present names */
  describeSides(event: MapEvent): string {
    const names = (ids: number[]) => ids.map(id => this.stateName(id)).join(", ");
    if (event.type === "war" || event.type === "battle") {
      if (!event.defenders.length)
        return t("{{attackers}} against a vanished foe", { attackers: names(event.attackers) });
      return t("{{attackers}} against {{defenders}}", {
        attackers: names(event.attackers),
        defenders: names(event.defenders)
      });
    }
    if (event.type === "alliance") return t("Alliance of {{states}}", { states: names(event.states) });
    if (event.type === "vassalage")
      return t("{{vassal}} under {{suzerain}}", {
        vassal: this.stateName(event.vassal),
        suzerain: this.stateName(event.suzerain)
      });
    return names(event.states ?? []);
  }

  /** The outcome of a battle */
  describeResult(event: MapEvent): string {
    if (event.type !== "battle") return "";
    if (event.winner === "attackers") return t("Attackers won");
    if (event.winner === "defenders") return t("Defenders won");
    return t("No victor");
  }

  /** The dates and, when known, the length: "117 – 120 WE (3 years)", "117 WE –" for one going on */
  describeDates(event: MapEvent): string {
    const range =
      this.lasts(event) && event.end === event.start
        ? `${Dates.format(event.start)} – ${Dates.format(event.end)}`
        : Dates.formatRange(event.start, event.end);
    return this.lasts(event) ? `${range} (${Dates.formatLength(event.start, event.end!)})` : range;
  }

  /** It ended, and lasted rather than happened at one time: a war, an alliance or a vassalage does even within a year */
  lasts(event: MapEvent): boolean {
    return event.end !== undefined && (event.end !== event.start || isRelation(event));
  }

  /** An event in a line: its sides, its result and its dates */
  describe(event: MapEvent): string {
    return [this.describeSides(event), this.describeResult(event), this.describeDates(event)]
      .filter(Boolean)
      .map(part => (/[.!?]$/.test(part) ? part : `${part}.`))
      .join(" ");
  }

  // relations

  /** `ongoing`: the ongoing wars, alliances and vassalages, kept up to date for the next pair */
  private followPair(a: number, b: number, ongoing: RelationEvent[]): void {
    const relation = this.relation(a, b);
    const kind =
      relation === "Enemy"
        ? "war"
        : relation === "Ally"
          ? "alliance"
          : relation?.match(/^(Vassal|Suzerain)$/)
            ? "vassalage"
            : null;
    const [suzerain, vassal] = relation === "Vassal" ? [b, a] : [a, b];
    const matches = (event: MapEvent): boolean => {
      if (event.type !== kind) return false;
      if (event.type === "vassalage") return event.suzerain === suzerain && event.vassal === vassal;
      return true;
    };

    const named = ongoing.filter(event => this.names(event, a, b));
    if (!kind && !named.length) return;
    const present = this.present();
    const ending = named.filter(event => !matches(event) && (event.type !== "war" || this.leads(event, a, b)));
    for (const event of ending) if (event.start !== present || this.holdsUserWork(event)) event.end = present;
    this.removeUnless(ending.filter(event => event.end === undefined));
    for (const event of ending) ongoing.splice(ongoing.indexOf(event), 1);

    if (!kind || named.some(matches)) return;
    const reopened = this.list().findLast(
      event =>
        isRelation(event) &&
        matches(event) &&
        event.end === present &&
        (event.type === "war" ? this.leads(event, a, b) : this.names(event, a, b))
    );
    if (reopened) delete reopened.end;
    const event = reopened ?? this.get(this.add(this.relationEvent(kind, a, b, suzerain, vassal, present)));
    ongoing.push(event as RelationEvent);
  }

  private relationEvent(
    kind: "war" | "alliance" | "vassalage",
    a: number,
    b: number,
    suzerain: number,
    vassal: number,
    start: string
  ): NewEvent {
    const base = { start, tags: [kind], auto: true as const };
    if (kind === "war")
      return { ...base, type: "war", name: this.pairName(a, b, "War"), attackers: [a], defenders: [b] };
    if (kind === "alliance")
      return { ...base, type: "alliance", name: this.pairName(a, b, "Alliance"), states: [a, b] };
    const name = `${this.stateName(vassal)} under ${this.stateName(suzerain)}`;
    return { ...base, type: "vassalage", name, suzerain, vassal };
  }

  /** a's relation towards b, none when either is gone */
  private relation(a: number, b: number): string | undefined {
    const [sa, sb] = [pack.states[a], pack.states[b]];
    if (!sa || !sb || sa.removed || sb.removed) return undefined;
    return sa.diplomacy?.[b];
  }

  /** The event names both states: on opposite sides of a war */
  private names(event: RelationEvent, a: number, b: number): boolean {
    if (event.type === "war") return this.opposes(event, a, b);
    if (event.type === "alliance") return event.states.includes(a) && event.states.includes(b);
    return (event.suzerain === a && event.vassal === b) || (event.suzerain === b && event.vassal === a);
  }

  private opposes(event: MapEvent, a: number, b: number): boolean {
    if (event.type !== "war" && event.type !== "battle") return false;
    const { attackers, defenders } = event;
    return (attackers.includes(a) && defenders.includes(b)) || (attackers.includes(b) && defenders.includes(a));
  }

  /** The two states lead the war's sides */
  private leads(war: RelationEvent, a: number, b: number): boolean {
    if (war.type !== "war") return false;
    const [attacker, defender] = [war.attackers[0], war.defenders[0]];
    return (attacker === a && defender === b) || (attacker === b && defender === a);
  }

  /** While it is going on, a war, an alliance or a vassalage follows the relation of its states */
  private guardRelation(event: MapEvent, next: MapEvent): void {
    if (!isRelation(event)) return;
    if (event.end === undefined) {
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
    } else if (next.end === undefined) {
      throw new Error("A war, alliance or vassalage that is over cannot be made ongoing: set the relation instead");
    }
  }

  // the list

  private readonly order = (a: MapEvent, b: MapEvent): number => Dates.compare(a.start, b.start) || a.i - b.i;

  /** The end of an event whose start moves: with the start while the two are one moment, dated in one step; an event
   * that took under a day keeps its length, or ends as it begins once its start gives no time */
  private moveEnd(start: string, end: string, moved: string): string {
    if (end === start) return moved;
    const minutes = Dates.minutesBetween(start, end);
    if (minutes === null || minutes >= 1440) return end;
    return Dates.minutesBetween(moved, moved) === null ? moved : Dates.addMinutes(moved, minutes);
  }

  /** The event as another kind: its name, dates, parent, note and states stay, the tag of its kind is replaced */
  private retype(event: MapEvent, type: EventType): MapEvent {
    if (event.type === "battle" && event.replay) throw new Error("A played battle stays a battle: its replay is one");
    if (isRelation(event) && event.end === undefined)
      throw new Error("An ongoing war, alliance or vassalage follows the relation of its states and keeps its kind");
    if (type !== "custom" && type !== "battle" && event.end === undefined)
      throw new Error("A war, alliance or vassalage set by hand is over: give the event an end first");

    const { i, name, start, end, parent, note } = event;
    const tags = [type, ...(event.tags ?? [])].filter(tag => tag !== "custom" && (tag === type || tag !== event.type));
    const base = {
      i,
      name,
      start,
      ...(end !== undefined && { end }),
      ...(parent !== undefined && { parent }),
      ...(note && { note }),
      ...(tags.length && { tags: [...new Set(tags)] })
    };
    const [first = 0, second = 0, ...rest] = this.statesOf(event);
    const sides = { attackers: [first].filter(Boolean), defenders: [second, ...rest].filter(Boolean) };
    if (type === "war") return { ...base, type, ...sides };
    if (type === "alliance") return { ...base, type, states: [first, second] };
    if (type === "vassalage") return { ...base, type, suzerain: first, vassal: second };
    if (type === "custom") return { ...base, type, ...((first || second) && { states: this.statesOf(event) }) };
    const battle = { winner: null, status: BattleRules.getStatus(0, 0, null) };
    return { ...base, type, ...sides, ...battle } as BattleEvent; // its place comes with the patch
  }

  private validate(event: MapEvent): void {
    if (!event.name || typeof event.name !== "string") throw new Error("An event needs a name");
    if (!EVENT_TYPES.includes(event.type)) throw new Error(`An event is one of: ${EVENT_TYPES.join(", ")}`);
    if (!Dates.parse(event.start)) Dates.year(event.start); // throws the readable error
    if (event.end !== undefined) {
      if (!Dates.parse(event.end)) Dates.year(event.end);
      if (Dates.compareLoosely(event.end, event.start) < 0) throw new Error("An event cannot end before it began");
    }
    if (event.parent !== undefined && !this.index().byId.has(event.parent))
      throw new Error(`Event ${event.parent} does not exist`);
    const sided = event.type === "war" || event.type === "battle";
    if (sided && !(areStateIds(event.attackers) && areStateIds(event.defenders)))
      throw new Error("A war or a battle needs its attackers and defenders: lists of state ids");
    if (
      event.type === "battle" &&
      !(Number.isInteger(event.cell) && Number.isFinite(event.x) && Number.isFinite(event.y))
    )
      throw new Error("A battle needs a place: give its cell, x and y");
    if (event.type === "alliance" && !(areStateIds(event.states) && event.states.length === 2))
      throw new Error("An alliance needs its two states");
    if (event.type === "vassalage" && !(isStateId(event.suzerain) && isStateId(event.vassal)))
      throw new Error("A vassalage needs its suzerain and vassal");
    if (event.type === "custom" && event.states !== undefined && !areStateIds(event.states))
      throw new Error("An event's states are a list of state ids");
  }

  /** The list was written past the model, as by the assistant's proposals: put it in order of time and index it again */
  reload(): void {
    pack.events.sort((a, b) => Dates.compare(a.start, b.start)); // stable: events of one date keep their order
    this.indexes.set(pack.events, this.build(pack.events));
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
    if (next.start !== event.start) {
      list.splice(list.indexOf(event), 1);
      this.insert(next);
    } else list[list.indexOf(event)] = next;
    const index = this.index();
    if (event.parent !== undefined) index.byParent.get(event.parent)?.delete(event.i);
    if (next.parent !== undefined) this.link(index, next.i, next.parent);
    index.byId.set(next.i, next);
  }

  private link(index: EventIndex, id: number, parent: number): void {
    if (!index.byParent.has(parent)) index.byParent.set(parent, new Set());
    index.byParent.get(parent)!.add(id);
  }

  /** Remove, in one pass, the events that hold none of the user's work, with their parts */
  private removeUnless(events: MapEvent[]): void {
    const { byId } = this.index();
    const gone = events.filter(event => byId.has(event.i) && !this.holdsUserWork(event));
    if (gone.length)
      this.removeIds(new Set(gone.flatMap(event => [event.i, ...this.parts(event.i).map(part => part.i)])));
  }

  /** Take the events out of the list and index what is left */
  private removeIds(ids: Set<number>): void {
    const list = pack.events;
    let kept = 0;
    for (const item of list) if (!ids.has(item.i)) list[kept++] = item;
    list.length = kept;
    this.indexes.set(list, this.build(list));
  }

  private require(id: number): MapEvent {
    const event = this.get(id);
    if (!event) throw new Error(`Event ${id} does not exist`);
    return event;
  }

  /** The lookups of the map's list, built on first use and again when the list was changed past the model */
  private index(): EventIndex {
    const index = this.indexes.get(pack.events);
    if (index && index.byId.size === pack.events.length) return index;
    const built = this.build(pack.events);
    this.indexes.set(pack.events, built);
    return built;
  }

  private build(list: MapEvent[]): EventIndex {
    const index: EventIndex = { byId: new Map(), byParent: new Map(), lastId: -1 };
    for (const event of list) {
      index.byId.set(event.i, event);
      index.lastId = Math.max(index.lastId, event.i);
      if (event.parent !== undefined) this.link(index, event.i, event.parent);
    }
    return index;
  }
}

export const Events = new EventsModel();

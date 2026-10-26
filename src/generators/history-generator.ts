// The map's chronicle in `pack.history`: dated events, fallen realms and eras. See docs/plans/history-generation.md
// The model is `Chronicle`, not `History`: the DOM owns that global name
import {
  COLLAPSE_TEMPLATES,
  CORONATION_TEMPLATES,
  FALL_BATTLE_TEMPLATES,
  FOUNDING_TEMPLATES,
  GOLDEN_AGE_TEMPLATES,
  INDEPENDENCE_TEMPLATES,
  MIGRATION_TEMPLATES,
  ONGOING_WAR_TEMPLATES,
  PAST_WAR_TEMPLATES,
  REALM_FORMS,
  REALM_FOUNDING_TEMPLATES,
  REMNANT_TEMPLATES,
  RULER_TITLES,
  SCHISM_TEMPLATES,
  SUBJUGATION_TEMPLATES,
  SUCCESSION_TEMPLATES,
  WAR_GENERAL_TEMPLATES
} from "@/data/history-events";
import {
  type Era,
  emptyHistory,
  type HistoricalFigure,
  type History,
  type HistoryEvent,
  type HistRef,
  type Realm,
  type RealmCause
} from "@/types/history";
import { last, minmax, P, ra, rand, rw } from "@/utils";
import { Emblems } from "./emblems-generator";
import { Epochs } from "./epochs-generator";
import { Markers } from "./markers-generator";
import { Names } from "./names-generator";
import { Notes } from "./notes";
import { States } from "./states-generator";

interface Footprint {
  core: number;
  states: number[];
  score: number;
}

class ChronicleModel {
  /** date what exists and write it into the event log; then weave in fallen realms and leave their traces.
   * In the epochs mode the political past is really generated instead: the chronicle keeps what the engine did */
  generate(): void {
    if (options.map.lore.history.mode === "epochs") {
      this.generateEpochs();
      return;
    }

    const events: HistoryEvent[] = [];
    const founded = this.dateFoundings(events);
    this.emitPastWars(events, founded);
    this.emitOngoingWars(events, founded);
    this.emitVassalages(events, founded);
    this.emitCultureDivergence(events);
    this.emitReligionSchisms(events);
    const eras: Era[] = [];
    const realms = this.emitRealms(events, founded, eras);
    const figures = this.emitFigures(events, founded);
    eras.sort((a, b) => a.from - b.from);
    eras.push({ name: options.map.lore.calendar.era, from: last(eras)?.to ?? this.year - this.span, to: this.year });
    events.sort((a, b) => a.year - b.year);
    events.forEach((event, i) => {
      event.i = i;
    });
    pack.history = { events, realms, eras, figures };
    this.echoes(realms, events);
  }

  /** ensure the pack carries the chronicle; safe to call repeatedly, older saves predate it */
  sync(): History {
    pack.history ??= emptyHistory();
    return pack.history;
  }

  /** the epochs mode: the political events are what the epoch engine did, not an invention;
   * culture and faith remain deep time, dated backwards as always */
  private generateEpochs(): void {
    const events: HistoryEvent[] = [];
    const founded = this.dateFoundings(events, false); // dynasties still date from the state's age; the founding events belong to the polities
    this.emitCultureDivergence(events);
    this.emitReligionSchisms(events);
    const figures = this.emitFigures(events, founded);
    const { epochs, polities, events: political, snapshots } = Epochs.generate();
    events.push(...political);
    events.sort((a, b) => a.year - b.year);
    events.forEach((event, i) => {
      event.i = i;
    });
    pack.history = {
      events,
      realms: [], // the ghost realms are retired: the epochs are real
      eras: epochs.map(epoch => ({ name: epoch.era, from: epoch.from, to: epoch.to })),
      figures,
      epochs,
      polities,
      snapshots
    };
  }

  private get year(): number {
    return options.map.lore.calendar.year;
  }

  private get span(): number {
    return options.map.lore.history.span;
  }

  /** date each state's founding, older on average the larger it is, and record the events;
   * `record` turns the events off, where the polities own the founding story */
  private dateFoundings(events: HistoryEvent[], record = true): number[] {
    const valid = pack.states.filter(s => s.i && !s.removed);
    const largest = Math.max(...valid.map(s => s.area || 1), 1);
    const founded: number[] = [];
    for (const state of valid) {
      const age = this.span * (0.15 + 0.75 * Math.sqrt((state.area || 1) / largest)) * (0.85 + 0.3 * Math.random());
      founded[state.i] = Math.round(minmax(this.year - age, this.year - this.span, this.year - 5));
      if (!record) continue;
      const culture = pack.cultures[state.culture]?.name ?? "an ancient people";
      events.push({
        i: 0,
        year: founded[state.i],
        type: "founding",
        actors: [{ kind: "state", id: state.i }],
        text: ra(FOUNDING_TEMPLATES)(state.fullName || state.name, culture)
      });
    }
    return founded;
  }

  /** one event per war between a pair of states; both sides record the same war in their campaigns */
  private emitPastWars(events: HistoryEvent[], founded: number[]): void {
    const seen = new Set<string>();
    for (const state of pack.states) {
      if (!state.i || state.removed || !state.campaigns) continue;
      for (const campaign of state.campaigns) {
        if (campaign.end === undefined) continue; // ongoing wars are recorded from the relations chronicle
        const key = [
          Math.min(campaign.attacker, campaign.defender),
          Math.max(campaign.attacker, campaign.defender)
        ].join(":");
        if (seen.has(key)) continue;
        seen.add(key);
        const start = Math.max(
          Math.round(campaign.start),
          founded[campaign.attacker] || 0,
          founded[campaign.defender] || 0
        );
        const end = Math.max(Math.round(campaign.end), start + 1);
        events.push({
          i: 0,
          year: start,
          type: "war",
          actors: this.warActors(campaign.attacker, campaign.defender),
          text: ra(PAST_WAR_TEMPLATES)(
            campaign.name,
            this.displayName(campaign.attacker),
            this.displayName(campaign.defender),
            start,
            end
          )
        });
      }
    }
  }

  /** ongoing wars, their stories taken from the relations chronicle the diplomacy generator wrote */
  private emitOngoingWars(events: HistoryEvent[], founded: number[]): void {
    const chronicle = States.getChronicle();
    const seen = new Set<string>();
    for (const state of pack.states) {
      if (!state.i || state.removed || !state.campaigns) continue;
      for (const campaign of state.campaigns) {
        if (campaign.end !== undefined || seen.has(campaign.name)) continue; // one object sits on both sides' campaigns
        seen.add(campaign.name);
        const story = chronicle.find(entry => entry[0] === campaign.name);
        events.push({
          i: 0,
          year: Math.max(Math.round(campaign.start), founded[campaign.attacker] || 0, founded[campaign.defender] || 0),
          type: "war",
          actors: this.warActors(campaign.attacker, campaign.defender),
          text: story
            ? story.slice(1).join(" ")
            : ra(ONGOING_WAR_TEMPLATES)(this.displayName(campaign.attacker), this.displayName(campaign.defender))
        });
      }
    }
  }

  /** every vassalage began somewhere: record the war of subjugation that created it */
  private emitVassalages(events: HistoryEvent[], founded: number[]): void {
    for (const vassal of pack.states) {
      if (!vassal.i || vassal.removed || !vassal.diplomacy) continue;
      vassal.diplomacy.forEach((relation, suzerainId) => {
        if (relation !== "Vassal" || !pack.states[suzerainId] || suzerainId === vassal.i) return;
        const earliest = Math.max(founded[suzerainId] || 0, founded[vassal.i] || 0, this.year - this.span);
        events.push({
          i: 0,
          year: rand(earliest, this.year - 1),
          type: "war",
          actors: this.warActors(suzerainId, vassal.i),
          text: ra(SUBJUGATION_TEMPLATES)(this.displayName(suzerainId), this.displayName(vassal.i))
        });
      });
    }
  }

  /** date each culture split after its parent; roots anchor the start of recorded time */
  private emitCultureDivergence(events: HistoryEvent[]): void {
    const diverged: number[] = [];
    for (const culture of pack.cultures) {
      if (!culture?.i || culture.removed) continue;
      const parent = culture.origins?.find(origin => origin); // 0 and null are roots: wildlands or top level
      if (!parent) continue;
      const year = this.dateAfter(parent, diverged);
      diverged[culture.i] = year;
      events.push({
        i: 0,
        year,
        type: "migration",
        actors: [
          { kind: "culture", id: culture.i },
          { kind: "culture", id: parent }
        ],
        text: ra(MIGRATION_TEMPLATES)(culture.name, pack.cultures[parent]?.name ?? "an elder people")
      });
    }
  }

  /** as cultures: each organized religion, heresy or cult records the schism that created it */
  private emitReligionSchisms(events: HistoryEvent[]): void {
    const diverged: number[] = [];
    for (const religion of pack.religions) {
      if (!religion?.i || religion.removed) continue;
      const parent = religion.origins?.find(origin => origin); // 0 is "no religion": folk religions root there
      if (!parent) continue;
      const year = this.dateAfter(parent, diverged);
      diverged[religion.i] = year;
      events.push({
        i: 0,
        year,
        type: "schism",
        actors: [
          { kind: "religion", id: religion.i },
          { kind: "religion", id: parent }
        ],
        text: ra(SCHISM_TEMPLATES[religion.type] ?? SCHISM_TEMPLATES.Organized)(
          religion.name,
          pack.religions[parent]?.name ?? "an older faith"
        )
      });
    }
  }

  /** dynasties for the major states and a general for every interstate war, each figure made only as an event needs it */
  private emitFigures(events: HistoryEvent[], founded: number[]): HistoricalFigure[] {
    const figures: HistoricalFigure[] = [];
    for (const stateId of this.majorStates()) this.emitDynasty(stateId, founded[stateId], figures, events);
    for (const event of events) {
      if (event.type !== "war") continue;
      const servant = event.actors.find(ref => ref.kind === "state" && ref.id); // a state, not the wilds
      if (servant) this.attachGeneral(event, servant.id, figures);
    }
    return figures;
  }

  /** the states grand enough to be remembered through their dynasties */
  private majorStates(): number[] {
    const valid = pack.states.filter(s => s.i && !s.removed);
    const largest = Math.max(...valid.map(s => s.area || 1), 1);
    return valid.filter(s => (s.area || 0) >= largest / 3).map(s => s.i);
  }

  /** 2–5 rulers whose reigns span the state's founding to the present; each accession is an event */
  private emitDynasty(stateId: number, start: number, figures: HistoricalFigure[], events: HistoryEvent[]): void {
    const state = pack.states[stateId];
    const stateRef: HistRef = { kind: "state", id: stateId };
    const reigns = rand(2, 5);
    const length = (this.year - start) / reigns;
    let predecessor: HistoricalFigure | undefined;
    for (let r = 0, from = start; r < reigns; r++, from += length) {
      const accession = Math.round(from);
      const end = r === reigns - 1 ? undefined : Math.max(accession + 1, Math.round(from + length));
      const figure: HistoricalFigure = {
        i: figures.length,
        name: Names.getCulture(state.culture),
        culture: state.culture,
        birth: accession - rand(18, 40),
        death: end, // reigns end with the ruler; the last figure has neither
        roles: [{ type: "ruler", target: stateRef, from: accession, to: end }]
      };
      const figureRef: HistRef = { kind: "figure", id: figure.i };
      events.push(
        predecessor
          ? {
              i: 0,
              year: accession,
              type: "succession",
              actors: [figureRef, { kind: "figure", id: predecessor.i }, stateRef],
              text: ra(SUCCESSION_TEMPLATES)(figure.name, predecessor.name, state.name)
            }
          : {
              i: 0,
              year: accession,
              type: "coronation",
              actors: [figureRef, stateRef],
              text: ra(CORONATION_TEMPLATES)(figure.name, this.rulerTitle(state), state.name)
            }
      );
      figures.push(figure);
      predecessor = figure;
    }
  }

  private rulerTitle(state: { formName?: string }): string {
    const [masculine, feminine] = RULER_TITLES[state.formName ?? ""] ?? ["Lord", "Lady"];
    return P(0.7) ? masculine : feminine;
  }

  /** the war is remembered through the commander its leading state trusted it to */
  private attachGeneral(event: HistoryEvent, stateId: number, figures: HistoricalFigure[]): void {
    const culture = pack.states[stateId]?.culture ?? 0;
    const figure: HistoricalFigure = {
      i: figures.length,
      name: Names.getCulture(culture),
      culture,
      birth: event.year - rand(20, 45),
      roles: [{ type: "general", target: { kind: "state", id: stateId }, from: event.year }]
    };
    event.actors.push({ kind: "figure", id: figure.i });
    if (P(0.5)) event.text += ` ${ra(WAR_GENERAL_TEMPLATES)(figure.name, this.displayName(stateId))}`;
    figures.push(figure);
  }

  /** weave in fallen empires: the largest state and its neighbors, once one and about to be again */
  private emitRealms(events: HistoryEvent[], founded: number[], eras: Era[]): Realm[] {
    const realms: Realm[] = [];
    const wanted = options.map.lore.history.realms;
    if (!wanted) return realms;
    const claimed = new Set<number>();
    for (const footprint of this.footprints()) {
      if (realms.length >= wanted) break;
      if (footprint.states.some(id => claimed.has(id))) continue;
      for (const id of footprint.states) claimed.add(id);
      realms.push(this.buildRealm(realms.length, footprint, founded, events, eras));
    }
    return realms;
  }

  /** candidate imperial footprints, scored by area and culture coherence */
  private footprints(): Footprint[] {
    const footprints: Footprint[] = [];
    for (const core of pack.states) {
      if (!core?.i || core.removed) continue;
      const states = [core.i, ...(core.neighbors ?? [])].filter(id => pack.states[id] && !pack.states[id].removed);
      if (states.length < 3) continue; // an empire implies several successor realms
      const area = states.reduce((sum, id) => sum + (pack.states[id].area || 0), 0);
      const kin = states.filter(id => pack.states[id].culture === core.culture).length / states.length;
      footprints.push({ core: core.i, states, score: area * (1 + kin) });
    }
    return footprints.sort((a, b) => b.score - a.score);
  }

  private buildRealm(i: number, footprint: Footprint, founded: number[], events: HistoryEvent[], eras: Era[]): Realm {
    const { states, core } = footprint;
    const successorIds = new Set(states);
    const proper = Names.getCultureShort(pack.states[core].culture);
    const name = `${proper} ${rw(REALM_FORMS)}`;
    const realm: Realm = {
      i,
      name,
      coa: Emblems.generate(null, null, null),
      center: 0,
      founded: 0,
      fallen: 0,
      cause: rw({ collapse: 5, conquest: 3, partition: 3 }) as RealmCause,
      successors: states
    };
    const realmRef: HistRef = { kind: "realm", id: i };

    // the realm rises, shines, and falls before the youngest successor was founded
    const youngest = Math.min(...states.map(id => founded[id] ?? this.year));
    const lo = this.year - this.span;
    realm.founded = rand(lo, Math.max(lo + 1, youngest - 2));
    realm.fallen = rand(realm.founded + 1, Math.max(realm.founded + 1, youngest - 1));

    // its seat: the grandest burg of the footprint that is not a capital today
    const inside = new Set(states);
    const cells: number[] = [];
    for (const cellId of pack.cells.i) {
      if (inside.has(pack.cells.state[cellId])) cells.push(cellId);
    }
    let capital: number | undefined;
    let grandest = 0;
    for (const burg of pack.burgs) {
      if (!burg || burg.removed || burg.capital || !cells.includes(burg.cell)) continue;
      if ((burg.population ?? 0) > grandest) {
        grandest = burg.population ?? 0;
        capital = burg.i;
      }
    }
    realm.capital = capital;
    realm.center = capital !== undefined ? pack.burgs[capital].cell : ra(cells);

    events.push({
      i: 0,
      year: realm.founded,
      type: "founding",
      actors: [realmRef],
      loc: realm.center,
      text: ra(REALM_FOUNDING_TEMPLATES)(name, pack.cultures[pack.states[core].culture]?.name ?? "ancient")
    });
    for (let age = rand(1, 2); age > 0; age--) {
      events.push({
        i: 0,
        year: rand(realm.founded + 1, Math.max(realm.founded + 1, realm.fallen - 1)),
        type: "goldenAge",
        actors: [realmRef],
        text: ra(GOLDEN_AGE_TEMPLATES)(name)
      });
    }

    // the fall: a last battle at the frontier between two successors, then the partition
    const [first, second] = states;
    const frontier = this.frontierCell(first, second) ?? realm.center;
    events.push({
      i: 0,
      year: realm.fallen,
      type: "battle",
      actors: [realmRef, { kind: "state", id: first }, { kind: "state", id: second }],
      loc: frontier,
      text: ra(FALL_BATTLE_TEMPLATES)(name)
    });
    events.push({
      i: 0,
      year: realm.fallen,
      type: "collapse",
      actors: [realmRef, ...states.map(id => ({ kind: "state" as const, id }))],
      text: ra(COLLAPSE_TEMPLATES[realm.cause])(name, realm.fallen, this.joinNames(states))
    });

    // vassals inside the footprint first won their independence from the realm
    for (const vassal of pack.states) {
      if (!vassal.i || vassal.removed || !vassal.diplomacy || !inside.has(vassal.i)) continue;
      vassal.diplomacy.forEach((relation, suzerainId) => {
        if (relation !== "Vassal" || !successorIds.has(suzerainId)) return;
        events.push({
          i: 0,
          year: rand(realm.founded + 1, Math.max(realm.founded + 1, realm.fallen - 1)),
          type: "independence",
          actors: [{ kind: "state", id: vassal.i }, realmRef],
          text: ra(INDEPENDENCE_TEMPLATES)(this.displayName(vassal.i), name)
        });
      });
    }

    // a conquered people who survive inside the footprint are the empire's remnant
    const remnant = this.remnantCulture(inside, pack.states[core].culture);
    if (remnant !== undefined) {
      realm.remnantCulture = remnant;
      events.push({
        i: 0,
        year: realm.fallen - 1,
        type: "migration",
        actors: [realmRef, { kind: "culture", id: remnant }],
        text: ra(REMNANT_TEMPLATES)(pack.cultures[remnant]?.name ?? "a foreign", name)
      });
    }

    // some wars between the successors were really about reforging the old borders
    const reforging = events
      .filter(
        event =>
          event.type === "war" &&
          event.actors.length === 2 &&
          event.actors.every(ref => ref.kind === "state" && successorIds.has(ref.id))
      )
      .slice(0, 2);
    for (const war of reforging) war.text += ` Some said the war was fought to reforge the old ${proper} borders.`;

    eras.push({ name: `The ${proper} Era`, from: realm.founded, to: realm.fallen });
    return realm;
  }

  /** a culture with a real presence inside the footprint that is not the core's own */
  private remnantCulture(inside: Set<number>, dominant: number): number | undefined {
    const counts = new Map<number, number>();
    for (const cellId of pack.cells.i) {
      if (!inside.has(pack.cells.state[cellId])) continue;
      const culture = pack.cells.culture[cellId];
      if (culture === dominant) continue;
      counts.set(culture, (counts.get(culture) ?? 0) + 1);
    }
    let best: number | undefined;
    let bestCount = 4; // fewer cells than this is a border quirk, not a people
    counts.forEach((count, culture) => {
      if (count > bestCount) {
        best = culture;
        bestCount = count;
      }
    });
    return best;
  }

  /** a cell of state a on the border with state b */
  private frontierCell(a: number, b: number): number | undefined {
    const frontier: number[] = [];
    for (const cellId of pack.cells.i) {
      if (pack.cells.state[cellId] !== a) continue;
      if (pack.cells.c[cellId].some(neighbor => pack.cells.state[neighbor] === b)) frontier.push(cellId);
    }
    return frontier.length ? ra(frontier) : undefined;
  }

  private joinNames(stateIds: number[]): string {
    const names = stateIds.map(id => this.displayName(id));
    if (names.length <= 1) return names.join("");
    return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  }

  /** leave the realm's traces on the map: ruins, battlefields, notes, a name */
  private echoes(realms: Realm[], events: HistoryEvent[]): void {
    if (!realms.length || !options.map.lore.history.echoes) return;
    for (const realm of realms) this.placeRuins(realm);
    for (const event of events) {
      if (event.type !== "battle" || event.loc === undefined) continue; // sea battles get no marker
      const [x, y] = pack.cells.p[event.loc];
      Markers.place(x, y, "battlefields", { name: `Battle of the Fall of ${this.proper(event)}`, note: event.text });
    }
    for (const realm of realms) this.writeRealmNotes(realm);
    if (options.map.lore.history.renames) States.rename(realms[0].successors[0], `New ${this.properRealm(realms[0])}`);
  }

  private placeRuins(realm: Realm): void {
    const cell = realm.capital !== undefined ? pack.burgs[realm.capital].cell : realm.center;
    const [x, y] = pack.cells.p[cell];
    Markers.place(x, y, "ruins", {
      name: `Ruins of ${this.properRealm(realm)}`,
      note: `Once the seat of the ${realm.name}, which fell in ${realm.fallen}.`
    });
  }

  /** the realm's story, carried by the entities it explains */
  private writeRealmNotes(realm: Realm): void {
    for (const successorId of realm.successors) {
      const state = pack.states[successorId];
      if (!state || state.note) continue; // never overwrite what the user wrote
      Notes.write(
        `state:${successorId}`,
        `${state.name} was carved from the ${realm.name} when it fell in ${realm.fallen}.`
      );
    }
    if (realm.capital !== undefined && !pack.burgs[realm.capital]?.note) {
      Notes.write(
        `burg:${realm.capital}`,
        `Once the pride of the ${realm.name}, the city fell with the empire in ${realm.fallen}.`
      );
    }
  }

  /** the realm's name without its form word: "Vhælen Empire" -> "Vhælen" */
  private properRealm(realm: Realm): string {
    return realm.name.split(" ").slice(0, -1).join(" ");
  }

  /** the proper name a battle event belongs to: "Battle of the Fall of X" names it */
  private proper(event: HistoryEvent): string {
    const realm = event.actors.find(ref => ref.kind === "realm");
    return realm ? this.properRealm(pack.history.realms[realm.id]) : "the Fallen Age";
  }

  /** a divergence date for a child of `parent`: after the parent's own, within recorded time */
  private dateAfter(parent: number, diverged: number[]): number {
    const latest = this.year - 5;
    const earliest = Math.min((diverged[parent] ?? this.year - this.span) + 1, latest);
    return rand(earliest, latest);
  }

  private warActors(attacker: number, defender: number): HistRef[] {
    return [
      { kind: "state", id: attacker },
      { kind: "state", id: defender }
    ];
  }

  /** states 0 is the wilds: wars against it are wars against the tribes */
  private displayName(stateId: number): string {
    return stateId ? (pack.states[stateId]?.name ?? "a forgotten realm") : "the wild tribes";
  }
}

declare global {
  var Chronicle: ChronicleModel;
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const Chronicle = new ChronicleModel();
window.Chronicle = Chronicle;

// The map's chronicle in `pack.history`: dated events, fallen realms and eras. See docs/plans/history-generation.md
// The model is `Chronicle`, not `History`: the DOM owns that global name
import {
  FOUNDING_TEMPLATES,
  MIGRATION_TEMPLATES,
  ONGOING_WAR_TEMPLATES,
  PAST_WAR_TEMPLATES,
  SCHISM_TEMPLATES,
  SUBJUGATION_TEMPLATES
} from "@/data/history-events";
import { emptyHistory, type History, type HistoryEvent, type HistRef } from "@/types/history";
import { minmax, ra, rand } from "@/utils";
import { States } from "./states-generator";

class ChronicleModel {
  /** date what exists and write it into the event log; fallen realms and map echoes come later */
  generate(): void {
    const events: HistoryEvent[] = [];
    const founded = this.dateFoundings(events);
    this.emitPastWars(events, founded);
    this.emitOngoingWars(events, founded);
    this.emitVassalages(events, founded);
    this.emitCultureDivergence(events);
    this.emitReligionSchisms(events);
    events.sort((a, b) => a.year - b.year);
    events.forEach((event, i) => {
      event.i = i;
    });
    pack.history = { events, realms: [], eras: [] };
  }

  /** ensure the pack carries the chronicle; safe to call repeatedly, older saves predate it */
  sync(): History {
    pack.history ??= emptyHistory();
    return pack.history;
  }

  private get year(): number {
    return options.map.lore.calendar.year;
  }

  private get span(): number {
    return options.map.lore.history.span;
  }

  /** date each state's founding, older on average the larger it is, and record the events */
  private dateFoundings(events: HistoryEvent[]): number[] {
    const valid = pack.states.filter(s => s.i && !s.removed);
    const largest = Math.max(...valid.map(s => s.area || 1), 1);
    const founded: number[] = [];
    for (const state of valid) {
      const age = this.span * (0.15 + 0.75 * Math.sqrt((state.area || 1) / largest)) * (0.85 + 0.3 * Math.random());
      founded[state.i] = Math.round(minmax(this.year - age, this.year - this.span, this.year - 5));
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

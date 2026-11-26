// The sample of past history a new map starts with. Rolled from dice of its own, seeded by the map's seed,
// so the map's sequence of rolls is untouched. See docs/prd/events.md#events-of-relations
import Alea from "alea";
import { shuffler } from "d3";
import { gauss } from "@/utils/probability-utils";
import { Dates } from "./dates";
import { Events, type WarEvent } from "./events";

/** A war a state rolled against a neighbour, or against a foe now gone (defender 0) */
export interface RolledWar {
  attacker: number;
  defender: number;
  name: string;
  kind: string; // War, Conquest, Rebellion…
  start: number;
  end: number;
}

const WARS_PER_STATE = 0.6;
const MAX_WARS = 20;

class HistoryGenerator {
  /** How many past wars a map of so many states keeps */
  sampleSize(states: number): number {
    return Math.min(MAX_WARS, Math.round(states * WARS_PER_STATE));
  }

  /** Up to `limit` wars, every state with the same chance of one: the states in a random order take one war of theirs
   * each, those already in a picked war waiting until every other state had its turn */
  pick<T extends { attacker: number; defender: number }>(wars: T[], limit: number, random: () => number): T[] {
    const left = shuffler(random)([...wars]);
    const states = shuffler(random)([...new Set(wars.flatMap(war => [war.attacker, war.defender]))].filter(Boolean));
    const picked: T[] = [];
    const counts = new Map<number, number>();
    for (let round = 0; picked.length < limit && left.length; round++) {
      const before = picked.length;
      for (const state of states) {
        if (picked.length >= limit) break;
        if ((counts.get(state) ?? 0) > round) continue; // had its war this round as the other side of one
        const index = left.findIndex(war => war.attacker === state || war.defender === state);
        if (index === -1) continue;
        const [war] = left.splice(index, 1);
        picked.push(war);
        for (const side of [war.attacker, war.defender]) counts.set(side, (counts.get(side) ?? 0) + 1);
      }
      if (picked.length === before) break;
    }
    return picked;
  }

  /** Keep a sample of the rolled wars: a neighbouring pair keeps the one its more expansionist state rolled */
  writePastWars(rolled: RolledWar[]): void {
    const { states } = pack;
    const pairs = new Map<string, RolledWar>();
    const vanished: RolledWar[] = [];
    for (const war of rolled) {
      if (!war.defender) {
        vanished.push(war);
        continue;
      }
      if (this.leadsPair(war.attacker, war.defender)) pairs.set(this.pairKey(war.attacker, war.defender), war);
    }

    const living = states.filter(state => state.i && !state.removed).length;
    const fought = new Set(Events.list({ type: "war" }).flatMap(war => this.warPairs(war)));
    const ended = Events.list({ type: "war" }).filter(war => war.end !== undefined).length;
    const limit = Math.max(this.sampleSize(living) - ended, 0);
    const candidates = [...pairs.values(), ...vanished].filter(
      war => !fought.has(war.defender ? this.pairKey(war.attacker, war.defender) : `${war.attacker}-0`)
    );

    const picked = this.roll("wars", () => this.pick(candidates, limit, Math.random));
    picked
      .sort((a, b) => a.start - b.start)
      .forEach(war => {
        const { attacker, defender, kind } = war;
        const name = defender ? Events.pairName(attacker, defender, kind) : war.name;
        Events.add({
          type: "war",
          name,
          start: Dates.ofYear(war.start),
          end: Dates.ofYear(war.end),
          attackers: [attacker],
          defenders: defender ? [defender] : [],
          tags: ["war"],
          auto: true
        });
      });
  }

  /** An ongoing war begins a year ago at least, after the last war of its leaders has ended */
  getOngoingStart(rolled: number, a: number, b: number): string {
    const year = options.map.lore.calendar.year;
    const last = this.lastWarEnd(a, b);
    return Dates.ofYear(Math.max(Math.min(Math.max(rolled, last + 1), year - 1), last)); // never before the last one ended
  }

  /** A vassalage for every vassal, begun some years ago and after the last war of the two */
  writeVassalages(): void {
    const { states } = pack;
    const year = options.map.lore.calendar.year;
    this.roll("vassalages", () => {
      for (const vassal of states) {
        if (!vassal.i || vassal.removed) continue;
        vassal.diplomacy?.forEach((relation, suzerain) => {
          if (relation !== "Vassal" || !states[suzerain] || states[suzerain].removed) return;
          const age = gauss(40, 30, 1, 200);
          const start = Math.min(Math.max(year - age, this.lastWarEnd(vassal.i, suzerain) + 1), year - 1);
          Events.add({
            type: "vassalage",
            name: `${vassal.name} under ${states[suzerain].name}`,
            start: Dates.ofYear(start),
            suzerain,
            vassal: vassal.i,
            tags: ["vassalage"],
            auto: true
          });
        });
      }
    });
  }

  private lastWarEnd(a: number, b: number): number {
    const key = this.pairKey(a, b);
    const ends = Events.list({ type: "war" }).flatMap(war =>
      war.end !== undefined && this.warPairs(war).includes(key) ? [Dates.year(war.end)] : []
    );
    return ends.length ? Math.max(...ends) : -Infinity;
  }

  /** The pairs a war sets against each other; a vanished foe counts as state 0 */
  private warPairs(war: WarEvent): string[] {
    const defenders = war.defenders.length ? war.defenders : [0];
    return war.attackers.flatMap(a => defenders.map(d => (d ? this.pairKey(a, d) : `${a}-0`)));
  }

  private pairKey(a: number, b: number): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
  }

  /** The state whose roll a pair keeps: the more expansionist, or with the lower id */
  private leadsPair(a: number, b: number): boolean {
    const [ea, eb] = [pack.states[a].expansionism, pack.states[b].expansionism];
    return ea > eb || (ea === eb && a < b);
  }

  /** Run with the history's own dice; the map's sequence goes on where it was */
  private roll<T>(salt: string, run: () => T): T {
    const mapRandom = Math.random;
    Math.random = Alea(`${options.map.seed}:history:${salt}`);
    try {
      return run();
    } finally {
      Math.random = mapRandom;
    }
  }
}

export const History = new HistoryGenerator();

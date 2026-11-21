import type { LogEntry, LogEvent } from "./battle";
import { ROUND_TICKS } from "./movement";

const MOST = 12; // keyframes a report shows at most
const TOLL: LogEvent[] = ["rout", "surrender", "destroyed", "broken"]; // what makes a moment worth keeping
const DEFAULT_KEY_EVENTS: LogEvent[] = ["clash", "rout", "broken"];

class KeyframesModule {
  /** Ticks of a battle report's keyframes: the start, the rounds with an event of the kinds, the end; an event shows on the field once its tick is over */
  select(log: LogEntry[], kinds: LogEvent[], most = MOST): number[] {
    const end = log.findLast(entry => entry.event === "end")?.tick ?? log.at(-1)?.tick ?? 0;
    const chosen = kinds.length ? kinds : DEFAULT_KEY_EVENTS;
    const rounds = new Map<number, { tick: number; score: number }>();
    for (const { tick, event: logged } of log) {
      if (!tick || tick >= end) continue;
      const event = logged === "raised" ? "broken" : logged; // a siege raised is the moment the besiegers give up
      const round = Math.floor(tick / ROUND_TICKS);
      const key = rounds.get(round);
      const score = +chosen.includes(event) + +TOLL.includes(event);
      if (chosen.includes(event))
        rounds.set(round, { tick: Math.min(tick + 1, end), score: (key?.score ?? 0) + score });
      else if (key) key.score += score;
    }
    const kept = [...rounds.values()]
      .sort((a, b) => b.score - a.score || a.tick - b.tick)
      .slice(0, Math.max(most - 2, 0))
      .map(({ tick }) => tick);
    return [...new Set([0, ...kept.sort((a, b) => a - b), end])];
  }
}

export const Keyframes = new KeyframesModule();

// The recipe a battle is played again from; the field is built anew from the map at its place
import { Dates } from "@/model/story/dates";
import { type BattleEvent, Events } from "@/model/story/events";
import { type Battle, type BattleRegiment, Battles, type Intervention, type Settled } from "./battle";
import { SIDES, type Side } from "./battle-rules";
import { TICK_SECONDS } from "./battle-scale";
import { Battlefields } from "./battlefield";

/** Its tick is the one the battle was applied at */
export interface BattleReplay
  extends Pick<
    Battle,
    | "type"
    | "name"
    | "place"
    | "x"
    | "y"
    | "cell"
    | "approach"
    | "units"
    | "populationScale"
    | "settings"
    | "seed"
    | "hour"
    | "latitude"
    | "weather"
    | "mud"
    | "ice"
    | "heat"
    | "interventions"
    | "settled"
    | "tick"
  > {
  version: string; // of the app it was fought in
  attackers: BattleRegiment[]; // as they joined at the start; latecomers are in the interventions
  defenders: BattleRegiment[];
}

/** A battle set up anew at its start, with the changes to make on the way */
export interface BattleStart {
  battle: Battle;
  script: Intervention[];
  settled: Settled | null; // what the generals settled on: they do not think it through again
  until?: number; // a past battle stops at the tick it was applied at
}

const TICKS_PER_PAUSE = 200; // a long battle lets the screen breathe while it is played out

class BattleReplaysModule {
  /** The recipe of a battle as it stands: the ground at the start, the troops as they joined, the changes made */
  record(battle: Battle, ground: Pick<Battle, "weather" | "mud" | "ice" | "heat">, version: string): BattleReplay {
    const late = new Set(
      battle.interventions.flatMap(change =>
        change.kind === "add" ? [`${change.regiment.state}-${change.regiment.i}`] : []
      )
    );
    const initial = (side: Side) =>
      battle[side].regiments.filter(regiment => !late.has(`${regiment.state}-${regiment.i}`));
    const { type, name, place, x, y, cell, approach, units, populationScale, settings, seed, hour, latitude } = battle;
    return structuredClone({
      version,
      type,
      name,
      place,
      x,
      y,
      cell,
      approach,
      units,
      populationScale,
      settings,
      ...(seed !== undefined && { seed }),
      hour,
      latitude,
      ...ground,
      attackers: initial("attackers"),
      defenders: initial("defenders"),
      interventions: battle.interventions,
      settled: battle.settled,
      tick: battle.tick
    });
  }

  /** The battle at its start, on a field built from the map at its place */
  start(replay: BattleReplay): BattleStart {
    const {
      type,
      x,
      y,
      approach,
      attackers,
      defenders,
      interventions,
      settled,
      tick: _,
      version: __,
      ...rest
    } = replay;
    const field =
      type === "naval"
        ? Battlefields.createEmpty("sea")
        : type === "air"
          ? Battlefields.createEmpty("sky")
          : Battlefields.createMapField(x, y);
    const battle = Battles.create({
      ...structuredClone(rest),
      type,
      x,
      y,
      axis: approach,
      field,
      attackers: structuredClone(attackers),
      defenders: structuredClone(defenders)
    });
    return { battle, script: structuredClone(interventions), settled, until: replay.tick };
  }

  /** Keep an applied battle in the history: part of the war of its leaders, with its replay and the regiments that
   * fought. Returns the event's id */
  keep(battle: Battle, ground: Pick<Battle, "weather" | "mud" | "ice" | "heat">, version: string): number {
    const { winner, status } = Battles.getResult(battle);
    const [attackers, defenders] = SIDES.map(side => [...new Set(battle[side].regiments.map(({ state }) => state))]);
    const parent = this.getWar(attackers, defenders);
    const { start, end } = this.getDates(battle, parent);
    return Events.add({
      type: "battle",
      name: battle.name,
      start,
      end,
      parent,
      cell: battle.cell,
      x: battle.x,
      y: battle.y,
      attackers,
      defenders,
      winner,
      status,
      tags: battle.type === "field" ? ["battle"] : ["battle", battle.type],
      replay: this.record(battle, ground, version),
      regiments: SIDES.flatMap(side => battle[side].regiments.map(({ state, i }) => ({ state, i })))
    });
  }

  /** The war a battle is part of: the ongoing one that has its leaders on opposite sides, the latest begun; or one of
   * theirs that ended this year; or a new one of this year, which their relation reopens if they turn enemies */
  private getWar(attackers: number[], defenders: number[]): number | undefined {
    const [attacker, defender] = [attackers[0], defenders[0]];
    if (!attacker || !defender || attacker === defender) return undefined;
    const present = Events.present();
    const wars = Events.list({ type: "war", state: attacker, against: defender });
    const war = wars.findLast(war => war.end === undefined) ?? wars.findLast(war => war.end === present);
    if (war) return war.i;
    const name = Events.pairName(attacker, defender, "War");
    return Events.add({
      type: "war",
      name,
      start: present,
      end: present,
      attackers,
      defenders,
      tags: ["war"],
      auto: true
    });
  }

  /** When the battle was fought: the hour it began at and the time it took, on a day of the current year. The map
   * has no current day, so the day is rolled from the battle's seed, after what its war already has in that year */
  private getDates(battle: Battle, warId?: number): { start: string; end: string } {
    const { year } = options.map.lore.calendar;
    const first = this.getFirstDay(warId, year);
    const day = first + Math.floor(Battlefields.mix(battle.seed ?? battle.cell, 365, 1) * (365 - first));
    const start = Dates.write({ year, ...Dates.ofDay(day), hour: battle.hour, minute: 0 });
    return { start, end: Dates.addMinutes(start, (battle.tick * TICK_SECONDS) / 60) };
  }

  /** The first day of the year a new battle of the war may fall on: not before the war began, and after its parts
   * dated to a day of that year, so battles are listed in the order they were fought */
  private getFirstDay(warId: number | undefined, year: number): number {
    const war = warId === undefined ? undefined : Events.get(warId);
    if (!war) return 0;
    const inYear = (date: string) => Dates.year(date) === year && Dates.hasDay(date);
    const began = inYear(war.start) ? Dates.dayOfYear(war.start) : 0;
    const parts = Events.parts(war.i, false).map(part => part.end ?? part.start);
    const taken = parts.filter(inYear).map(date => Dates.dayOfYear(date) + 1);
    return Math.min(Math.max(began, ...taken), 364);
  }

  /** Play the battle out to the tick it was applied at, undrawn; `progress` hears the share done */
  async play(replay: BattleReplay, progress?: (share: number) => void): Promise<Battle> {
    const { battle, script, settled } = this.start(replay);
    Battles.applyDue(battle, script);
    Battles.plan(battle, settled);
    while (!battle.result && battle.tick < replay.tick) {
      Battles.tick(battle);
      Battles.applyDue(battle, script);
      if (battle.tick % TICKS_PER_PAUSE === 0) {
        progress?.(battle.tick / replay.tick);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    if (!battle.result) Battles.settleLosses(battle); // applied before its end, as the apply counted it
    return battle;
  }

  /** The replay ends as the event records it */
  matches(battle: Battle, event: BattleEvent): boolean {
    const { winner, status } = Battles.getResult(battle);
    return winner === event.winner && SIDES.every((_, i) => status[i] === event.status[i]);
  }
}

export const BattleReplays = new BattleReplaysModule();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultMilitaryUnits } from "@/model/political/military-units";
import { Dates } from "@/model/story/dates";
import { type BattleEvent, Events } from "@/model/story/events";
import { type Battle, type BattleRegiment, Battles } from "./battle";
import { Battlefields } from "./battlefield";
import { BattleReplays } from "./replay";

const regiment = (state: number, troops: Record<string, number>): BattleRegiment => ({
  state,
  i: 0,
  name: `Regiment ${state}`,
  icon: "",
  troops,
  upkeep: 1,
  stability: 0.5,
  distance: 0
});

const GROUND = { weather: "clear", mud: false, ice: false, heat: false } as const;

function fight(until = Infinity): Battle {
  const battle = Battles.create({
    type: "field",
    name: "Test",
    place: null,
    x: 10,
    y: 10,
    cell: 0,
    axis: 0,
    field: Battlefields.createEmpty(),
    units: getDefaultMilitaryUnits(),
    populationScale: 1000,
    attackers: [regiment(1, { infantry: 900, archers: 300 })],
    defenders: [regiment(2, { infantry: 700, cavalry: 100 })],
    seed: 42
  });
  const script = [{ tick: 4, kind: "morale" as const, side: "defenders" as const, value: 80 }];
  Battles.applyDue(battle, script);
  Battles.plan(battle);
  while (!battle.result && battle.tick < until) {
    Battles.tick(battle);
    Battles.applyDue(battle, script);
  }
  if (!battle.result) Battles.settleLosses(battle);
  return battle;
}

const asEvent = (battle: Battle): BattleEvent => {
  const { winner, status } = Battles.getResult(battle);
  return { winner, status } as BattleEvent;
};

describe("BattleReplays", () => {
  beforeEach(() => vi.spyOn(Battlefields, "createMapField").mockImplementation(() => Battlefields.createEmpty()));
  afterEach(() => vi.restoreAllMocks());

  it("plays a battle again to the recorded result and losses", async () => {
    const battle = fight();
    const replay = BattleReplays.record(battle, GROUND, "test");
    const again = await BattleReplays.play(replay);
    expect(again.tick).toBe(battle.tick);
    expect(BattleReplays.matches(again, asEvent(battle))).toBe(true);
    expect(again.attackers.casualties).toBeCloseTo(battle.attackers.casualties);
    expect(again.defenders.casualties).toBeCloseTo(battle.defenders.casualties);
  });

  it("stops a battle applied before its end at the tick it was applied at", async () => {
    const battle = fight(30);
    const replay = BattleReplays.record(battle, GROUND, "test");
    const again = await BattleReplays.play(replay);
    expect(again.tick).toBe(30);
    expect(again.result).toBeNull();
    expect(again.defenders.casualties).toBeCloseTo(battle.defenders.casualties);
  });

  it("keeps an applied battle as one event in its war, with its replay and regiments", () => {
    vi.stubGlobal("options", { map: { lore: { calendar: { year: 120 } } } });
    vi.stubGlobal("pack", {
      events: [
        { i: 0, type: "war", name: "Old", start: "90", attackers: [1], defenders: [2] },
        { i: 1, type: "war", name: "Present", start: "110", attackers: [2], defenders: [1, 3] },
        { i: 2, type: "war", name: "Other", start: "115", attackers: [1], defenders: [3] }
      ],
      markers: []
    });
    const battle = fight();
    const id = BattleReplays.keep(battle, GROUND, "test");
    expect(pack.events.filter(event => event.type === "battle")).toHaveLength(1);
    expect(pack.events.find(event => event.i === id)).toMatchObject({
      type: "battle",
      name: "Test",
      start: expect.stringMatching(/^120-\d\d-\d\dT12:00$/), // a day of the current year, at the hour it began
      parent: 1, // the latest begun war of its leaders, whichever attacked
      attackers: [1],
      defenders: [2],
      tags: ["battle"],
      regiments: [
        { state: 1, i: 0 },
        { state: 2, i: 0 }
      ],
      replay: { tick: battle.tick, version: "test" }
    });
    expect(pack.markers).toEqual([]);
    const { start, end } = Events.get(id)!;
    expect(Dates.addMinutes(start, (battle.tick * 8) / 60)).toBe(end); // it took as long as it was fought
  });

  it("begins a war for a battle of states not at war, and puts their next battle of the year in it", () => {
    vi.stubGlobal("options", { map: { lore: { calendar: { year: 120 } } } });
    const states = [{ name: "Neutrals" }, { name: "Angria" }, { name: "Tiria" }];
    vi.stubGlobal("pack", {
      states,
      events: [{ i: 0, type: "war", name: "Old", start: "90", end: "95", attackers: [1], defenders: [2] }]
    });
    const first = Events.get(BattleReplays.keep(fight(), GROUND, "test"))!;
    const war = Events.get(first.parent!)!;
    expect(war).toMatchObject({
      type: "war",
      name: "Angria-Tirian War",
      start: "120",
      end: "120",
      attackers: [1],
      defenders: [2],
      tags: ["war"]
    });
    const second = Events.get(BattleReplays.keep(fight(30), GROUND, "test"))!;
    expect(second.parent).toBe(war.i);
    expect(Events.list({ type: "war" })).toHaveLength(2);
    expect(Dates.dayOfYear(second.start)).toBeGreaterThan(Dates.dayOfYear(first.end!)); // listed in the order fought
  });

  it("dates a battle no earlier than its war began in the year", () => {
    vi.stubGlobal("options", { map: { lore: { calendar: { year: 120 } } } });
    const war = { i: 0, type: "war", name: "Late", start: "120-12-30", attackers: [1], defenders: [2] };
    vi.stubGlobal("pack", { states: [], events: [war] });
    const battle = Events.get(BattleReplays.keep(fight(), GROUND, "test"))!;
    expect(battle.parent).toBe(0);
    expect(Dates.dayOfYear(battle.start)).toBeGreaterThanOrEqual(Dates.dayOfYear("120-12-30"));
  });

  it("tells when the battle no longer plays out as recorded", async () => {
    const battle = fight();
    const replay = BattleReplays.record(battle, GROUND, "test");
    replay.attackers[0].troops = { infantry: 10 };
    const again = await BattleReplays.play(replay);
    expect(BattleReplays.matches(again, asEvent(battle))).toBe(false);
  });
});

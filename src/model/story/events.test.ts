import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleRegiment } from "@/model/political/battle/battle";
import type { BattleReplay } from "@/model/political/battle/replay";
import { States } from "@/model/political/states-generator";
import { type BattleEvent, Events, type MapEvent, type NewEvent } from "./events";
import { Notes } from "./notes";

const war = (start: string, extra: Partial<NewEvent> = {}): NewEvent =>
  ({ type: "war", name: `War ${start}`, start, end: start, attackers: [1], defenders: [2], ...extra }) as NewEvent;

const statesPack = (count: number) => ({
  states: Array.from({ length: count + 1 }, (_, i) => ({
    i,
    name: i ? `S${i}` : "Neutrals",
    diplomacy: Array.from({ length: count + 1 }, (_, j) => (i && j && i !== j ? "Neutral" : "x")),
    military: []
  })),
  events: [] as MapEvent[]
});

beforeEach(() => {
  vi.stubGlobal("options", { map: { seed: "1", lore: { calendar: { year: 120, eraShort: "WE" } } } });
  vi.stubGlobal("pack", statesPack(4));
});

describe("Events: the list", () => {
  it("keeps the order of time, events of one date in the order they were added", () => {
    const a = Events.add(war("120"));
    const b = Events.add(war("100"));
    const c = Events.add(war("120"));
    const d = Events.add(war("120-01-01"));
    expect(Events.list().map(event => event.i)).toEqual([b, a, c, d]);
    Events.update(b, { start: "121", end: "121" });
    expect(Events.list().map(event => event.i)).toEqual([a, c, d, b]);
  });

  it("removes parts to any depth", () => {
    const w = Events.add(war("100", { end: "105" }));
    const battle = Events.add({
      type: "battle",
      name: "Battle",
      start: "101",
      end: "101",
      parent: w,
      cell: 0,
      x: 0,
      y: 0,
      attackers: [1],
      defenders: [2],
      winner: null,
      status: ["stalemate", "stalemate"]
    });
    const note = Events.add({ type: "custom", name: "Note", start: "101", end: "101", parent: battle });
    expect(Events.parts(w).map(event => event.i)).toEqual([battle, note]);
    expect(Events.remove(w)).toEqual([w, battle, note]);
    expect(pack.events).toEqual([]);
  });

  it("refuses to make an event part of itself or of its own parts, and an end before the start", () => {
    const a = Events.add(war("100"));
    const b = Events.add({ ...war("101"), parent: a });
    expect(() => Events.update(a, { parent: b })).toThrow("part of itself");
    expect(() => Events.update(a, { parent: a })).toThrow("part of itself");
    expect(() => Events.update(a, { end: "99" })).toThrow("end before it began");
    Events.update(a, { start: "100-03-01", end: "100" }); // equal at the year
  });

  it("shifts every date and finds a war from either side", () => {
    const id = Events.add(war("100-02-03", { end: undefined, auto: true }));
    Events.shiftYears(-200);
    expect(Events.get(id)!.start).toBe("-100-02-03");
    expect(Events.list({ type: "war", ongoing: true, state: 2 }).map(({ i }) => i)).toEqual([id]);
    expect(Events.list({ type: "war", ongoing: true, state: 3 })).toEqual([]);
  });

  it("remaps state ids and removes the app's war left with no state", () => {
    const kept = Events.add(war("100"));
    const empty = Events.add({ ...war("101"), auto: true });
    Events.add(war("101", { attackers: [3], defenders: [], auto: true } as Partial<NewEvent>));
    Events.remapStates(
      new Map([
        [1, 1],
        [2, 2]
      ])
    );
    expect(Events.list().map(event => event.i)).toEqual([kept, empty]);
    Events.remapStates(new Map([[1, 4]]));
    expect(Events.get(kept)).toMatchObject({ attackers: [4], defenders: [] });
    expect(Events.get(empty)).toMatchObject({ attackers: [4] });
  });

  it("keeps a replay's state ids as fought and follows them to the present states; moves it with its battle", () => {
    const fighter = (state: number, i: number) => ({ state, i }) as BattleRegiment;
    const replay = {
      x: 10,
      y: 20,
      cell: 3,
      attackers: [fighter(1, 1)],
      defenders: [fighter(2, 1)],
      interventions: [{ tick: 5, kind: "add", side: "defenders", regiment: fighter(3, 2) }]
    } as unknown as BattleReplay;
    const id = Events.add({
      type: "battle",
      name: "Battle",
      start: "101",
      end: "101",
      cell: 3,
      x: 10,
      y: 20,
      attackers: [1],
      defenders: [2, 3],
      winner: null,
      status: ["stalemate", "stalemate"],
      replay
    });
    const battle = () => Events.get(id) as BattleEvent;
    const name = (fought: number) => Events.currentStateOf(battle(), fought)?.name;
    expect([1, 2, 3].map(name)).toEqual(["S1", "S2", "S3"]);

    Events.remapStates(
      new Map([
        [0, 0],
        [1, 2],
        [3, 1]
      ])
    ); // state 2 is gone, 1 and 3 renumbered
    expect([1, 2, 3].map(name)).toEqual(["S2", undefined, "S1"]);
    expect(battle().replay!.attackers[0].state).toBe(1); // the replay is as it was fought
    Events.remapStates(
      new Map([
        [0, 0],
        [1, 1]
      ])
    );
    expect([1, 2, 3].map(name)).toEqual([undefined, undefined, "S1"]);

    Events.relocateBattles(() => ({ x: 30, y: 40, cell: 7 }));
    expect(battle().replay).toMatchObject({ x: 30, y: 40, cell: 7 });
  });

  it("gives an event a new id when a loaded file has one that is not a whole number", () => {
    const kept = Events.add(war("100"));
    pack.events.push({ ...war("101"), i: '0"><img src=x onerror=alert(1)>' } as unknown as MapEvent);
    const repairs = Events.repair(() => false);
    expect(repairs).toHaveLength(1);
    expect(pack.events.map(event => event.i)).toEqual([kept, kept + 1]);
  });

  it("refuses an event without what its kind needs, and a change of what the user does not set", () => {
    expect(() => Events.add({ type: "war", name: "W", start: "10", end: "20" } as NewEvent)).toThrow("attackers");
    expect(() => Events.add({ ...war("10"), type: "battle", winner: null } as NewEvent)).toThrow("place");
    expect(() => Events.add({ type: "alliance", name: "A", start: "10", end: "20", states: [1] } as never)).toThrow();
    const id = Events.add(war("10"));
    expect(() => Events.update(id, { i: 5 } as never)).toThrow("cannot be changed");
    expect(pack.events).toHaveLength(1);
  });

  it("orders and indexes again a list written past the model", () => {
    const [a, b] = [Events.add(war("10")), Events.add(war("20"))];
    pack.events.splice(0, 1);
    pack.events.push({ ...war("15"), i: 7 } as MapEvent, { ...war("5"), i: 8, parent: b } as MapEvent);
    Events.reload();
    expect(pack.events.map(event => event.i)).toEqual([8, 7, b]);
    expect(Events.get(a)).toBeUndefined();
    expect(Events.parts(b).map(event => event.i)).toEqual([8]);
    expect(Events.add(war("30"))).toBe(9);
  });

  it("makes an event the user's on any change; its tags are normalized and matched", () => {
    const id = Events.add({ ...war("100"), tags: ["war", "conquest"], auto: true });
    Events.update(id, { tags: "Conquest, Famous!" });
    expect(Events.get(id)).toMatchObject({ tags: ["conquest", "famous"] });
    expect(Events.get(id)!.auto).toBeUndefined();
  });
});

describe("Events: relations set by hand", () => {
  const relations = () => pack.events.map(({ i, name, ...rest }) => JSON.stringify(rest)).sort();

  it("begins an event, ends it, reopens it right away, and drops a trial", () => {
    States.setRelation(1, 2, "Enemy");
    const [war] = pack.events;
    expect(war).toMatchObject({ type: "war", attackers: [1], defenders: [2], start: "120", tags: ["war"], auto: true });
    expect(war.end).toBeUndefined();
    States.setRelation(1, 2, "Neutral");
    expect(pack.events).toEqual([]); // begun and dropped in one sitting
    expect(() => Events.add({ type: "war", name: "Mine", start: "100", attackers: [1], defenders: [2] })).toThrow(
      "give it an end"
    );
  });

  it("keeps the start, name and battles of a war ended and declared again", () => {
    const id = Events.add({ type: "war", name: "Old War", start: "100", attackers: [1], defenders: [2], auto: true });
    pack.states[1].diplomacy![2] = pack.states[2].diplomacy![1] = "Enemy";
    States.setRelation(2, 1, "Neutral");
    expect(Events.get(id)!.end).toBe("120");
    States.setRelation(2, 1, "Enemy");
    expect(pack.events).toHaveLength(1);
    expect(Events.get(id)).toMatchObject({ start: "100", name: "Old War" });
    expect(Events.get(id)!.end).toBeUndefined();
  });

  it("keeps and ends a trial war that holds the user's work", () => {
    States.setRelation(1, 2, "Enemy");
    const id = pack.events[0].i;
    Events.add({ type: "custom", name: "Mine", start: "120", end: "120", parent: id });
    States.setRelation(1, 2, "Friendly");
    expect(Events.get(id)!.end).toBe("120");
  });

  it("begins a second war in the same year once the first one's end is dated", () => {
    States.setRelation(1, 2, "Enemy");
    const id = pack.events[0].i;
    Events.update(id, { name: "First War" });
    States.setRelation(1, 2, "Neutral");
    Events.update(id, { end: "120-05-01" });
    States.setRelation(1, 2, "Enemy");
    expect(Events.list({ type: "war" })).toHaveLength(2);
  });

  it("ends a war by its leaders only", () => {
    const id = Events.add({ type: "war", name: "War", start: "100", attackers: [1, 3], defenders: [2], auto: true });
    pack.states[1].diplomacy![2] = pack.states[2].diplomacy![1] = "Enemy";
    pack.states[3].diplomacy![2] = pack.states[2].diplomacy![3] = "Enemy";
    States.setRelation(3, 2, "Neutral");
    expect(Events.get(id)).toMatchObject({ attackers: [1, 3] });
    expect(Events.get(id)!.end).toBeUndefined();
    States.setRelation(1, 2, "Ally");
    expect(Events.get(id)!.end).toBe("120");
    expect(Events.list({ type: "alliance" })).toMatchObject([{ states: [1, 2], start: "120" }]);
  });

  it("gives a vassalage its suzerain and vassal", () => {
    States.setRelation(3, 4, "Vassal");
    expect(pack.events).toMatchObject([{ type: "vassalage", suzerain: 4, vassal: 3, name: "S3 under S4" }]);
  });

  it("leaves after any series of changes what one change to the final relations would", () => {
    const kinds = ["Enemy", "Ally", "Vassal", "Suzerain", "Neutral", "Rival"];
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
    for (let round = 0; round < 30; round++) {
      vi.stubGlobal("pack", statesPack(4));
      Events.add({ type: "war", name: "Old", start: "90", attackers: [1], defenders: [2], auto: true });
      pack.states[1].diplomacy![2] = pack.states[2].diplomacy![1] = "Enemy";
      const before = structuredClone(pack);
      const pairs: [number, number][] = [
        [1, 2],
        [2, 3],
        [1, 3]
      ];
      for (let step = 0; step < 8; step++) {
        const [a, b] = pick(pairs);
        States.setRelation(a, b, pick(kinds));
      }
      const final = pack.states.map(state => state.diplomacy?.slice());
      const steps = relations();

      vi.stubGlobal("pack", before);
      for (const [a, b] of pairs) {
        const relation = final[a]![b];
        if (pack.states[a].diplomacy![b] !== relation) States.setRelation(a, b, relation);
      }
      expect(steps).toEqual(relations());
    }
  });
});

describe("Events: dates, notes and renumbering", () => {
  it("turns an event into another kind, keeping what every kind has and its states", () => {
    const id = Events.add({
      type: "custom",
      name: "Feud",
      start: "100",
      end: "104",
      states: [1, 2, 3],
      tags: ["feud"]
    });
    Events.update(id, { type: "war" });
    expect(Events.get(id)).toEqual({
      i: id,
      type: "war",
      name: "Feud",
      start: "100",
      end: "104",
      attackers: [1],
      defenders: [2, 3],
      tags: ["war", "feud"]
    });
    Events.update(id, { type: "vassalage" });
    expect(Events.get(id)).toMatchObject({ type: "vassalage", suzerain: 1, vassal: 2, tags: ["vassalage", "feud"] });
    expect(() => Events.update(id, { type: "battle" })).toThrow("A battle needs a place");
    Events.update(id, { type: "battle", cell: 5, x: 10, y: 20 });
    expect(Events.get(id)).toMatchObject({ type: "battle", cell: 5, attackers: [1], defenders: [2], winner: null });
    Events.update(id, { type: "custom" });
    expect(Events.get(id)).toMatchObject({ type: "custom", states: [1, 2], tags: ["feud"] });
    expect(Events.get(id)).not.toHaveProperty("cell");
  });

  it("keeps the length of an event that took under a day when its start moves", () => {
    const base = { type: "custom", name: "Feast" } as const;
    const id = Events.add({ ...base, start: "120-03-14T09:00", end: "120-03-14T09:30" });
    Events.update(id, { start: "120-03-20T18:00" });
    expect(Events.get(id)).toMatchObject({ start: "120-03-20T18:00", end: "120-03-20T18:30" });
    Events.update(id, { start: "120-03-02" }); // no time any more: it ends as it begins
    expect(Events.get(id)).toMatchObject({ start: "120-03-02", end: "120-03-02" });
    const long = Events.add({ ...base, start: "120-03-14", end: "120-05-01" });
    Events.update(long, { start: "120-03-10" });
    expect(Events.get(long)).toMatchObject({ start: "120-03-10", end: "120-05-01" });
    expect(() => Events.update(long, { start: "120-06-01" })).toThrow("cannot end before it began");
  });

  it("keeps the kind of an ongoing relation and of a played battle, and wants an end for a relation set by hand", () => {
    const ongoing = Events.add({ type: "war", name: "War", start: "100", attackers: [1], defenders: [2], auto: true });
    expect(() => Events.update(ongoing, { type: "custom" })).toThrow("keeps its kind");
    const open = Events.add({ type: "custom", name: "Plague", start: "100" });
    expect(() => Events.update(open, { type: "alliance" })).toThrow("give the event an end first");
    const played = Events.add({
      ...war("100"),
      type: "battle",
      cell: 1,
      x: 1,
      y: 1,
      winner: null,
      replay: {}
    } as NewEvent);
    expect(() => Events.update(played, { type: "war" })).toThrow("stays a battle");
  });

  it("shows a war begun and ended in one year as lasting under a year, a battle as one moment", () => {
    const war = Events.add({
      type: "war",
      name: "Short War",
      start: "120",
      end: "120",
      attackers: [1],
      defenders: [2]
    });
    expect(Events.describeDates(Events.get(war)!)).toBe("120 WE – 120 WE (under a year)");
    const battle = Events.add({ type: "custom", name: "Feast", start: "120", end: "120" });
    expect(Events.describeDates(Events.get(battle)!)).toBe("120 WE");
  });

  it("keeps a note on an event through the notes store, making it the user's, and removes it with the event", () => {
    const id = Events.add({ ...war("100"), auto: true } as NewEvent);
    Notes.set({ type: "event", id }, "<p>Forty days</p>");
    expect(Events.get(id)).toMatchObject({ note: "<p>Forty days</p>" });
    expect(Events.get(id)!.auto).toBeUndefined();
    expect(Notes.list().map(entry => entry.key)).toContain(`event:${id}`);
    Events.remove(id);
    expect(Notes.list().map(entry => entry.key)).not.toContain(`event:${id}`);
  });

  it("renumbers the user's alliance and vassalage when one of their states is gone", () => {
    Events.add({ type: "alliance", name: "Pact", start: "100", end: "110", states: [2, 3] });
    Events.add({ type: "vassalage", name: "Fief", start: "100", end: "110", suzerain: 3, vassal: 2 });
    Events.remapStates(new Map([[3, 1]]));
    expect(pack.events).toMatchObject([{ states: [0, 1] }, { suzerain: 1, vassal: 0 }]);
  });

  it("finds a war by the states on each side", () => {
    const id = Events.add({ ...war("100"), attackers: [1, 3], defenders: [2] } as NewEvent);
    expect(Events.list({ type: "war", state: 2, against: 3 }).map(({ i }) => i)).toEqual([id]);
    expect(Events.list({ type: "war", state: 1, against: 3 })).toEqual([]);
  });
});

describe("Events: political acts", () => {
  it("writes an act once and corrects it when done again right away", () => {
    const first = Events.logAct("capital:1", { name: "S1 moves its capital to A", states: [1], tag: "capital" });
    const again = Events.logAct("capital:1", { name: "S1 moves its capital to B", states: [1], tag: "capital" });
    expect(again).toBe(first);
    expect(pack.events).toMatchObject([
      { type: "custom", name: "S1 moves its capital to B", start: "120", end: "120", tags: ["capital"], auto: true }
    ]);
    vi.stubGlobal("pack", { ...pack, events: structuredClone(pack.events) }); // saved and loaded again
    Events.logAct("capital:1", { name: "S1 moves its capital to B", states: [1], tag: "capital" });
    expect(pack.events).toHaveLength(1);
    Events.update(first, { name: "The great move" });
    Events.logAct("capital:1", { name: "S1 moves its capital to C", states: [1], tag: "capital" });
    expect(pack.events.map(event => event.name)).toEqual(["The great move", "S1 moves its capital to C"]);
  });

  it("corrects no act done before its subject's id named another, or one naming a state since removed", () => {
    const act = (key: string, states: number[]) => Events.logAct(key, { name: key, states, tag: "capital" });
    const renumbered = act("capital:2", [2]);
    Events.remapStates(new Map([[2, 1]]));
    expect(act("capital:2", [2])).not.toBe(renumbered);
    const cession = act("cession:7", [1, 2]);
    const other = act("capital:3", [3]);
    Events.forgetActs(1);
    expect(act("cession:7", [2, 3])).not.toBe(cession);
    expect(act("capital:3", [3])).toBe(other);
  });

  it("words an event from the present names", () => {
    const id = Events.add({ type: "war", name: "War", start: "100", end: "105", attackers: [1], defenders: [2, 9] });
    expect(Events.describe(Events.get(id)!)).toBe("S1 against S2, former state 9. 100 WE – 105 WE (5 years).");
  });
});

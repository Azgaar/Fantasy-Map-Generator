import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HistRefKind } from "@/types/history";
import { emptyHistory } from "@/types/history";
import { Chronicle } from "./history-generator";

beforeEach(() => {
  // 0.5 keeps every random draw on its middle branch, so assertions hold without knowing the tables
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  globalThis.options = {
    map: {
      lore: {
        name: "",
        description: "",
        calendar: { year: 1000, era: "Era", eraShort: "E" },
        history: { span: 1000, realms: 2, density: 1, echoes: true, renames: false }
      }
    }
  } as unknown as typeof options;
  globalThis.pack = {
    states: [
      {
        i: 0,
        name: "Neutrals",
        diplomacy: [["A-B War", "A declared a war on its rival B", "B's vassal joined the war on defenders side"]]
      },
      {
        i: 1,
        name: "A",
        fullName: "Kingdom of A",
        area: 1000,
        culture: 1,
        campaigns: [
          { name: "A-B War", start: 995, attacker: 1, defender: 2 }, // ongoing: no end
          { name: "The Old War", start: 800, end: 806, attacker: 1, defender: 3 }
        ],
        diplomacy: ["x", "x", "Suzerain", "Enemy"]
      },
      {
        i: 2,
        name: "B",
        area: 100,
        culture: 2,
        campaigns: [{ name: "The B-C War", start: 851, end: 854, attacker: 2, defender: 3 }],
        diplomacy: ["x", "Vassal", "x", "x"]
      },
      {
        i: 3,
        name: "C",
        area: 500,
        culture: 1,
        campaigns: [{ name: "The B-C War", start: 850, end: 855, attacker: 3, defender: 2 }],
        diplomacy: ["x", "Enemy", "x", "x"]
      }
    ],
    cultures: [
      { i: 0, name: "Wildlings" },
      { i: 1, name: "Aeloran", origins: [0] },
      { i: 2, name: "Velic", origins: [1] },
      { i: 3, name: "Thornic", origins: [2] }
    ],
    religions: [
      { i: 0, name: "No religion", origins: null },
      { i: 1, name: "Yalaism", type: "Folk", origins: [0] },
      { i: 2, name: "Church of Dawn", type: "Organized", origins: [1] },
      { i: 3, name: "Ashen Way", type: "Heresy", origins: [2] }
    ]
  } as unknown as typeof pack;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const emptyWorld = () => {
  globalThis.pack = { states: [], cultures: [], religions: [] } as unknown as typeof pack;
};

const warsBetween = (a: number, b: number) =>
  pack.history.events.filter(
    event =>
      event.type === "war" &&
      event.actors.some(ref => ref.kind === "state" && ref.id === a) &&
      event.actors.some(ref => ref.kind === "state" && ref.id === b)
  );

const foundingYear = (stateId: number) =>
  pack.history.events.find(event => event.type === "founding" && event.actors[0]?.id === stateId)?.year;

describe("Chronicle", () => {
  it("generates an empty chronicle for a world with nothing to date", () => {
    emptyWorld();
    Chronicle.generate();
    expect(pack.history).toEqual({ events: [], realms: [], eras: [] });
  });

  it("replaces a stale chronicle on regeneration", () => {
    emptyWorld();
    Chronicle.generate();
    pack.history.events.push({ i: 0, year: 100, type: "war", actors: [], text: "stale" });
    Chronicle.generate();
    expect(pack.history.events).toEqual([]);
  });

  it("gives older saves an empty chronicle on sync", () => {
    const history = Chronicle.sync();
    expect(history).toEqual(emptyHistory());
    expect(pack.history).toBe(history);
  });

  it("keeps an existing chronicle on sync", () => {
    pack.history = {
      events: [{ i: 0, year: 5, type: "founding", actors: [], text: "founded" }],
      realms: [],
      eras: []
    };
    const history = Chronicle.sync();
    expect(history.events).toHaveLength(1);
  });
});

describe("Chronicle.generate", () => {
  it("dates a founding for every living state", () => {
    Chronicle.generate();
    const foundings = pack.history.events.filter(event => event.type === "founding");
    expect(foundings.map(event => event.actors[0]?.id).sort()).toEqual([1, 2, 3]);
    for (const founding of foundings) {
      expect(founding.year).toBeGreaterThanOrEqual(0); // 1000 - span
      expect(founding.year).toBeLessThanOrEqual(995); // 1000 - 5
      expect(founding.text).toContain(pack.states[founding.actors[0]!.id].name);
    }
  });

  it("dates larger states older", () => {
    Chronicle.generate();
    expect(foundingYear(1)!).toBeLessThan(foundingYear(3)!);
    expect(foundingYear(3)!).toBeLessThan(foundingYear(2)!);
  });

  it("sorts events by year with sequential ids", () => {
    Chronicle.generate();
    const { events } = pack.history;
    expect(events.map(event => event.i)).toEqual(events.map((_, i) => i));
    for (let i = 1; i < events.length; i++) expect(events[i].year).toBeGreaterThanOrEqual(events[i - 1].year);
  });

  it("resolves every actor reference to a living entity", () => {
    Chronicle.generate();
    const tables: Record<HistRefKind, { removed?: boolean }[]> = {
      state: pack.states,
      culture: pack.cultures,
      religion: pack.religions,
      realm: [],
      burg: []
    };
    for (const event of pack.history.events) {
      expect(event.actors.length).toBeGreaterThan(0);
      for (const ref of event.actors) {
        const entity = tables[ref.kind][ref.id];
        expect(entity).toBeTruthy();
        expect(entity.removed).toBeFalsy();
      }
    }
  });

  it("records one war per state pair, however many sides logged it", () => {
    Chronicle.generate();
    // both A and C carry "The Old War"; both B and C carry "The B-C War" under different names
    expect(warsBetween(1, 3)).toHaveLength(1);
    expect(warsBetween(2, 3)).toHaveLength(1);
    expect(warsBetween(1, 3)[0].text).toContain("The Old War");
  });

  it("keeps war years after every participant's founding", () => {
    Chronicle.generate();
    for (const event of pack.history.events) {
      if (event.type !== "war") continue;
      for (const ref of event.actors) {
        const founded = foundingYear(ref.id);
        if (founded !== undefined) expect(event.year).toBeGreaterThanOrEqual(founded);
      }
    }
  });

  it("takes ongoing war stories from the relations chronicle", () => {
    Chronicle.generate();
    const ongoing = warsBetween(1, 2).find(event => event.text.includes("declared a war on its rival"));
    expect(ongoing!.text).toContain("B's vassal joined the war on defenders side");
    expect(ongoing!.year).toBe(995);
  });

  it("falls back to a template when the chronicle is empty", () => {
    pack.states[0].diplomacy = [] as unknown as string[];
    Chronicle.generate();
    expect(warsBetween(1, 2).length).toBeGreaterThan(0);
  });

  it("records the subjugation of every vassal", () => {
    Chronicle.generate();
    const subjugations = warsBetween(1, 2).filter(event => event.text.includes("vassal"));
    expect(subjugations.length).toBeGreaterThan(0);
  });

  it("dates culture divergences after their parents", () => {
    Chronicle.generate();
    const migrations = pack.history.events.filter(event => event.type === "migration");
    expect(migrations.map(event => event.actors[0]?.id)).toEqual([2, 3]); // roots produce no event
    const yearOf = (cultureId: number) => migrations.find(event => event.actors[0]?.id === cultureId)!.year;
    expect(yearOf(3)).toBeGreaterThanOrEqual(yearOf(2));
  });

  it("records schisms for derived religions", () => {
    Chronicle.generate();
    const schisms = pack.history.events.filter(event => event.type === "schism");
    expect(schisms.map(event => event.actors[0]?.id)).toEqual([2, 3]); // folk roots produce no event
    expect(schisms[0]!.text).toContain("Church of Dawn");
    expect(schisms[1]!.text).toContain("split");
  });

  it("is deterministic for the same random source", () => {
    const prng = (seed: number) => {
      let state = seed;
      return () => {
        state = (state * 1103515245 + 12345) % 2147483648;
        return state / 2147483648;
      };
    };
    vi.spyOn(Math, "random").mockImplementation(prng(42));
    Chronicle.generate();
    const first = structuredClone(pack.history);
    vi.spyOn(Math, "random").mockImplementation(prng(42));
    Chronicle.generate();
    expect(pack.history).toEqual(first);
  });

  it("survives states without campaigns, diplomacy or culture", () => {
    pack.states.push({ i: 4, name: "D", area: 10, campaigns: undefined, diplomacy: undefined } as never);
    pack.states[0].diplomacy = [] as unknown as string[];
    expect(() => Chronicle.generate()).not.toThrow();
  });
});

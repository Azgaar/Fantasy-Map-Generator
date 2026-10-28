// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALIGNMENTS,
  CONTRADICTIONS,
  rollAlignment,
  rollFigureTraits,
  TRAIT_COUNTS,
  traitsRng,
  VICES,
  VIRTUES
} from "@/data/culture-traits";
import type { HistRefKind } from "@/types/history";
import { emptyHistory } from "@/types/history";
import "./pack-generator"; // Markers.place resolves cells through the global Pack
import type { EpochArtifact } from "./epochs-generator";
import { Chronicle } from "./history-generator";

// The epoch engine is mocked: the engine's own behavior is epochs-generator.test.ts's business,
// and these tests want a cast whose ids and years never move. The mock counts its calls so the
// archaeologist tests can assert the engine is never consulted.
const engine = vi.hoisted((): { calls: number; artifact: EpochArtifact } => ({
  calls: 0,
  artifact: {
    epochs: [
      {
        i: 0,
        from: 0,
        to: 500,
        era: "The Age of Broken Crowns",
        polities: [
          {
            id: 1,
            name: "Old Empire",
            form: "Empire",
            capital: 1,
            cells: 30,
            color: "#123456",
            founded: 0,
            fallen: 500
          },
          { id: 3, name: "High March", form: "Duchy", capital: 3, cells: 20, color: "#3366aa", founded: 0 }
        ],
        snapshot: 0
      },
      {
        i: 1,
        from: 500,
        to: 1000,
        era: "Era",
        polities: [
          {
            id: 2,
            name: "Heir Realm",
            form: "Kingdom",
            capital: 2,
            cells: 40,
            color: "#654321",
            founded: 500,
            successorOf: 1
          },
          { id: 3, name: "High March", form: "Duchy", capital: 3, cells: 25, color: "#3366aa", founded: 0 },
          { id: 4, name: "Wardens", form: "Duchy", capital: 4, cells: 8, color: "#778899", founded: 500 }
        ],
        snapshot: 1
      }
    ],
    polities: [
      { id: 1, name: "Old Empire", form: "Empire", capital: 1, cells: 30, color: "#123456", founded: 12, fallen: 500 },
      {
        id: 2,
        name: "Heir Realm",
        form: "Kingdom",
        capital: 2,
        cells: 40,
        color: "#654321",
        founded: 500,
        successorOf: 1
      },
      { id: 3, name: "High March", form: "Duchy", capital: 3, cells: 25, color: "#3366aa", founded: 0 },
      { id: 4, name: "Wardens", form: "Duchy", capital: 4, cells: 8, color: "#778899", founded: 500 }
    ],
    events: [
      { i: 0, year: 12, type: "founding", actors: [{ kind: "polity", id: 1 }], text: "The Old Empire was proclaimed" },
      {
        i: 0,
        year: 500,
        type: "battle",
        actors: [{ kind: "polity", id: 1 }],
        loc: 7,
        text: "The Old Empire fell in battle"
      },
      {
        i: 0,
        year: 500,
        type: "collapse",
        actors: [
          { kind: "polity", id: 1 },
          { kind: "polity", id: 2 }
        ],
        text: "In 500 the Old Empire collapsed; Heir Realm rose from its remains"
      },
      {
        i: 0,
        year: 501,
        type: "independence",
        actors: [
          { kind: "polity", id: 2 },
          { kind: "polity", id: 1 }
        ],
        text: "Heir Realm rose from the ruins of the Old Empire"
      },
      {
        i: 0,
        year: 600,
        type: "war",
        actors: [
          { kind: "polity", id: 2 },
          { kind: "polity", id: 3 }
        ],
        text: "The Heir Realm warred on the High March"
      }
    ],
    snapshots: [Uint16Array.of(0, 1, 0, 1), Uint16Array.of(0, 2, 2, 1)]
  }
}));

vi.mock("./epochs-generator", () => ({
  Epochs: {
    generate: () => {
      engine.calls++;
      return engine.artifact;
    }
  }
}));

beforeEach(() => {
  // 0.5 keeps every random draw on its middle branch, so assertions hold without knowing the tables
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  globalThis.options = {
    map: {
      graph: { width: 1280, height: 800 },
      seed: "history-traits-seed",
      cultures: { set: "world" },
      lore: {
        name: "",
        description: "",
        calendar: { year: 1000, era: "Era", eraShort: "E" },
        history: { span: 1000, realms: 2, density: 1, echoes: true, renames: false }
      }
    },
    generation: { cultures: { traits: true } }
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
      { i: 0, name: "Wildlings", base: 1 },
      { i: 1, name: "Aeloran", base: "ENGLI", origins: [0] },
      { i: 2, name: "Velic", base: "ENGLI", origins: [1] },
      { i: 3, name: "Thornic", base: "ENGLI", origins: [2] }
    ],
    religions: [
      { i: 0, name: "No religion", origins: null },
      { i: 1, name: "Yalaism", type: "Folk", origins: [0] },
      { i: 2, name: "Church of Dawn", type: "Organized", origins: [1] },
      { i: 3, name: "Ashen Way", type: "Heresy", origins: [2] }
    ],
    burgs: [
      0,
      { i: 1, cell: 10, culture: 1 },
      { i: 2, cell: 11, culture: 2 },
      { i: 3, cell: 12, culture: 3 },
      { i: 4, cell: 13, culture: 1 }
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
    expect(pack.history.events).toEqual([]);
    expect(pack.history.realms).toEqual([]);
    expect(pack.history.eras).toEqual([{ name: "Era", from: 0, to: 1000 }]); // the configured era alone
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
    const tables: Record<HistRefKind, unknown[]> = {
      state: pack.states,
      culture: pack.cultures,
      religion: pack.religions,
      realm: [],
      burg: [],
      figure: pack.history.figures ?? [],
      polity: []
    };
    for (const event of pack.history.events) {
      expect(event.actors.length).toBeGreaterThan(0);
      for (const ref of event.actors) {
        const entity = tables[ref.kind][ref.id] as { removed?: boolean } | undefined;
        expect(entity).toBeTruthy();
        expect(entity!.removed).toBeFalsy();
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
        const founded = ref.kind === "state" ? foundingYear(ref.id) : undefined;
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

describe("Chronicle.generate figures", () => {
  const figures = () => pack.history.figures ?? [];
  const rulers = () => figures().filter(figure => figure.roles[0]?.type === "ruler");
  const roleOf = (figureId: number) => figures()[figureId].roles[0]!;

  it("remembers dynasties for the major states only", () => {
    Chronicle.generate();
    const served = new Set(rulers().map(figure => figure.roles[0]!.target.id));
    expect(served).toEqual(new Set([1, 3])); // B is too small to be remembered
    for (const figure of rulers()) expect(figure.culture).toBe(pack.states[figure.roles[0]!.target.id].culture);
  });

  it("spans each dynasty from the state's founding to now under 2–5 rulers", () => {
    Chronicle.generate();
    for (const stateId of [1, 3]) {
      const dynasty = rulers().filter(figure => figure.roles[0]!.target.id === stateId);
      expect(dynasty.length).toBeGreaterThanOrEqual(2);
      expect(dynasty.length).toBeLessThanOrEqual(5);
      let previousEnd: number | undefined;
      for (const figure of dynasty) {
        const role = figure.roles[0]!;
        expect(role.from).toBe(previousEnd ?? foundingYear(stateId)); // reigns are contiguous from the founding
        expect(figure.birth).toBeLessThan(role.from);
        if (role.to !== undefined) expect(figure.death).toBeGreaterThanOrEqual(role.to);
        previousEnd = role.to;
      }
      expect(previousEnd).toBeUndefined(); // the last ruler still reigns
    }
  });

  it("crowns the founder and records each later accession", () => {
    Chronicle.generate();
    const coronations = pack.history.events.filter(event => event.type === "coronation");
    const successions = pack.history.events.filter(event => event.type === "succession");
    expect(coronations.length + successions.length).toBe(rulers().length);
    expect(coronations.map(event => event.actors[1]!.id).sort()).toEqual([1, 3]);
    for (const event of coronations) expect(event.year).toBe(foundingYear(event.actors[1]!.id));
    for (const event of successions) {
      const [heir, dead] = event.actors;
      expect(heir.kind).toBe("figure");
      expect(dead.kind).toBe("figure");
      expect(roleOf(heir.id).from).toBe(event.year); // the heir's reign began
      expect(roleOf(dead.id).to).toBe(event.year); // the dead ruler's reign ended
    }
  });

  it("indexes figures densely by id", () => {
    Chronicle.generate();
    expect(figures().map(figure => figure.i)).toEqual(figures().map((_, index) => index));
  });

  it("gives every interstate war a general", () => {
    Chronicle.generate();
    const wars = pack.history.events.filter(
      event => event.type === "war" && event.actors.some(ref => ref.kind === "state" && ref.id)
    );
    const generals = figures().filter(figure => figure.roles[0]?.type === "general");
    expect(generals.length).toBe(wars.length);
    for (const event of wars) {
      const servant = event.actors.find(ref => ref.kind === "state" && ref.id)!;
      const ref = event.actors.find(ref => ref.kind === "figure")!;
      expect(roleOf(ref.id).type).toBe("general");
      expect(roleOf(ref.id).target).toEqual(servant);
      expect(roleOf(ref.id).from).toBe(event.year);
      expect(figures()[ref.id].birth).toBeLessThan(event.year);
    }
  });
});

describe("figure traits", () => {
  const figures = () => pack.history.figures ?? [];
  const seed = "history-traits-seed";
  const antonyms = new Map(
    CONTRADICTIONS.flatMap(([virtue, vice]) => [
      [virtue, vice],
      [vice, virtue]
    ])
  );

  it("gives every figure an alignment and the traits that alignment dictates", () => {
    Chronicle.generate();
    expect(figures().length).toBeGreaterThan(0);

    for (const figure of figures()) {
      expect(ALIGNMENTS).toContain(figure.alignment!);
      const counts = TRAIT_COUNTS[figure.alignment!];
      expect(figure.virtues).toHaveLength(counts.virtues);
      expect(figure.vices).toHaveLength(counts.vices);
      for (const virtue of figure.virtues!) expect(VIRTUES).toContain(virtue);
      for (const vice of figure.vices!) expect(VICES).toContain(vice);
    }
  });

  it("never puts a word twice on a figure, nor both halves of a contradiction", () => {
    Chronicle.generate();
    for (const figure of figures()) {
      const drawn = [...(figure.virtues ?? []), ...(figure.vices ?? [])];
      expect(new Set(drawn).size).toBe(drawn.length);
      for (const word of drawn) expect(drawn).not.toContain(antonyms.get(word));
    }
  });

  it("rolls each figure from its own stream, on the prevailing column of the culture it serves", () => {
    for (const culture of pack.cultures) culture.alignment = "evil";

    Chronicle.generate();
    for (const figure of figures()) {
      const rng = traitsRng(seed, "figure", figure.i);
      const alignment = rollAlignment(rng, pack.cultures[figure.culture]?.alignment);
      expect(figure.alignment).toBe(alignment);
      expect({ virtues: figure.virtues, vices: figure.vices }).toEqual(rollFigureTraits(rng, alignment));
    }
  });

  it("rolls a figure of an untyped culture — or the Wildlands — on the neutral column", () => {
    // the fixture cultures carry no alignment, as on a map generated before the traits layer
    Chronicle.generate();
    for (const figure of figures()) {
      const rng = traitsRng(seed, "figure", figure.i);
      expect(figure.alignment).toBe(rollAlignment(rng));
    }
  });

  it("leaves figures untyped when the layer is off", () => {
    options.generation.cultures.traits = false;
    Chronicle.generate();

    expect(figures().length).toBeGreaterThan(0);
    for (const figure of figures()) {
      expect(figure).not.toHaveProperty("alignment");
      expect(figure).not.toHaveProperty("virtues");
      expect(figure).not.toHaveProperty("vices");
    }
  });

  it("does not move a single name, birth or date of the chronicle", () => {
    // a position-sensitive stream, so a draw taken anywhere would shift everything after it
    let draw = 0;
    const sequence = () => ((draw++ * 0.37 + 0.11) % 1) ** 2;
    vi.spyOn(Math, "random").mockImplementation(sequence);

    Chronicle.generate();
    const withTraits = pack.history.figures!.map(figure => [figure.name, figure.birth, figure.death]);
    const eventsWithTraits = pack.history.events.map(event => `${event.year}: ${event.text}`);

    draw = 0;
    options.generation.cultures.traits = false;
    Chronicle.generate();

    expect(pack.history.figures!.map(figure => [figure.name, figure.birth, figure.death])).toEqual(withTraits);
    expect(pack.history.events.map(event => `${event.year}: ${event.text}`)).toEqual(eventsWithTraits);
  });
});

describe("Chronicle.generate fallen realms", () => {
  /** a compact world: state 1 cores a 4-state footprint; cells on a 6x3 grid; culture 2 pockets in the old heartland */
  beforeEach(() => {
    const cellState = [1, 1, 1, 1, 2, 2, 1, 1, 1, 3, 3, 3, 1, 1, 4, 4, 4, 4];
    const cellCulture = [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const cellColumn = (cellId: number) => cellId % 6;
    const cellRow = (cellId: number) => Math.floor(cellId / 6);
    const at = (cellId: number) => [cellColumn(cellId) * 100 + 50, cellRow(cellId) * 100 + 50];
    globalThis.pack = {
      cells: {
        i: cellState.map((_, cellId) => cellId),
        state: cellState,
        culture: cellCulture,
        burg: cellState.map((_, cellId) => (cellId === 2 ? 1 : cellId === 10 ? 2 : 0)),
        c: cellState.map((_, cellId) => {
          const [x, y] = [cellColumn(cellId), cellRow(cellId)];
          return cellState
            .map((_, other) => [other, other % 6, Math.floor(other / 6)] as const)
            .filter(([, ox, oy]) => Math.abs(ox - x) + Math.abs(oy - y) === 1)
            .map(([other]) => other);
        }),
        p: cellState.map((_, cellId) => at(cellId))
      },
      burgs: [
        0,
        { i: 1, cell: 2, name: "Aldgate", x: at(2)[0], y: at(2)[1], population: 10, capital: 1 },
        { i: 2, cell: 10, name: "Fairholm", x: at(10)[0], y: at(10)[1], population: 8 }
      ],
      markers: [],
      states: [
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "A",
          area: 900,
          culture: 1,
          neighbors: [2, 3, 4],
          campaigns: [{ name: "The Succession War", start: 900, end: 904, attacker: 1, defender: 2 }],
          diplomacy: ["x", "x", "x", "x"]
        },
        { i: 2, name: "B", area: 400, culture: 2, neighbors: [1], campaigns: [], diplomacy: ["x", "x", "x", "x"] },
        {
          i: 3,
          name: "C",
          area: 400,
          culture: 1,
          neighbors: [1, 4],
          campaigns: [{ name: "The Border War", start: 900, end: 905, attacker: 3, defender: 1 }],
          diplomacy: ["x", "x", "x", "x"]
        },
        {
          i: 4,
          name: "D",
          area: 980,
          culture: 2,
          neighbors: [1, 3],
          campaigns: [],
          diplomacy: ["x", "Vassal", "x", "x"]
        }
      ],
      cultures: [
        { i: 0, name: "Wildlings", base: 1 },
        { i: 1, name: "Aeloran", base: "ENGLI", origins: [0] },
        { i: 2, name: "Velic", base: "ENGLI", origins: [1] }
      ],
      religions: [{ i: 0, name: "No religion", origins: null }]
    } as unknown as typeof pack;
  });

  it("weaves a fallen realm over the largest state and its neighbors", () => {
    Chronicle.generate();
    expect(pack.history.realms).toHaveLength(1);
    const [realm] = pack.history.realms;
    expect(realm.successors).toEqual([1, 2, 3, 4]);
    expect(realm.name.split(" ")).toHaveLength(2); // a proper name and a form word
    expect(realm.coa).toBeTruthy();
    expect(realm.capital).toBe(2); // the grandest burg that is not a capital
    expect(realm.center).toBe(pack.burgs[2].cell);
  });

  it("dates the realm after its founding and before every successor", () => {
    Chronicle.generate();
    const [realm] = pack.history.realms;
    expect(realm.founded).toBeLessThan(realm.fallen);
    for (const successorId of realm.successors) {
      expect(realm.fallen).toBeLessThan(foundingYear(successorId)!);
    }
    expect(realm.fallen).toBeLessThan(1000);
  });

  it("records the rise, golden ages, last battle and the fall of the realm", () => {
    Chronicle.generate();
    const byType = (type: string) => pack.history.events.filter(event => event.type === type);
    const realmRef = { kind: "realm", id: 0 };
    const founding = byType("founding").find(event => event.actors.some(actor => actor.kind === "realm"));
    expect(founding!.loc).toBe(10);
    expect(byType("goldenAge").length).toBeGreaterThanOrEqual(1);
    const battle = byType("battle")[0]!;
    expect(battle.loc).toBeDefined();
    expect(battle.actors).toContainEqual(realmRef);
    const collapse = byType("collapse")[0]!;
    expect(collapse.actors[0]).toEqual(realmRef);
    expect(collapse.actors).toHaveLength(5); // the realm and its four successors
    expect(collapse.text).toContain("A, B, C and D");
    expect(battle.year).toBe(collapse.year);
  });

  it("names the successors in the partition text", () => {
    Chronicle.generate();
    const collapse = pack.history.events.find(event => event.type === "collapse")!;
    expect(collapse.text).toMatch(/A, B, C and D/);
  });

  it("places ruins and battlefield markers where history says they happened", () => {
    Chronicle.generate();
    const ruins = pack.markers.filter(marker => marker.type === "ruins");
    expect(ruins).toHaveLength(2); // the realm's seat plus a province burg, as the epochs do it
    expect(ruins[0].name).toContain("Ruins of");
    expect(ruins[0].cell).toBe(10); // Fairholm, the grandest burg that is not a capital today
    expect(ruins[1].name).toBe("Ruins of Aldgate"); // the footprint's one remaining burg fell with it
    const battlefields = pack.markers.filter(marker => marker.type === "battlefields");
    expect(battlefields).toHaveLength(1);
    expect(battlefields[0].cell).toBe(pack.history.events.find(event => event.type === "battle")!.loc);
  });

  it("notes the successors and the fallen capital", () => {
    Chronicle.generate();
    for (const successorId of [1, 2, 3, 4]) {
      expect(pack.states[successorId].note).toContain("was carved from the");
    }
    expect(pack.burgs[2].note).toContain("fell with the empire");
  });

  it("renames a successor when renames are on", () => {
    options.map.lore.history.renames = true;
    Chronicle.generate();
    expect(pack.states[1].name).toMatch(/^New /);
  });

  it("records the independence of a footprint vassal from the realm", () => {
    Chronicle.generate();
    const independence = pack.history.events.find(event => event.type === "independence");
    expect(independence!.actors).toContainEqual({ kind: "state", id: 4 });
    expect(independence!.actors).toContainEqual({ kind: "realm", id: 0 });
    expect(independence!.year).toBeLessThan(pack.history.realms[0].fallen);
  });

  it("marks a remnant culture in the old heartland", () => {
    Chronicle.generate();
    expect(pack.history.realms[0].remnantCulture).toBe(2);
    const migration = pack.history.events.find(
      event => event.type === "migration" && event.actors.some(actor => actor.kind === "realm")
    );
    expect(migration!.actors).toContainEqual({ kind: "culture", id: 2 });
  });

  it("retells border wars as attempts to reforge the old borders", () => {
    Chronicle.generate();
    const borderWar = pack.history.events.find(event => event.text.includes("The Border War"));
    expect(borderWar!.text).toContain("reforge the old");
  });

  it("derives eras from the realm spans and the configured era", () => {
    Chronicle.generate();
    const [realm] = pack.history.realms;
    expect(pack.history.eras).toEqual([
      { name: `The ${realm.name.split(" ")[0]} Era`, from: realm.founded, to: realm.fallen },
      { name: "Era", from: realm.fallen, to: 1000 }
    ]);
  });

  it("places no markers when echoes are off", () => {
    options.map.lore.history.echoes = false;
    Chronicle.generate();
    expect(pack.markers).toHaveLength(0);
    expect(pack.states[1].note).toBeUndefined();
  });
});

describe("Chronicle.generate in the epochs mode", () => {
  beforeEach(() => {
    options.map.lore.history.mode = "epochs";
    options.map.lore.history.echoes = false; // the fall markers have their own describe
    engine.calls = 0;
  });

  it("installs the engine's cast and retires the invented realms", () => {
    Chronicle.generate();
    expect(engine.calls).toBe(1);
    expect(pack.history.realms).toEqual([]);
    expect(pack.history.snapshots).toEqual([Uint16Array.of(0, 1, 0, 1), Uint16Array.of(0, 2, 2, 1)]);
    expect(pack.history.polities?.map(polity => polity.name)).toEqual([
      "Old Empire",
      "Heir Realm",
      "High March",
      "Wardens"
    ]);
    expect(pack.history.epochs).toEqual(engine.artifact.epochs);
  });

  it("derives the eras from the epochs: contiguous, ending at the present", () => {
    Chronicle.generate();
    const eras = pack.history.eras;
    expect(eras[1]).toEqual({ name: "Era", from: 500, to: 1000 }); // the configured present age
    for (let i = 1; i < eras.length; i++) expect(eras[i].from).toBe(eras[i - 1].to);
  });

  it("merges the deep-time events with the engine's and renumbers the log", () => {
    Chronicle.generate();
    const types = pack.history.events.map(event => event.type);
    expect(types).toContain("schism"); // the faiths are deep time, dated backwards as always
    expect(types).toContain("migration");
    expect(types).toContain("collapse"); // what the engine really did
    expect(types).toContain("independence");

    const events = pack.history.events;
    expect(events.map(event => event.i)).toEqual(events.map((_, i) => i));
    for (let i = 1; i < events.length; i++) expect(events[i].year).toBeGreaterThanOrEqual(events[i - 1].year);
  });

  it("writes no invented political events of its own: the polities own that story", () => {
    Chronicle.generate();
    for (const event of pack.history.events) {
      for (const actor of event.actors) expect(actor.kind).not.toBe("realm");
      if (event.type === "founding") {
        expect(event.actors.some(actor => actor.kind === "state")).toBe(false);
        expect(event.actors.some(actor => actor.kind === "polity")).toBe(true);
      }
    }
  });

  const reigns = (polityId: number) =>
    (pack.history.figures ?? [])
      .map(figure => ({ figure, role: figure.roles[0]! }))
      .filter(
        entry => entry.role.type === "ruler" && entry.role.target.kind === "polity" && entry.role.target.id === polityId
      );

  it("remembers only the lineages that rivaled the greatest epoch power", () => {
    Chronicle.generate();
    const targeted = new Set<number>();
    for (const figure of pack.history.figures ?? []) {
      for (const role of figure.roles) targeted.add(role.target.id);
    }
    expect(targeted.has(1)).toBe(true);
    expect(targeted.has(4)).toBe(false); // 8 cells against a peak of 40: history forgets the Wardens
  });

  it("confines every reign to a single epoch of its lineage's presence", () => {
    Chronicle.generate();
    const epochs = pack.history.epochs!;
    for (const figure of pack.history.figures ?? []) {
      const role = figure.roles[0]!;
      if (role.type !== "ruler") continue;
      const contained = epochs.some(
        epoch => epoch.from <= role.from && (role.to === undefined ? epoch.to === 1000 : role.to <= epoch.to)
      );
      expect(contained).toBe(true); // no reign outlives the epoch it belongs to
    }
  });

  it("ends a fallen lineage's last reign exactly at its collapse", () => {
    Chronicle.generate();
    const empire = reigns(1);
    expect(empire).toHaveLength(2);
    expect(empire.at(-1)!.role.to).toBe(500); // the collapse, at the epoch's end
    expect(empire.at(-1)!.figure.death).toBe(500);
  });

  it("leaves a surviving lineage's last reign open", () => {
    Chronicle.generate();
    for (const polityId of [2, 3]) {
      const last = reigns(polityId).at(-1)!;
      expect(last.role.to).toBeUndefined();
      expect(last.figure.death).toBeUndefined();
    }
  });

  it("chains succession across the epoch boundaries", () => {
    // the High March is present in both epochs: its crown passes at 500 within one dynasty
    Chronicle.generate();
    const handover = pack.history.events.find(
      event =>
        event.type === "succession" &&
        event.year === 500 &&
        event.actors.some(ref => ref.kind === "polity" && ref.id === 3)
    );
    expect(handover).toBeDefined();
    const figures = pack.history.figures ?? [];
    const outgoing = figures[handover!.actors[1]!.id]!;
    const heir = figures[handover!.actors[0]!.id]!;
    expect(outgoing.roles[0]!.to).toBe(500); // the old ruler closed the epoch as one of its reigns
    expect(heir.roles[0]!.from).toBe(500);
  });

  it("sends a general with every epoch war", () => {
    Chronicle.generate();
    const war = pack.history.events.find(event => event.type === "war" && event.year === 600)!;
    const general = (pack.history.figures ?? []).find(figure => figure.roles.some(role => role.type === "general"))!;
    expect(general).toBeDefined();
    expect(war.actors).toContainEqual({ kind: "figure", id: general.i });
    const role = general.roles[0]!;
    expect(role.target).toEqual({ kind: "polity", id: 2 }); // the war's leading power
    expect(role.from).toBe(600);
    expect(general.culture).toBe(2); // the capital burg's people
  });

  it("leaves the archaeologist path untouched in the default mode", () => {
    delete (options.map.lore.history as { mode?: string }).mode; // an old file without the field loads as it always did
    options.map.lore.history.echoes = false; // this bare world has no terrain to seed markers from
    for (const state of pack.states) state.neighbors = [1, 2, 3].filter(id => id !== state.i); // an empire needs successors
    globalThis.pack.cells = {
      i: [],
      culture: [],
      state: new Uint16Array(0),
      c: [],
      p: []
    } as unknown as typeof pack.cells;
    globalThis.pack.burgs = [];

    Chronicle.generate();
    expect(engine.calls).toBe(0);
    expect(pack.history.epochs).toBeUndefined();
    expect(pack.history.polities).toBeUndefined();
    expect(pack.history.snapshots).toBeUndefined();
    expect(pack.history.realms.length).toBeGreaterThan(0); // the ghost realms return
    expect(
      pack.history.events.some(event => event.type === "founding" && event.actors.some(actor => actor.kind === "state"))
    ).toBe(true); // and the states' own foundings are dated again
  });
});

describe("Chronicle.generate fall markers", () => {
  /** the mock engine's Old Empire (polity 1, fallen in 500) over a world whose burgs can fall with it */
  beforeEach(() => {
    options.map.lore.history.mode = "epochs";
    engine.calls = 0;
    // the empire's territory at its death: every cell but the multiples of 5
    engine.artifact.snapshots[0] = Uint16Array.from({ length: 26 }, (_, cell) => (cell && cell % 5 ? 1 : 0));
    const burg = Array<number>(26).fill(0);
    burg[1] = 1;
    burg[2] = 2;
    burg[3] = 3;
    burg[6] = 4;
    globalThis.pack = {
      cells: {
        burg,
        p: Array.from({ length: 26 }, (_, cell) => [cell * 10 + 10, 10])
      },
      burgs: [
        0,
        { i: 1, cell: 1, name: "Oldtown", x: 20, y: 10, population: 10, culture: 1 },
        { i: 2, cell: 2, name: "Hillfort", x: 30, y: 10, population: 8, culture: 1 },
        { i: 3, cell: 3, name: "Dale", x: 40, y: 10, population: 6, culture: 2 },
        { i: 4, cell: 6, name: "Grange", x: 70, y: 10, population: 4, culture: 2 }
      ],
      markers: [],
      cultures: [
        { i: 0, name: "Wildlings", base: 1 },
        { i: 1, name: "Aeloran", base: "ENGLI", origins: [0] },
        { i: 2, name: "Velic", base: "ENGLI", origins: [1] }
      ],
      religions: [{ i: 0, name: "No religion", origins: null }]
    } as unknown as typeof pack;
  });

  afterEach(() => {
    engine.artifact.snapshots[0] = Uint16Array.of(0, 1, 0, 1); // the shared mock artifact restored
  });

  it("marks the fallen polity's capital, and leaves the living polities alone", () => {
    Chronicle.generate();
    const seats = pack.markers.filter(marker => marker.name === "Ruins of Old Empire");
    expect(seats).toHaveLength(1);
    expect(seats[0].type).toBe("ruins"); // the fixed draw stays under the necropolis chance
    expect(seats[0].note).toContain("Old Empire");
    expect(seats[0].note).toContain("500");
    for (const living of ["Heir Realm", "High March", "Wardens"])
      expect(pack.markers.some(marker => marker.name.includes(living))).toBe(false);
  });

  it("marks the greater burgs with it, naming the burg", () => {
    Chronicle.generate();
    expect(pack.markers.map(marker => marker.name)).toEqual(["Ruins of Old Empire", "Ruins of Dale"]);
    expect(pack.markers[1].note).toContain("Old Empire"); // the provinces fell with it, and the note says so
  });

  it("lets the ruins slider strip the provinces back to the capital", () => {
    options.map.lore.history.ruins = 1;
    Chronicle.generate();
    expect(pack.markers).toHaveLength(1);
    expect(pack.markers[0].name).toBe("Ruins of Old Empire");
  });

  it("multiplies the province ruins at the slider's top", () => {
    options.map.lore.history.ruins = 5;
    Chronicle.generate();
    expect(pack.markers).toHaveLength(3); // the seat plus both greater burgs: sqrt(20) / 2 asks for two
  });

  it("skips burgs that already host a marker", () => {
    pack.markers.push({ i: 9, name: "The Old Fair", type: "fairs", cell: 3 } as typeof pack.markers[number]); // Dale's cell is taken
    options.map.lore.history.ruins = 5;
    Chronicle.generate();
    expect(pack.markers.map(marker => marker.name)).toEqual(["The Old Fair", "Ruins of Old Empire", "Ruins of Hillfort"]);
  });

  it("places nothing when echoes are off", () => {
    options.map.lore.history.echoes = false;
    Chronicle.generate();
    expect(pack.markers).toHaveLength(0);
  });

  it("tells the fallen polity's story at its greatest survivor when the capital is gone", () => {
    pack.burgs[1].removed = true;
    Chronicle.generate();
    const seat = pack.markers.find(marker => marker.name === "Ruins of Old Empire")!;
    expect(seat.cell).toBe(2); // Hillfort, the largest survivor
  });

  it("marks the empty heartland when no burg survives the fall", () => {
    for (const burg of pack.burgs) if (burg) burg.removed = true;
    Chronicle.generate();
    const seat = pack.markers.find(marker => marker.name === "Ruins of Old Empire")!;
    expect(seat.cell).toBe(1); // the first cell of the dead territory
  });
});

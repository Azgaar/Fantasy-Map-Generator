import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NameBase } from "@/data/name-bases";
import {
  applyNaming,
  groupsOf,
  isAstralMap,
  pickFor,
  polityWordFor,
  sectorWordFor,
  starClassFor,
  systemTip,
  systemTraits,
  toSystem
} from "./astral-naming";
import { Names } from "@/model/society/names-generator";

const ASTRAL_BASE = "TRKCO";

let savedBases: NameBase[];

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  savedBases = Names.nameBases;
  globalThis.options = {
    map: {
      seed: "test-seed",
      cultures: { set: "astralTrek" },
      units: { population: { scale: 1000, urbanization: { rate: 0.1 } } }
    }
  } as unknown as typeof options;
  globalThis.pack = {
    states: [
      { i: 0, name: "Neutrals" },
      { i: 1, name: "Gantia", culture: 1, capital: 1 },
      { i: 2, name: "Burgia", culture: 2, capital: 2 }
    ],
    cultures: [
      { i: 0, name: "Wildlings", base: "GERMA" },
      { i: 1, name: "Aeloran", base: ASTRAL_BASE },
      { i: 2, name: "Stockish", base: "ENGLI" }
    ],
    burgs: [
      0,
      { i: 1, cell: 0, x: 10, y: 10, name: "Gant", culture: 1, population: 5 },
      { i: 2, cell: 1, x: 20, y: 20, name: "Burg", culture: 2, population: 5 }
    ],
    provinces: [
      { i: 0 },
      { i: 1, name: "Gant County", state: 1, burg: 1, center: 0 },
      { i: 2, name: "Burg County", state: 2, burg: 2, center: 1 }
    ]
  } as unknown as typeof pack;
});

afterEach(() => {
  Names.nameBases = savedBases;
  vi.restoreAllMocks();
});

describe("the Astral mapping", () => {
  it("knows the Astral culture sets", () => {
    expect(isAstralMap()).toBe(true);
    options.map.cultures.set = "highFantasy";
    expect(isAstralMap()).toBe(false);
  });

  it("picks a word the same way every time", () => {
    const words = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"];
    expect(pickFor(words, "Gant")).toBe(pickFor(words, "Gant"));
    expect(words).toContain(pickFor(words, "Gant"));
    // different names do not all collapse onto one word
    const picked = new Set(["Gant", "Burg", "Zorn", "Yax", "Kesh"].map(name => pickFor(words, name)));
    expect(picked.size).toBeGreaterThan(1);
    expect(pickFor([], "Gant")).toBeUndefined();
  });

  it("gives each sector a word of its own", () => {
    expect(sectorWordFor("Gant")).toBeTruthy();
    expect(sectorWordFor("Gant")).toBe(sectorWordFor("Gant"));
  });

  it("reads the polities of an Astral culture and leaves a stock one alone", () => {
    expect(groupsOf(1)).toBeTruthy(); // an Astral base
    expect(groupsOf(2)).toBeUndefined(); // a stock base has no groups
    expect(polityWordFor(1, "Gant")).toBeTruthy();
    expect(polityWordFor(2, "Burg")).toBeUndefined();
  });

  it("never puts a word with its own 'of' in front of a state's name", () => {
    Names.nameBases = [
      { id: "STOCK", name: "Stock", i: 0, min: 4, max: 12, d: "", m: 0, b: "" },
      {
        id: ASTRAL_BASE,
        name: "Trek Core",
        i: 1,
        min: 4,
        max: 12,
        d: "",
        m: 0,
        b: "",
        groups: { polities: ["United Federation", "Church of the Star"] }
      }
    ];

    for (const seed of ["A", "B", "C", "D", "E"]) {
      expect(polityWordFor(1, seed)).toBe("United Federation");
    }
  });
});

describe("the star classes", () => {
  const fringe = (i: number) => starClassFor({ i, population: 5 }); // 500 people
  const core = (i: number) => starClassFor({ i, population: 100 }); // 10 000 people

  it("rolls a stable star for each burg", () => {
    expect(fringe(1)).toEqual(fringe(1));
    expect(core(1)).toEqual(core(1));
    // a population edit within a band does not reroll
    expect(starClassFor({ i: 1, population: 5 })).toEqual(starClassFor({ i: 1, population: 50 }));
  });

  it("keeps the big worlds in the habitable band", () => {
    for (let i = 0; i < 500; i += 1) expect(["F", "G", "K"]).toContain(core(i).class);
  });

  it("rolls the standard distribution on the fringe", () => {
    const SUPPORTED = ["M", "K", "G", "F", "A", "B"];
    const rolled = new Set<string>();
    let redDwarfs = 0;

    for (let i = 0; i < 8000; i += 1) {
      const { class: cls } = fringe(i);
      expect(SUPPORTED).toContain(cls);
      rolled.add(cls);
      if (cls === "M") redDwarfs += 1;
    }

    expect(rolled.size).toBe(6); // every supported class is reachable, however rare
    expect(redDwarfs / 8000).toBeGreaterThan(0.7); // the fringe is a red-dwarf galaxy
  });

  it("names the classes in their own words", () => {
    const names = new Map<string, string>();
    for (let i = 0; i < 8000; i += 1) {
      const { class: cls, name } = fringe(i);
      names.set(cls, name);
    }

    expect(names.get("M")).toBe("red dwarf");
    expect(names.get("K")).toBe("orange dwarf");
    expect(names.get("G")).toBe("yellow dwarf");
    expect(names.get("F")).toBe("white-yellow star");
    expect(names.get("A")).toBe("white star");
    expect(names.get("B")).toBe("blue giant");
  });

  it("rerolls when the population crosses the core threshold", () => {
    // the bands seed independently: a fringe red dwarf can never keep its star up top
    const crossed = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].some(i => fringe(i).class !== core(i).class);
    expect(crossed).toBe(true);
  });

  it("names the installations in their own words", () => {
    expect(systemTraits({ port: 1, citadel: 1, plaza: 1, shanty: 1, temple: 1, walls: 1 })).toEqual([
      "shipyard",
      "bastion",
      "civic core",
      "drift",
      "shrine",
      "shielding"
    ]);
    expect(systemTraits({})).toEqual([]);
  });
});

describe("the star systems", () => {
  it("reads a burg as a system in its place", () => {
    const system = toSystem(pack.burgs[1]);
    expect(system.id).toBe(1);
    expect(system.x).toBe(10);
    expect(system.y).toBe(10);
  });

  it("writes the tooltip line from the class and the traits", () => {
    const system = toSystem(pack.burgs[1]);
    expect(system.class).toBe(starClassFor(pack.burgs[1]).class); // the system reads the burg's roll
    const homeworld = { ...system, class: "G", className: "yellow dwarf", traits: ["shipyard", "bastion"] };
    expect(systemTip(homeworld)).toBe("G-class yellow dwarf. Shipyard, bastion. Click to edit");
    expect(systemTip({ ...homeworld, traits: [] })).toBe("G-class yellow dwarf. Click to edit");
  });
});

describe("applying the naming", () => {
  it("renames the polities and their provinces, and leaves the stock ones alone", () => {
    const { polities, sectors } = applyNaming();

    expect(polities).toBe(1); // only the Astral state
    expect(sectors).toBe(1); // only the Astral province
    expect(pack.states[1].name).toBe("Gant"); // named by the system that holds it
    expect(pack.states[2].name).toBe("Burgia"); // the stock one is untouched
    expect(pack.provinces[1].formName).toBeTruthy(); // the Astral province became a sector
    expect(pack.provinces[2].formName).toBeUndefined(); // the stock one is untouched
  });

  it("is idempotent: applying twice changes nothing more", () => {
    applyNaming();
    const first = { name: pack.states[1].name, form: pack.states[1].formName };
    applyNaming();
    expect(pack.states[1].name).toBe(first.name);
    expect(pack.states[1].formName).toBe(first.form);
  });
});

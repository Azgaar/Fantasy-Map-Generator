import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NameBase } from "@/data/name-bases";
import {
  applyNaming,
  groupsOf,
  isAstralMap,
  pickFor,
  polityWordFor,
  sectorWordFor,
  starClass,
  systemTip,
  systemTraits,
  toSystem
} from "./astral-naming";
import { Names } from "./names-generator";

const ASTRAL_BASE = "TRKCO";

let savedBases: NameBase[];

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  savedBases = Names.nameBases;
  globalThis.options = {
    map: {
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
  it("puts the biggest worlds on the most habitable stars", () => {
    // a world of a million sits on a Sun-like yellow dwarf
    expect(starClass(2_000_000).class).toBe("G");
    expect(starClass(2_000_000).name).toBe("yellow dwarf");
    expect(starClass(300_000).class).toBe("F");
  });

  it("puts the small worlds on the exotic, harsh ones", () => {
    expect(starClass(30_000).class).toBe("A"); // a hot white star
    expect(starClass(5_000).class).toBe("B"); // a blue giant
    expect(starClass(500).class).toBe("M"); // a red dwarf: nobody's idea of a home
    expect(starClass(500).name).toBe("red dwarf");
  });

  it("walks down the ladder as the population falls", () => {
    const ladder = [2_000_000, 300_000, 60_000, 30_000, 5_000, 500].map(population => starClass(population).class);
    expect(ladder).toEqual(["G", "F", "K", "A", "B", "M"]);
  });

  it("gives the middle worlds the hardy stars", () => {
    expect(starClass(60_000).class).toBe("K");
    expect(starClass(60_000).name).toBe("orange dwarf");
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
    expect(system.class).toBe("M"); // 500 people is a red dwarf
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

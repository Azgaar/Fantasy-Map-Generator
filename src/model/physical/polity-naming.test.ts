import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NameBase } from "@/data/name-bases";
import { Names } from "@/model/society/names-generator";
import {
  applyNaming,
  groupsOf,
  isAstralMap,
  isRpgMap,
  polityWordFor,
  SECTOR_WORDS,
  sectorWordFor
} from "./polity-naming";

const ASTRAL_BASE = "TRKCO";
const RPG_BASE = "HALFL";

let savedBases: NameBase[];

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  savedBases = Names.nameBases;
  globalThis.options = {
    map: {
      cultures: { set: "rpgFantasy" },
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
      { i: 1, name: "Halflings", base: RPG_BASE },
      { i: 2, name: "Stockish", base: "ENGLI" }
    ],
    burgs: [
      0,
      { i: 1, cell: 0, x: 10, y: 10, name: "Gant", culture: 1, population: 5 },
      { i: 2, cell: 1, x: 20, y: 20, name: "Burg", culture: 2, population: 5 }
    ],
    provinces: [
      { i: 0 },
      { i: 1, name: "Gant Shire", state: 1, burg: 1, center: 0 },
      { i: 2, name: "Burg County", state: 2, burg: 2, center: 1 }
    ]
  } as unknown as typeof pack;
});

afterEach(() => {
  Names.nameBases = savedBases;
  vi.restoreAllMocks();
});

describe("polity naming", () => {
  it("knows Astral and RPG culture sets", () => {
    expect(isRpgMap()).toBe(true);
    expect(isAstralMap()).toBe(false);

    options.map.cultures.set = "astralTrek";
    expect(isAstralMap()).toBe(true);
    expect(isRpgMap()).toBe(false);

    options.map.cultures.set = "world";
    expect(isAstralMap()).toBe(false);
    expect(isRpgMap()).toBe(false);
  });

  it("reads groups for RPG and Astral cultures and returns undefined for stock cultures (no-group fallback)", () => {
    expect(groupsOf(1)).toBeTruthy(); // RPG base
    expect(groupsOf(2)).toBeUndefined(); // stock base (no groups)
    expect(polityWordFor(1, "Gant")).toBeTruthy();
    expect(polityWordFor(2, "Burg")).toBeUndefined();
  });

  it("never puts a polity word with its own 'of' in front of a state's name", () => {
    Names.nameBases = [
      { id: "STOCK", name: "Stock", i: 0, min: 4, max: 12, d: "", m: 0, b: "" },
      {
        id: RPG_BASE,
        name: "Halfling",
        i: 1,
        min: 4,
        max: 12,
        d: "",
        m: 0,
        b: "",
        groups: {
          polities: ["The Shire", "Realm of Halflings"],
          provinces: ["Shire", "Riding"]
        }
      }
    ];

    for (const seed of ["A", "B", "C", "D", "E"]) {
      expect(polityWordFor(1, seed)).toBe("The Shire");
    }
  });

  it("sectorWordFor uses provinces group when present, falling back to SECTOR_WORDS when absent", () => {
    // Culture 1 (RPG_BASE) has a provinces group in default name bases
    const provinceWord = sectorWordFor("Gant", 1);
    expect(provinceWord).toBeTruthy();
    // It should NOT fall back to SECTOR_WORDS when the base provides provinces
    const base = Names.getNameBase(RPG_BASE)!;
    expect(base.groups!.provinces).toContain(provinceWord);

    // When cultureId is omitted or points to an Astral base without provinces:
    expect(SECTOR_WORDS).toContain(sectorWordFor("Gant"));
  });

  it("applies RPG naming without renaming states to capitals, preserving fantasy state names", () => {
    options.map.cultures.set = "rpgFantasy";
    const { polities, sectors, renamed } = applyNaming();

    expect(polities).toBe(1);
    expect(sectors).toBe(1);
    expect(renamed).toBe(0); // RPG states are not renamed after capitals

    expect(pack.states[1].name).toBe("Gantia"); // preserved
    expect(pack.states[1].formName).toBeTruthy(); // given a polity form
    expect(pack.states[2].name).toBe("Burgia"); // stock culture untouched
    expect(pack.states[2].formName).toBeUndefined();

    expect(pack.provinces[1].formName).toBeTruthy(); // given a province form
    expect(pack.provinces[2].formName).toBeUndefined(); // stock culture untouched
  });

  it("applies Astral naming by renaming states to capitals and setting sector forms", () => {
    options.map.cultures.set = "astralTrek";
    pack.cultures[1].base = ASTRAL_BASE;

    const { polities, sectors, renamed } = applyNaming();

    expect(polities).toBe(1);
    expect(sectors).toBe(1);
    expect(renamed).toBe(1); // Astral states ARE renamed after capitals

    expect(pack.states[1].name).toBe("Gant"); // renamed after capital
    expect(pack.states[1].formName).toBeTruthy();
    expect(pack.provinces[1].formName).toBeTruthy();
  });

  it("is idempotent: applying twice changes nothing more", () => {
    applyNaming();
    const firstState = { name: pack.states[1].name, form: pack.states[1].formName };
    const firstProvince = { form: pack.provinces[1].formName };

    applyNaming();
    expect(pack.states[1].name).toBe(firstState.name);
    expect(pack.states[1].formName).toBe(firstState.form);
    expect(pack.provinces[1].formName).toBe(firstProvince.form);
  });
});

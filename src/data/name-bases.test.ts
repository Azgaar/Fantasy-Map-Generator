import { describe, expect, it } from "vitest";
import { pinSchemas } from "@/components/options-schema";
import { shields } from "@/data/emblems/shields";
import { getDefaultNameBases, isAstralBase, type NameBase } from "@/data/name-bases";
import { CULTURE_SETS, Cultures } from "@/generators/cultures-generator";

const ASTRAL_SETS = {
  astralTrek: ["Trek Core", "Trek Terran", "Trek Continental", "Trek Synthetic"],
  astralJammer: ["Jammer Deep", "Jammer Ethereal", "Jammer Stoneborn", "Jammer Wild"],
  grimdark: ["Grimdark Core", "Grimdark Gothic", "Grimdark Iron", "Grimdark Machine"]
} as const;

const ALL_ASTRAL_BASE_NAMES = Object.values(ASTRAL_SETS).flat();

const RPG_BASES = [
  { name: "Halfling", id: "HALFL", i: 55, min: 5, max: 12, d: "lnst" },
  { name: "Fey", id: "FEYFO", i: 56, min: 5, max: 13, d: "lrnm" },
  { name: "Infernal", id: "INFER", i: 57, min: 5, max: 13, d: "rxz" },
  { name: "Celestial", id: "CELES", i: 58, min: 5, max: 12, d: "ln" },
  { name: "Grave", id: "GRAVE", i: 59, min: 5, max: 13, d: "rn" },
  { name: "Merfolk", id: "MERFO", i: 60, min: 5, max: 12, d: "lrnm" },
  { name: "Beastfolk", id: "BEAST", i: 61, min: 4, max: 11, d: "rk" },
  { name: "Elemental", id: "ELEME", i: 62, min: 5, max: 12, d: "lnr" },
  { name: "Construct", id: "CONST", i: 63, min: 5, max: 12, d: "rn" },
  { name: "Eldritch", id: "ELDRI", i: 64, min: 4, max: 13, d: "rl" },
  { name: "Tribal", id: "TRIBA", i: 65, min: 4, max: 9, d: "nk" }
] as const;

const ALL_RPG_BASE_NAMES = RPG_BASES.map(b => b.name);

function getAstralBases(): NameBase[] {
  const all = getDefaultNameBases();
  return all.filter(b => ALL_ASTRAL_BASE_NAMES.includes(b.name as any));
}

function getRpgBases(): NameBase[] {
  const all = getDefaultNameBases();
  return all.filter(b => (ALL_RPG_BASE_NAMES as readonly string[]).includes(b.name));
}

function systemsOf(base: NameBase): string[] {
  return base.b
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function politiesOf(base: NameBase): string[] {
  return base.groups?.polities ?? [];
}

describe("Astral name bases content rules", () => {
  it("ships all 12 Astral name bases in getDefaultNameBases()", () => {
    const bases = getAstralBases();
    expect(bases).toHaveLength(12);
    expect(bases.map(b => b.name)).toEqual(ALL_ASTRAL_BASE_NAMES);
  });

  it("base names and indices are unique and appended after stock bases", () => {
    const all = getDefaultNameBases();
    const indices = all.map(b => b.i);
    expect(new Set(indices).size).toBe(all.length);
    expect(indices).toEqual(all.map((_, i) => i));

    // Stock bases 0..42, Astral bases 43..54
    const astral = getAstralBases();
    expect(astral[0].i).toBe(43);
    expect(astral[astral.length - 1].i).toBe(54);
  });

  it("gives every base a unique five-letter id", () => {
    const all = getDefaultNameBases();
    const ids = all.map(b => b.id);
    expect(new Set(ids).size).toBe(all.length);
    for (const id of ids) expect(id).toMatch(/^[A-Z]{5}$/);
  });

  for (const baseName of ALL_ASTRAL_BASE_NAMES) {
    describe(baseName, () => {
      const getB = () => getAstralBases().find(b => b.name === baseName)!;

      it("has a systems pool and a polities pool meeting minimum variety thresholds", () => {
        const base = getB();
        const systems = systemsOf(base);
        const polities = politiesOf(base);
        expect(systems.length).toBeGreaterThanOrEqual(50);
        expect(polities.length).toBeGreaterThanOrEqual(18);
      });

      it("has no duplicate names in systems or polities", () => {
        const base = getB();
        const systems = systemsOf(base);
        const polities = politiesOf(base);
        expect(new Set(systems).size).toBe(systems.length);
        expect(new Set(polities).size).toBe(polities.length);
      });

      it("contains no digits in any name", () => {
        const base = getB();
        for (const name of [...systemsOf(base), ...politiesOf(base)]) {
          expect(/[0-9]/.test(name)).toBe(false);
        }
      });

      it("contains no characters forbidden by the serialization format (| or /)", () => {
        const base = getB();
        for (const name of [...systemsOf(base), ...politiesOf(base)]) {
          expect(name).not.toContain("|");
          expect(name).not.toContain("/");
        }
      });

      it("has a sane length window and valid doubling letters", () => {
        const base = getB();
        expect(base.min).toBeGreaterThanOrEqual(2);
        expect(base.max).toBeGreaterThan(base.min);
        expect(base.max).toBeLessThanOrEqual(20);
        expect(base.d).toMatch(/^[a-z]*$/);
      });
    });
  }

  it("the bases of one set do not share a systems name", () => {
    const bases = getAstralBases();
    for (const [_setName, baseNames] of Object.entries(ASTRAL_SETS)) {
      const setBases = bases.filter(b => (baseNames as readonly string[]).includes(b.name));
      const allSystems = setBases.flatMap(systemsOf);
      expect(new Set(allSystems).size).toBe(allSystems.length);
    }
  });
});

describe("RPG Fantasy name bases content rules", () => {
  it("ships all 11 RPG Fantasy name bases in getDefaultNameBases()", () => {
    const bases = getRpgBases();
    expect(bases).toHaveLength(11);
    expect(bases.map(b => b.name)).toEqual(ALL_RPG_BASE_NAMES);
  });

  it("base names and indices are unique and appended after Astral bases", () => {
    const all = getDefaultNameBases();
    const indices = all.map(b => b.i);
    expect(new Set(indices).size).toBe(all.length);
    expect(indices).toEqual(all.map((_, i) => i));

    // Stock bases 0..42, Astral bases 43..54, RPG bases 55..65
    const rpg = getRpgBases();
    expect(rpg[0].i).toBe(55);
    expect(rpg[rpg.length - 1].i).toBe(65);
  });

  it("assigns each RPG base its reserved stable five-letter id", () => {
    const rpg = getRpgBases();
    for (const spec of RPG_BASES) {
      const base = rpg.find(b => b.name === spec.name);
      expect(base?.id).toBe(spec.id);
    }
  });

  for (const spec of RPG_BASES) {
    describe(spec.name, () => {
      const getB = () => getRpgBases().find(b => b.name === spec.name)!;

      it("has a names pool meeting the 80–150 variety threshold", () => {
        const base = getB();
        const names = systemsOf(base);
        expect(names.length).toBeGreaterThanOrEqual(80);
        expect(names.length).toBeLessThanOrEqual(150);
      });

      it("has no duplicate names", () => {
        const base = getB();
        const names = systemsOf(base);
        expect(new Set(names).size).toBe(names.length);
      });

      it("contains no digits in any name", () => {
        const base = getB();
        for (const name of systemsOf(base)) {
          expect(/[0-9]/.test(name)).toBe(false);
        }
      });

      it("contains no characters forbidden by the serialization format (| or /)", () => {
        const base = getB();
        for (const name of systemsOf(base)) {
          expect(name).not.toContain("|");
          expect(name).not.toContain("/");
        }
      });

      it("has the expected length window and doubling letters", () => {
        const base = getB();
        expect(base.min).toBe(spec.min);
        expect(base.max).toBe(spec.max);
        expect(base.d).toBe(spec.d);
      });

      it("carries polities and provinces groups meeting variety thresholds and is not classified as Astral", () => {
        const base = getB();
        expect(base.groups?.polities?.length).toBeGreaterThanOrEqual(8);
        expect(base.groups?.provinces?.length).toBeGreaterThanOrEqual(5);
        expect(isAstralBase(base)).toBe(false);
      });
    });
  }

  it("the bases of the RPG family do not share a settlement name", () => {
    const bases = getRpgBases();
    const allNames = bases.flatMap(systemsOf);
    expect(new Set(allNames).size).toBe(allNames.length);
  });
});

describe("RPG Fantasy culture set", () => {
  it("registers rpgFantasy in CULTURE_SETS", () => {
    expect(CULTURE_SETS.rpgFantasy).toEqual({ name: "RPG Fantasy", max: 24, probability: 4 });
  });

  const ALL_SHIELDS = Object.entries(shields)
    .filter(([key]) => key !== "types")
    .flatMap(([, record]) => Object.keys(record));

  it("getDefault() returns 44 cultures resolved to valid bases and real shields", () => {
    const origMap = options.map;
    const origPack = (globalThis as any).pack;
    const origGrid = (globalThis as any).grid;
    try {
      options.map = {
        ...origMap,
        cultures: { set: "rpgFantasy" }
      } as any;
      (globalThis as any).pack = {
        cells: {
          s: [10, 20, 30],
          t: [1, 1, 1],
          h: [20, 50, 80],
          g: [0, 1, 2],
          biome: [6, 8, 11],
          haven: [0, 0, 0]
        },
        features: [{ type: "ocean" }]
      };
      (globalThis as any).grid = {
        cells: {
          temp: [12, 0, -20]
        }
      };

      const cultures = Cultures.getDefault();
      expect(cultures).toHaveLength(44);

      const allBases = getDefaultNameBases();
      const allBaseIds = new Set(allBases.map(b => b.id));

      for (const culture of cultures) {
        expect(allBaseIds.has(culture.base)).toBe(true);
        expect(typeof culture.sort).toBe("function");
        expect(culture.odd).toBeGreaterThan(0);
        expect(ALL_SHIELDS).toContain(culture.shield);
      }
    } finally {
      options.map = origMap;
      (globalThis as any).pack = origPack;
      (globalThis as any).grid = origGrid;
    }
  });

  it("placement sort functions score homelands according to habitat preference", () => {
    const origMap = options.map;
    const origPack = (globalThis as any).pack;
    const origGrid = (globalThis as any).grid;
    try {
      options.map = { ...origMap, cultures: { set: "rpgFantasy" } } as any;
      (globalThis as any).pack = {
        cells: {
          s: [100, 10], // cell 0: score 100, cell 1: score 10
          t: [1, 1],
          h: [80, 10], // cell 0: height 80, cell 1: height 10
          g: [0, 1],
          biome: [6, 1], // cell 0: temperate forest (6), cell 1: marine/desert (1)
          haven: [1, 0] // cell 0 has haven, cell 1 doesn't
        },
        features: [{ type: "ocean" }]
      };
      (globalThis as any).grid = {
        cells: {
          temp: [25, -10] // cell 0: temp 25 (warm), cell 1: temp -10 (freezing)
        }
      };

      const cultures = Cultures.getDefault();
      const elf = cultures.find(c => c.name === "Quenar (High Elf)")!; // forest
      const dwarf = cultures.find(c => c.name === "Khazad (Mountain Dwarf)")!; // highland
      const nomad = cultures.find(c => c.name === "Desert Nomad (Human)")!; // arid (td 25)
      const troll = cultures.find(c => c.name === "Troll")!; // polar (td -10)
      const aelvar = cultures.find(c => c.name === "Aelvar (Sea Elf)")!; // coastal (haven)
      const drow = cultures.find(c => c.name === "Drow (Dark Elf)")!; // underworld (td 20 + sMax - h)
      const feudal = cultures.find(c => c.name === "Feudal (Human)")!; // open (n(i))

      // Forest culture prefers forest biome (cell 0, biome 6) over non-forest (cell 1, biome 1)
      expect(elf.sort!(0)).toBeGreaterThan(elf.sort!(1));

      // Highland culture prefers higher elevation (cell 0, h 80) over low (cell 1, h 10)
      expect(dwarf.sort!(0)).toBeGreaterThan(dwarf.sort!(1));

      // Arid culture prefers hot (cell 0, temp 25) over freezing (cell 1, temp -10)
      expect(nomad.sort!(0)).toBeGreaterThan(nomad.sort!(1));

      // Polar culture prefers freezing (cell 1, temp -10) over hot (cell 0, temp 25)
      expect(troll.sort!(1)).toBeGreaterThan(troll.sort!(0));

      // Coastal culture prefers cell with haven (cell 0) over without (cell 1)
      expect(aelvar.sort!(0)).toBeGreaterThan(aelvar.sort!(1));

      // Underworld culture prefers low elevation (sMax - h[i])
      expect(drow.sort!(1)).toBeGreaterThan(drow.sort!(0));

      // Open culture prefers higher cell score (cell 0, s 100) over lower (cell 1, s 10)
      expect(feudal.sort!(0)).toBeGreaterThan(feudal.sort!(1));
    } finally {
      options.map = origMap;
      (globalThis as any).pack = origPack;
      (globalThis as any).grid = origGrid;
    }
  });

  it("set acceptance: places 24 cultures with set max 24, and options tab select renders it", async () => {
    expect(CULTURE_SETS.rpgFantasy.max).toBe(24);
    expect(pinSchemas.culturesSet.safeParse("rpgFantasy").success).toBe(true);

    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/options/tabs/options-tab.ts", "utf8");
    expect(source).toContain("CULTURE_SETS");
    expect(CULTURE_SETS.rpgFantasy).toBeDefined();
  });
});

describe("Astral culture sets", () => {
  it("registers astralTrek, astralJammer, and grimdark in CULTURE_SETS", () => {
    expect(CULTURE_SETS.astralTrek).toEqual({ name: "AstralTrek", max: 8, probability: 5 });
    expect(CULTURE_SETS.astralJammer).toEqual({ name: "AstralJammer", max: 8, probability: 4 });
    expect(CULTURE_SETS.grimdark).toEqual({ name: "Grimdark", max: 8, probability: 3 });
  });

  const ALL_SHIELDS = Object.entries(shields)
    .filter(([key]) => key !== "types")
    .flatMap(([, record]) => Object.keys(record));

  for (const [setId, baseNames] of Object.entries(ASTRAL_SETS)) {
    it(`getDefault() returns 8 cultures for ${setId} resolved to the set's bases`, () => {
      const origMap = options.map;
      const origPack = (globalThis as any).pack;
      const origGrid = (globalThis as any).grid;
      try {
        options.map = {
          ...origMap,
          cultures: { set: setId }
        } as any;
        (globalThis as any).pack = {
          cells: {
            s: [10, 20, 30],
            t: [1, 1, 1],
            h: [20, 50, 80],
            g: [0, 1, 2],
            biome: [6, 8, 11],
            haven: [0, 0, 0]
          },
          features: [{ type: "ocean" }]
        };
        (globalThis as any).grid = {
          cells: {
            temp: [12, 0, -20]
          }
        };

        const cultures = Cultures.getDefault();
        expect(cultures).toHaveLength(8);

        const allBases = getDefaultNameBases();
        const allowedIds = baseNames.map(name => allBases.find(base => base.name === name)?.id);

        for (const culture of cultures) {
          expect(allowedIds).toContain(culture.base);
          expect(typeof culture.sort).toBe("function");
          expect(culture.odd).toBeGreaterThan(0);
          expect(ALL_SHIELDS).toContain(culture.shield);
        }
      } finally {
        options.map = origMap;
        (globalThis as any).pack = origPack;
        (globalThis as any).grid = origGrid;
      }
    });
  }

  it("placement sort functions score homelands according to habitat preference", () => {
    const origMap = options.map;
    const origPack = (globalThis as any).pack;
    const origGrid = (globalThis as any).grid;
    try {
      options.map = { ...origMap, cultures: { set: "astralTrek" } } as any;
      (globalThis as any).pack = {
        cells: {
          s: [100, 10], // cell 0: score 100, cell 1: score 10
          t: [1, 1],
          h: [50, 10], // cell 0: height 50, cell 1: height 10
          g: [0, 1],
          biome: [6, 11],
          haven: [0, 0]
        },
        features: [{ type: "ocean" }]
      };
      (globalThis as any).grid = {
        cells: {
          temp: [12, -20] // cell 0: temp 12 (temperate), cell 1: temp -20 (harsh)
        }
      };

      const cultures = Cultures.getDefault();
      const terran = cultures.find(c => c.name === "Terran (Human)")!;
      const highlander = cultures.find(c => c.name === "Highlander (Human)")!;
      const posthuman = cultures.find(c => c.name === "Posthuman (Machine)")!;
      const colonial = cultures.find(c => c.name === "Colonial (Human)")!;

      // Temperate culture prefers mild climate (cell 0, temp 12) over freezing (cell 1, temp -20)
      expect(terran.sort!(0)).toBeGreaterThan(terran.sort!(1));

      // Harsh / highland culture prefers cold/elevation
      expect(highlander.sort!(0)).toBeGreaterThan(0);

      // Remote culture prefers rim/lesser populated cells
      expect(posthuman.sort!(1)).toBeGreaterThan(posthuman.sort!(0));

      // Any culture prefers higher cell score
      expect(colonial.sort!(0)).toBeGreaterThan(colonial.sort!(1));
    } finally {
      options.map = origMap;
      (globalThis as any).pack = origPack;
      (globalThis as any).grid = origGrid;
    }
  });
});

describe("Phase A acceptance", () => {
  it("yields the eight Trek peoples naming their burgs from systems pools, and set pinning works", () => {
    const origMap = options.map;
    const origPack = (globalThis as any).pack;
    const origGrid = (globalThis as any).grid;
    try {
      options.map = {
        ...origMap,
        cultures: { set: "astralTrek" }
      } as any;
      (globalThis as any).pack = {
        cells: {
          s: [10, 20, 30],
          t: [1, 1, 1],
          h: [20, 50, 80],
          g: [0, 1, 2],
          biome: [6, 8, 11],
          haven: [0, 0, 0]
        },
        features: [{ type: "ocean" }]
      };
      (globalThis as any).grid = {
        cells: {
          temp: [12, 0, -20]
        }
      };

      const cultures = Cultures.getDefault();
      expect(cultures).toHaveLength(8);
      expect(cultures.map(c => c.name)).toEqual([
        "Terran (Human)",
        "Colonial (Human)",
        "Continental (Human)",
        "Highlander (Human)",
        "Synthetic (Machine)",
        "Posthuman (Machine)",
        "Core Worlds (Mixed)",
        "Inner Reach (Mixed)"
      ]);

      const bases = getDefaultNameBases();
      for (const culture of cultures) {
        const base = bases.find(candidate => candidate.id === culture.base);
        expect(base).toBeDefined();
        expect(base!.name.startsWith("Trek ")).toBe(true);
        expect(base!.b.length).toBeGreaterThan(0);
      }

      expect(pinSchemas.culturesSet.safeParse("astralTrek").success).toBe(true);
      expect(pinSchemas.culturesSet.safeParse("astralJammer").success).toBe(true);
      expect(pinSchemas.culturesSet.safeParse("grimdark").success).toBe(true);
    } finally {
      options.map = origMap;
      (globalThis as any).pack = origPack;
      (globalThis as any).grid = origGrid;
    }
  });

  it("options tab culturesSet select renders all CULTURE_SETS including Astral sets", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/components/options/tabs/options-tab.ts", "utf8");
    expect(source).toContain("CULTURE_SETS");
    expect(source).toContain('data-option="culturesSet"');
    for (const key of ["astralTrek", "astralJammer", "grimdark"]) {
      expect(CULTURE_SETS[key]).toBeDefined();
    }
  });
});

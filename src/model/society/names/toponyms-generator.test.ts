import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type Concept, conceptsOf, kindOf } from "@/data/name-concepts";
import { PATTERNS } from "@/data/name-patterns";
import type { Feature } from "@/model/physical/features-generator";
import type { Burg } from "@/model/political/burgs-generator";
import type { Pattern } from "@/types/names";
import { seeded } from "@/utils/probability-utils";
import { NameBases } from "./name-bases";
import { type LandSize, Toponyms } from "./toponyms-generator";

beforeAll(() => vi.stubGlobal("pack", { cultures: [] }));
beforeAll(() => NameBases.load(["english", "german", "human-generic"]));

describe("Toponyms.sample", () => {
  it("makes a name of any pattern asked for", () => {
    for (const pattern of Object.keys(PATTERNS) as Pattern[]) {
      const { name, meaning } = Toponyms.sample(NameBases.find("english")!, { pattern });
      expect(meaning.pattern).toBe(pattern);
      expect(name.length, pattern).toBeGreaterThan(1);
    }
  });

  it("says the concept asked for, whatever its kind", () => {
    for (const kind of ["settlement", "generic", "modifier", "numeral", "land"] as const) {
      const [concept] = conceptsOf(kind);
      expect(Toponyms.sample(NameBases.find("english")!, { concept }).meaning.tokens).toContain(concept);
    }
  });

  it("counts what there may be several of, never a kind of settlement", () => {
    for (let i = 0; i < 20; i++) {
      const [, generic] = Toponyms.sample(NameBases.find("english")!, { concept: "three" }).meaning.tokens;
      expect(kindOf(generic as Concept)).toBe("generic");
    }
  });
});

describe("Toponyms.sea", () => {
  it("describes a sea or names its side of the map, said in the seas' base or the one given", () => {
    vi.stubGlobal("pack", { cells: { p: [[10, 50]] } });
    const graph = options.map.graph;
    options.map.graph = { ...graph, width: 100, height: 100 };
    const sea = { firstCell: 0 } as Feature;
    const seas = seeded("seas", () => Array.from({ length: 50 }, () => Toponyms.sea(sea)));
    expect(seas.every(({ meaning }) => meaning.pattern === "description" && meaning.origin === "human-generic")).toBe(
      true
    );
    expect(seas.some(({ name }) => name === "West")).toBe(true);
    expect(new Set(seas.map(({ name }) => name)).size).toBeGreaterThan(10);
    expect(Toponyms.sea(sea, "german").meaning.origin).toBe("german");
    options.map.graph = graph;
  });
});

describe("Toponyms.land", () => {
  it("calls a big land a realm and a small one a march more often, and describes a big one less", () => {
    vi.stubGlobal("pack", { cultures: [], burgs: [], states: [], provinces: [] });
    const count = (size: LandSize) => {
      const lands = seeded("lands", () =>
        Array.from({ length: 300 }, () => Toponyms.land("german", new Set(), size).meaning)
      );
      return {
        realms: lands.filter(({ tokens }) => tokens[1] === "realm").length,
        marches: lands.filter(({ tokens }) => tokens[1] === "march").length,
        described: lands.filter(({ pattern }) => pattern === "modifier-land").length
      };
    };
    const [big, small] = [count("big"), count("small")];
    expect(big.realms).toBeGreaterThan(small.realms);
    expect(big.marches).toBeLessThan(small.marches);
    expect(big.described).toBeLessThan(small.described);
  });
});

describe("a base that picks its places", () => {
  const burg = { i: 1, cell: 0, culture: 1 } as Burg;
  const base = () => NameBases.edit("english");
  const named = () => Toponyms.burg(burg, { burgs: [], baseId: "english", taken: new Set(["Alpha", "Beta"]) });

  afterEach(() => {
    options.map.nameBases = [];
  });

  it("names a burg with a listed place not taken yet, as it is", () => {
    base().places = { names: ["Alpha", "Beta", "Gamma"], mode: "pick" };
    expect(named()).toEqual({
      name: "Gamma",
      meaning: { pattern: "simplex", tokens: ["~Gamma"], origin: "english" }
    });
  });

  it("coins a name like the listed ones when all are taken", () => {
    base().places = { names: ["Alpha", "Beta"], mode: "pick" };
    expect(named().meaning.pattern).toBe("simplex");
  });

  it("coins one that is not taken either", () => {
    const names = base().places.names.slice(0, 40);
    base().places = { names, mode: "pick" };
    const taken = new Set(names);
    for (let i = 0; i < 20; i++) {
      const { name } = seeded(`${i}`, () => Toponyms.burg(burg, { burgs: [], baseId: "english", taken }));
      expect(taken.has(name)).toBe(false);
      taken.add(name);
    }
  });
});

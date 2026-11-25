import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type Concept, conceptsOf, kindOf } from "@/data/name-concepts";
import { DEFAULT_TEMPLATES } from "@/data/name-rules";
import type { Burg } from "@/model/political/burgs-generator";
import type { Pattern } from "@/types/names";
import { seeded } from "@/utils/probability-utils";
import { Names } from "./names-generator";
import { type LandSize, Toponyms } from "./toponyms-generator";

beforeAll(() => vi.stubGlobal("pack", { cultures: [] }));
beforeAll(() => Names.load(["english", "german"]));

describe("Toponyms.sample", () => {
  it("makes a name of any pattern asked for", () => {
    for (const pattern of Object.keys(DEFAULT_TEMPLATES) as Pattern[]) {
      const { name, meaning } = Toponyms.sample(Names.find("english")!, { pattern });
      expect(meaning.pattern).toBe(pattern);
      expect(name.length, pattern).toBeGreaterThan(1);
    }
  });

  it("says the concept asked for, whatever its kind", () => {
    for (const kind of ["settlement", "generic", "modifier", "numeral", "land"] as const) {
      const [concept] = conceptsOf(kind);
      expect(Toponyms.sample(Names.find("english")!, { concept }).meaning.tokens).toContain(concept);
    }
  });

  it("counts what there may be several of, never a kind of settlement", () => {
    for (let i = 0; i < 20; i++) {
      const [, generic] = Toponyms.sample(Names.find("english")!, { concept: "three" }).meaning.tokens;
      expect(kindOf(generic as Concept)).toBe("generic");
    }
  });
});

describe("Toponyms.landOf", () => {
  it("calls a big land a realm and a small one a march more often, and describes a big one less", () => {
    vi.stubGlobal("pack", { cultures: [], burgs: [], states: [], provinces: [] });
    const count = (size: LandSize) => {
      const lands = seeded("lands", () =>
        Array.from({ length: 300 }, () => Toponyms.landOf("german", new Set(), size).meaning)
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
  const base = () => Names.find("english")!;
  const named = () => Toponyms.burg(burg, { burgs: [], baseId: "english", taken: new Set(["Alpha", "Beta"]) });

  afterEach(() => {
    Names.nameBases = Names.getNameBases();
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
});

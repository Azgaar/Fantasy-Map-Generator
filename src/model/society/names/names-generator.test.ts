import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NAME_BASES, readNameBase } from "@/data/name-bases";
import { CONCEPTS, type Concept, conceptsOf, isConcept, weightOf } from "@/data/name-concepts";
import { DEFAULT_LEXICON, DEFAULT_TEMPLATES } from "@/data/name-rules";
import type { NameBase, Pattern } from "@/types/names";
import { Lexicon } from "./lexicon";
import { Meanings } from "./meanings";
import { Names } from "./names-generator";
import { SoundRules } from "./sound-rules";

beforeAll(() => vi.stubGlobal("pack", { cultures: [] }));
beforeAll(() => Names.loadAll());

afterEach(() => {
  vi.restoreAllMocks();
  Names.nameBases = Names.getNameBases();
  Names.clearChains();
});

describe("Names.calculateChain", () => {
  it("splits CJK names into single-character syllables", () => {
    const chain = Names.calculateChain(["长安", "洛阳", "ソウル", "서울"]);
    expect(chain[""]).toEqual(["长", "洛", "ソ", "서"]);
    expect(chain.长).toEqual(["安"]);
    expect(chain.安).toEqual([""]);
    expect(chain.ウ).toEqual(["ル"]);
    expect(chain.서).toEqual(["울"]);
  });

  it("keeps multi-letter syllables for alphabetic names", () => {
    expect(Names.calculateChain(["Chester"])[""]).toEqual(["ches"]);
  });
});

describe("concepts", () => {
  it("weigh all but settlements in whole numbers from 1 to 10", () => {
    for (const concept of Object.keys(CONCEPTS) as Concept[]) {
      if (conceptsOf("settlement").includes(concept)) expect(weightOf(concept), concept).toBe(0);
      else
        expect(
          [...Array(10).keys()].map(n => n + 1),
          concept
        ).toContain(weightOf(concept));
    }
  });
});

describe("shipped name bases", () => {
  it("are listed under the ids and names their files give", async () => {
    const written = await Promise.all(NAME_BASES.map(({ id }) => readNameBase(id)));
    expect(written.map(({ id, name }) => ({ id, name }))).toEqual(NAME_BASES);
  });

  it("have unique ids made of their names, a corpus and rules that compile", () => {
    const bases = Names.loaded();
    expect(new Set(bases.map(base => base.id)).size).toBe(bases.length);
    for (const base of bases) {
      expect(base.id).toBe(Names.uniqueId(base.name, []));
      expect(Names.schema.safeParse(base).success).toBe(true);
      expect(base.places.names.length).toBeGreaterThan(100);
      for (const { match } of base.rules ?? []) expect(() => new RegExp(match, "gu")).not.toThrow();
    }
  });

  it("write lexicons in the vocabulary, patterns that exist and bases they can extend", () => {
    const bases = Names.loaded();
    for (const base of bases) {
      for (const concept of Object.keys(base.lexicon ?? {}))
        expect(isConcept(concept), `${base.id}: ${concept}`).toBe(true);
      for (const [pattern, { templates = [] }] of Object.entries(base.patterns ?? {})) {
        expect(Object.keys(DEFAULT_TEMPLATES), base.id).toContain(pattern);
        const slots = Meanings.slots[pattern as Pattern].map(slot => `{${slot}}`);
        for (const { parts } of templates)
          expect(slots, `${base.id}: ${parts}`).toEqual(expect.arrayContaining(parts.match(/\{\w+\}/g)!));
      }
      if (base.extends)
        expect(
          bases.some(({ id }) => id === base.extends),
          base.id
        ).toBe(true);
    }
    for (const concept of Object.keys(DEFAULT_LEXICON)) expect(isConcept(concept)).toBe(true);
  });

  it("list people for every base, each name once", () => {
    for (const { id, people } of Names.loaded()) {
      for (const corpus of [people?.male, people?.female]) {
        expect(corpus?.names.length, id).toBeGreaterThanOrEqual(20);
        expect(new Set(corpus!.names).size, id).toBe(corpus!.names.length);
      }
    }
  });

  it("write a form for every settlement and modifier concept in English and Ruthenian", () => {
    for (const id of ["english", "ruthenian"]) {
      const { lexicon = {} } = Names.loaded().find(base => base.id === id)!;
      for (const concept of (["settlement", "generic", "modifier", "numeral"] as const).flatMap(conceptsOf)) {
        expect(lexicon[concept]?.length, `${id}: ${concept}`).toBeGreaterThan(0);
        for (const { form } of lexicon[concept]!)
          expect(form, `${id}: ${concept}`).toMatch(/^(-?[\p{Ll}']+(\*\p{Ll}*|-)?|_)$/u);
      }
    }
  });

  it("write the settlements and a land in every shipped base", () => {
    for (const { id, lexicon = {}, extends: parent } of Names.loaded()) {
      if (parent) continue; // Human Generic speaks English's words where it writes none
      for (const concept of ["city", "town", "village", "hamlet", "land"] as const)
        expect(lexicon[concept]?.length, `${id}: ${concept}`).toBeGreaterThan(0);
    }
  });

  it("end no state as they end a town", () => {
    const endings = (base: NameBase, concepts: Concept[]) =>
      concepts.flatMap(concept =>
        Lexicon.formsOf(base, concept).flatMap(({ form, position }) =>
          position === "word" ? [] : form.replace("-", "")
        )
      );
    const lands: Concept[] = ["land", "realm", "march", "domain", "country"];
    for (const base of Names.loaded()) {
      const towns = endings(base, conceptsOf("settlement"));
      for (const ending of endings(base, lands)) expect(towns, base.id).not.toContain(ending);
    }
  });
});

describe("Names.getBase", () => {
  const generate = (doubled: string, dupl?: string) => {
    Names.nameBases = [Names.composeBase("test", "Test", [2, 20], ["Bolla"], doubled)];
    Names.clearChains();
    vi.spyOn(Math, "random").mockReturnValue(0);
    return Names.getBase("test", undefined, undefined, dupl);
  };

  it("doubles only the letters the base's rule allows", () => {
    expect(generate("l")).toBe("Bolla");
    expect(generate("")).toBe("Bola");
    expect(generate("l", "")).toBe("Bola"); // an empty dupl allows none
  });

  it("gives a shipped base the map dropped the base standing in its place, else the first one", () => {
    Names.nameBases = [Names.composeBase("a", "A", [2, 9], ["Aaa"]), Names.composeBase("b", "B", [2, 9], ["Bbb"])];
    expect(Names.resolve("english").id).toBe("b"); // English is the second shipped base
    expect(Names.resolve("unknown").id).toBe("a");
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(Names.getBase("unknown")).toBe(Names.getBase("a"));
  });
});

describe("Names.getPerson", () => {
  const withPeople = (mode?: "chain" | "pick") => {
    const base = Names.composeBase("test", "Test", [4, 9], ["Aaa", "Bbb", "Ccc"]);
    base.people = {
      male: { names: ["Alfred", "Edmund", "Oswald"], mode },
      female: { names: ["Edith", "Hilda"], mode }
    };
    Names.nameBases = [base];
    return [...base.people.male!.names, ...base.people.female!.names];
  };

  it("picks a name of the corpus as it is", () => {
    const listed = withPeople("pick");
    expect(listed).toContain(Names.getPerson("test"));
  });

  it("follows the options over the corpus", () => {
    const listed = withPeople("chain");
    options.generation.names.proper = "pick";
    expect(listed).toContain(Names.getPerson("test"));
    options.generation.names.proper = "base";
  });

  it("names a woman as often as it is told", () => {
    withPeople("pick");
    expect(["Alfred", "Edmund", "Oswald"]).toContain(Names.getPerson("test", 0));
    expect(["Edith", "Hilda"]).toContain(Names.getPerson("test", 1));
  });

  it("names a person like a short place where a base has no people, and takes the people of the base it extends", () => {
    Names.nameBases = [Names.composeBase("bare", "Bare", [4, 9], ["Aaaaaa", "Bbbbbb", "Cccccc"])];
    expect(Names.getPerson("bare").length).toBeLessThanOrEqual(6);
    const listed = withPeople("pick");
    Names.nameBases.push({ ...Names.composeBase("heir", "Heir", [4, 9], ["Aaa"]), extends: "test" });
    expect(listed).toContain(Names.getPerson("heir"));
  });
});

describe("Names.getWater", () => {
  it("names a water off the base's own list, or like a place where it has none", () => {
    const base = Names.composeBase("test", "Test", [4, 9], ["Aaaaaa", "Bbbbbb", "Cccccc"]);
    Names.nameBases = [base];
    expect(Names.getWater("test")).toMatch(/^[ABC]/);
    base.waters = { names: ["Dvina", "Desna"], mode: "pick" };
    expect(["Dvina", "Desna"]).toContain(Names.getWater("test"));
    base.waters = { names: ["Dddddd"] };
    expect(Names.getWater("test")).toMatch(/^D/);
  });
});

describe("Names.uniqueId", () => {
  it("slugs a name and numbers a taken id", () => {
    expect(Names.uniqueId("Dark Elven", [])).toBe("dark-elven");
    expect(Names.uniqueId("Dark Elven", ["dark-elven", "dark-elven-2"])).toBe("dark-elven-3");
    expect(Names.uniqueId("Русский (north)", [])).toBe("русский-north");
    expect(Names.uniqueId("!!!", [])).toBe("base");
  });
});

describe("Names.serialize", () => {
  it("stores a shipped base by its id and an edited or custom one in full", () => {
    const [german, english] = Names.loaded();
    english.length[1] = 14;
    const custom = Names.composeBase("custom", "Custom", [4, 8], ["Aaa", "Bbb", "Ccc"]);
    Names.nameBases = [german, english, custom];

    expect(JSON.parse(Names.serialize())).toEqual([{ id: "german" }, english, custom]);
  });

  it("restores what it stored, shipped bases from the shipped data", () => {
    const shipped = Names.getNameBases();
    const custom = Names.composeBase("custom", "Custom", [4, 8], ["Aaa", "Bbb", "Ccc"], "b");
    Names.nameBases = [shipped[5], custom];
    Names.getBase("custom"); // caches a chain

    const record = Names.serialize();
    Names.nameBases = [];
    Names.restore(record);

    expect(Names.nameBases).toEqual([shipped[5], custom]);
    const chained = vi.spyOn(Names, "calculateChain");
    Names.getBase("custom");
    expect(chained).toHaveBeenCalledOnce(); // the cached chain went with the old set
    chained.mockRestore();
  });

  it("restores the shipped bases when a map holds none, and skips a shipped id it does not know", () => {
    Names.restore();
    expect(Names.nameBases).toEqual(Names.getNameBases());
    Names.restore(JSON.stringify([{ id: "gone" }, { id: "nordic" }]));
    expect(Names.nameBases.map(base => base.id)).toEqual(["nordic"]);
  });
});

describe("Names.replace", () => {
  it("moves each culture to the base standing where its own stood", () => {
    const bases = ["english", "greek", "custom", "levantine"].map(base => ({ base }));
    vi.stubGlobal("pack", { cultures: bases });
    Names.nameBases.push(Names.composeBase("custom", "Custom", [4, 8], ["Aaa", "Bbb", "Ccc"]));
    const set = ["A", "B", "C"].map(name => Names.composeBase(name.toLowerCase(), name, [4, 8], ["Aaa", "Bbb", "Ccc"]));

    Names.replace(set);
    expect(bases.map(culture => culture.base)).toEqual(["b", "greek", "custom", "levantine"]); // only English had a place

    Names.replace(Names.getNameBases());
    expect(bases.map(culture => culture.base)).toEqual(["english", "greek", "custom", "levantine"]);
    vi.stubGlobal("pack", { cultures: [] });
  });
});

describe("a generated name", () => {
  it("is capitalized after a space and a hyphen", () => {
    Names.nameBases = [Names.composeBase("test", "Test", [2, 30], ["an giang-le"], "")];
    Names.clearChains();
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(Names.getBase("test")).toBe("An Giang-Le");
    expect(SoundRules.apply("an giang-le")).toBe("an giang-le");
  });
});

describe("loading", () => {
  const unloaded = async () => {
    vi.resetModules();
    return (await import("./names-generator")).Names;
  };

  it("starts with the shipped bases listed and none loaded", async () => {
    const names = await unloaded();
    expect(names.nameBases).toEqual(NAME_BASES);
    expect(names.has("greek")).toBe(true);
    expect(names.find("greek")).toBeUndefined();
    expect(names.loaded()).toEqual([]);
  });

  it("loads the bases the cultures use, those they extend and what stands in for a dropped one", async () => {
    const names = await unloaded();
    vi.stubGlobal("pack", { cultures: [{ base: "goblin" }, { base: "goblin" }, { base: "heir" }, { base: "greek" }] });
    const heir = { ...names.composeBase("heir", "Heir", [4, 8], ["Aaa", "Bbb", "Ccc"]), extends: "elven" };
    const kept = names.getNameBases().filter(base => ["german", "nordic", "goblin", "elven"].includes(base.id));
    names.nameBases = [...kept, heir]; // Greek, the eighth of the shipped bases, stands for the third of these five
    expect(names.entry("greek")?.id).toBe(kept[2].id);

    await names.loadUsed();
    expect(names.loaded().map(base => base.id)).toEqual(expect.arrayContaining(["goblin", "heir", "elven", "goblin"]));
    expect(names.find("german")).toBeUndefined();
    vi.stubGlobal("pack", { cultures: [] });
  });

  it("leaves a base loaded and edited meanwhile as it is", async () => {
    const names = await unloaded();
    await Promise.all([names.load(["greek"]), names.load(["greek"])]);
    const greek = names.find("greek")!;
    greek.length = [1, 2];
    await names.loadAll();
    expect(names.find("greek")).toBe(greek);
    expect(greek.length).toEqual([1, 2]);
  });

  it("stores a base that is not loaded by its id, and one that fails to load keeps its place", async () => {
    vi.doMock("@/data/name-bases", async original => {
      const data = await original<typeof import("@/data/name-bases")>();
      const readNameBase = async (id: string) => {
        if (id === "greek") throw new Error("offline");
        return data.readNameBase(id);
      };
      return { ...data, readNameBase };
    });
    const names = await unloaded();
    await names.load(["greek", "roman"]);
    expect(names.resolve("greek").id).toBe("roman");
    expect(JSON.parse(names.serialize())).toEqual(NAME_BASES.map(({ id }) => ({ id })));
    vi.doUnmock("@/data/name-bases");
  });
});

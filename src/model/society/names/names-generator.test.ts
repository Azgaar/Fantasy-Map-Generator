import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NAME_BASES, readNameBase } from "@/data/name-bases";
import { CONCEPTS, type Concept, conceptsOf, isConcept, weightOf } from "@/data/name-concepts";
import { DEFAULT_LEXICON, DEFAULT_TEMPLATES } from "@/data/name-rules";
import { mapSchema } from "@/model/options/options-schema";
import type { NameBase, Pattern } from "@/types/names";
import { Lexicon } from "./lexicon";
import { Meanings } from "./meanings";
import { NAME_BASE_SCHEMA } from "./name-base-schema";
import { Names } from "./names-generator";
import { SoundRules } from "./sound-rules";

beforeAll(() => vi.stubGlobal("pack", { cultures: [] }));
beforeAll(() => Names.loadAll());

afterEach(() => {
  vi.restoreAllMocks();
  options.map.nameBases = [];
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
      expect(NAME_BASE_SCHEMA.safeParse(base).success).toBe(true);
      expect(base.places.names.length).toBeGreaterThan(100);
      expect(base.description, base.id).toBeTruthy();
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

describe("Names.cut", () => {
  const base = Names.composeBase("test", "Test", [2, 12], ["Waldbach", "Kord", "Ama", "Wald"]);

  it("keeps three letters at least and closes as the base's names do", () => {
    expect(Names.cut("waldbach", base, 1)).toBe("wald");
    expect(Names.cut("amadea", base, 1)).toBe("ama");
    expect(Names.cut("kord", base, 1)).toBe("kord");
  });
});

describe("a base's vocabulary", () => {
  it("is what a base of a real language writes, and all concepts for an invented tongue", () => {
    const modifiers = conceptsOf("modifier");
    const spoken = (id: string) => Lexicon.spoken(Names.find(id)!, modifiers);
    for (const concept of spoken("french")) expect(Lexicon.authoredForms(Names.find("french")!, concept)).toBeDefined();
    expect(spoken("french").length).toBeLessThan(modifiers.length);
    expect(spoken("arachnid")).toEqual(modifiers);
  });
});

describe("Names.getBase", () => {
  const generate = (doubled: string, single?: boolean) => {
    options.map.nameBases = [Names.composeBase("test", "Test", [2, 20], ["Bolla"], doubled)];
    vi.spyOn(Math, "random").mockReturnValue(0);
    return Names.getBase("test", undefined, undefined, single);
  };

  it("doubles only the letters the base's rule allows", () => {
    expect(generate("l")).toBe("Bolla");
    expect(generate("")).toBe("Bola");
    expect(generate("l", true)).toBe("Bola");
  });

  it("gives an unknown base the first one", () => {
    expect(Names.resolve("unknown").id).toBe("german");
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(Names.getBase("unknown")).toBe(Names.getBase("german"));
  });
});

describe("Names.getPerson", () => {
  const withPeople = (mode?: "chain" | "pick") => {
    const base = Names.composeBase("test", "Test", [4, 9], ["Aaa", "Bbb", "Ccc"]);
    base.people = {
      male: { names: ["Alfred", "Edmund", "Oswald"], mode },
      female: { names: ["Edith", "Hilda"], mode }
    };
    options.map.nameBases = [base];
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
    options.map.nameBases = [Names.composeBase("bare", "Bare", [4, 9], ["Aaaaaa", "Bbbbbb", "Cccccc"])];
    expect(Names.getPerson("bare").length).toBeLessThanOrEqual(6);
    const listed = withPeople("pick");
    Names.add({ ...Names.composeBase("heir", "Heir", [4, 9], ["Aaa"]), extends: "test" });
    expect(listed).toContain(Names.getPerson("heir"));
  });
});

describe("Names.getWater", () => {
  it("names a water off the base's own list, or like a place where it has none", () => {
    const base = Names.composeBase("test", "Test", [4, 9], ["Aaaaaa", "Bbbbbb", "Cccccc"]);
    options.map.nameBases = [base];
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

describe("editing the bases", () => {
  it("keeps a shipped base as it ships and an edited copy of it in the options", async () => {
    const shipped = Names.find("english")!;
    expect(Names.isShipped(shipped)).toBe(true);
    const edited = Names.edit("english");
    edited.settled = 0.1;
    expect(Names.edit("english")).toBe(edited);
    expect(Names.find("english")).toBe(edited);
    expect(Names.isChanged(edited)).toBe(true);
    expect(options.map.nameBases).toEqual([edited]);
    expect(Names.ids()).toEqual(NAME_BASES.map(({ id }) => id)); // in its place

    Names.dropUnchanged("english");
    expect(Names.find("english")).toBe(edited);
    await Names.reset("english");
    expect(Names.find("english")).toBe(shipped);
    expect(shipped.settled).not.toBe(0.1);

    Names.edit("english");
    Names.dropUnchanged("english");
    expect(options.map.nameBases).toEqual([]);
  });

  it("copies a base under an id of its own, apart from the one copied", () => {
    const base = Names.find("english")!;
    const copy = Names.copy(base, "English");
    expect([copy.id, Names.nameBases.at(-1)]).toEqual(["english-2", copy]);
    expect(Names.isChanged(copy) || Names.isShipped(copy)).toBe(false);
    copy.places.names.push("Testham");
    expect(base.places.names).not.toContain("Testham");
    Names.remove(copy.id);
    expect(Names.has(copy.id)).toBe(false);
  });

  it("swaps the edited and custom bases, and gives a culture whose base is gone the first one", () => {
    const cultures = ["english", "polish", "mine"].map(base => ({ base }));
    vi.stubGlobal("pack", { cultures });
    Names.edit("english");
    Names.add(Names.composeBase("mine", "Mine", [4, 8], ["Aaa", "Bbb", "Ccc"]));
    Names.replace([Names.composeBase("other", "Other", [4, 8], ["Aaa", "Bbb", "Ccc"])]);
    expect(cultures.map(({ base }) => base)).toEqual(["english", "polish", "german"]);
    expect(Names.isShipped(Names.find("english")!)).toBe(true);
    expect(Names.ids().at(-1)).toBe("other");
    vi.stubGlobal("pack", { cultures: [] });
  });

  it("are kept in the settings of the map and of the browser, broken ones left out", () => {
    const base = Names.composeBase("mine", "Mine", [4, 8], ["Aaa", "Bbb", "Ccc"]);
    const { nameBases, ...older } = options.map;
    const read = (stored?: unknown) => mapSchema.shape.nameBases.parse(stored);
    expect(read(JSON.parse(JSON.stringify([base, { id: "broken" }])))).toEqual([base]);
    const odd = { ...base, rules: [{ match: "a", replace: "b", chance: 1.5 }], later: "a field of a later version" };
    const unnamed = Names.composeBase("bare", "", [Number.NaN, 8], ["Aaa"]);
    const kept = JSON.parse(JSON.stringify([odd, unnamed]));
    expect(read(kept)).toEqual([odd, unnamed]);
    expect(mapSchema.parse(older).nameBases).toEqual([]);
    expect(nameBases).toEqual([]);
  });
});

describe("a generated name", () => {
  it("is capitalized after a space and a hyphen", () => {
    options.map.nameBases = [Names.composeBase("test", "Test", [2, 30], ["an giang-le"], "")];
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

  it("loads the bases the cultures use and those they extend", async () => {
    const names = await unloaded();
    vi.stubGlobal("pack", { cultures: [{ base: "goblin" }, { base: "goblin" }, { base: "heir" }, { base: "greek" }] });
    names.add({ ...names.composeBase("heir", "Heir", [4, 8], ["Aaa", "Bbb", "Ccc"]), extends: "sindarin" });
    await names.loadUsed();
    expect(names.loaded().map(base => base.id)).toEqual(["greek", "sindarin", "goblin", "heir"]);
    vi.stubGlobal("pack", { cultures: [] });
  });

  it("loads the bases burg names were coined in", async () => {
    const names = await unloaded();
    vi.stubGlobal("pack", {
      cultures: [{ base: "english" }],
      burgs: [0, { meaning: { origin: "japanese" } }, { name: "Bare" }]
    });
    await names.loadUsed();
    expect(names.loaded().map(({ id }) => id)).toEqual(["english", "japanese"]);
    vi.stubGlobal("pack", { cultures: [] });
  });

  it("loads a base once", async () => {
    const names = await unloaded();
    await Promise.all([names.load(["greek"]), names.load(["greek"])]);
    const greek = names.find("greek")!;
    const { places } = greek;
    await names.loadAll();
    expect(names.find("greek")).toBe(greek);
    expect(greek.places).toBe(places);
  });

  it("stands any loaded base in for one that fails to load", async () => {
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
    names.add(names.composeBase("greek", "Greek", [4, 8], ["Aaa", "Bbb", "Ccc"]));
    await names.reset("greek");
    expect(names.isChanged(names.entry("greek"))).toBe(true); // nothing to go back to
    names.remove("greek");
    vi.doUnmock("@/data/name-bases");
  });
});

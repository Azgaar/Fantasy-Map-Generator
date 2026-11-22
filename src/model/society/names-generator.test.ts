import { afterEach, describe, expect, it, vi } from "vitest";
import { composeBase, Names, nameBaseSchema, uniqueBaseId } from "./names-generator";
import { applyRules } from "./sound-rules";

afterEach(() => {
  vi.restoreAllMocks();
  Names.restore();
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

describe("shipped name bases", () => {
  it("have unique ids made of their names, a corpus and rules that compile", () => {
    const bases = Names.getNameBases();
    expect(new Set(bases.map(base => base.id)).size).toBe(bases.length);
    for (const base of bases) {
      expect(base.id).toBe(uniqueBaseId(base.name, []));
      expect(nameBaseSchema.safeParse(base).success).toBe(true);
      expect(base.places.names.length).toBeGreaterThan(100);
      for (const { match } of base.rules ?? []) expect(() => new RegExp(match, "gu")).not.toThrow();
    }
  });
});

describe("Names.getBase", () => {
  const generate = (doubled: string, dupl?: string) => {
    Names.nameBases = [composeBase("test", "Test", [2, 20], ["Bolla"], doubled)];
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
    Names.nameBases = [composeBase("a", "A", [2, 9], ["Aaa"]), composeBase("b", "B", [2, 9], ["Bbb"])];
    expect(Names.resolve("english")?.id).toBe("b"); // English is the second shipped base
    expect(Names.resolve("unknown")).toBeUndefined();
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(Names.getBase("unknown")).toBe(Names.getBase("a"));
  });
});

describe("uniqueBaseId", () => {
  it("slugs a name and numbers a taken id", () => {
    expect(uniqueBaseId("Dark Elven", [])).toBe("dark-elven");
    expect(uniqueBaseId("Dark Elven", ["dark-elven", "dark-elven-2"])).toBe("dark-elven-3");
    expect(uniqueBaseId("Русский (north)", [])).toBe("русский-north");
    expect(uniqueBaseId("!!!", [])).toBe("base");
  });
});

describe("Names.serialize", () => {
  it("stores a shipped base by its id and an edited or custom one in full", () => {
    const [german, english] = Names.nameBases;
    english.length[1] = 14;
    const custom = composeBase("custom", "Custom", [4, 8], ["Aaa", "Bbb", "Ccc"]);
    Names.nameBases = [german, english, custom];

    expect(JSON.parse(Names.serialize())).toEqual([{ id: "german" }, english, custom]);
  });

  it("restores what it stored, shipped bases from the shipped data", () => {
    const shipped = Names.getNameBases();
    const custom = composeBase("custom", "Custom", [4, 8], ["Aaa", "Bbb", "Ccc"], "b");
    Names.nameBases = [shipped[5], custom];
    Names.getBase("custom"); // caches a chain

    const record = Names.serialize();
    Names.nameBases = [];
    Names.restore(record);

    expect(Names.nameBases).toEqual([shipped[5], custom]);
    expect(Names.chains.size).toBe(0);
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
    Names.nameBases.push(composeBase("custom", "Custom", [4, 8], ["Aaa", "Bbb", "Ccc"]));
    const set = ["A", "B", "C"].map(name => composeBase(name.toLowerCase(), name, [4, 8], ["Aaa", "Bbb", "Ccc"]));

    Names.replace(set);
    expect(bases.map(culture => culture.base)).toEqual(["b", "greek", "custom", "levantine"]); // only English had a place

    Names.replace(Names.getNameBases());
    expect(bases.map(culture => culture.base)).toEqual(["english", "greek", "custom", "levantine"]);
    vi.unstubAllGlobals();
  });
});

describe("a generated name", () => {
  it("is capitalized after a space and a hyphen", () => {
    Names.nameBases = [composeBase("test", "Test", [2, 30], ["an giang-le"], "")];
    Names.clearChains();
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(Names.getBase("test")).toBe("An Giang-Le");
    expect(applyRules("an giang-le")).toBe("an giang-le");
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import { Appropriation } from "./appropriation";
import { NameBases } from "./name-bases";

beforeAll(() => NameBases.loadAll());

const into = (id: string) => (name: string) => Appropriation.adapt(name, NameBases.find(id)!);

describe("Appropriation.adapt", () => {
  it("bends a whole name, its ending with it, to the sounds of the base", () => {
    const german = into("german");
    expect(german("lipsko")).toMatch(/^lip[sz]/);
    expect(german("dreždany")).toMatch(/^drest?[ae]n$/); // Dresden
    expect(german("kraków")).toMatch(/^kra[cgk](au|ow)$/); // Krakau
    expect(german("warszawa")).toBe("warsau");
    expect(into("italian")("london")).toMatch(/^londo/);
  });

  it("leaves a name that sounds native alone", () => {
    expect(into("german")("barton")).toBe("barton");
    expect(into("english")("bristol")).toBe("bristol");
    expect(into("french")("london")).toBe("london");
    expect(into("turkish")("ankara")).toBe("ankara");
  });

  it("uses no letter the base never writes", () => {
    for (const base of NameBases.loaded()) {
      const { places, waters, people } = base;
      const corpora = [places, waters, people?.male, people?.female];
      const letters = new Set(
        corpora
          .flatMap(corpus => corpus?.names ?? [])
          .join("")
          .toLowerCase()
      );
      if (!letters.has("a") || !letters.has("i")) continue; // of another script
      for (const name of ["frank", "wroxham", "jyväskylä", "gdańsk"]) {
        const native = Appropriation.adapt(name, { ...base, rules: [] });
        expect(
          [...native].filter(letter => !letters.has(letter)),
          `${base.id}: ${native}`
        ).toEqual([]);
      }
    }
  });

  it("runs the rules a base keeps for foreign names", () => {
    const ruthenian = into("ruthenian");
    expect(ruthenian("theodore")).toMatch(/^f/);
    expect(ruthenian("harald")).toMatch(/^g/);
    expect(into("english")("zhitomir")).toMatch(/^[jy]/);
  });

  it("parts consonants in a base of open syllables and ends a name in a vowel", () => {
    expect(into("hawaiian")("frank")).toMatch(/[aeiou]$/);
    expect(into("japanese")("hamburg")).toMatch(/[aeiou]$/);
  });

  it("adapts every word of a name and keeps what stands between them", () => {
    const words = ["nowy", "kraków"].map(into("german"));
    expect(into("german")("nowy kraków")).toBe(words.join(" "));
  });

  it("gives the same name every time", () => {
    expect(into("german")("chotěbuz")).toBe(into("german")("chotěbuz"));
  });

  it("hears the people and waters of a base, its own or inherited, and measures an edited list anew", () => {
    options.map.nameBases = [];
    const parent = NameBases.add(NameBases.compose("parent", "Parent", [3, 9], []));
    const base = NameBases.add({ ...NameBases.compose("child", "Child", [3, 9], ["tana", "nata"]), extends: "parent" });
    expect(Appropriation.adapt("tona", base)).toBe("tana"); // it writes no o
    const names = Array(200).fill("tona");
    parent.waters = { names };
    expect(Appropriation.adapt("tona", base)).toBe("tona");
    parent.waters = undefined;
    expect(Appropriation.adapt("tona", base)).toBe("tana");
    base.people = { male: { names } };
    expect(Appropriation.adapt("tona", base)).toBe("tona");
    options.map.nameBases = [];
  });

  it("leaves a name alone in a base with no names to measure it by, or of another script", () => {
    expect(Appropriation.adapt("frank", NameBases.compose("empty", "Empty", [3, 9], []))).toBe("frank");
    expect(Appropriation.adapt("frank", NameBases.compose("other", "Other", [3, 9], ["Москва", "Киев"]))).toBe("frank");
  });
});

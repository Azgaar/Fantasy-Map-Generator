import { describe, expect, it } from "vitest";
import { deriveBaseId, getDefaultNameBases, type NameBase } from "@/data/name-bases";
import { normalizeCultureBases, parseNameBases, serializeNameBases } from "./name-bases-format";

const defaults = getDefaultNameBases();

function base(overrides: Partial<NameBase> & { id: string }): NameBase {
  return { name: "Base", i: 0, min: 5, max: 10, d: "", m: 0, b: "", ...overrides };
}

describe("the name-base save format", () => {
  it("round-trips ids, order and a customized corpus", () => {
    const bases = [
      base({ id: "HALFL", name: "Halfling", b: "Barleybottom,Thistlewick" }),
      base({ id: "GERMA", name: "German", b: defaults[0].b })
    ];

    const parsed = parseNameBases(serializeNameBases(bases));
    expect(parsed.map(b => b.id)).toEqual(["HALFL", "GERMA"]);
    expect(parsed[0].b).toBe("Barleybottom,Thistlewick");
    expect(parsed[1].b).toBe(defaults[0].b); // read back from the shipped base with that id
  });

  it("omits names that match the shipped base with the same id", () => {
    const bases = [base({ id: "GERMA", name: "German", b: defaults[0].b })];
    expect(serializeNameBases(bases)).toBe(`GERMA|German|5|10||0|`);
  });

  it("reads legacy rows without ids and maps their positions to shipped ids", () => {
    const legacy = "German|5|12|lt|0|/English|6|11||0.1|Nyberg,Altdorf,Thorne";
    const parsed = parseNameBases(legacy);

    expect(parsed.map(b => b.id)).toEqual(["GERMA", "ENGLI"]);
    expect(parsed[0].b).toBe(defaults[0].b); // an empty field falls back to the shipped corpus
    expect(parsed[1].b).toBe("Nyberg,Altdorf,Thorne"); // a custom corpus is kept whatever its size
  });

  it("derives an id for a legacy row past the shipped bases", () => {
    const parsed = parseNameBases(`${"German|5|12|lt|0|1,2,3/German|5|12|lt|0|1,2,3"}`, [defaults[0]]);
    expect(parsed[0].id).toBe("GERMA");
    expect(parsed[1].id).toMatch(/^[A-Z]{5}$/);
    expect(parsed[1].id).not.toBe("GERMA");
  });

  it("keeps the first of two duplicate ids", () => {
    const parsed = parseNameBases("HALFL|One|5|10||0|1,2,3/HALFL|Two|5|10||0|4,5,6");
    expect(parsed[0].id).toBe("HALFL");
    expect(parsed[1].id).not.toBe("HALFL");
    expect(parsed[1].name).toBe("Two");
  });

  it("uses the shipped bases when a map has no name-base slot", () => {
    const parsed = parseNameBases(undefined);
    expect(parsed.map(b => b.id)).toEqual(defaults.map(b => b.id));
    expect(parsed[0].b).toBe(defaults[0].b);
  });
});

describe("moving cultures from positions to ids", () => {
  const bases = [base({ id: "GERMA" }), base({ id: "ENGLI" }), base({ id: "FEYFO" })];

  it("maps a numeric base through the loaded list", () => {
    const cultures = [{ base: 1 }, { base: 0 }];
    normalizeCultureBases(cultures, bases);
    expect(cultures.map(c => c.base)).toEqual(["ENGLI", "GERMA"]);
  });

  it("keeps a valid id across a reorder, which is why ids exist", () => {
    const cultures = [{ base: "FEYFO" }];
    const reordered = [bases[2], bases[0], bases[1]];
    normalizeCultureBases(cultures, reordered);
    expect(cultures[0].base).toBe("FEYFO");
    expect(reordered.find(b => b.id === cultures[0].base)).toBe(reordered[0]);
  });

  it("falls back to the first base for an unknown or out-of-range reference", () => {
    const cultures = [{ base: 9 }, { base: "NOPE1" }, { base: undefined }];
    normalizeCultureBases(cultures, bases);
    expect(cultures.map(c => c.base)).toEqual(["GERMA", "GERMA", "GERMA"]);
  });
});

describe("derived ids", () => {
  it("are stable, five letters, and ignore punctuation", () => {
    const taken = new Set<string>();
    const first = deriveBaseId("New Base!", taken);
    expect(first).toMatch(/^[A-Z]{5}$/);
    expect(deriveBaseId("New Base!", new Set())).toBe(first);
    expect(deriveBaseId("new base", new Set())).toBe(first);
  });

  it("never reuse an id already taken", () => {
    const taken = new Set([deriveBaseId("Skaven", new Set())]);
    const next = deriveBaseId("Skaven", taken);
    expect(next).not.toBe([...taken][0]);
    expect(next).toMatch(/^[A-Z]{5}$/);
  });
});

import { describe, expect, it } from "vitest";
import { getDefaultNameBases } from "@/data/name-bases";
import { Names } from "./names-generator";

describe("Names.calculateChain", () => {
  it("splits CJK names into single-character syllables", () => {
    const chain = Names.calculateChain("长安,洛阳,ソウル,서울");
    expect(chain[""]).toEqual(["长", "洛", "ソ", "서"]);
    expect(chain.长).toEqual(["安"]);
    expect(chain.安).toEqual([""]);
    expect(chain.ウ).toEqual(["ル"]);
    expect(chain.서).toEqual(["울"]);
  });

  it("keeps multi-letter syllables for alphabetic names", () => {
    expect(Names.calculateChain("Chester")[""]).toEqual(["ches"]);
  });
});

describe("name bases by id", () => {
  it("finds a base by its id, and keeps i as the array position", () => {
    Names.nameBases = getDefaultNameBases();
    Names.reindex();

    expect(Names.getNameBase("ELVEN")?.name).toBe("Elven");
    expect(Names.nameBases.every((base, i) => base.i === i)).toBe(true);
  });

  it("generates from the id even after the list is reordered", () => {
    const defaults = getDefaultNameBases();
    const elven = defaults.find(base => base.id === "ELVEN")!;
    const dwarven = defaults.find(base => base.id === "DWARV")!;
    Names.nameBases = [dwarven, elven];
    Names.reindex();
    Names.clearChains();

    expect(Names.getBase("ELVEN", 6, 12, "")).not.toBe("ERROR");
    expect(Names.chains.DWARV).toBeUndefined(); // only the used base is chained
  });

  it("falls back to the first base for an unknown id", () => {
    Names.nameBases = getDefaultNameBases();
    Names.clearChains();
    const fromFirst = Names.getBase("GERMA", 5, 10, "");
    expect(Names.getBase("NOPE1", 5, 10, "")).toBeTypeOf("string");
    expect(fromFirst).not.toBe("ERROR");
  });
});

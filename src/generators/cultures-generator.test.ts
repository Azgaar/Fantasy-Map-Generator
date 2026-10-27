import { afterEach, describe, expect, it, vi } from "vitest";
import { ALIGNMENTS, PREVAILING_ALIGNMENT, rollAlignment, rollValues, traitsRng } from "@/data/culture-traits";
import { Cultures } from "./cultures-generator";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("uses the requested culture set when regenerating an existing map", () => {
  options = Options.getDefaultOptions();
  options.map.cultures.set = "english";
  options.generation.cultures = { ...options.generation.cultures, set: "highFantasy", limit: 16 };
  const cells = { i: Array.from({ length: 500 }, (_, i) => i), s: Array(500).fill(1), h: [], t: [] };
  vi.stubGlobal("pack", { cells });
  vi.stubGlobal("grid", { cells: { temp: [] } });
  const getDefault = Cultures.getDefault.bind(Cultures);
  let names: string[] = [];
  vi.spyOn(Cultures, "getDefault").mockImplementation(count => {
    names = getDefault(count).map(culture => culture.name);
    throw new Error("stop before placement");
  });

  expect(() => Cultures.regenerate()).toThrow("stop before placement");
  expect(options.map.cultures.set).toBe("highFantasy");
  expect(Cultures.getDefault).toHaveBeenCalledWith(16);
  expect(names.includes("Quenian (Elfish)")).toBe(true);
});

it("recomputes a renamed culture's code without clashing with other cultures", () => {
  vi.stubGlobal("pack", {
    cultures: [
      { i: 0, name: "Wildlands", code: "Wi" },
      { i: 1, name: "Old", code: "Ol" },
      { i: 2, name: "Salt", code: "Sa" }
    ]
  });
  Cultures.rename(1, "Saltmere");
  expect(pack.cultures[1]).toMatchObject({ name: "Saltmere", code: "SA" });
  expect(() => Cultures.rename(5, "X")).toThrow("Culture 5 does not exist");
});

// ─── the social layer (docs/plans/culture-traits.md, slice 1) ─────────────────────────────────

const SEED = "culture-traits-seed";
const LIMIT = 4;
const CELLS = 200;

/** a flat world of CELLS populated cells far enough apart for one center each */
function stubWorld({ limit = LIMIT, traits = true, seed = SEED } = {}) {
  options = Options.getDefaultOptions();
  options.map.seed = seed;
  options.generation.cultures = { ...options.generation.cultures, limit, traits };

  const cells = {
    i: Array.from({ length: CELLS }, (_, i) => i),
    s: Array(CELLS).fill(1),
    h: Array(CELLS).fill(30),
    t: Array(CELLS).fill(0),
    g: Array(CELLS).fill(0),
    biome: Array(CELLS).fill(6),
    f: Array(CELLS).fill(0),
    haven: Array(CELLS).fill(0),
    harbor: Array(CELLS).fill(0),
    r: Array(CELLS).fill(0),
    fl: Array(CELLS).fill(0),
    p: Array.from({ length: CELLS }, (_, i) => [i * 400, 0]),
    culture: new Uint16Array(CELLS)
  };

  vi.stubGlobal("pack", { cells, cultures: [], features: [{ i: 0, type: "island", subtype: "continent", cells: 10 }] });
  vi.stubGlobal("grid", { cells: { temp: [] } });
  vi.stubGlobal("Emblems", { shape: "culture" });
  const nameBases = [{ id: "ENGLI", name: "English", min: 5, max: 9, d: "ln", m: 0 }];
  vi.stubGlobal("Names", {
    nameBases,
    getNameBase(id: string) {
      return nameBases.find(base => base.id === id);
    },
    getCulture: () => "Newfolk"
  });
  const defaults = Array.from({ length: limit }, (_, i) => ({ name: `Folk ${i}`, base: "ENGLI", shield: "round" }));
  vi.spyOn(Cultures, "getDefault").mockImplementation(() => defaults as any);

  return cells;
}

describe("culture traits", () => {
  it("gives every living culture an alignment and one or two values, rolled on its own stream", () => {
    stubWorld();
    Cultures.generate();

    const living = pack.cultures.filter(culture => culture.i && !culture.removed);
    expect(living).toHaveLength(LIMIT);
    for (const culture of living) {
      expect(ALIGNMENTS).toContain(culture.alignment!);
      expect(culture.values!.length === 1 || culture.values!.length === 2).toBe(true);

      // the traits come from the culture's own keyed stream, not from whatever rolled before it
      const rng = traitsRng(SEED, "culture", culture.i);
      expect(culture.alignment).toBe(rollAlignment(rng));
      expect(culture.values).toEqual(rollValues(rng, culture.alignment!));
    }

    expect(pack.cultures[0]).toMatchObject({ name: "Wildlands" });
    expect(pack.cultures[0]).not.toHaveProperty("alignment");
    expect(pack.cultures[0]).not.toHaveProperty("values");
  });

  it("keeps the same traits for the same seed and the same ids", () => {
    stubWorld();
    Cultures.generate();
    const first = pack.cultures.map(culture => [culture.i, culture.alignment, culture.values]);

    stubWorld();
    Cultures.generate();
    expect(pack.cultures.map(culture => [culture.i, culture.alignment, culture.values])).toEqual(first);
  });

  it("leaves the whole social layer off when the option is off", () => {
    const cells = stubWorld({ traits: false });
    Cultures.generate();

    for (const culture of pack.cultures) {
      expect(culture).not.toHaveProperty("alignment");
      expect(culture).not.toHaveProperty("values");
    }

    // a culture founded by hand stays untyped as well
    cells.culture[150] = 1;
    vi.stubGlobal("Pack", { requireCell: () => 150 });
    const founded = Cultures.add(0, 0);
    expect(pack.cultures[founded]).not.toHaveProperty("alignment");
  });

  it("keeps a locked culture's traits through regeneration", () => {
    const cells = stubWorld({ limit: 1 });
    cells.culture[0] = 1;
    pack.cultures = [
      {
        i: 1,
        name: "Old Faithful",
        base: "ENGLI",
        shield: "round",
        code: "Ol",
        center: 0,
        type: "Generic",
        lock: true,
        alignment: "evil",
        values: ["power"]
      }
    ];

    Cultures.generate();
    expect(pack.cultures[1]).toMatchObject({ name: "Old Faithful", alignment: "evil", values: ["power"] });
  });

  it("rolls a founded culture on its parent's prevailing column", () => {
    const cells = stubWorld();
    Cultures.generate();
    const parent = pack.cultures[1];
    const parentAlignment = parent.alignment!;
    const center = 150;
    cells.culture[center] = parent.i;
    vi.stubGlobal("Pack", { requireCell: () => center });

    const founded = Cultures.add(0, 0);
    const created = pack.cultures[founded];

    expect(PREVAILING_ALIGNMENT[parentAlignment]).toContain(created.alignment!);
    expect(created.alignment).toBe(rollAlignment(traitsRng(SEED, "culture", founded), parentAlignment));
  });

  it("rolls a founded culture from scratch when its parent has no alignment", () => {
    const cells = stubWorld();
    Cultures.generate(); // an old map: the parent predates the layer
    delete pack.cultures[1].alignment;
    delete pack.cultures[1].values;
    const center = 150;
    cells.culture[center] = 1;
    vi.stubGlobal("Pack", { requireCell: () => center });

    const founded = Cultures.add(0, 0);
    expect(pack.cultures[founded].alignment).toBe(rollAlignment(traitsRng(SEED, "culture", founded)));
  });
});

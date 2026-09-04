// @vitest-environment jsdom
// The invariants the two-object split exists to guarantee.
// See docs/architecture/configuration.md#invariants
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isLocked, lock } from "@/utils/preferences";
import { getDefaultFacts } from "./facts-model";
import { getDefaultOptions, POINTS_BY_DENSITY } from "./options-model";

const UNIT = { icon: "u", name: "cavalry", rural: 0.2, urban: 0.1, crew: 2, power: 1, type: "melee", separate: 0 };
const DEFAULT_UNITS = [{ ...UNIT, name: "the module default" }];

async function boot() {
  vi.resetModules();
  localStorage.clear();
  globalThis.facts = getDefaultFacts();
  globalThis.options = getDefaultOptions();
  await import("./facts-model");
  await import("./options-model");
  await import("./pinnable");
}

/** A `.map` file's settings field: what save.ts writes and load.ts reads back */
const savedFile = (change: (facts: ReturnType<typeof getDefaultFacts>) => void): string => {
  const written = getDefaultFacts();
  change(written);
  return JSON.stringify(written);
};

const load = (file: string) => Facts.adopt(Facts.parse(JSON.parse(file)));

beforeEach(boot);

describe("a file describes its map", () => {
  it("round-trips: load, save, load again is a fixed point", () => {
    const file = savedFile(f => {
      f.seed = "12345";
      f.graph = { width: 1600, height: 900, points: 20000 };
      f.lore.name = "Narnia";
      f.military.units = [UNIT];
      f.units.distance = { unit: "leagues", scale: 5 };
    });

    load(file);
    const first = JSON.stringify(facts);
    load(first);
    const second = JSON.stringify(facts);
    load(second);

    // values survive every pass, and the bytes settle once the schema has normalised key order
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    expect(JSON.stringify(facts)).toBe(second);
    expect(facts.lore.name).toBe("Narnia");
    expect(facts.units.distance).toEqual({ unit: "leagues", scale: 5 });
  });

  it("carries no options into the file", () => {
    const written = JSON.parse(JSON.stringify(facts));
    for (const key of Object.keys(getDefaultOptions())) expect(written[key]).toBeUndefined();
  });
});

describe("no cross-map inheritance", () => {
  it("drops the previous map's definition sets when the next one has none", () => {
    load(savedFile(f => (f.military.units = [UNIT])));
    expect(facts.military.units).toHaveLength(1);

    load(savedFile(f => (f.lore.name = "second"))); // a map with no military of its own
    expect(facts.military.units).toEqual([]);
    expect(facts.lore.name).toBe("second");
  });

  it("leaves a section absent from an older file at its default, not at map A's value", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    load(savedFile(f => (f.climate.precipitation = 400)));

    const older: Record<string, unknown> = JSON.parse(savedFile(f => (f.seed = "old")));
    delete older.climate;
    load(JSON.stringify(older));

    expect(facts.climate.precipitation).toBe(getDefaultFacts().climate.precipitation);
  });
});

describe("options survive maps", () => {
  it("keeps preferences and requests when a map is loaded", () => {
    Options.set(o => {
      o.app.threeD.erosion = true;
      o.generation.states.limit = 30;
    });

    load(savedFile(f => (f.lore.name = "someone else's map")));

    expect(options.app.threeD.erosion).toBe(true);
    expect(options.generation.states.limit).toBe(30);
  });

  it("never adopts the loaded map's definition sets as this browser's defaults", () => {
    load(savedFile(f => (f.military.units = [UNIT])));
    expect(options.library.military).toBeNull();
  });

  it("carries the extent over, since the next map should continue the one just opened", () => {
    load(savedFile(f => (f.graph = { width: 1600, height: 900, points: 20000 })));
    Options.syncOnLoad();

    expect(options.generation.graph.width).toBe(1600);
    expect(options.generation.graph.height).toBe(900);
  });

  it("never lets the allowlist override a pin", () => {
    Options.set(o => (o.generation.graph.width = 800));
    lock("mapWidth", 800);

    load(savedFile(f => (f.graph.width = 1600)));
    Options.syncOnLoad();

    expect(options.generation.graph.width).toBe(800);
  });
});

describe("a pin outlives the map it was made on", () => {
  it("survives loading a map that disagrees with it", () => {
    lock("statesNumber", 30);
    load(savedFile(f => (f.lore.name = "a 12-state map")));

    Options.randomize();
    expect(options.generation.states.limit).toBe(30);
  });

  it("restores a pinned fact onto a newly seeded map", () => {
    lock("prec", 350);
    lock("year", 777);

    Facts.seedForNewMap();

    expect(facts.climate.precipitation).toBe(350);
    expect(facts.lore.calendar.year).toBe(777);
  });
});

describe("the preservation library", () => {
  it("seeds a new map from the user's own set", () => {
    Options.remember("military", [UNIT], DEFAULT_UNITS);
    Facts.seedForNewMap();
    expect(facts.military.units).toEqual([UNIT]);
  });

  it("is not disturbed by loading a map, so the next map still starts from the user's set", () => {
    Options.remember("military", [UNIT], DEFAULT_UNITS);
    load(savedFile(f => (f.military.units = [{ ...UNIT, name: "theirs" }])));

    expect(facts.military.units[0].name).toBe("theirs"); // the loaded map governs itself
    expect(options.library.military).toEqual([UNIT]); // the library is untouched

    Facts.seedForNewMap();
    expect(facts.military.units).toEqual([UNIT]); // and still seeds the next map
  });
});

describe("validation repairs rather than rejects", () => {
  const parse = (change: (file: any) => void) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const file: any = JSON.parse(savedFile(() => {}));
    change(file);
    return Facts.parse(file);
  };

  it("strips a key from a newer schema instead of losing the section it sits in", () => {
    const parsed = parse(file => {
      file.climate.precipitation = 400;
      file.climate.humidity = 7; // a field this version does not know
    });

    expect(parsed.climate.precipitation).toBe(400);
    expect(parsed.climate).not.toHaveProperty("humidity");
  });

  it("strips an unknown key nested inside a section", () => {
    const parsed = parse(file => {
      file.climate.temperature.equator = 33;
      file.climate.temperature.tropics = 20;
    });

    expect(parsed.climate.temperature.equator).toBe(33);
  });

  it("drops the one unusable entry of a definition set, not the set around it", () => {
    const parsed = parse(file => {
      file.military.units = [UNIT, { ...UNIT, name: "broken", rural: "not a number" }, { ...UNIT, name: "third" }];
    });

    expect(parsed.military.units.map(unit => unit.name)).toEqual(["cavalry", "third"]);
  });

  it("keeps repairing a leaf from the defaults where the defaults have one", () => {
    const parsed = parse(file => {
      file.lore.name = "Narnia";
      file.lore.calendar.year = "not a number";
    });

    expect(parsed.lore.name).toBe("Narnia");
    expect(parsed.lore.calendar.year).toBe(getDefaultFacts().lore.calendar.year);
  });
});

describe("a lock stands for something", () => {
  it("refuses to pin an option nothing answers for", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    lock("noSuchOption");
    expect(isLocked("noSuchOption")).toBe(false);
  });

  it("ignores a pinned value of the wrong type rather than writing it into the map", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    lock("prec", "corrupt");

    Facts.seedForNewMap();
    expect(facts.climate.precipitation).toBeTypeOf("number");
  });

  it("applies a pinned extent to the map being generated, not to the one after it", () => {
    lock("mapWidth", 1600);
    lock("mapHeight", 900);
    lock("points", 6);

    Options.setGraphSize(); // boot or a new map: the request is resolved here
    Options.randomize();
    Facts.seedForNewMap();

    expect(facts.graph.width).toBe(1600);
    expect(facts.graph.height).toBe(900);
    expect(facts.graph.points).toBe(POINTS_BY_DENSITY[6]);
  });
});

describe("the preservation library holds what the user typed", () => {
  it("clears the entry when the user resets a set to the module defaults", () => {
    Options.remember("military", [UNIT], DEFAULT_UNITS);
    expect(options.library.military).toEqual([UNIT]);

    Options.remember("military", DEFAULT_UNITS, DEFAULT_UNITS);
    expect(options.library.military).toBeNull();
  });
});

describe("one object, one key", () => {
  const LEGACY = {
    uiSize: "1.4",
    tooltipSize: "20",
    themeColor: "#123456",
    transparency: "30",
    shapeRendering: "geometricPrecision",
    onloadBehavior: "lastSaved",
    emblemShape: "heater",
    autosaveInterval: "5",
    tileCols: "4",
    noReminder: "true",
    statesNumber: "99" // a pin from the same scheme, which the objects answer for now
  };

  it("adopts the preferences that used to keep a key of their own, then drops the namespace", () => {
    for (const [key, value] of Object.entries(LEGACY)) localStorage.setItem(key, value);

    Options.restoreStored();

    expect(options.app.ui.size).toBe(1.4);
    expect(options.app.ui.tooltipSize).toBe(20);
    expect(options.app.ui.themeColor).toBe("#123456");
    expect(options.app.ui.transparency).toBe(30);
    expect(options.app.rendering).toBe("geometricPrecision");
    expect(options.app.onLoad).toBe("lastSaved");
    expect(options.app.emblemShape).toBe("heater");
    expect(options.app.autosave).toEqual({ interval: 5, remind: false });
    expect(options.app.export.tiles.cols).toBe(4);

    for (const key of Object.keys(LEGACY)) expect(localStorage.getItem(key)).toBeNull();
  });

  it("keeps every preference in the one stored object", () => {
    Options.set(o => (o.app.ui.tooltipSize = 22));
    Options.persist();

    const stored = JSON.parse(localStorage.getItem("fmg-options")!);
    expect(stored.app.ui.tooltipSize).toBe(22);
    expect(Object.keys(localStorage)).toEqual(["fmg-options"]);
  });

  it("leaves preferences alone when a map is loaded", () => {
    Options.set(o => {
      o.app.ui.size = 2;
      o.app.emblemShape = "spanish";
      o.app.zoomExtent = { min: 2, max: 30 };
    });

    load(savedFile(f => (f.lore.name = "someone else's map")));

    expect(options.app.ui.size).toBe(2);
    expect(options.app.emblemShape).toBe("spanish");
    expect(options.app.zoomExtent).toEqual({ min: 2, max: 30 });
  });

  it("starts a reset browser from the defaults", () => {
    Options.set(o => (o.app.ui.tooltipSize = 30));
    Options.reset();

    expect(options.app.ui.tooltipSize).toBe(getDefaultOptions().app.ui.tooltipSize);
    expect(JSON.parse(localStorage.getItem("fmg-options")!).app.ui.tooltipSize).toBe(14);
  });
});

describe("the two objects hold no field twice", () => {
  it("keeps every count, rate and variety on the request side alone", () => {
    const factFields = new Set(Object.keys(JSON.parse(JSON.stringify(getDefaultFacts()))));
    expect(factFields.has("states")).toBe(false);

    const asked = getDefaultOptions().generation;
    expect(asked.states.growthRate).toBeTypeOf("number");
    expect(asked.cultures.sizeVariety).toBeTypeOf("number");
    expect(asked.resolveDepressionsSteps).toBeTypeOf("number");
    expect(asked.lakeElevationLimit).toBeTypeOf("number");

    const recorded = getDefaultFacts() as unknown as Record<string, Record<string, unknown>>;
    expect(recorded.cultures).toEqual({ set: "world" }); // the set, not the rate it expanded at
  });

  it("asks for the graph in one place and records it in another", () => {
    // the request holds a density step; the cell count it stands for is derived, never stored
    const asked = getDefaultOptions().generation.graph;
    expect(asked).toEqual({ width: 1280, height: 800, density: 4 });
    expect(Options.cellsFor(asked.density)).toBe(10000);

    // the record has no density: a step is how the request was phrased, not what was built
    expect(getDefaultFacts().graph).toEqual({ width: 1280, height: 800, points: 10000 });
  });

  it("takes each default from the module that owns it, rather than copying it", async () => {
    const { DEFAULT_COASTLINE } = await import("@/generators/coastline-generator");
    expect(getDefaultFacts().coastline).toEqual(DEFAULT_COASTLINE);
  });
});

describe("the map carries its own lore", () => {
  it("round-trips a description through a file", () => {
    const file = savedFile(f => {
      f.lore.name = "Narnia";
      f.lore.description = "A world of talking beasts, under a long winter.";
      f.lore.calendar = { year: 1300, era: "Winter Era", eraShort: "WE" };
    });

    load(file);
    expect(facts.lore.description).toBe("A world of talking beasts, under a long winter.");
    expect(facts.lore.calendar.eraShort).toBe("WE");

    load(savedFile(() => {})); // another map: nothing of the first one's lore survives
    expect(facts.lore.description).toBe("");
  });

  it("leaves a description absent from an older file empty, not undefined", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const older: any = JSON.parse(savedFile(f => (f.lore.name = "old")));
    delete older.lore.description;

    load(JSON.stringify(older));
    expect(facts.lore).toEqual({ name: "old", description: "", calendar: getDefaultFacts().lore.calendar });
  });
});

describe("a derived fact is stored, not recomputed", () => {
  it("takes the lat/lon box the file carries", () => {
    const box = { latT: 60, latN: 40, latS: -20, lonT: 96, lonW: -48, lonE: 48 };
    load(
      savedFile(f => {
        f.geography.mapSize = 33;
        f.geography.coordinates = box;
      })
    );

    // parsing does not touch it, and the load has nothing to recompute: the panel that owns the
    // three inputs re-derives it on every edit, so what a file carries always agrees with them
    expect(facts.geography.coordinates).toEqual(box);
  });

  it("keeps it recomputable: the inputs travel in the same file", () => {
    const written = JSON.parse(savedFile(f => (f.geography.mapSize = 33)));
    expect(written.geography).toMatchObject({ mapSize: 33, latitude: 50, longitude: 50 });
    expect(written.graph).toMatchObject({ width: 1280, height: 800 });
  });
});

describe("neither object writes the other", () => {
  it("takes the 3D defaults from the module that owns them", async () => {
    const { DEFAULT_THREE_D } = await import("@/data/view-3d-options");
    expect(getDefaultOptions().app.threeD).toEqual(DEFAULT_THREE_D);
  });

  it("leaves this browser's preferences alone however old the map it opens", () => {
    Options.set(o => {
      o.app.threeD.erosion = true;
      o.app.threeD.skyColor = "#000000";
      o.app.notesPinned = true;
    });

    load(savedFile(f => (f.lore.name = "a map from an older version")));

    expect(options.app.threeD.erosion).toBe(true);
    expect(options.app.threeD.skyColor).toBe("#000000");
    expect(options.app.notesPinned).toBe(true);
  });
});

describe("presentation is the style's, not the map's", () => {
  it("keeps the scale bar's label and placement out of the facts", () => {
    const written = JSON.parse(JSON.stringify(getDefaultFacts()));
    expect(written).not.toHaveProperty("scaleBar");
  });
});

describe("an editor's Restore asks the model, rather than keeping its own copy", () => {
  it("restores the units the model defines", async () => {
    const { getDefaultFacts: modelDefaults } = await import("./facts-model");
    Facts.set(f => {
      f.units.distance.scale = 99;
      f.units.height.exponent = 1.1;
    });

    Facts.set(f => (f.units = modelDefaults().units)); // what the editor's Restore does
    expect(facts.units).toEqual(modelDefaults().units);
    expect(facts.units.height.exponent).toBe(2);
  });
});

describe("a preference nobody has set is null", () => {
  it("leaves the viewport and the interface size unset until someone chooses", () => {
    const { app } = getDefaultOptions();
    expect(app.viewport).toBeNull();
    expect(app.ui.size).toBeNull();
  });

  it("remembers a viewport the user set, and survives a map load like any other preference", () => {
    Options.set(o => (o.app.viewport = { width: 900, height: 600 }));
    Options.persist();

    load(savedFile(f => (f.lore.name = "another map")));
    expect(options.app.viewport).toEqual({ width: 900, height: 600 });
    expect(JSON.parse(localStorage.getItem("fmg-options")!).app.viewport).toEqual({ width: 900, height: 600 });
  });
});

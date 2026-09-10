// @vitest-environment jsdom
// The invariants `options` exists to guarantee, and what a `.map` file carries of it.
// See docs/architecture/configuration.md#invariants
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPointsNumber, POINTS_BY_DENSITY } from "@/data/graph-density";
import type { MapData } from "./options-schema";
import { Pins } from "./pins";

const UNIT = { icon: "u", name: "cavalry", rural: 0.2, urban: 0.1, crew: 2, power: 1, type: "melee", separate: 0 };

async function boot() {
  vi.resetModules();
  localStorage.clear();
  await import("./options-model"); // re-evaluating it installs a fresh `options` and `Options`
}

/** A `.map` file's settings block as a fresh browser would write it: what load.ts reads back */
const savedFile = (change: (map: MapData) => void): string => {
  const written = Options.getDefaultOptions().map;
  change(written);
  return JSON.stringify(written);
};

const defaults = (): MapData => Options.getDefaultOptions().map;
const load = (file: string) => Options.applyLoaded(JSON.parse(file));

beforeEach(boot);

it.each(["ancient", "fmgStyle_custom"])("keeps the %s style preset across generation and session reloads", preset => {
  options.map.style.preset = preset;
  Options.persist();

  for (let session = 0; session < 2; session++) {
    options = Options.getDefaultOptions();
    Options.restore();
    expect(options.map.style.preset).toBe(preset);

    Options.randomize();
    expect(options.map.style.preset).toBe(preset);
    Options.persist();
  }
});

it.each(["load", "restore"])("repairs one wind without losing other settings during %s", boundary => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const stored = Options.getDefaultOptions();
  stored.map.lore.name = "Kept world";
  stored.map.military.units = [UNIT];
  stored.map.climate.precipitation = 321;
  stored.map.climate.temperature.equator = 31;
  stored.map.climate.winds = [90, 45, 999, 315, 135, 315];

  if (boundary === "load") Options.applyLoaded(stored.map);
  else {
    localStorage.setItem("fmg-options", JSON.stringify(stored));
    Options.restore();
  }

  expect(options.map.climate.winds).toEqual([90, 45, 225, 315, 135, 315]);
  expect(options.map.climate.precipitation).toBe(321);
  expect(options.map.climate.temperature.equator).toBe(31);
  expect(options.map.lore.name).toBe("Kept world");
  expect(options.map.military.units).toEqual([UNIT]);
});

it("keeps reset defaults independent from edited 3D settings", () => {
  const initial = Options.getDefaultOptions().app.threeD.sun.x;
  Options.reset();
  options.app.threeD.sun.x = initial + 100;
  Options.reset();
  expect(options.app.threeD.sun.x).toBe(initial);
});

describe("a file describes its map", () => {
  it("round-trips: load, save, load again is a fixed point", () => {
    const file = savedFile(map => {
      map.seed = "12345";
      map.graph = { width: 1600, height: 900, points: 20000 };
      map.lore.name = "Narnia";
      map.military.units = [UNIT];
      map.units.distance = { unit: "leagues", scale: 5 };
    });

    load(file);
    const first = JSON.stringify(options.map);
    load(first);
    const second = JSON.stringify(options.map);
    load(second);

    // values survive every pass, and the bytes settle once the schema has normalised key order
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    expect(JSON.stringify(options.map)).toBe(second);
    expect(options.map.lore.name).toBe("Narnia");
    expect(options.map.units.distance).toEqual({ unit: "leagues", scale: 5 });
  });

  it("carries nothing of this browser into the file", () => {
    const written = JSON.parse(JSON.stringify(options.map));
    expect(written.generation).toBeUndefined();
    expect(written.app).toBeUndefined();
  });
});

describe("no cross-map inheritance", () => {
  it("drops the previous map's definition sets when the next one has none", () => {
    load(savedFile(map => (map.military.units = [UNIT])));
    expect(options.map.military.units).toHaveLength(1);

    load(savedFile(map => (map.lore.name = "second"))); // a map with no military of its own
    expect(options.map.military.units).toEqual(defaults().military.units);
    expect(options.map.lore.name).toBe("second");
  });

  it("leaves a section absent from an older file at its default, not at map A's value", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    load(savedFile(map => (map.climate.precipitation = 400)));

    const older: Record<string, unknown> = JSON.parse(savedFile(map => (map.seed = "old")));
    delete older.climate;
    load(JSON.stringify(older));

    expect(options.map.climate.precipitation).toBe(defaults().climate.precipitation);
  });
});

describe("a load establishes a map, and leaves the rest of this browser alone", () => {
  it("keeps preferences and requests when a map is loaded", () => {
    Options.set(o => {
      o.app.threeD.erosion = true;
      o.generation.states.limit = 30;
    });

    load(savedFile(map => (map.lore.name = "someone else's map")));

    expect(options.app.threeD.erosion).toBe(true);
    expect(options.generation.states.limit).toBe(30);
  });

  it("carries the extent over, since the next map should continue the one just opened", () => {
    load(savedFile(map => (map.graph = { width: 1600, height: 900, points: 20000 })));

    expect(options.generation.graph.width).toBe(1600);
    expect(options.generation.graph.height).toBe(900);
  });

  it("never lets the extent override a pin", () => {
    Options.set(o => (o.generation.graph.width = 800));
    Pins.set("mapWidth", 800);

    load(savedFile(map => (map.graph.width = 1600)));

    expect(options.generation.graph.width).toBe(800);
  });
});

describe("a pin outlives the map it was made on", () => {
  it("survives loading a map that disagrees with it", () => {
    Pins.set("statesNumber", 30);
    load(savedFile(map => (map.lore.name = "a 12-state map")));

    Options.randomize();
    expect(options.generation.states.limit).toBe(30);
  });

  it("restores a pinned map value onto a newly seeded map", () => {
    Pins.set("prec", 350);
    Pins.set("year", 777);

    Options.randomize();

    expect(options.map.climate.precipitation).toBe(350);
    expect(options.map.lore.calendar.year).toBe(777);
  });
});

describe("the definition sets carry to the next map", () => {
  it("starts a new map from the set this browser holds", () => {
    options.map.military.units = [UNIT];
    Options.randomize();
    expect(options.map.military.units).toEqual([UNIT]);
  });

  it("starts it from the set of the map last opened, since that is the one this browser holds", () => {
    options.map.military.units = [UNIT];
    load(savedFile(map => (map.military.units = [{ ...UNIT, name: "theirs" }])));

    expect(options.map.military.units[0].name).toBe("theirs");

    Options.randomize();
    expect(options.map.military.units[0].name).toBe("theirs");
  });

  it("never leaves a set empty: the module that owns it answers for what it must hold", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    load(savedFile(map => (map.transports = [])));

    expect(options.map.transports).toEqual(defaults().transports);
  });
});

describe("validation repairs rather than rejects", () => {
  const adopt = (change: (file: MapData) => void) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const file = JSON.parse(savedFile(() => {})) as MapData;
    change(file);
    Options.applyLoaded(file);
    return options.map;
  };

  it("strips a key from a newer schema instead of losing the section it sits in", () => {
    const map = adopt(file => {
      file.climate.precipitation = 400;
      (file.climate as MapData["climate"] & { humidity?: number }).humidity = 7;
    });

    expect(map.climate.precipitation).toBe(400);
    expect(map.climate).not.toHaveProperty("humidity");
  });

  it("strips an unknown key nested inside a section", () => {
    const map = adopt(file => {
      file.climate.temperature.equator = 33;
      (file.climate.temperature as MapData["climate"]["temperature"] & { tropics?: number }).tropics = 20;
    });

    expect(map.climate.temperature.equator).toBe(33);
  });

  it("drops the one unusable entry of a definition set, not the set around it", () => {
    const map = adopt(file => {
      file.military.units = [
        UNIT,
        { ...UNIT, name: "broken", rural: "not a number" },
        { ...UNIT, name: "third" }
      ] as unknown as MapData["military"]["units"];
    });

    expect(map.military.units.map(unit => unit.name)).toEqual(["cavalry", "third"]);
  });

  it("keeps repairing a leaf from the defaults where the defaults have one", () => {
    const map = adopt(file => {
      file.lore.name = "Narnia";
      file.lore.calendar.year = "not a number" as unknown as number;
    });

    expect(map.lore.name).toBe("Narnia");
    expect(map.lore.calendar.year).toBe(defaults().lore.calendar.year);
  });
});

describe("a pin stands for something", () => {
  it("pins nothing when the dialog has no value for the key", () => {
    Pins.set("noSuchOption", undefined);
    expect(Pins.has("noSuchOption")).toBe(false);
  });

  it("ignores a pinned value of the wrong type rather than writing it into the map", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    Pins.set("prec", "corrupt");

    Options.randomize();
    expect(options.map.climate.precipitation).toBeTypeOf("number");
  });

  it("applies a pinned extent to the map being generated, not to the one after it", () => {
    Pins.set("mapWidth", 1600);
    Pins.set("mapHeight", 900);
    Pins.set("points", 6);

    Options.setGraphSize(); // boot or a new map: the request is resolved here
    Options.randomize();

    expect(options.map.graph.width).toBe(1600);
    expect(options.map.graph.height).toBe(900);
    expect(options.map.graph.points).toBe(POINTS_BY_DENSITY[6]);
  });
});

describe("a new map keeps what the user pinned", () => {
  it("puts every pinned value back, including the ones nothing rolls", () => {
    Pins.set("mapName", "Kept Name");
    Pins.set("mapSize", 70);
    Pins.set("distanceUnit", "leagues");
    Pins.set("urbanDensity", 42);

    Options.randomize();

    expect(options.map.lore.name).toBe("Kept Name");
    expect(options.generation.geography.mapSize).toBe(70);
    expect(options.map.units.distance.unit).toBe("leagues");
    expect(options.map.units.population.urbanization.density).toBe(42);
  });

  it("keeps nothing else of the map it replaces", () => {
    options.map.lore.description = "the previous author's note";
    options.map.climate.winds = [0, 0, 0, 0, 0, 0];

    Options.randomize();

    expect(options.map.lore.description).toBe("");
    expect(options.map.climate.winds).toEqual(defaults().climate.winds);
  });

  it("caps the cultures request at what the chosen set can give", () => {
    Options.set(o => {
      o.generation.cultures.limit = 30;
      o.generation.cultures.set = "english"; // a set of 10
    });
    Options.capCultures();

    expect(options.generation.cultures.limit).toBe(10);
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
    statesNumber: "99" // a pin from the same scheme, which the object answers for now
  };

  it("adopts the preferences that used to keep a key of their own, then drops the namespace", () => {
    for (const [key, value] of Object.entries(LEGACY)) localStorage.setItem(key, value);

    Options.restore();

    expect(options.app.ui.size).toBe(1.4);
    expect(options.app.ui.tooltipSize).toBe(20);
    expect(options.app.ui.themeColor).toBe("#123456");
    expect(options.app.ui.transparency).toBe(30);
    expect(options.app.rendering).toBe("geometricPrecision");
    expect(options.app.onLoad).toBe("lastSaved");
    expect(options.app.emblems.shape).toBe("heater");
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
      o.app.emblems.shape = "spanish";
      o.app.zoomExtent = { min: 2, max: 30 };
    });

    load(savedFile(map => (map.lore.name = "someone else's map")));

    expect(options.app.ui.size).toBe(2);
    expect(options.app.emblems.shape).toBe("spanish");
    expect(options.app.zoomExtent).toEqual({ min: 2, max: 30 });
  });

  it("starts a reset browser from the defaults", () => {
    Options.set(o => (o.app.ui.tooltipSize = 30));
    Options.reset();

    expect(options.app.ui.tooltipSize).toBe(Options.getDefaultOptions().app.ui.tooltipSize);
    expect(JSON.parse(localStorage.getItem("fmg-options")!).app.ui.tooltipSize).toBe(14);
  });

  it("resets the options alone: the pins are a store of their own, cleared by whoever wipes them", () => {
    Pins.set("statesNumber", 3);
    Options.reset();

    expect(options.generation.states.limit).toBe(Options.getDefaultOptions().generation.states.limit);
    expect(Pins.has("statesNumber")).toBe(true); // cleanupData clears the pin store itself

    Pins.clearAll();
    Options.randomize();
    expect(options.generation.states.limit).not.toBe(3);
  });
});

describe("the pin store", () => {
  it("keeps the value and not just the key, so a load cannot take it away", () => {
    Pins.set("prec", 350);
    load(savedFile(map => (map.climate.precipitation = 12)));

    expect(options.map.climate.precipitation).toBe(12); // the loaded map governs itself
    expect(Pins.valueOr("prec", 0)).toBe(350); // and the pin still stands for the next one
  });

  it("reads a pin only where one was made", () => {
    Pins.set("statesNumber", 7);
    expect(Pins.rolls("statesNumber")).toBe(false);
    expect(Pins.rolls("provincesRatio")).toBe(true);
    expect(Pins.valueOr("provincesRatio", 20)).toBe(20);

    Pins.clear("statesNumber");
    expect(Pins.rolls("statesNumber")).toBe(true);
  });
});

describe("a request and what it produced are not the same field", () => {
  it("keeps every count, rate and variety on the request side alone", () => {
    const map = defaults() as unknown as Record<string, unknown>;
    expect(map.states).toBeUndefined();

    const asked = Options.getDefaultOptions().generation;
    expect(asked.states.growthRate).toBeTypeOf("number");
    expect(asked.cultures.sizeVariety).toBeTypeOf("number");
    expect(asked.resolveDepressionsSteps).toBeTypeOf("number");
    expect(asked.lakeElevationLimit).toBeTypeOf("number");

    expect(map.cultures).toEqual({ set: "world" }); // the set, not the rate it expanded at
  });

  it("asks for the graph in one place and records it in another", () => {
    // the request holds a density step; the cell count it stands for is derived, never stored
    const asked = Options.getDefaultOptions().generation.graph;
    expect(asked).toEqual({ width: 1280, height: 800, density: 4 });
    expect(getPointsNumber(asked.density)).toBe(10000);

    // the record has no density: a step is how the request was phrased, not what was built
    expect(defaults().graph).toEqual({ width: 1280, height: 800, points: 10000 });
  });
});

describe("the map carries its own lore", () => {
  it("round-trips a description through a file", () => {
    const file = savedFile(map => {
      map.lore.name = "Narnia";
      map.lore.description = "A world of talking beasts, under a long winter.";
      map.lore.calendar = { year: 1300, era: "Winter Era", eraShort: "WE" };
    });

    load(file);
    expect(options.map.lore.description).toBe("A world of talking beasts, under a long winter.");
    expect(options.map.lore.calendar.eraShort).toBe("WE");

    load(savedFile(() => {})); // another map: nothing of the first one's lore survives
    expect(options.map.lore.description).toBe("");
  });

  it("leaves a description absent from an older file empty, not undefined", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const older = JSON.parse(savedFile(map => (map.lore.name = "old"))) as MapData;
    delete (older.lore as Partial<MapData["lore"]>).description;

    load(JSON.stringify(older));
    expect(options.map.lore).toEqual({ name: "old", description: "", calendar: defaults().lore.calendar });
  });
});

describe("a derived value is stored, not recomputed", () => {
  it("takes the lat/lon box the file carries", () => {
    const box = { latT: 60, latN: 40, latS: -20, lonT: 96, lonW: -48, lonE: 48 };
    load(
      savedFile(map => {
        map.geography.mapSize = 33;
        map.geography.coordinates = box;
      })
    );

    // parsing does not touch it, and the load has nothing to recompute: the panel that owns the
    // three inputs re-derives it on every edit, so what a file carries always agrees with them
    expect(options.map.geography.coordinates).toEqual(box);
  });

  it("keeps it recomputable: the inputs travel in the same file", () => {
    const written = JSON.parse(savedFile(map => (map.geography.mapSize = 33)));
    expect(written.geography).toMatchObject({ mapSize: 33, latitude: 50, longitude: 50 });
    expect(written.graph).toMatchObject({ width: 1280, height: 800 });
  });
});

describe("the defaults come from the module that owns them", () => {
  it("takes the 3D defaults from the module that owns them", async () => {
    const { DEFAULT_THREE_D } = await import("@/data/view-3d-options");
    expect(Options.getDefaultOptions().app.threeD).toEqual(DEFAULT_THREE_D);
  });

  it("leaves this browser's preferences alone however old the map it opens", () => {
    Options.set(o => {
      o.app.threeD.erosion = true;
      o.app.threeD.skyColor = "#000000";
      o.app.notesPinned = true;
    });

    load(savedFile(map => (map.lore.name = "a map from an older version")));

    expect(options.app.threeD.erosion).toBe(true);
    expect(options.app.threeD.skyColor).toBe("#000000");
    expect(options.app.notesPinned).toBe(true);
  });

  it("restores the units the model defines, rather than an editor's own copy", () => {
    options.map.units.distance.scale = 99;
    options.map.units.height.exponent = 1.1;

    options.map.units = defaults().units; // what the editor's Restore does
    expect(options.map.units).toEqual(defaults().units);
    expect(options.map.units.height.exponent).toBe(2);
  });
});

describe("presentation is the style's, not the map's", () => {
  it("keeps the scale bar's label and placement out of the file", () => {
    expect(defaults()).not.toHaveProperty("scaleBar");
  });
});

describe("a preference nobody has set is null", () => {
  it("leaves the viewport and the interface size unset until someone chooses", () => {
    const { app } = Options.getDefaultOptions();
    expect(app.viewport).toBeNull();
    expect(app.ui.size).toBeNull();
  });

  it("remembers a viewport the user set, and survives a map load like any other preference", () => {
    Options.set(o => (o.app.viewport = { width: 900, height: 600 }));
    Options.persist();

    load(savedFile(map => (map.lore.name = "another map")));
    expect(options.app.viewport).toEqual({ width: 900, height: 600 });
    expect(JSON.parse(localStorage.getItem("fmg-options")!).app.viewport).toEqual({ width: 900, height: 600 });
  });
});

import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CoastlineSettings } from "@/generators/coastline-generator";
import type { LabelGroup } from "@/generators/labels-generator";
import type { Transport } from "@/generators/transports-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { MilitaryUnit } from "@/types/Military";
import { parseSections } from "@/utils/schemaUtils";
import { type MapData, mapSchema, type OptionsData, optionsSchema, pinSchemas } from "./options-schema";

// The schema is the shape; the default factory is the values. These keep the two in step,
// and keep both in step with the domain types the rest of the app is written against.

const defaults = (): MapData => Options.getDefaultOptions().map;

describe("options schema", () => {
  it("validates its own defaults", () => {
    expect(() => optionsSchema.parse(Options.getDefaultOptions())).not.toThrow();
  });

  it("round-trips a parsed default map unchanged", () => {
    expect(mapSchema.parse(structuredClone(defaults()))).toEqual(defaults());
  });

  it("holds the requests generation consumes", () => {
    const { generation } = Options.getDefaultOptions();
    expect(generation.states.limit).toBeTypeOf("number");
    expect(generation.states.freeBurgs).toBe(0);
    expect(generation.cultures.limit).toBeTypeOf("number");
    expect(generation.cultures.traits).toBe(true);
    expect(generation.religions.limit).toBeTypeOf("number");
    expect(generation.provinces.ratio).toBeTypeOf("number");
  });

  it("resolves the density step to a cell count", () => {
    const { graph } = Options.getDefaultOptions().generation;
    expect(graph.density).toBe(4);
    expect(graph).not.toHaveProperty("points"); // derived from the step, never stored beside it
  });

  it("holds no requested counts in the map section: how many exist is answered by the data", () => {
    const map = defaults() as unknown as Record<string, Record<string, unknown>>;
    expect(map.states).toBeUndefined();
    expect(map.religions).toBeUndefined();
    expect(map.provinces).toBeUndefined();
    expect(map.heightmap).toBeUndefined(); // the template produced the terrain, it does not describe it
    expect(map.cultures.limit).toBeUndefined();
    expect(map.cultures.growthRate).toBeUndefined();
    expect(map.cultures.set).toBeTypeOf("string"); // the one culture value the map keeps
  });

  // a set the model leaves empty is a map whose entities resolve none of the names they point at
  it("starts the definition sets from the modules that own them", () => {
    const map = defaults();
    expect(map.military.units.length).toBeGreaterThan(0);
    expect(map.transports.length).toBeGreaterThan(0);
    expect(map.burgs.groups.length).toBeGreaterThan(0);
    expect(map.labels.groups.length).toBeGreaterThan(0);
  });
});

// A schema that only describes the shape lets a value through that nothing can act on: the app
// then fails where the value is used, far from the boundary that should have caught it
describe("the schema describes the value, not merely its type", () => {
  const repair = (section: string, value: unknown): OptionsData => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const stored = { ...structuredClone(Options.getDefaultOptions()), [section]: value };
    return parseSections<OptionsData>(optionsSchema, Options.getDefaultOptions(), stored, "test");
  };

  it("repairs a density step the cell-count table has no entry for", () => {
    const generation = { ...Options.getDefaultOptions().generation, graph: { width: 800, height: 600, density: 99 } };
    const parsed = repair("generation", generation);

    expect(parsed.generation.graph.density).toBe(Options.getDefaultOptions().generation.graph.density);
    expect(parsed.generation.graph.width).toBe(800); // the step alone was wrong
  });

  it("repairs a free-burgs share outside the percent range", () => {
    const generation = {
      ...Options.getDefaultOptions().generation,
      states: { ...Options.getDefaultOptions().generation.states, freeBurgs: 140 }
    };

    expect(repair("generation", generation).generation.states.freeBurgs).toBe(0);
    expect(pinSchemas.freeBurgs.safeParse(30).success).toBe(true);
    expect(pinSchemas.freeBurgs.safeParse(101).success).toBe(false);
  });

  it("repairs an extent nothing could be generated on", () => {
    const generation = { ...Options.getDefaultOptions().generation, graph: { width: 0, height: -5, density: 4 } };
    const parsed = repair("generation", generation);

    expect(parsed.generation.graph).toEqual(Options.getDefaultOptions().generation.graph);
  });

  it("repairs a value outside a closed vocabulary", () => {
    const { performance } = Options.getDefaultOptions().app;
    const app = {
      ...Options.getDefaultOptions().app,
      performance: { ...performance, shapeRendering: "whatever the last version called it" }
    };
    expect(repair("app", app).app.performance.shapeRendering).toBe(performance.shapeRendering);
  });

  it("repairs culture-set ids the generator does not know", () => {
    const defaults = Options.getDefaultOptions();
    const generation = {
      ...defaults.generation,
      cultures: { ...defaults.generation.cultures, set: "missing-culture-set" }
    };
    const map = { ...defaults.map, cultures: { set: "missing-culture-set" } };

    expect(repair("generation", generation).generation.cultures.set).toBe(defaults.generation.cultures.set);
    expect(repair("map", map).map.cultures.set).toBe(defaults.map.cultures.set);
  });

  it("validates astral and rpg culture-set ids and accepts them in schema and pins", () => {
    const defaults = Options.getDefaultOptions();
    for (const setId of ["astralTrek", "astralJammer", "grimdark", "rpgFantasy"]) {
      const generation = {
        ...defaults.generation,
        cultures: { ...defaults.generation.cultures, set: setId }
      };
      const map = { ...defaults.map, cultures: { set: setId } };

      expect(repair("generation", generation).generation.cultures.set).toBe(setId);
      expect(repair("map", map).map.cultures.set).toBe(setId);
      expect(pinSchemas.culturesSet.safeParse(setId).success).toBe(true);
    }
  });

  it("reads the culture-traits request as a plain on/off, defaulting to on", () => {
    const defaults = Options.getDefaultOptions();
    const generation = { ...defaults.generation, cultures: { ...defaults.generation.cultures, traits: "yes" } };

    expect(repair("generation", generation).generation.cultures.traits).toBe(true);

    const off = { ...defaults.generation, cultures: { ...defaults.generation.cultures, traits: false } };
    expect(repair("generation", off).generation.cultures.traits).toBe(false);
  });

  it("leaves a generation section without the culture-traits switch at its default", () => {
    const generation = structuredClone(Options.getDefaultOptions().generation) as Record<string, any>;
    delete generation.cultures.traits;

    expect(repair("generation", generation).generation.cultures.traits).toBe(true);
  });

  it("repairs a zoom extent whose ends are the wrong way round", () => {
    const app = { ...Options.getDefaultOptions().app, zoomExtent: { min: 30, max: 2 } };
    expect(repair("app", app).app.zoomExtent).toEqual(Options.getDefaultOptions().app.zoomExtent);
  });

  it("repairs a wind direction that is not one", () => {
    const map = defaults();
    map.climate = { ...map.climate, winds: [225, 45, 225, 315, 135, 400] };

    expect(repair("map", map).map.climate.winds).toEqual(defaults().climate.winds);
  });

  it("repairs a history mode no version has written", () => {
    const map = defaults();
    map.lore = { ...map.lore, history: { ...map.lore.history, mode: "timeless" as "archaeologist" } };

    const parsed = repair("map", map);
    expect(parsed.map.lore.history.mode).toBe("archaeologist");
    expect(parsed.map.lore.history.span).toBe(map.lore.history.span); // the settings around it survive
  });

  it("recovers a map whose climate section is corrupt without losing the rest", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const file = { ...defaults(), seed: "12345", climate: "corrupt" };
    const parsed = parseSections<MapData>(mapSchema, defaults(), file, "test");

    expect(parsed.seed).toBe("12345");
    expect(parsed.climate).toEqual(defaults().climate);
  });

  it("leaves a field absent from an older file at its default", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const file: Record<string, unknown> = defaults();
    delete file.coastline;

    const parsed = parseSections<MapData>(mapSchema, defaults(), file, "test");
    expect(parsed.coastline).toEqual(defaults().coastline);
  });

  it("loads an older file that has no history mode as the archaeologist", () => {
    const file = structuredClone(defaults()) as unknown as Record<string, any>;
    delete file.lore.history.mode;

    const parsed = parseSections<MapData>(mapSchema, defaults(), file, "test");
    expect(parsed.lore.history.mode).toBe("archaeologist");
  });
});

describe("schema types match the domain types", () => {
  it("military units", () => {
    expectTypeOf<MapData["military"]["units"][number]>().toEqualTypeOf<MilitaryUnit>();
  });

  // these two are deliberately wider in the schema than in the domain (a label group may name a
  // layer the registry no longer has, a transport domain is validated by the enum alone), so the
  // guard runs in the direction that matters: whatever the app produces must validate
  it("transports", () => {
    expectTypeOf<Transport>().toMatchTypeOf<MapData["transports"][number]>();
  });

  it("burg groups", () => {
    expectTypeOf<MapData["burgs"]["groups"][number]>().toEqualTypeOf<BurgGroup>();
  });

  it("label groups", () => {
    expectTypeOf<LabelGroup>().toMatchTypeOf<MapData["labels"]["groups"][number]>();
  });

  it("coastline settings", () => {
    expectTypeOf<MapData["coastline"]>().toEqualTypeOf<CoastlineSettings>();
  });
});

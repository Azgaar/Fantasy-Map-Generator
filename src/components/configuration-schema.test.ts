import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CoastlineSettings } from "@/generators/coastline-generator";
import type { LabelGroup } from "@/generators/labels-generator";
import type { Transport } from "@/generators/transports-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { MilitaryUnit } from "@/types/Military";
import { parseSections } from "@/utils/schemaUtils";
import { type MapData, mapSchema, type OptionsData, optionsSchema } from "./options-schema";

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
    expect(generation.cultures.limit).toBeTypeOf("number");
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

  it("repairs an extent nothing could be generated on", () => {
    const generation = { ...Options.getDefaultOptions().generation, graph: { width: 0, height: -5, density: 4 } };
    const parsed = repair("generation", generation);

    expect(parsed.generation.graph).toEqual(Options.getDefaultOptions().generation.graph);
  });

  it("repairs a value outside a closed vocabulary", () => {
    const app = { ...Options.getDefaultOptions().app, rendering: "whatever the last version called it" };
    expect(repair("app", app).app.rendering).toBe(Options.getDefaultOptions().app.rendering);
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

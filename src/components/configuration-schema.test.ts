import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { CoastlineSettings } from "@/generators/coastline-generator";
import type { LabelGroup } from "@/generators/labels-generator";
import type { Transport } from "@/generators/transports-generator";
import type { BurgGroup } from "@/types/burg-groups";
import type { MilitaryUnit } from "@/types/Military";
import { parseSections } from "@/utils/schemaUtils";
import { getDefaultFacts } from "./facts-model";
import { type FactsData, factsSchema } from "./facts-schema";
import { getDefaultOptions } from "./options-model";
import { type OptionsData, optionsSchema } from "./options-schema";

// The schemas are the shape; the default factories are the values. These keep the two in step,
// and keep both in step with the domain types the rest of the app is written against.

describe("facts schema", () => {
  it("validates its own defaults", () => {
    expect(() => factsSchema.parse(getDefaultFacts())).not.toThrow();
  });

  it("round-trips a parsed default object unchanged", () => {
    const defaults = getDefaultFacts();
    expect(factsSchema.parse(structuredClone(defaults))).toEqual(defaults);
  });

  it("holds no requested counts: how many exist is answered by the data", () => {
    const facts = getDefaultFacts() as unknown as Record<string, Record<string, unknown>>;
    expect(facts.states).toBeUndefined();
    expect(facts.cultures.limit).toBeUndefined();
    expect(facts.religions).toBeUndefined();
    expect(facts.provinces).toBeUndefined();
  });

  it("keeps no rate or variety: those are asked for at generation and then spent", () => {
    const facts = getDefaultFacts() as unknown as Record<string, Record<string, unknown>>;
    expect(facts.states).toBeUndefined();
    expect(facts.cultures.growthRate).toBeUndefined();
    expect(facts.cultures.sizeVariety).toBeUndefined();
    expect(facts.heightmap).toBeUndefined(); // the template produced the terrain, it does not describe it

    const { generation } = getDefaultOptions();
    expect(generation.states.growthRate).toBeTypeOf("number");
    expect(generation.states.sizeVariety).toBeTypeOf("number");
    expect(generation.cultures.growthRate).toBeTypeOf("number");
    expect(generation.resolveDepressionsSteps).toBeTypeOf("number");

    expect(getDefaultFacts().cultures.set).toBeTypeOf("string"); // the one culture value a fact keeps
  });

  // the defaults are what a repair and a file with no set of its own fall back to, so a set the
  // model leaves empty is a map whose entities resolve none of the names they point at
  it("carries the definition sets entities reference by name", () => {
    const facts = getDefaultFacts();
    expect(facts.military.units.length).toBeGreaterThan(0);
    expect(facts.transports.length).toBeGreaterThan(0);
    expect(facts.burgs.groups.length).toBeGreaterThan(0);
    expect(facts.labels.groups.length).toBeGreaterThan(0);
  });

  it("recovers a map whose climate section is corrupt without losing the rest", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const file = { ...structuredClone(getDefaultFacts()), seed: "12345", climate: "corrupt" };
    const parsed = parseSections<FactsData>(factsSchema, getDefaultFacts(), file, "Facts.parse");

    expect(parsed.seed).toBe("12345");
    expect(parsed.climate).toEqual(getDefaultFacts().climate);
  });

  it("leaves a field absent from an older file at its default", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const file: Record<string, unknown> = structuredClone(getDefaultFacts());
    delete file.coastline;

    const parsed = parseSections<FactsData>(factsSchema, getDefaultFacts(), file, "Facts.parse");
    expect(parsed.coastline).toEqual(getDefaultFacts().coastline);
  });
});

describe("options schema", () => {
  it("validates its own defaults", () => {
    expect(() => optionsSchema.parse(getDefaultOptions())).not.toThrow();
  });

  it("holds the requests generation consumes", () => {
    const { generation } = getDefaultOptions();
    expect(generation.states.limit).toBeTypeOf("number");
    expect(generation.cultures.limit).toBeTypeOf("number");
    expect(generation.religions.limit).toBeTypeOf("number");
    expect(generation.provinces.ratio).toBeTypeOf("number");
  });

  it("starts with an empty preservation library", () => {
    const { library } = getDefaultOptions();
    expect(Object.values(library).every(entry => entry === null)).toBe(true);
  });

  it("resolves the density step to a cell count", () => {
    const { graph } = getDefaultOptions().generation;
    expect(graph.density).toBe(4);
    expect(graph).not.toHaveProperty("points"); // derived from the step, never stored beside it
  });
});

// A schema that only describes the shape lets a value through that nothing can act on: the app
// then fails where the value is used, far from the boundary that should have caught it
describe("the schemas describe the value, not merely its type", () => {
  const repair = (section: string, value: unknown): OptionsData => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const stored = { ...structuredClone(getDefaultOptions()), [section]: value };
    return parseSections<OptionsData>(optionsSchema, getDefaultOptions(), stored, "test");
  };

  it("repairs a density step the cell-count table has no entry for", () => {
    const generation = { ...getDefaultOptions().generation, graph: { width: 800, height: 600, density: 99 } };
    const parsed = repair("generation", generation);

    expect(parsed.generation.graph.density).toBe(getDefaultOptions().generation.graph.density);
    expect(parsed.generation.graph.width).toBe(800); // the step alone was wrong
  });

  it("repairs an extent nothing could be generated on", () => {
    const generation = { ...getDefaultOptions().generation, graph: { width: 0, height: -5, density: 4 } };
    const parsed = repair("generation", generation);

    expect(parsed.generation.graph).toEqual(getDefaultOptions().generation.graph);
  });

  it("repairs a value outside a closed vocabulary", () => {
    const app = { ...getDefaultOptions().app, rendering: "whatever the last version called it" };
    expect(repair("app", app).app.rendering).toBe(getDefaultOptions().app.rendering);
  });

  it("repairs a zoom extent whose ends are the wrong way round", () => {
    const app = { ...getDefaultOptions().app, zoomExtent: { min: 30, max: 2 } };
    expect(repair("app", app).app.zoomExtent).toEqual(getDefaultOptions().app.zoomExtent);
  });

  it("repairs a wind direction that is not one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const climate = { ...getDefaultFacts().climate, winds: [225, 45, 225, 315, 135, 400] };
    const file = { ...structuredClone(getDefaultFacts()), climate };
    const parsed = parseSections<FactsData>(factsSchema, getDefaultFacts(), file, "Facts.parse");

    expect(parsed.climate.winds).toEqual(getDefaultFacts().climate.winds);
  });
});

describe("the two objects stay disjoint", () => {
  it("shares no top-level section name", () => {
    const factsKeys = Object.keys(getDefaultFacts());
    const optionsKeys = Object.keys(getDefaultOptions());
    expect(factsKeys.filter(key => optionsKeys.includes(key))).toEqual([]);
  });

  it("keeps the library shaped like the facts it seeds", () => {
    const library = optionsSchema.shape.library;
    expect(() =>
      library.parse({
        military: getDefaultFacts().military.units,
        transports: getDefaultFacts().transports,
        burgGroups: getDefaultFacts().burgs.groups,
        labelGroups: getDefaultFacts().labels.groups,
        coastline: getDefaultFacts().coastline
      })
    ).not.toThrow();
  });
});

describe("schema types match the domain types", () => {
  it("military units", () => {
    expectTypeOf<FactsData["military"]["units"][number]>().toEqualTypeOf<MilitaryUnit>();
  });

  // these two are deliberately wider in the schema than in the domain (a label group may name a
  // layer the registry no longer has, a transport domain is validated by the enum alone), so the
  // guard runs in the direction that matters: whatever the app produces must validate
  it("transports", () => {
    expectTypeOf<Transport>().toMatchTypeOf<FactsData["transports"][number]>();
  });

  it("burg groups", () => {
    expectTypeOf<FactsData["burgs"]["groups"][number]>().toEqualTypeOf<BurgGroup>();
  });

  it("label groups", () => {
    expectTypeOf<LabelGroup>().toMatchTypeOf<FactsData["labels"]["groups"][number]>();
  });

  it("coastline settings", () => {
    expectTypeOf<FactsData["coastline"]>().toEqualTypeOf<CoastlineSettings>();
  });

  it("library entries are facts-shaped", () => {
    expectTypeOf<NonNullable<OptionsData["library"]["military"]>>().toEqualTypeOf<FactsData["military"]["units"]>();
    expectTypeOf<NonNullable<OptionsData["library"]["coastline"]>>().toEqualTypeOf<FactsData["coastline"]>();
  });
});

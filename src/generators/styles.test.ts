import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { Styles } from "./styles";
import { stylesSchema } from "./styles-schema";

const readPreset = (name: string) => JSON.parse(readFileSync(`public/styles/${name}.json`, "utf8"));
const cinderwood = readPreset("cinderwood");
const ink = readPreset("ink");

describe("stylesSchema", () => {
  test("the default styles are valid — defaults and schema cannot drift", () => {
    expect(stylesSchema.safeParse(Styles.defaults).success).toBe(true);
  });

  test("unknown keys are rejected by the strict schemas", () => {
    const routes = structuredClone(Styles.defaults.routes) as Record<string, unknown>;
    routes.bogus = {};
    expect(stylesSchema.shape.routes.safeParse(routes).success).toBe(false);
  });
});

describe("parseStyles", () => {
  test.each(["burgIcons", "anchors"] as const)("repairs empty %s groups without changing other styles", type => {
    const doc = Styles.parse(Styles.defaults);
    doc.burgIcons.burgIcons.groups.capital.options.size = 5;
    doc.burgIcons.anchors.groups.capital.options.size = 7;
    doc.burgIcons[type].groups = {};
    const expected = structuredClone(doc);
    expected.burgIcons[type].groups = structuredClone(Styles.defaults.burgIcons[type].groups);

    const parsed = Styles.parse(doc);

    expect(parsed).toEqual(expected);
    expect(doc.burgIcons[type].groups).toEqual({});
    expect(parsed.burgIcons[type].groups).not.toBe(Styles.defaults.burgIcons[type].groups);
  });

  test("older oceans gain disabled bands and Cinderwood bands survive serialization", () => {
    const doc = structuredClone(Styles.defaults);
    const { bands: _, ...options } = doc.ocean.options;
    const parsed = Styles.parse({ ...doc, ocean: { ...doc.ocean, options } });
    expect(parsed.ocean.options.bands.render).toBe(false);
    expect(parsed.ocean.base).toEqual(doc.ocean.base);
    const preset = Styles.parse(cinderwood);
    expect(preset.ocean.options.bands.render).toBe(true);
    expect(Styles.parse(JSON.parse(JSON.stringify(preset))).ocean).toEqual(preset.ocean);
    const { shade: __, ...bands } = preset.ocean.options.bands;
    const legacy = { ...preset, ocean: { ...preset.ocean, options: { ...preset.ocean.options, bands } } };
    expect(Styles.parse(legacy).ocean.options.bands).toEqual({ ...bands, shade: 0.35 });
  });

  test("older lakes gain disabled embellishments and ink settings survive serialization", () => {
    const doc = structuredClone(Styles.defaults);
    const { options: _, ...freshwater } = doc.lakes.groups.freshwater;
    const parsed = Styles.parse({ ...doc, lakes: { groups: { ...doc.lakes.groups, freshwater } } });
    expect(parsed.lakes.groups.freshwater.options.embellishment).toBe("none");
    expect(parsed.lakes.groups.freshwater.attrs).toEqual(freshwater.attrs);
    const inkStyles = Styles.parse(ink);
    expect(inkStyles.lakes.groups.freshwater.options.embellishment).toBe("ripples");
    expect(inkStyles.lakes.groups.dry.options.embellishment).toBe("none");
    expect(Styles.parse(JSON.parse(JSON.stringify(inkStyles)))).toEqual(inkStyles);
  });

  test("older heightmap styles gain disabled contours without changing their existing appearance", () => {
    const doc = structuredClone(Styles.defaults) as any;
    delete doc.heightmap.landHeights.options.contours;
    delete doc.heightmap.oceanHeights.options.contours;
    doc.heightmap.landHeights.options.scheme = "monochrome";
    doc.heightmap.landHeights.attrs.opacity = 0.7;
    const parsed = Styles.parse(doc);
    expect(parsed.heightmap.landHeights.options.contours.mode).toBe("off");
    expect(parsed.heightmap.oceanHeights.options.contours.mode).toBe("off");
    expect(parsed.heightmap.landHeights.options.scheme).toBe("monochrome");
    expect(parsed.heightmap.landHeights.attrs.opacity).toBe(0.7);
  });

  test("older heightmap styles gain disabled hachures", () => {
    const doc = structuredClone(Styles.defaults);
    const { hachures: _, ...options } = doc.heightmap.landHeights.options;
    const landHeights = { ...doc.heightmap.landHeights, options };
    const parsed = Styles.parse({ ...doc, heightmap: { ...doc.heightmap, landHeights } });
    expect(parsed.heightmap.landHeights.options.hachures).toEqual(
      Styles.defaults.heightmap.landHeights.options.hachures
    );
    expect(parsed.heightmap.landHeights.options.hachures.mode).toBe("off");
  });

  test("older styles gain disabled coastal waves", () => {
    const doc = structuredClone(Styles.defaults);
    const { oceanWaves: _, ...ocean } = doc.ocean;
    const parsed = Styles.parse({ ...doc, ocean });
    expect(parsed.ocean.oceanWaves).toEqual(Styles.defaults.ocean.oceanWaves);
  });

  test("existing coastal-wave styles default to Waves without losing their settings", () => {
    const doc = structuredClone(Styles.defaults);
    const { type: _, ...options } = { ...doc.ocean.oceanWaves.options, render: true, density: 1.5 };
    const legacy = { ...doc, ocean: { ...doc.ocean, oceanWaves: { ...doc.ocean.oceanWaves, options } } };
    expect(Styles.parse(legacy).ocean.oceanWaves.options).toEqual({ ...options, type: "waves" });
  });

  test("coastal wave settings round-trip through serialized styles", () => {
    const doc = Styles.parse(Styles.defaults);
    doc.ocean.oceanWaves.options = { render: true, type: "lines", density: 1.4, length: 2, reach: 7, halo: 0.15 };
    doc.ocean.oceanWaves.attrs = {
      stroke: "#343434",
      "stroke-width": 0.4,
      "stroke-dasharray": "3 2",
      opacity: 0.7,
      filter: null
    };
    expect(Styles.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  test("custom contour settings round-trip through serialized styles", () => {
    const doc = Styles.parse(Styles.defaults);
    doc.heightmap.landHeights.options.contours = {
      mode: "only",
      interval: 3,
      color: "#654321",
      width: 0.6,
      opacity: 0.8
    };
    expect(Styles.parse(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  test("invalid contour spacing is repaired without resetting the other contour settings", () => {
    const doc = Styles.parse(Styles.defaults);
    doc.heightmap.landHeights.options.contours.mode = "overlay";
    doc.heightmap.landHeights.options.contours.interval = 0;
    const parsed = Styles.parse(doc);
    expect(parsed.heightmap.landHeights.options.contours.interval).toBe(5);
    expect(parsed.heightmap.landHeights.options.contours.mode).toBe("overlay");
  });

  test("a valid document round-trips unchanged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(Styles.parse(structuredClone(Styles.defaults))).toEqual(Styles.defaults);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("an invalid layer falls back to the default with one warning; the rest survive", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = structuredClone(Styles.defaults) as any;
    doc.rivers.attrs.fill = "#123456";
    (doc as Record<string, unknown>).markers = { attrs: { opacity: "not a number" } };
    const parsed = Styles.parse(doc);
    expect(parsed.rivers.attrs.fill).toBe("#123456");
    expect(parsed.markers).toEqual(Styles.defaults.markers);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test("garbage input yields the complete defaults", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = Styles.parse("nonsense");
    expect(parsed).toEqual(Styles.defaults);
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(stylesSchema.shape).sort());
    warn.mockRestore();
  });

  test("null survives — it means the attribute is not set", () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.rivers.attrs.filter = null;
    expect(Styles.parse(doc).rivers.attrs.filter).toBeNull();
  });

  test("numeric stroke-dasharray values are not coerced by the regular parser", () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.routes.groups.roads.attrs["stroke-dasharray"] = 5;

    expect(Styles.parse(doc).routes.groups.roads.attrs["stroke-dasharray"]).toBe("2");
  });
});

describe("schema reconciliation", () => {
  test("ocean filter and outline live under the oceanLayers subgroup", () => {
    expect(Styles.defaults.ocean.oceanLayers.attrs.filter).toBeNull();
    expect(Styles.defaults.ocean.oceanLayers.options.outline).toBe("-6,-3,-1");
    expect(Styles.defaults.ocean.options).toMatchObject({ pattern: "./images/pattern1.png", patternOpacity: 0.2 });
  });

  test("labels base font-size is the css length the registry stamps", () => {
    expect(Styles.defaults.labels.attrs["font-size"]).toBe("100px");
  });

  test("label groups default font-weight to unset", () => {
    expect(Styles.defaults.labels.groups.capital.attrs["font-weight"]).toBeNull();
  });
});

describe("per-attribute repair", () => {
  test("an invalid attribute falls back alone, not with its whole layer", () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.temperature.attrs.opacity = 0.6;
    doc.temperature.attrs["font-size"] = null; // non-nullable in the schema
    const parsed = Styles.parse(doc);
    expect(parsed.temperature.attrs.opacity).toBe(0.6);
    expect(parsed.temperature.attrs["font-size"]).toBe(Styles.defaults.temperature.attrs["font-size"]);
  });

  test("a layer that cannot be repaired still falls back whole", () => {
    const parsed = Styles.parse({ ...Styles.defaults, provinces: "not a layer" });
    expect(parsed.provinces).toEqual(Styles.defaults.provinces);
  });

  test("an invalid value inside a custom group repairs alone — the group and its layer survive", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = structuredClone(Styles.defaults) as any;
    doc.routes.groups.royal_roads = structuredClone(doc.routes.groups.roads);
    doc.routes.groups.royal_roads.attrs.stroke = "#8b0000";
    doc.routes.groups.royal_roads.attrs["stroke-width"] = "2px"; // invalid: schema wants a number
    doc.routes.groups.roads.attrs.opacity = 0.55;

    const parsed = Styles.parse(doc);
    expect(parsed.routes.groups.roads.attrs.opacity).toBe(0.55);
    expect(parsed.routes.groups.royal_roads.attrs.stroke).toBe("#8b0000");
    expect(parsed.routes.groups.royal_roads.attrs["stroke-width"]).toBe(
      Styles.defaults.routes.groups.roads.attrs["stroke-width"]
    );
    warn.mockRestore();
  });

  test("an unrepairable custom group is rebuilt from a stock group without resetting the layer", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = structuredClone(Styles.defaults) as any;
    doc.routes.groups.royal_roads = "not a group";
    doc.routes.groups.roads.attrs.opacity = 0.55;

    const parsed = Styles.parse(doc);
    expect(parsed.routes.groups.roads.attrs.opacity).toBe(0.55);
    expect(parsed.routes.groups.royal_roads).toEqual(Object.values(Styles.defaults.routes.groups)[0]);
    warn.mockRestore();
  });
});

describe("port icon styles", () => {
  test("older anchor groups keep the anchor appearance and gain no shift", () => {
    const legacy = Styles.parse(Styles.defaults);
    legacy.burgIcons.anchors.groups.town.options = { size: 2, icon: "#icon-circle" };
    const parsed = Styles.parse(legacy);
    expect(parsed.burgIcons.anchors.groups.town.options).toEqual({ size: 2, icon: "#icon-anchor" });
    expect(parsed.burgIcons.burgIcons.groups.town.options.icon).toBe("#icon-circle");
  });

  test("Cinderwood port settings survive saving and loading for every burg group", () => {
    const parsed = Styles.parse(cinderwood);
    const restored = Styles.parse(JSON.parse(JSON.stringify(parsed)));
    const groups = restored.burgIcons.anchors.groups;
    expect(Object.keys(groups).sort()).toEqual(Object.keys(parsed.burgIcons.burgIcons.groups).sort());
    const source = readFileSync("src/index.html", "utf8");
    const icons = new Set<string>();
    for (const [name, group] of Object.entries(groups)) {
      expect(group.options).toEqual(cinderwood.burgIcons.anchors.groups[name].options);
      expect(source.includes(`id="${group.options.icon.slice(1)}"`)).toBe(true);
      expect(Number.isFinite(group.options.dx)).toBe(true);
      expect(Number.isFinite(group.options.dy)).toBe(true);
      icons.add(group.options.icon);
    }
    expect(icons).toEqual(new Set(["#icon-anchor", "#icon-harbor"])); // shifted anchors on big burgs, harbors on small
  });
});

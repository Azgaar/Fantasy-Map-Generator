import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { Styles } from "./styles";
import { FORMATS, isLabelStyle } from "./styles-formats";
import { normalizeStyles } from "./styles-legacy";
import { stylesSchema } from "./styles-schema";

const readPreset = (name: string) => JSON.parse(readFileSync(`public/styles/${name}.json`, "utf8"));
const cinderwood = readPreset("cinderwood");
const ink = readPreset("ink");

describe("stylesSchema", () => {
  test("relief stroke width and color survive serialization with defaults for existing maps", () => {
    const record = Styles.parse(Styles.defaults);
    record.relief.attrs["stroke-width"] = 2;
    record.relief.attrs.stroke = "#aabbcc";
    expect(Styles.parse(JSON.parse(JSON.stringify(record))).relief.attrs).toMatchObject({
      "stroke-width": 2,
      stroke: "#aabbcc"
    });
    const { "stroke-width": _width, ...oldAttrs } = record.relief.attrs;
    expect(stylesSchema.shape.relief.parse({ ...record.relief, attrs: oldAttrs }).attrs["stroke-width"]).toBe(0);
    expect(stylesSchema.shape.relief.shape.attrs.shape["stroke-width"].safeParse(-1).success).toBe(false);
  });

  test("the default styles are valid — defaults and schema cannot drift", () => {
    expect(stylesSchema.safeParse(Styles.defaults).success).toBe(true);
  });

  test("unknown keys are rejected by the strict schemas", () => {
    const routes = structuredClone(Styles.defaults.routes) as Record<string, unknown>;
    routes.bogus = {};
    expect(stylesSchema.shape.routes.safeParse(routes).success).toBe(false);
  });

  const presetFiles = readdirSync("public/styles").filter(file => file.endsWith(".json"));
  test.each(presetFiles)("every preset in public/styles parses: %s", file => {
    const result = stylesSchema.safeParse(readPreset(file.replace(/\.json$/, "")));
    expect(result.error?.issues ?? []).toEqual([]);
  });
});

describe("attr formats", () => {
  const cases: [keyof typeof FORMATS, string[], string[]][] = [
    [
      "filter",
      ["none", "url(#paper)", "sepia(0.6)", "blur(3px)", "hue-rotate(24deg) saturate(1.15) brightness(0.9)"],
      ["", "foo", "url(paper)", "url(#a) url(#b)", "nonenone", "url(#a)url(#b)", "sepia(0.6) none", "blur(3px) "]
    ],
    ["blurFilter", ["blur(5px)", "blur(0.5px)"], ["", "blur(5)", "url(#blur5)", "blur(5px) "]],
    ["mask", ["url(#land)", "url(#vignette-mask)"], ["", "land", "url(#a) url(#b)"]],
    ["strokeDasharray", ["none", "5", ".5 1", "0 4 10 4", "3 1.2 0.5 1.2"], ["", "5,2", "5 px", "inherit"]],
    ["fontSizePercent", ["22%", "1.5%"], ["", "22 %", "8px", "18", "-2%"]],
    ["fontSizePx", ["8px", "100px", "1.5px"], ["", "8 px", "22%", "18", "-2px"]],
    ["percentage", ["0.3%", "-5%", "99.6%"], ["", "5", "5px", "5 %"]],
    [
      "compassTransform",
      ["translate(80 80) scale(0.25)", "translate(80 80) scale(.25)", "translate(-1 2) scale(1)"],
      ["", "translate(80 80)", "scale(1) translate(1 1)", "translate(1, 1) scale(1)"]
    ]
  ];
  test.each(cases)("%s accepts its format and rejects the rest", (_name, valid, invalid) => {
    const format = FORMATS[_name];
    for (const value of valid) expect(format.test(value), value).toBe(true);
    for (const value of invalid) expect(format.test(value), value).toBe(false);
  });

  test("a label style is a cssText of shadow, transform, variant and shift", () => {
    for (const value of [
      "text-shadow: white 0px 0px 4px",
      "text-shadow: #d3c9ae 0px 0px 1px; text-transform: uppercase; transform: translate(0em, 0.3em)",
      "font-variant: small-caps; text-shadow: -0.2px -0.2px 0 #f6fbfc, 0.35px 0.35px 0 #10222e;",
      "transform: translate(0em, -0.45em)",
      "text-shadow: none;"
    ])
      expect(isLabelStyle(value), value).toBe(true);
    for (const value of ["display: none", "transform: translate(1px, 1px)", "text-transform: bold", "color: red"])
      expect(isLabelStyle(value), value).toBe(false);
  });

  test("enums pin the lists the editor offers", () => {
    const schema = stylesSchema.shape;
    expect(schema.grid.shape.options.shape.type.safeParse("pointyHex").success).toBe(true);
    expect(schema.grid.shape.options.shape.type.safeParse("hex").success).toBe(false);
    expect(schema.relief.shape.options.shape.set.safeParse("illustrated").success).toBe(true);
    expect(schema.relief.shape.options.shape.set.safeParse("fancy").success).toBe(false);
    expect(schema.ocean.shape.groups.shape.oceanLayers.shape.options.shape.outline.safeParse("-6,-3,-1").success).toBe(
      true
    );
    expect(schema.ocean.shape.groups.shape.oceanLayers.shape.options.shape.outline.safeParse("-1").success).toBe(false);
    const heights = schema.heightmap.shape.groups.shape.landHeights.shape.options.shape;
    expect(heights.curve.safeParse("curveStep").success).toBe(true);
    expect(heights.curve.safeParse("curveBasis").success).toBe(false);
    const label = stylesSchema.shape.labels.shape.groups.valueType.shape.attrs.shape;
    expect(label["font-style"].safeParse("italic").success).toBe(true);
    expect(label["font-style"].safeParse("normal").success).toBe(false);
    expect(label["stroke-linecap"].safeParse("inherit").success).toBe(false);
    expect(label["stroke-linecap"].safeParse(null).success).toBe(true);
    expect(schema.map.shape.attrs.shape.filter.safeParse("").success).toBe(false);
  });
});

describe("normalizeStyles", () => {
  test('"" and "inherit" become null where they meant "not set", other strings are trimmed', () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.biomes.attrs.filter = "";
    doc.cells.attrs.mask = " url(#land) ";
    doc.zones.attrs["stroke-linecap"] = "inherit";
    doc.zones.attrs["stroke-dasharray"] = "";
    doc.scaleBar.options.label = "";
    doc.vignette.options.filter = "blur(30px) ";
    const normalized = normalizeStyles(doc);
    expect(normalized).toBe(doc);
    expect(doc.biomes.attrs.filter).toBeNull();
    expect(doc.cells.attrs.mask).toBe("url(#land)");
    expect(doc.zones.attrs["stroke-linecap"]).toBeNull();
    expect(doc.zones.attrs["stroke-dasharray"]).toBeNull();
    expect(doc.scaleBar.options.label).toBe("");
    expect(doc.vignette.options.filter).toBe("blur(30px)");
    expect(stylesSchema.safeParse(doc).success).toBe(true);
  });

  test("a font size keeps its number and takes the unit its element pins", () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.labels.groups.capital.attrs["font-size"] = "6px"; // 6px of the 100px layer is 6%
    doc.labels.groups.city.attrs["font-size"] = "5";
    doc.labels.groups.town.attrs["font-size"] = " 4.5% ";
    doc.temperature.attrs["font-size"] = "8%";
    doc.scaleBar.attrs["font-size"] = 10; // a pre-v1.154 number
    normalizeStyles(doc);
    expect(doc.labels.groups.capital.attrs["font-size"]).toBe("6%");
    expect(doc.labels.groups.city.attrs["font-size"]).toBe("5%");
    expect(doc.labels.groups.town.attrs["font-size"]).toBe("4.5%");
    expect(doc.temperature.attrs["font-size"]).toBe("8px");
    expect(doc.scaleBar.attrs["font-size"]).toBe("10px");
    expect(stylesSchema.safeParse(doc).success).toBe(true);
  });

  test("a pre-v1.154 record folds its mirrored fields into the attrs", () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.map = { attrs: { filter: null }, options: { dataFilter: "sepia" } };
    doc.ocean.options = { pattern: "./images/waves.png", patternOpacity: 0.4, bands: doc.ocean.options.bands };
    delete doc.ocean.groups.pattern;
    doc.states.groups.statesHalo = { attrs: { opacity: 0.4, filter: null }, options: { width: 12 } };
    doc.military.options = { fontSize: 8, boxSize: 4 };
    doc.labels.attrs = { "font-size": "100px" };
    doc.coordinates.options = { fontSize: 14 };
    doc.rulers.options = { fontSize: 24 };
    doc.legend.options = { fontSize: 11, x: 50, y: 60, columns: 5 };
    doc.temperature.attrs = { ...doc.temperature.attrs, opacity: 0.7 };
    doc.markets.options = { size: 3, fontSize: 6, icon: "x" };
    doc.markers.options = { rescale: 1 };
    doc.coastline.groups.sea_island.options = { autoFilter: 1 };
    doc.compass.attrs["shape-rendering"] = "optimizespeed";
    doc.heightmap.groups.landHeights.options.render = true;
    normalizeStyles(doc);
    expect(doc.map).toEqual({ attrs: { filter: "url(#filter-sepia)" } });
    expect(doc.ocean.groups.pattern).toEqual({ attrs: { href: "./images/waves.png", opacity: 0.4 } });
    expect(doc.ocean.options).toEqual({ bands: Styles.defaults.ocean.options.bands });
    expect(doc.states.groups.statesHalo).toEqual({ attrs: { opacity: 0.4, filter: null, "stroke-width": 12 } });
    expect(doc.military.attrs["font-size"]).toBeUndefined();
    expect(doc.military.options).toEqual({ boxSize: 4 });
    expect(doc.labels.attrs).toBeUndefined();
    expect(doc.coordinates.attrs["font-size"]).toBe("14px");
    expect(doc.coordinates.options).toBeUndefined();
    expect(doc.rulers.attrs["font-size"]).toBe("24px");
    expect(doc.legend.attrs["font-size"]).toBe("11px");
    expect(doc.legend.options).toEqual({ columns: 5 });
    expect(doc.temperature.attrs.opacity).toBeUndefined();
    expect(doc.temperature.attrs["stroke-opacity"]).toBe(0.7);
    expect(doc.markets.options).toEqual({ size: 3, iconSize: 6, icon: "x" });
    expect(doc.markers.options).toBeUndefined();
    expect(doc.coastline.groups.sea_island.options).toBeUndefined();
    expect(doc.compass.attrs["shape-rendering"]).toBeUndefined();
    expect(doc.heightmap.groups.landHeights.options.render).toBeUndefined();
    expect(stylesSchema.safeParse(doc).success).toBe(true);
  });
});

describe("parseStyles", () => {
  test("repairs an empty icons groups record without changing other styles", () => {
    const doc = Styles.parse(Styles.defaults);
    doc.burgIcons.groups = {};

    const parsed = Styles.parse(doc);

    expect(parsed.burgIcons.groups).toEqual(Styles.defaults.burgIcons.groups);
    expect(doc.burgIcons.groups).toEqual({});
    expect(parsed.burgIcons.groups).not.toBe(Styles.defaults.burgIcons.groups);
  });

  test("older oceans gain disabled bands and Cinderwood bands survive serialization", () => {
    const doc = structuredClone(Styles.defaults);
    const { bands: _, ...options } = doc.ocean.options;
    const parsed = Styles.parse({ ...doc, ocean: { ...doc.ocean, options } });
    expect(parsed.ocean.options.bands.render).toBe(false);
    expect(parsed.ocean.groups.base).toEqual(doc.ocean.groups.base);
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
    delete doc.heightmap.groups.landHeights.options.contours;
    delete doc.heightmap.groups.oceanHeights.options.contours;
    doc.heightmap.groups.landHeights.options.scheme = "monochrome";
    doc.heightmap.groups.landHeights.attrs.opacity = 0.7;
    const parsed = Styles.parse(doc);
    expect(parsed.heightmap.groups.landHeights.options.contours.mode).toBe("off");
    expect(parsed.heightmap.groups.oceanHeights.options.contours.mode).toBe("off");
    expect(parsed.heightmap.groups.landHeights.options.scheme).toBe("monochrome");
    expect(parsed.heightmap.groups.landHeights.attrs.opacity).toBe(0.7);
  });

  test("older heightmap styles gain disabled hachures", () => {
    const doc = structuredClone(Styles.defaults);
    const { hachures: _, ...options } = doc.heightmap.groups.landHeights.options;
    const landHeights = { ...doc.heightmap.groups.landHeights, options };
    const parsed = Styles.parse({ ...doc, heightmap: { ...doc.heightmap, landHeights } });
    expect(parsed.heightmap.groups.landHeights.options.hachures).toEqual(
      Styles.defaults.heightmap.groups.landHeights.options.hachures
    );
    expect(parsed.heightmap.groups.landHeights.options.hachures.mode).toBe("off");
  });

  test("older styles gain disabled coastal waves", () => {
    const doc = structuredClone(Styles.defaults);
    const { oceanWaves: _, ...groups } = doc.ocean.groups;
    const parsed = Styles.parse({ ...doc, ocean: { ...doc.ocean, groups } });
    expect(parsed.ocean.groups.oceanWaves).toEqual(Styles.defaults.ocean.groups.oceanWaves);
  });

  test("existing coastal-wave styles default to Waves without losing their settings", () => {
    const doc = structuredClone(Styles.defaults);
    const { type: _, ...options } = { ...doc.ocean.groups.oceanWaves.options, render: true, density: 1.5 };
    const oceanWaves = { ...doc.ocean.groups.oceanWaves, options };
    const legacy = { ...doc, ocean: { ...doc.ocean, groups: { ...doc.ocean.groups, oceanWaves } } };
    expect(Styles.parse(legacy).ocean.groups.oceanWaves.options).toEqual({ ...options, type: "waves" });
  });

  test("coastal wave settings round-trip through serialized styles", () => {
    const doc = Styles.parse(Styles.defaults);
    doc.ocean.groups.oceanWaves.options = {
      render: true,
      type: "lines",
      density: 1.4,
      length: 2,
      reach: 7,
      halo: 0.15
    };
    doc.ocean.groups.oceanWaves.attrs = {
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
    doc.heightmap.groups.landHeights.options.contours = {
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
    doc.heightmap.groups.landHeights.options.contours.mode = "overlay";
    doc.heightmap.groups.landHeights.options.contours.interval = 0;
    const parsed = Styles.parse(doc);
    expect(parsed.heightmap.groups.landHeights.options.contours.interval).toBe(5);
    expect(parsed.heightmap.groups.landHeights.options.contours.mode).toBe("overlay");
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
    expect(Styles.defaults.ocean.groups.oceanLayers.attrs.filter).toBeNull();
    expect(Styles.defaults.ocean.groups.oceanLayers.options.outline).toBe("-6,-3,-1");
    expect(Styles.defaults.ocean.groups.pattern.attrs).toEqual({ href: "./images/pattern1.png", opacity: 0.2 });
  });

  test("label groups default font-weight to unset", () => {
    expect(Styles.defaults.labels.groups.capital.attrs["font-weight"]).toBeNull();
  });
});

describe("per-attribute repair", () => {
  test("an invalid attribute falls back alone, not with its whole layer", () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.temperature.attrs["stroke-opacity"] = 0.6;
    doc.temperature.attrs["font-size"] = null; // non-nullable in the schema
    const parsed = Styles.parse(doc);
    expect(parsed.temperature.attrs["stroke-opacity"]).toBe(0.6);
    expect(parsed.temperature.attrs["font-size"]).toBe(Styles.defaults.temperature.attrs["font-size"]);
  });

  test("a label group with no stroke width stores 0: unset would render at the SVG default of 1", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = structuredClone(Styles.defaults) as any;
    doc.labels.groups.capital.attrs.stroke = "#ffffff";
    doc.labels.groups.capital.attrs["stroke-width"] = null; // pre-1.154 presets
    delete doc.labels.groups.city.attrs["stroke-width"];
    const parsed = Styles.parse(doc);
    expect(parsed.labels.groups.capital.attrs.stroke).toBe("#ffffff");
    expect(parsed.labels.groups.capital.attrs["stroke-width"]).toBe(0);
    expect(parsed.labels.groups.city.attrs["stroke-width"]).toBe(0);
    warn.mockRestore();
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
  test("Cinderwood port settings survive saving and loading for every burg group", () => {
    const parsed = Styles.parse(cinderwood);
    const restored = Styles.parse(JSON.parse(JSON.stringify(parsed)));
    const groups = restored.burgIcons.groups;
    expect(Object.keys(groups).sort()).toEqual(Object.keys(parsed.burgIcons.groups).sort());
    const icons = new Set<string>();
    for (const [name, group] of Object.entries(groups)) {
      const anchor = group.groups.anchors;
      expect(anchor.options).toEqual(cinderwood.burgIcons.groups[name].groups.anchors.options);
      const file = `src/assets/icons/${anchor.options.icon.slice(1).replace("-", "/")}.svg`; // the port set's file
      expect(readFileSync(file, "utf8").includes("<svg")).toBe(true);
      expect(Number.isFinite(anchor.options.dx)).toBe(true);
      expect(Number.isFinite(anchor.options.dy)).toBe(true);
      icons.add(anchor.options.icon);
    }
    expect(icons).toEqual(new Set(["#ports-anchor", "#ports-harbor"])); // shifted anchors on big burgs, harbors on small
  });
});

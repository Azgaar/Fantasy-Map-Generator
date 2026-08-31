import { describe, expect, test, vi } from "vitest";
import { Styles } from "./styles";
import { stylesSchema } from "./styles-schema";

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
    expect(Styles.defaults.ocean.options).toEqual({ pattern: "./images/pattern1.png", patternOpacity: 0.2 });
  });

  test("labels base font-size is the css length the registry stamps", () => {
    expect(Styles.defaults.labels.attrs["font-size"]).toBe("100px");
  });
});

describe("per-attribute repair", () => {
  test("an invalid attribute falls back alone, not with its whole layer", () => {
    const doc = structuredClone(Styles.defaults) as any;
    doc.provinces.attrs.opacity = 0.6;
    doc.provinces.attrs["font-family"] = null; // non-nullable in the schema
    const parsed = Styles.parse(doc);
    expect(parsed.provinces.attrs.opacity).toBe(0.6);
    expect(parsed.provinces.attrs["font-family"]).toBe(Styles.defaults.provinces.attrs["font-family"]);
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

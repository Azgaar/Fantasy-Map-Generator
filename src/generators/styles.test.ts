import { describe, expect, test, vi } from "vitest";
import { Styles } from "./styles";
import { DEFAULT_STYLES } from "./styles-defaults";
import { stylesSchema } from "./styles-schema";

describe("stylesSchema", () => {
  test("the default styles are valid — defaults and schema cannot drift", () => {
    expect(stylesSchema.safeParse(DEFAULT_STYLES).success).toBe(true);
  });

  test("unknown keys are rejected by the strict schemas", () => {
    const routes = structuredClone(DEFAULT_STYLES.routes) as Record<string, unknown>;
    routes.bogus = {};
    expect(stylesSchema.shape.routes.safeParse(routes).success).toBe(false);
  });
});

describe("parseStyles", () => {
  test("a valid document round-trips unchanged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(Styles.parse(structuredClone(DEFAULT_STYLES))).toEqual(DEFAULT_STYLES);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("an invalid layer falls back to the default with one warning; the rest survive", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const doc = structuredClone(DEFAULT_STYLES);
    doc.rivers.attrs.fill = "#123456";
    (doc as Record<string, unknown>).markers = { attrs: { opacity: "not a number" } };
    const parsed = Styles.parse(doc);
    expect(parsed.rivers.attrs.fill).toBe("#123456");
    expect(parsed.markers).toEqual(DEFAULT_STYLES.markers);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test("garbage input yields the complete defaults", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const parsed = Styles.parse("nonsense");
    expect(parsed).toEqual(DEFAULT_STYLES);
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(stylesSchema.shape).sort());
    warn.mockRestore();
  });

  test("null survives — it means the attribute is not set", () => {
    const doc = structuredClone(DEFAULT_STYLES);
    doc.rivers.attrs.filter = null;
    expect(Styles.parse(doc).rivers.attrs.filter).toBeNull();
  });
});

describe("schema reconciliation", () => {
  test("ocean filter and outline live under the oceanLayers subgroup", () => {
    expect(DEFAULT_STYLES.ocean.oceanLayers.attrs.filter).toBeNull();
    expect(DEFAULT_STYLES.ocean.oceanLayers.options.outline).toBe("-6,-3,-1");
    expect(DEFAULT_STYLES.ocean.options).toEqual({ pattern: "./images/pattern1.png", patternOpacity: 0.2 });
  });

  test("labels base font-size is the css length the registry stamps", () => {
    expect(DEFAULT_STYLES.labels.attrs["font-size"]).toBe("100px");
  });
});

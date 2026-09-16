// A field cannot exist without UI: every leaf of the styles schema either resolves to a control the
// editor can build or is marked hidden. Fails in the PR that adds the field
import { describe, expect, test } from "vitest";
import { type ControlKind, SchemaForm } from "@/components/shared/schema-form";
import { styleMeta, stylesSchema } from "./styles-schema";

const STANDARD: ControlKind[] = ["checkbox", "select", "slider", "number", "text", "color"];
// the kinds the style editor registers (src/controllers/style-editor/controls.ts)
const CUSTOM: ControlKind[] = [
  "filter",
  "mask",
  "font",
  "unit",
  "blur",
  "transform",
  "labelStyle",
  "percent",
  "scheme",
  "texture",
  "icon",
  "emoji",
  "vignettePreset",
  "mapFilter"
];
const KNOWN = new Set<string>([...STANDARD, ...CUSTOM]);

const fields = SchemaForm.walk(stylesSchema, styleMeta, { records: true });
const byPath = Object.fromEntries(fields.map(field => [field.spec.path.join("."), field]));

describe("styles schema metadata", () => {
  test("every leaf resolves to a known control kind or is hidden", () => {
    const unknown = fields.filter(({ spec, hidden }) => !hidden && !KNOWN.has(spec.kind));
    expect(unknown.map(({ spec }) => `${spec.path.join(".")}: ${spec.kind}`)).toEqual([]);
  });

  test("the walk reaches the grouped records and the nested subgroups", () => {
    expect(byPath["labels.groups.*.attrs.font-family"].spec.kind).toBe("font");
    expect(byPath["burgIcons.anchors.groups.*.options.icon"].spec.kind).toBe("icon");
    expect(byPath["lakes.groups.*.options.embellishment"].spec.kind).toBe("select");
    expect(byPath["states.statesHalo.attrs.filter"].spec.kind).toBe("blur");
    expect(byPath["heightmap.oceanHeights.options.contours.mode"].spec.kind).toBe("select");
  });

  test("the shared constants carry their control and null semantics", () => {
    expect(byPath["rivers.attrs.fill"].spec).toMatchObject({ kind: "color", nullable: true });
    expect(byPath["rivers.attrs.opacity"].spec).toMatchObject({ kind: "slider", min: 0, max: 1, nullAs: 1 });
    expect(byPath["zones.attrs.stroke-width"].spec).toMatchObject({ kind: "slider", min: 0, max: 10, nullAs: 0 });
    expect(byPath["zones.attrs.filter"].spec.kind).toBe("filter");
    expect(byPath["zones.attrs.mask"].spec).toMatchObject({ kind: "select", label: "Clip to" });
    expect(byPath["fogging.attrs.mask"].spec.kind).toBe("text");
    expect(byPath["temperature.attrs.font-size"].spec.kind).toBe("unit");
    expect(byPath["vignette.options.x"].spec.kind).toBe("percent");
    expect(byPath["compass.compassRose.attrs.transform"].spec.kind).toBe("transform");
    expect(byPath["labels.groups.*.attrs.style"].spec.kind).toBe("labelStyle");
    expect(byPath["labels.groups.*.attrs.font-weight"].spec).toMatchObject({
      kind: "select",
      options: [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    });
    expect(byPath["heightmap.landHeights.options.scheme"].spec.kind).toBe("scheme");
    expect(byPath["texture.options.href"].spec.kind).toBe("texture");
    expect(byPath["markets.options.icon"].spec.kind).toBe("emoji");
    expect(byPath["map.options.dataFilter"].spec.kind).toBe("mapFilter");
    expect(byPath["markers.options.rescale"].spec).toMatchObject({ kind: "checkbox", valueType: "number" });
  });

  test("the fields the editor never shows are hidden", () => {
    for (const path of [
      "coastline.sea_island.options.autoFilter",
      "labels.attrs.font-size",
      "map.attrs.filter",
      "states.statesHalo.attrs.stroke-width",
      "military.options.fontSize",
      "heightmap.landHeights.options.render",
      "legend.options.x"
    ]) {
      expect(byPath[path]?.hidden, path).toBe(true);
    }
    expect(byPath["heightmap.oceanHeights.options.render"].hidden).toBe(false);
    expect(byPath["labels.groups.*.attrs.font-size"].hidden).toBe(false);
  });

  test("labels come from the meta or the key", () => {
    expect(byPath["rivers.attrs.stroke-width"]?.spec.label ?? byPath["zones.attrs.stroke-width"].spec.label).toBe(
      "Stroke width"
    );
    expect(byPath["ocean.options.patternOpacity"].spec.label).toBe("Pattern opacity");
    expect(byPath["burgIcons.anchors.groups.*.options.dx"].spec.label).toBe("Shift x");
    expect(byPath["heightmap.landHeights.options.skip"].spec.label).toBe("Reduce layers");
  });

  test("tips survive on the fields the classic tab described", () => {
    expect(byPath["relief.options.density"].spec.tip).toMatch(/regenerated/);
    expect(byPath["grid.options.scale"].spec.tip).toBe("Set grid cells scale multiplier");
  });
});

// A field cannot exist without UI: every leaf of the styles schema either resolves to a control the
// editor can build or is marked hidden. Fails in the PR that adds the field
import { describe, expect, test } from "vitest";
import type { z } from "zod";
import { SchemaForm } from "@/components/shared/schema-form";
import type { StandardControl, StyleControl } from "@/types/styles";
import { styleMeta, stylesSchema } from "./styles-schema";

const STANDARD: StandardControl[] = ["checkbox", "select", "slider", "number", "text", "color", "percent", "px"];
// the kinds the style editor registers (src/controllers/style-editor/controls.ts)
const CUSTOM: Exclude<StyleControl, StandardControl>[] = [
  "filter",
  "font",
  "blur",
  "dash",
  "transform",
  "labelStyle",
  "scheme",
  "texture",
  "icon",
  "emoji"
];
const KNOWN = new Set<string>([...STANDARD, ...CUSTOM]);

const fields = SchemaForm.walk(stylesSchema, styleMeta);
const byPath = Object.fromEntries(fields.map(field => [field.spec.path.join("."), field]));

/** The rule the record follows at every level: a node holds attrs, options and groups, and nothing else */
const NODE_KEYS = new Set(["attrs", "options", "groups"]);
function checkNode(schema: z.ZodType, path: string): void {
  const { leaf } = SchemaForm.unwrap(schema, styleMeta);
  const internals = leaf as unknown as { def?: { type?: string; valueType?: z.ZodType } };
  if (internals.def?.type !== "object") return;

  for (const [key, child] of Object.entries((leaf as z.ZodObject).shape as Record<string, z.ZodType>)) {
    expect(NODE_KEYS.has(key), `${path}.${key} is not attrs, options or groups`).toBe(true);
    if (key !== "groups") continue;

    const { leaf: groups } = SchemaForm.unwrap(child, styleMeta);
    const groupDef = (groups as unknown as { def?: { type?: string; valueType?: z.ZodType }; shape?: object }).def;
    if (groupDef?.type === "record" && groupDef.valueType) {
      checkNode(groupDef.valueType, `${path}.groups.*`);
      continue;
    }
    for (const [name, entry] of Object.entries((groups as z.ZodObject).shape as Record<string, z.ZodType>)) {
      checkNode(entry, `${path}.groups.${name}`);
    }
  }
}

describe("styles schema metadata", () => {
  test("the record is only ever attrs, options and groups, recursively", () => {
    for (const [element, schema] of Object.entries(stylesSchema.shape as Record<string, z.ZodType>)) {
      checkNode(schema, element);
    }
  });

  test("every leaf resolves to a known control kind or is hidden", () => {
    const unknown = fields.filter(({ spec, hidden }) => !hidden && !KNOWN.has(spec.kind));
    expect(unknown.map(({ spec }) => `${spec.path.join(".")}: ${spec.kind}`)).toEqual([]);
  });

  test("the walk reaches the grouped records and the nested subgroups", () => {
    expect(byPath["labels.groups.*.attrs.font-family"].spec.kind).toBe("font");
    expect(byPath["burgIcons.groups.*.groups.anchors.options.icon"].spec.kind).toBe("icon");
    expect(byPath["lakes.groups.*.options.embellishment"].spec.kind).toBe("select");
    expect(byPath["states.groups.statesHalo.attrs.filter"].spec.kind).toBe("blur");
    expect(byPath["heightmap.groups.oceanHeights.options.contours.mode"].spec.kind).toBe("select");
  });

  test("the shared constants carry their control and null semantics", () => {
    expect(byPath["rivers.attrs.fill"].spec).toMatchObject({ kind: "color", nullable: true });
    expect(byPath["rivers.attrs.opacity"].spec).toMatchObject({ kind: "slider", min: 0, max: 1, nullAs: 1 });
    expect(byPath["zones.attrs.stroke-width"].spec).toMatchObject({ kind: "slider", min: 0, max: 10, nullAs: 0 });
    expect(byPath["zones.attrs.filter"].spec.kind).toBe("filter");
    expect(byPath["zones.attrs.stroke-dasharray"].spec.kind).toBe("dash");
    expect(byPath["zones.attrs.mask"].spec).toMatchObject({ kind: "select", label: "Clip" });
    expect(byPath["fogging.attrs.mask"].hidden).toBe(true);
    expect(byPath["temperature.attrs.font-size"].spec).toMatchObject({ kind: "px", min: 1, max: 40 });
    expect(byPath["labels.groups.*.attrs.font-size"].spec).toMatchObject({ kind: "percent", group: "Font" });
    expect(byPath["vignette.options.x"].spec).toMatchObject({ kind: "percent", label: "Position x", min: 0, max: 100 });
    expect(byPath["compass.groups.compassRose.attrs.transform"].spec.kind).toBe("transform");
    expect(byPath["labels.groups.*.attrs.style"].spec.kind).toBe("labelStyle");
    expect(byPath["labels.groups.*.attrs.font-weight"].spec).toMatchObject({
      kind: "select",
      options: [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    });
    expect(byPath["heightmap.groups.landHeights.options.scheme"].spec.kind).toBe("scheme");
    expect(byPath["texture.options.href"].spec.kind).toBe("texture");
    expect(byPath["markets.options.icon"].spec.kind).toBe("emoji");
    expect(byPath["map.attrs.filter"].spec).toMatchObject({ kind: "select", nullable: true, label: "Filter" });
    expect(byPath["ocean.groups.pattern.attrs.href"].spec).toMatchObject({ kind: "select", label: "Image" });
    expect(byPath["legend.attrs.font-size"].spec).toMatchObject({ kind: "px", group: undefined, label: "Size" });
    expect(byPath["states.groups.statesHalo.attrs.stroke-width"].spec).toMatchObject({
      kind: "slider",
      min: 0,
      max: 30
    });
  });

  test("the fields the editor never shows are hidden", () => {
    for (const path of [
      "grid.attrs.transform",
      "compass.attrs.transform",
      "vignette.attrs.mask",
      "fogging.attrs.mask"
    ]) {
      expect(byPath[path]?.hidden, path).toBe(true);
    }
    expect(byPath["heightmap.groups.oceanHeights.options.render"].hidden).toBe(false);
    expect(byPath["labels.groups.*.attrs.font-size"].hidden).toBe(false);
  });

  test("labels come from the meta or the key, and read under their group or row", () => {
    expect(byPath["zones.attrs.stroke-width"].spec).toMatchObject({ group: "Stroke", label: "Width" });
    expect(byPath["temperature.attrs.stroke-opacity"].spec).toMatchObject({ group: "Stroke", label: "Opacity" });
    expect(byPath["burgIcons.groups.*.groups.anchors.options.dx"].spec).toMatchObject({
      kind: "slider",
      label: "Shift x",
      nullAs: 0
    });
    expect(byPath["heightmap.groups.landHeights.options.skip"].spec.label).toBe("Reduce layers");
    expect(byPath["heightmap.groups.landHeights.options.relax"].spec.label).toBe("Simplify");
  });

  test("no label needs a second line: the column holds 13 characters", () => {
    const long = fields.filter(({ spec, hidden, gate }) => !hidden && !gate && spec.label.length > 13);
    expect(long.map(({ spec }) => `${spec.path.join(".")}: ${spec.label}`)).toEqual([]);
  });

  test("tips survive on the fields the classic tab described", () => {
    expect(byPath["relief.options.density"].spec.tip).toMatch(/regenerated/);
    expect(byPath["grid.options.scale"].spec.tip).toBe("Set grid cells scale multiplier");
  });
});

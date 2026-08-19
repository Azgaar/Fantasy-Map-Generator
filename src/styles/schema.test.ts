import { describe, expect, test, vi } from "vitest";
import { Layers } from "@/components/layers";
import { parseStyleData } from "./schema";

// Re-derives DECLARED_CHILDREN by re-running parseStyleData against every registry-declared
// child and checking it survives (rather than reaching into the module's private table),
// so this catches drift whichever direction it happens: registry gains/loses a child, or the
// schema's static duplicate falls out of sync.
describe("DECLARED_CHILDREN stays in sync with the layers registry", () => {
  for (const layer of Layers.all) {
    if (layer.children.length === 0) continue;
    // the icons layer's two children ("burgIcons"/"anchors") are containers the applier resolves,
    // not style-tree children: each is a style layer of its own - covered separately below.
    if (layer.id === "burgIcons") continue;
    for (const child of layer.children) {
      test(`${layer.id}.${child.id} accepts attrs`, () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const data = parseStyleData({ [layer.id]: { children: { [child.id]: { attrs: { opacity: 1 } } } } });
        expect(
          (data as Record<string, { children?: Record<string, { attrs?: unknown }> }>)[layer.id]?.children?.[child.id]
            ?.attrs
        ).toEqual({
          opacity: 1
        });
        expect(warn).not.toHaveBeenCalledWith(expect.stringContaining(`child "${layer.id}.${child.id}"`));
        warn.mockRestore();
      });
    }
  }

  test("the icons layer's two containers are the `burgIcons`/`anchors` style layers", () => {
    const burgIconsLayer = Layers.get("burgIcons");
    expect(burgIconsLayer.children.map(child => child.id).sort()).toEqual(["anchors", "burgIcons"]);
  });

  test.each(["burgIcons", "anchors"])("a burg-type group under %s accepts attrs and size", layerId => {
    const data = parseStyleData({
      [layerId]: { children: { capital: { attrs: { fill: "#fff" }, options: { size: 2 } } } }
    });
    const group = (data as Record<string, { children?: Record<string, { attrs?: unknown; options?: unknown }> }>)[
      layerId
    ]?.children?.capital;
    expect(group?.attrs).toEqual({ fill: "#fff" });
    expect(group?.options).toEqual({ size: 2 });
  });
});

describe("parseStyleData", () => {
  test("a registry-declared child with no ChildOptions entry is attrs-only, not dropped", () => {
    // states.statesBody has no options schema in childOptionsSchema, only borders.stateBorders-
    // style presentation; it must still survive as long as it's declared in the registry.
    const data = parseStyleData({ states: { children: { statesBody: { attrs: { opacity: 0.4, filter: null } } } } });
    expect(data.states?.children?.statesBody?.attrs).toEqual({ opacity: 0.4, filter: null });
  });

  test("an undeclared child on a non-dynamic layer still drops with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = parseStyleData({ states: { children: { notAChild: { attrs: { opacity: 1 } } } } });
    expect(data.states?.children?.notAChild).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('child "states.notAChild"'));
    warn.mockRestore();
  });

  test("coerces a numeric stroke-dasharray to a string (SVG accepts bare numbers)", () => {
    const data = parseStyleData({ routes: { children: { roads: { attrs: { "stroke-dasharray": 5 } } } } });
    expect(data.routes?.children?.roads?.attrs?.["stroke-dasharray"]).toBe("5");
  });

  test("stroke-dasharray still preserves an explicit null (remove attribute)", () => {
    const data = parseStyleData({ routes: { attrs: { "stroke-dasharray": null } } });
    expect(data.routes?.attrs?.["stroke-dasharray"]).toBeNull();
  });

  test("heightmap render option matches the renderer's own Boolean(+v) coercion", () => {
    const falsy = parseStyleData({ heightmap: { children: { oceanHeights: { options: { render: "0" } } } } });
    expect(falsy.heightmap?.children?.oceanHeights?.options).toMatchObject({ render: false });

    const truthy = parseStyleData({ heightmap: { children: { oceanHeights: { options: { render: 1 } } } } });
    expect(truthy.heightmap?.children?.oceanHeights?.options).toMatchObject({ render: true });
  });

  test("accepts a valid tree and preserves nulls (null = remove attribute)", () => {
    const data = parseStyleData({
      routes: {
        attrs: { opacity: 0.9, filter: null },
        children: { roads: { attrs: { stroke: "#d06324", "stroke-width": 0.7 } } }
      }
    });
    expect(data.routes?.attrs?.filter).toBeNull();
    expect(data.routes?.children?.roads?.attrs?.stroke).toBe("#d06324");
  });

  test("drops unknown attr, option key and layer id with a warning each", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = parseStyleData({
      rivers: { attrs: { "not-an-attr": 1 } },
      markers: { options: { rescale: 1, bogus: true } },
      notALayer: {}
    });
    expect(data.rivers?.attrs).toEqual({});
    expect(data.markers?.options).toEqual({ rescale: 1 });
    expect((data as Record<string, unknown>).notALayer).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  test("prototype-named keys are dropped with a warning, never resolved to a prototype member", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = parseStyleData({
      map: { attrs: { toString: 1, constructor: 2 }, options: { hasOwnProperty: 3 } },
      burgIcons: { children: { capital: { options: { valueOf: 4 } } } }
    });
    expect(data.map?.attrs).toEqual({});
    expect(data.map?.options).toEqual({});
    expect(data.burgIcons?.children?.capital?.options).toEqual({});
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });

  test("label group options are schema-gated: fontSize survives, a bogus key drops with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const data = parseStyleData({ labels: { children: { capital: { options: { fontSize: 12, bogus: true } } } } });
    expect(data.labels?.children?.capital?.options).toEqual({ fontSize: 12 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("labels.capital.bogus"));
    warn.mockRestore();
  });

  test("coerces numeric strings on numeric fields (harvested DOM values are strings)", () => {
    const data = parseStyleData({ rivers: { attrs: { opacity: "0.5", "stroke-width": "1.2" } } });
    expect(data.rivers?.attrs?.opacity).toBe(0.5);
  });

  test("rejects a non-object", () => {
    expect(() => parseStyleData("nope")).toThrow();
  });
});

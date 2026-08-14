import { beforeEach, describe, expect, test } from "vitest";
import { LAYER_IDS } from "./schema";
import { deepMerge, ensureStyleShape, getLayerOptions, getStyleNode, setOptions, setPresentation } from "./store";

beforeEach(() => {
  (globalThis as any).style = ensureStyleShape({ layers: {} });
});

describe("style store", () => {
  test("ensureStyleShape fills every layer id", () => {
    expect(Object.keys(style.layers).sort()).toEqual([...LAYER_IDS].sort());
  });

  test("getStyleNode materializes child chain on demand", () => {
    const node = getStyleNode("routes", "roads");
    node.presentation = { stroke: "#000" };
    expect(style.layers.routes?.children?.roads.presentation?.stroke).toBe("#000");
  });

  test("setPresentation writes through to the object", () => {
    setPresentation({ layerId: "rivers" }, "fill", "#5d97bb");
    expect(style.layers.rivers?.presentation?.fill).toBe("#5d97bb");
  });

  test("setOptions merges without clobbering siblings", () => {
    setOptions({ layerId: "terrain" }, { set: "gray" });
    setOptions({ layerId: "terrain" }, { size: 2 });
    expect(getLayerOptions("terrain")).toEqual({ set: "gray", size: 2 });
  });
});

describe("deepMerge", () => {
  test("override wins on conflicting presentation keys", () => {
    const base = { rivers: { presentation: { fill: "#111", opacity: 1 } } };
    const override = { rivers: { presentation: { fill: "#fff" } } };
    expect(deepMerge(base, override)).toEqual({ rivers: { presentation: { fill: "#fff", opacity: 1 } } });
  });

  test("children merge recursively instead of one side replacing the other", () => {
    const base = { routes: { children: { roads: { presentation: { stroke: "#000" } } } } };
    const override = { routes: { children: { trails: { presentation: { stroke: "#111" } } } } };
    expect(deepMerge(base, override)).toEqual({
      routes: {
        children: { roads: { presentation: { stroke: "#000" } }, trails: { presentation: { stroke: "#111" } } }
      }
    });
  });

  test("an explicit null override survives (remove-attribute semantics)", () => {
    const base = { map: { presentation: { filter: "url(#x)" } } };
    const override = { map: { presentation: { filter: null } } };
    expect(deepMerge(base, override)).toEqual({ map: { presentation: { filter: null } } });
  });
});

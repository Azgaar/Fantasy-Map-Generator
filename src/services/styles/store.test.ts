import { beforeEach, describe, expect, test } from "vitest";
import { LAYER_IDS } from "./schema";
import { ensureStyleShape, getLayerOptions, getStyleNode, setOptions, setPresentation } from "./store";

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

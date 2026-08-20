import { afterEach, describe, expect, it, vi } from "vitest";
import { getMinimapViewport } from "./map-minimap";

describe("getMinimapViewport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("converts the editor camera into map-space viewport bounds", () => {
    vi.stubGlobal("graphWidth", 1000);
    vi.stubGlobal("graphHeight", 500);
    vi.stubGlobal("svgWidth", 500);
    vi.stubGlobal("svgHeight", 250);
    vi.stubGlobal("scale", 2);
    vi.stubGlobal("viewX", -400);
    vi.stubGlobal("viewY", -100);

    expect(getMinimapViewport()).toEqual({ height: 125, width: 250, x: 200, y: 50 });
  });

  it("clips the viewport at the world edge", () => {
    vi.stubGlobal("graphWidth", 1000);
    vi.stubGlobal("graphHeight", 500);
    vi.stubGlobal("svgWidth", 500);
    vi.stubGlobal("svgHeight", 250);
    vi.stubGlobal("scale", 2);
    vi.stubGlobal("viewX", -1900);
    vi.stubGlobal("viewY", -900);

    expect(getMinimapViewport()).toEqual({ height: 50, width: 50, x: 950, y: 450 });
  });
});

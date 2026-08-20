import { afterEach, describe, expect, it, vi } from "vitest";
import { getClampedMinimapCenter, getMinimapViewport } from "./map-minimap";

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

  it("keeps corner navigation inside the world at maximum zoom", () => {
    vi.stubGlobal("graphWidth", 1000);
    vi.stubGlobal("graphHeight", 500);
    vi.stubGlobal("svgWidth", 500);
    vi.stubGlobal("svgHeight", 250);

    expect(getClampedMinimapCenter(0, 0, 20)).toEqual([12.5, 6.25]);
    expect(getClampedMinimapCenter(1000, 500, 20)).toEqual([987.5, 493.75]);
  });

  it("centers an oversized viewport instead of allowing an invalid boundary", () => {
    vi.stubGlobal("graphWidth", 1000);
    vi.stubGlobal("graphHeight", 500);
    vi.stubGlobal("svgWidth", 500);
    vi.stubGlobal("svgHeight", 250);

    expect(getClampedMinimapCenter(0, 0, 0.25)).toEqual([500, 250]);
  });
});

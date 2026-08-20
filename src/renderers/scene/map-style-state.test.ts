import { describe, expect, it } from "vitest";
import type { Style } from "@/types/style";
import { getMapRendererStyle, resetMapRendererStyle } from "./map-style-state";
import { DEFAULT_PIXI_MAP_STYLE } from "./styles";

describe("map renderer style state", () => {
  it("initializes serialized application state without sharing mutable defaults", () => {
    const appStyle = {} as Pick<Style, "mapRenderer">;
    const first = getMapRendererStyle(appStyle);
    first.landmass.color = "#000000";

    expect(appStyle.mapRenderer).toEqual(DEFAULT_PIXI_MAP_STYLE);
    expect(getMapRendererStyle(appStyle).landmass.color).toBe(DEFAULT_PIXI_MAP_STYLE.landmass.color);
  });

  it("preserves stored semantic styles and can reset them explicitly", () => {
    const stored = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    stored.ocean.color = "#123456";
    const appStyle = { mapRenderer: stored };

    expect(getMapRendererStyle(appStyle).ocean.color).toBe("#123456");
    expect(resetMapRendererStyle(appStyle).ocean.color).toBe(DEFAULT_PIXI_MAP_STYLE.ocean.color);
  });

  it("hydrates newly introduced semantic layers in an older partial renderer style", () => {
    const appStyle = {
      mapRenderer: { states: { fallbackColor: "#123456", opacity: 0.25 } } as Style["mapRenderer"]
    };

    const hydrated = getMapRendererStyle(appStyle);

    expect(hydrated.states).toEqual({ fallbackColor: "#123456", opacity: 0.25 });
    expect(hydrated.cultures).toEqual(DEFAULT_PIXI_MAP_STYLE.cultures);
    expect(hydrated.religions).toEqual(DEFAULT_PIXI_MAP_STYLE.religions);
    expect(hydrated.provinces).toEqual(DEFAULT_PIXI_MAP_STYLE.provinces);
    expect(appStyle.mapRenderer).toEqual(hydrated);
  });
});

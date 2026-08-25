import { describe, expect, it } from "vitest";
import type { Style } from "@/types/style";
import {
  getCapturedPixiLayerVisibility,
  getStoredPixiLayerVisibility,
  PIXI_LAYER_CONTROL_IDS
} from "./pixi-layer-visibility-state";

describe("Pixi layer visibility state", () => {
  it("captures every toggleable owned layer without discarding future visibility entries", () => {
    const appStyle = { mapLayerVisibility: { texture: false, vignette: false } } as Pick<Style, "mapLayerVisibility">;
    const visibility = getCapturedPixiLayerVisibility(appStyle, controlId => controlId !== "toggleReligions");

    expect(Object.keys(PIXI_LAYER_CONTROL_IDS)).toEqual([
      "biomes",
      "borders",
      "burgIcons",
      "cells",
      "compass",
      "coordinates",
      "cultures",
      "emblems",
      "goods",
      "grid",
      "height",
      "ice",
      "lakes",
      "labels",
      "markers",
      "markets",
      "military",
      "precipitation",
      "population",
      "provinces",
      "relief",
      "religions",
      "rivers",
      "routes",
      "states",
      "temperature",
      "trade",
      "zones"
    ]);
    expect(visibility).toMatchObject({
      emblems: true,
      labels: true,
      religions: false,
      cultures: true,
      states: true,
      vignette: false
    });
    expect(visibility).not.toHaveProperty("texture");
    expect(appStyle.mapLayerVisibility).toEqual({ texture: false, vignette: false });
  });

  it("distinguishes an absent value from an explicitly hidden layer", () => {
    expect(getStoredPixiLayerVisibility({}, "states")).toBeUndefined();
    expect(getStoredPixiLayerVisibility({ mapLayerVisibility: { states: false } }, "states")).toBe(false);
  });
});

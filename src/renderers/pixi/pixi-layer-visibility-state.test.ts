import { describe, expect, it } from "vitest";
import type { Style } from "@/types/style";
import {
  capturePixiLayerVisibility,
  getStoredPixiLayerVisibility,
  PIXI_LAYER_CONTROL_IDS
} from "./pixi-layer-visibility-state";

describe("Pixi layer visibility state", () => {
  it("captures every toggleable owned layer without discarding future visibility entries", () => {
    const appStyle = { mapLayerVisibility: { labels: false } } as Pick<Style, "mapLayerVisibility">;
    capturePixiLayerVisibility(appStyle, controlId => controlId !== "toggleReligions");

    expect(Object.keys(PIXI_LAYER_CONTROL_IDS)).toEqual([
      "biomes",
      "borders",
      "burgIcons",
      "cells",
      "compass",
      "cultures",
      "goods",
      "grid",
      "ice",
      "lakes",
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
    expect(appStyle.mapLayerVisibility).toMatchObject({
      labels: false,
      religions: false,
      cultures: true,
      states: true
    });
  });

  it("distinguishes an absent value from an explicitly hidden layer", () => {
    expect(getStoredPixiLayerVisibility({}, "states")).toBeUndefined();
    expect(getStoredPixiLayerVisibility({ mapLayerVisibility: { states: false } }, "states")).toBe(false);
  });
});

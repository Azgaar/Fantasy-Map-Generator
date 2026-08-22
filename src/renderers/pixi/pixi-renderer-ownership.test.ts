import { describe, expect, it } from "vitest";
import {
  activatePixiRendererOwnership,
  PIXI_OWNED_LAYER_IDS,
  pixiOwnsLayer,
  rendererCoordinator
} from "./pixi-renderer-ownership";

describe("Pixi renderer ownership", () => {
  it("assigns every migrated layer to Pixi without a theme or fallback mode", () => {
    activatePixiRendererOwnership();

    expect(PIXI_OWNED_LAYER_IDS).toEqual([
      "ocean",
      "landmass",
      "lakes",
      "biomes",
      "cells",
      "grid",
      "compass",
      "rivers",
      "relief",
      "religions",
      "cultures",
      "states",
      "provinces",
      "trade",
      "zones",
      "borders",
      "routes",
      "temperature",
      "coastline",
      "ice",
      "goods",
      "markets",
      "precipitation",
      "population",
      "burgIcons",
      "military",
      "markers"
    ]);
    for (const layer of PIXI_OWNED_LAYER_IDS) {
      expect(pixiOwnsLayer(layer)).toBe(true);
      expect(rendererCoordinator.isOwnedBy(layer, "svg")).toBe(false);
    }
  });

  it("leaves not-yet-migrated layers with their current owner", () => {
    activatePixiRendererOwnership();
    expect(rendererCoordinator.isOwnedBy("labels", "svg")).toBe(true);
  });
});

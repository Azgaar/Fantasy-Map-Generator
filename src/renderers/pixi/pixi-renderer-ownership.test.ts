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
      "relief",
      "religions",
      "cultures",
      "states",
      "provinces",
      "borders",
      "coastline"
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

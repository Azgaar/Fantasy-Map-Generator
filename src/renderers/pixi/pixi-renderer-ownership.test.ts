import { describe, expect, it } from "vitest";
import {
  getPixiOwnedLayers,
  isPixiLayerOwned,
  pixiOwnsLayer,
  rendererCoordinator,
  setPixiRendererTheme
} from "./pixi-renderer-ownership";

describe("Pixi renderer ownership", () => {
  it("assigns the state-mode layers to Pixi", () => {
    expect(getPixiOwnedLayers("states")).toEqual(["states", "relief", "borders"]);
  });

  it("assigns only biomes in biome mode", () => {
    expect(getPixiOwnedLayers("biomes")).toEqual(["biomes"]);
  });

  it("does not claim a layer owned only by the other theme", () => {
    expect(isPixiLayerOwned("states", "biomes")).toBe(false);
    expect(isPixiLayerOwned("biomes", "states")).toBe(false);
  });

  it("adapts prototype themes through the production coordinator", () => {
    setPixiRendererTheme("states");
    expect(pixiOwnsLayer("states")).toBe(true);
    expect(pixiOwnsLayer("biomes")).toBe(false);
    expect(rendererCoordinator.isOwnedBy("states", "svg")).toBe(false);

    setPixiRendererTheme("biomes");
    expect(pixiOwnsLayer("states")).toBe(false);
    expect(pixiOwnsLayer("biomes")).toBe(true);

    setPixiRendererTheme(null);
    expect(pixiOwnsLayer("biomes")).toBe(false);
  });
});

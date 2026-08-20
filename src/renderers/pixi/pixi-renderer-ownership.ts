import { MAP_LAYER_REGISTRY } from "../core/layer-registry";
import { RendererCoordinator } from "../core/renderer-coordinator";
import type { PixiMapTheme } from "./pixi-map-renderer";

export type PixiOwnedLayer = "biomes" | "borders" | "relief" | "states";

const OWNED_LAYERS: Record<PixiMapTheme, readonly PixiOwnedLayer[]> = {
  biomes: ["biomes"],
  states: ["states", "relief", "borders"]
};

export const getPixiOwnedLayers = (theme: PixiMapTheme): readonly PixiOwnedLayer[] => OWNED_LAYERS[theme];

export const isPixiLayerOwned = (theme: PixiMapTheme, layer: PixiOwnedLayer): boolean =>
  OWNED_LAYERS[theme].includes(layer);

export const rendererCoordinator = new RendererCoordinator(MAP_LAYER_REGISTRY);

export function setPixiRendererTheme(theme: PixiMapTheme | null): void {
  rendererCoordinator.resetOwners("svg");
  if (theme) rendererCoordinator.setOwners("pixi", getPixiOwnedLayers(theme));
}

export const pixiOwnsLayer = (layer: PixiOwnedLayer): boolean => rendererCoordinator.isOwnedBy(layer, "pixi");

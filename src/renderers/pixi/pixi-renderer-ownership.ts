import type { PixiMapTheme } from "./pixi-map-prototype";

export type PixiOwnedLayer = "biomes" | "borders" | "relief" | "states";

const OWNED_LAYERS: Record<PixiMapTheme, readonly PixiOwnedLayer[]> = {
  biomes: ["biomes"],
  states: ["states", "relief", "borders"]
};

export const getPixiOwnedLayers = (theme: PixiMapTheme): readonly PixiOwnedLayer[] => OWNED_LAYERS[theme];

export const isPixiLayerOwned = (theme: PixiMapTheme, layer: PixiOwnedLayer): boolean =>
  OWNED_LAYERS[theme].includes(layer);

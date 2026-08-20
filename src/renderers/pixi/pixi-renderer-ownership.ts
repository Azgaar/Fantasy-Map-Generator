import { MAP_LAYER_REGISTRY } from "../core/layer-registry";
import { RendererCoordinator } from "../core/renderer-coordinator";

export type PixiOwnedLayer =
  | "biomes"
  | "borders"
  | "coastline"
  | "lakes"
  | "landmass"
  | "ocean"
  | "relief"
  | "states";

export const PIXI_OWNED_LAYER_IDS: readonly PixiOwnedLayer[] = [
  "ocean",
  "landmass",
  "lakes",
  "biomes",
  "relief",
  "states",
  "borders",
  "coastline"
];

export const isPixiOwnedLayer = (layer: string): layer is PixiOwnedLayer =>
  PIXI_OWNED_LAYER_IDS.includes(layer as PixiOwnedLayer);

export const rendererCoordinator = new RendererCoordinator(MAP_LAYER_REGISTRY);

export function activatePixiRendererOwnership(): void {
  rendererCoordinator.resetOwners("svg");
  rendererCoordinator.setOwners("pixi", PIXI_OWNED_LAYER_IDS);
}

export const pixiOwnsLayer = (layer: PixiOwnedLayer): boolean => rendererCoordinator.isOwnedBy(layer, "pixi");

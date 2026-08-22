import { MAP_LAYER_REGISTRY } from "../core/layer-registry";
import { RendererCoordinator } from "../core/renderer-coordinator";

export type PixiOwnedLayer =
  | "biomes"
  | "borders"
  | "burgIcons"
  | "cells"
  | "coastline"
  | "compass"
  | "cultures"
  | "grid"
  | "goods"
  | "ice"
  | "lakes"
  | "landmass"
  | "markers"
  | "markets"
  | "military"
  | "ocean"
  | "precipitation"
  | "population"
  | "provinces"
  | "relief"
  | "religions"
  | "rivers"
  | "routes"
  | "states"
  | "temperature"
  | "trade"
  | "zones";

export const PIXI_OWNED_LAYER_IDS: readonly PixiOwnedLayer[] = [
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
];

export const isPixiOwnedLayer = (layer: string): layer is PixiOwnedLayer =>
  PIXI_OWNED_LAYER_IDS.includes(layer as PixiOwnedLayer);

export const rendererCoordinator = new RendererCoordinator(MAP_LAYER_REGISTRY);

export function activatePixiRendererOwnership(): void {
  rendererCoordinator.resetOwners("svg");
  rendererCoordinator.setOwners("pixi", PIXI_OWNED_LAYER_IDS);
}

export const pixiOwnsLayer = (layer: PixiOwnedLayer): boolean => rendererCoordinator.isOwnedBy(layer, "pixi");

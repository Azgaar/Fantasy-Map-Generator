import type { MapRenderWorld } from "../scene/render-world";
import type { MapStyle } from "../scene/styles";
import type { MapCamera, ViewportSize } from "./camera";
import type { RenderInvalidationBatch } from "./invalidation";
import type { MapLayerId } from "./layer-registry";

export interface ScreenPoint {
  x: number;
  y: number;
}

export type MapHitKind = "area" | "label" | "line" | "point";

export interface MapHit {
  domainId: number | string;
  kind: MapHitKind;
  layer: MapLayerId;
  mapPoint: ScreenPoint;
}

/** Persistent interactive renderer contract. Runtime renderer resources must never escape through this interface. */
export interface MapRenderer {
  destroy(): void;
  mount(surface: HTMLElement): Promise<void>;
  pick(point: ScreenPoint): MapHit | null;
  render(world: MapRenderWorld, style: MapStyle, invalidation: RenderInvalidationBatch): Promise<void>;
  resize(viewport: ViewportSize): void;
  setCamera(camera: MapCamera): void;
  setLayerVisibility(layer: MapLayerId, visible: boolean): void;
}

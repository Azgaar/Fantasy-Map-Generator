import type { PackedGraph } from "@/types/PackedGraph";
import type { Style } from "@/types/style";
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
  render(world: PackedGraph, style: Style, invalidation: RenderInvalidationBatch): Promise<void>;
  resize(viewport: ViewportSize): void;
  setCamera(camera: MapCamera): void;
  setLayerVisibility(layer: MapLayerId, visible: boolean): void;
}

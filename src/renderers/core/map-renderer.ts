import type { MapRenderWorld } from "../scene/render-world";
import type { MapStyle } from "../scene/styles";
import type { CameraPoint, MapCamera, ViewportSize } from "./camera";
import type { RenderInvalidationBatch } from "./invalidation";
import type { MapLayerId } from "./layer-registry";

export type ScreenPoint = CameraPoint;

export type MapHitKind = "area" | "label" | "line" | "point";
export type MapDomainKind =
  | "biome"
  | "burg"
  | "cell"
  | "coastline"
  | "culture"
  | "emblem"
  | "good"
  | "ice"
  | "label"
  | "lake"
  | "market"
  | "marker"
  | "province"
  | "regiment"
  | "relief"
  | "religion"
  | "river"
  | "route"
  | "state"
  | "zone";

export interface MapHit {
  distance: number;
  domainId: number | string;
  domainKind: MapDomainKind;
  kind: MapHitKind;
  layer: MapLayerId;
  mapPoint: ScreenPoint;
  screenPoint: ScreenPoint;
  subPart?: Readonly<Record<string, boolean | number | string>>;
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

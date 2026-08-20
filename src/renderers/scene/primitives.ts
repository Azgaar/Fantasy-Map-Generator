import type { MapLayerId } from "../core/layer-registry";

export type SceneDomainId = number | string;
export type SceneRevision = number | string;
export type ScenePoint = readonly [number, number];

export interface SceneBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface ScenePrimitiveBase {
  bounds: SceneBounds | null;
  domainIds: readonly SceneDomainId[];
  layer: MapLayerId;
  revision: SceneRevision;
}

export interface PolygonBatchPrimitive extends ScenePrimitiveBase {
  colors?: Float32Array;
  indices: Uint16Array | Uint32Array;
  kind: "polygon-batch";
  positions: Float32Array;
}

export interface PolygonPathPrimitive {
  domainId: SceneDomainId;
  points: readonly ScenePoint[];
  role?: string;
}

export interface PolygonPathBatchPrimitive extends ScenePrimitiveBase {
  kind: "polygon-path-batch";
  polygons: readonly PolygonPathPrimitive[];
}

export interface LinePathPrimitive {
  closed?: boolean;
  domainId: SceneDomainId;
  points: readonly ScenePoint[];
  role?: string;
}

export interface LineBatchPrimitive extends ScenePrimitiveBase {
  kind: "line-batch";
  paths: readonly LinePathPrimitive[];
}

export interface CircleInstancePrimitive {
  domainId: SceneDomainId;
  radius: number;
  role?: string;
  x: number;
  y: number;
}

export interface CircleBatchPrimitive extends ScenePrimitiveBase {
  circles: readonly CircleInstancePrimitive[];
  kind: "circle-batch";
}

export interface SpriteInstancePrimitive {
  domainId: SceneDomainId;
  height: number;
  icon: string;
  rotation?: number;
  width: number;
  x: number;
  y: number;
}

export interface SpriteBatchPrimitive extends ScenePrimitiveBase {
  instances: readonly SpriteInstancePrimitive[];
  kind: "sprite-batch";
}

export interface PointSymbolInstancePrimitive {
  anchorX: number;
  anchorY: number;
  domainId: SceneDomainId;
  fill: string;
  fillOpacity: number;
  icon: string | null;
  iconOffsetX: number;
  iconOffsetY: number;
  iconSize: number;
  opacity: number;
  rescale: boolean;
  role?: string;
  shape: string;
  size: number;
  stroke: string;
  strokeWidth: number;
  x: number;
  y: number;
}

export interface PointSymbolBatchPrimitive extends ScenePrimitiveBase {
  instances: readonly PointSymbolInstancePrimitive[];
  kind: "point-symbol-batch";
}

export interface LabelRunPrimitive {
  anchor: ScenePoint;
  domainId: SceneDomainId;
  maxScale?: number;
  minScale?: number;
  role: string;
  text: string;
}

export interface LabelBatchPrimitive extends ScenePrimitiveBase {
  kind: "label-batch";
  labels: readonly LabelRunPrimitive[];
}

export interface HitRegionPrimitive extends ScenePrimitiveBase {
  domainKind: string;
  kind: "hit-regions";
  regions: readonly { bounds: SceneBounds; domainId: SceneDomainId }[];
}

export interface MaskRegionPrimitive extends PolygonPathPrimitive {
  operation: "exclude" | "include";
}

export interface MaskPrimitive extends ScenePrimitiveBase {
  kind: "mask";
  regions: readonly MaskRegionPrimitive[];
}

export type ScenePrimitive =
  | PolygonBatchPrimitive
  | PolygonPathBatchPrimitive
  | LineBatchPrimitive
  | CircleBatchPrimitive
  | SpriteBatchPrimitive
  | PointSymbolBatchPrimitive
  | LabelBatchPrimitive
  | HitRegionPrimitive
  | MaskPrimitive;

export function mergeSceneBounds(bounds: SceneBounds | null, next: SceneBounds): SceneBounds {
  if (!bounds) return { ...next };
  return {
    maxX: Math.max(bounds.maxX, next.maxX),
    maxY: Math.max(bounds.maxY, next.maxY),
    minX: Math.min(bounds.minX, next.minX),
    minY: Math.min(bounds.minY, next.minY)
  };
}

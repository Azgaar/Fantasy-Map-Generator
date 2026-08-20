import type { Feature } from "@/generators/features";
import type { PackedGraph } from "@/types/PackedGraph";
import type {
  LineBatchPrimitive,
  LinePathPrimitive,
  MaskPrimitive,
  MaskRegionPrimitive,
  PolygonBatchPrimitive,
  PolygonPathBatchPrimitive,
  PolygonPathPrimitive,
  SceneBounds,
  SceneRevision
} from "../primitives";
import { buildFeatureShape, type FeatureShapeOptions, type MapBounds } from "./feature-shapes";

export interface BaseGeographyScene {
  coastline: LineBatchPrimitive;
  lakes: PolygonPathBatchPrimitive;
  landMask: MaskPrimitive;
  landmass: PolygonPathBatchPrimitive;
  ocean: PolygonBatchPrimitive;
  waterMask: MaskPrimitive;
}

export interface BaseGeographySource {
  features: readonly (Feature | null | undefined)[];
  vertices: Pick<PackedGraph["vertices"], "p">;
}

export function buildBaseGeographyScene(
  source: BaseGeographySource,
  mapBounds: MapBounds,
  revision: SceneRevision = 0,
  shapeOptions: FeatureShapeOptions = {}
): BaseGeographyScene {
  validateBounds(mapBounds);
  const sceneBounds: SceneBounds = { maxX: mapBounds.width, maxY: mapBounds.height, minX: 0, minY: 0 };
  const landPolygons: PolygonPathPrimitive[] = [];
  const lakePolygons: PolygonPathPrimitive[] = [];
  const coastlinePaths: LinePathPrimitive[] = [];
  const landRegions: MaskRegionPrimitive[] = [];
  const waterRegions: MaskRegionPrimitive[] = [createMapMaskRegion(mapBounds)];

  for (const feature of source.features) {
    if (!feature || feature.type === "ocean" || !Array.isArray(feature.vertices)) continue;
    const shape = buildFeatureShape(feature, source.vertices, mapBounds, shapeOptions);
    if (!shape) continue;

    const role = getFeatureRole(feature);
    const polygon: PolygonPathPrimitive = { domainId: feature.i, points: shape.points, role };
    if (feature.type === "lake") {
      lakePolygons.push(polygon);
      landRegions.push({ ...polygon, operation: "exclude" });
      waterRegions.push({ ...polygon, operation: "include" });
      continue;
    }

    landPolygons.push(polygon);
    coastlinePaths.push({ closed: true, domainId: feature.i, points: shape.points, role });
    landRegions.push({ ...polygon, operation: "include" });
    waterRegions.push({ ...polygon, operation: "exclude" });
  }

  return {
    coastline: createLineBatch("coastline", coastlinePaths, sceneBounds, revision),
    lakes: createPolygonPathBatch("lakes", lakePolygons, sceneBounds, revision),
    landMask: createMask("landmass", landRegions, sceneBounds, revision),
    landmass: createPolygonPathBatch("landmass", landPolygons, sceneBounds, revision),
    ocean: createMapRectangle(mapBounds, revision),
    waterMask: createMask("ocean", waterRegions, sceneBounds, revision)
  };
}

function createMapRectangle(mapBounds: MapBounds, revision: SceneRevision): PolygonBatchPrimitive {
  return {
    bounds: { maxX: mapBounds.width, maxY: mapBounds.height, minX: 0, minY: 0 },
    domainIds: ["map"],
    indices: Uint16Array.from([0, 1, 2, 0, 2, 3]),
    kind: "polygon-batch",
    layer: "ocean",
    positions: Float32Array.from([0, 0, mapBounds.width, 0, mapBounds.width, mapBounds.height, 0, mapBounds.height]),
    revision
  };
}

function createMapMaskRegion(mapBounds: MapBounds): MaskRegionPrimitive {
  return {
    domainId: "map",
    operation: "include",
    points: [
      [0, 0],
      [mapBounds.width, 0],
      [mapBounds.width, mapBounds.height],
      [0, mapBounds.height]
    ],
    role: "map"
  };
}

function createPolygonPathBatch(
  layer: "lakes" | "landmass",
  polygons: readonly PolygonPathPrimitive[],
  bounds: SceneBounds,
  revision: SceneRevision
): PolygonPathBatchPrimitive {
  return {
    bounds,
    domainIds: polygons.map(polygon => polygon.domainId),
    kind: "polygon-path-batch",
    layer,
    polygons,
    revision
  };
}

function createLineBatch(
  layer: "coastline",
  paths: readonly LinePathPrimitive[],
  bounds: SceneBounds,
  revision: SceneRevision
): LineBatchPrimitive {
  return { bounds, domainIds: paths.map(path => path.domainId), kind: "line-batch", layer, paths, revision };
}

function createMask(
  layer: "landmass" | "ocean",
  regions: readonly MaskRegionPrimitive[],
  bounds: SceneBounds,
  revision: SceneRevision
): MaskPrimitive {
  return { bounds, domainIds: regions.map(region => region.domainId), kind: "mask", layer, regions, revision };
}

function getFeatureRole(feature: Feature): string {
  if (feature.type === "lake") return feature.group || "freshwater";
  return feature.group === "lake_island" ? "lake_island" : "sea_island";
}

function validateBounds({ height, width }: MapBounds): void {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`Invalid map bounds: ${width}x${height}`);
  }
}

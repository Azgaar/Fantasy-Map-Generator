import type { Zone } from "@/generators/zones-generator";
import type { PackedGraph } from "@/types/PackedGraph";
import type { PolygonPathBatchPrimitive, PolygonPathPrimitive, SceneBounds, SceneRevision } from "../primitives";

export interface ZoneFillBatch extends PolygonPathBatchPrimitive {
  color: string;
  type: string;
  zoneId: number;
}

export interface ZoneScene {
  bounds: SceneBounds | null;
  layer: "zones";
  revision: SceneRevision;
  zones: readonly ZoneFillBatch[];
}

export interface ZoneSceneOptions {
  filterType?: string | null;
}

export function buildZoneScene(
  source: Pick<PackedGraph, "cells" | "vertices" | "zones">,
  revision: SceneRevision = 0,
  options: ZoneSceneOptions = {}
): ZoneScene {
  const zones = source.zones
    .filter(zone => isZoneVisible(zone, options.filterType))
    .map(zone => buildZoneBatch(source, zone, revision))
    .filter((zone): zone is ZoneFillBatch => Boolean(zone));
  return {
    bounds: getSceneBounds(zones.flatMap(zone => zone.polygons)),
    layer: "zones",
    revision,
    zones
  };
}

function buildZoneBatch(
  source: Pick<PackedGraph, "cells" | "vertices">,
  zone: Zone,
  revision: SceneRevision
): ZoneFillBatch | null {
  const polygons: PolygonPathPrimitive[] = [];
  for (const cellId of zone.cells) {
    const vertexIds = source.cells.v[cellId];
    if (!vertexIds?.length) continue;
    const points = vertexIds.map(vertexId => source.vertices.p[vertexId]).filter(isFinitePoint);
    if (points.length < 3) continue;
    polygons.push({ domainId: zone.i, points });
  }
  if (!polygons.length) return null;
  return {
    bounds: getSceneBounds(polygons),
    color: zone.color,
    domainIds: [zone.i],
    kind: "polygon-path-batch",
    layer: "zones",
    polygons,
    revision,
    type: zone.type,
    zoneId: zone.i
  };
}

function isZoneVisible(zone: Zone, filterType?: string | null): boolean {
  return (
    !zone.hidden && Boolean(zone.cells.length) && (!filterType || filterType === "all" || zone.type === filterType)
  );
}

function getSceneBounds(polygons: readonly PolygonPathPrimitive[]): SceneBounds | null {
  if (!polygons.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const { points } of polygons) {
    for (const [x, y] of points) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { maxX, maxY, minX, minY };
}

function isFinitePoint(point: [number, number] | undefined): point is [number, number] {
  return Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

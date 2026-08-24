import type { PackedGraph } from "@/types/PackedGraph";
import type { LineBatchPrimitive, LinePathPrimitive, SceneBounds, SceneRevision } from "../primitives";

export interface CellOutlineSource {
  cells: Pick<PackedGraph["cells"], "i" | "v">;
  vertices: Pick<PackedGraph["vertices"], "p">;
}

export function buildCellOutlineScene(source: CellOutlineSource, revision: SceneRevision = 0): LineBatchPrimitive {
  const paths: LinePathPrimitive[] = [];
  const edgeKeys = new Set<string>();
  let bounds: SceneBounds | null = null;

  for (const cellId of source.cells.i) {
    const vertexIds = source.cells.v[cellId];
    if (!vertexIds || vertexIds.length < 2) continue;
    for (let index = 0; index < vertexIds.length; index++) {
      const startId = vertexIds[index];
      const endId = vertexIds[(index + 1) % vertexIds.length];
      const start = source.vertices.p[startId];
      const end = source.vertices.p[endId];
      if (!isFinitePoint(start) || !isFinitePoint(end) || startId === endId) continue;
      const edgeKey = startId < endId ? `${startId}:${endId}` : `${endId}:${startId}`;
      if (edgeKeys.has(edgeKey)) continue;
      edgeKeys.add(edgeKey);
      paths.push({ domainId: edgeKey, points: [start, end] });
      bounds = includePoint(includePoint(bounds, start), end);
    }
  }

  return {
    bounds,
    domainIds: paths.map(path => path.domainId),
    kind: "line-batch",
    layer: "cells",
    paths,
    revision
  };
}

function includePoint(bounds: SceneBounds | null, [x, y]: [number, number]): SceneBounds {
  if (!bounds) return { maxX: x, maxY: y, minX: x, minY: y };
  return {
    maxX: Math.max(bounds.maxX, x),
    maxY: Math.max(bounds.maxY, y),
    minX: Math.min(bounds.minX, x),
    minY: Math.min(bounds.minY, y)
  };
}

function isFinitePoint(point: [number, number] | undefined): point is [number, number] {
  return Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

import type { PackedGraph } from "@/types/PackedGraph";
import type { MapLayerId } from "../../core/layer-registry";
import {
  type LineBatchPrimitive,
  type LinePathPrimitive,
  mergeSceneBounds,
  type SceneBounds,
  type SceneRevision
} from "../primitives";

export interface AssignmentBoundarySource {
  cells: Pick<PackedGraph["cells"], "h" | "i" | "v">;
  vertices: Pick<PackedGraph["vertices"], "c" | "p">;
}

/** Builds the visible edges of thematic regions without outlining every Voronoi cell. */
export function buildAssignmentBoundaryScene(
  source: AssignmentBoundarySource,
  assignments: ArrayLike<number>,
  layer: Extract<MapLayerId, "biomes" | "cultures" | "provinces" | "religions" | "states">,
  revision: SceneRevision = 0
): LineBatchPrimitive {
  const paths: LinePathPrimitive[] = [];
  const visitedEdges = new Set<string>();
  let bounds: SceneBounds | null = null;

  for (const cellId of source.cells.i) {
    const assignment = assignments[cellId];
    const vertexIds = source.cells.v[cellId];
    if (source.cells.h[cellId] < 20 || !assignment || !vertexIds?.length) continue;

    for (let index = 0; index < vertexIds.length; index++) {
      const startId = vertexIds[index];
      const endId = vertexIds[(index + 1) % vertexIds.length];
      const edgeKey = startId < endId ? `${startId}:${endId}` : `${endId}:${startId}`;
      if (visitedEdges.has(edgeKey)) continue;
      visitedEdges.add(edgeKey);

      const adjacentCells = source.vertices.c[startId]?.filter(
        adjacent => adjacent < source.cells.i.length && source.vertices.c[endId]?.includes(adjacent)
      );
      const landNeighbor = adjacentCells?.find(adjacent => adjacent !== cellId && source.cells.h[adjacent] >= 20);
      if (landNeighbor !== undefined && assignments[landNeighbor] === assignment) continue;

      const start = source.vertices.p[startId];
      const end = source.vertices.p[endId];
      if (!isFinitePoint(start) || !isFinitePoint(end)) continue;
      paths.push({ domainId: `${layer}:${assignment}:${edgeKey}`, points: [start, end], role: String(assignment) });
      bounds = mergeSceneBounds(bounds, {
        maxX: Math.max(start[0], end[0]),
        maxY: Math.max(start[1], end[1]),
        minX: Math.min(start[0], end[0]),
        minY: Math.min(start[1], end[1])
      });
    }
  }

  return {
    bounds,
    domainIds: paths.map(path => path.domainId),
    kind: "line-batch",
    layer,
    paths,
    revision
  };
}

function isFinitePoint(point: [number, number] | undefined): point is [number, number] {
  return Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

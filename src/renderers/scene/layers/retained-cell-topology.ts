import { mergeSceneBounds, type SceneBounds } from "../primitives";

export type { SceneBounds } from "../primitives";

export type CellTopologyRevision = number | string;

export interface CellGeometryRange {
  bounds: SceneBounds;
  cellId: number;
  indexCount: number;
  indexOffset: number;
  triangleCount: number;
  triangleOffset: number;
  vertexCount: number;
  vertexOffset: number;
}

export interface RetainedCellTopology {
  bounds: SceneBounds | null;
  cellRangeIndices: Int32Array;
  cellRanges: readonly CellGeometryRange[];
  indices: Uint16Array | Uint32Array;
  positions: Float32Array;
  revision: CellTopologyRevision;
  triangleCount: number;
  vertexCount: number;
}

export interface CellTopologySource {
  cellIds: Iterable<number>;
  cellVertices: readonly (readonly number[] | undefined)[];
  revision: CellTopologyRevision;
  vertexPoints: readonly (readonly [number, number] | undefined)[];
}

interface ValidCell {
  bounds: SceneBounds;
  cellId: number;
  vertexIds: readonly number[];
}

/**
 * Build immutable GPU-ready geometry for convex Voronoi cells.
 *
 * Vertices are intentionally duplicated between cells so later layers can update per-cell attributes without
 * splitting shared vertices or rebuilding topology.
 */
export function buildRetainedCellTopology(source: CellTopologySource): RetainedCellTopology {
  const cells: ValidCell[] = [];
  let maxCellId = -1;
  let vertexCount = 0;
  let triangleCount = 0;
  let bounds: SceneBounds | null = null;

  for (const cellId of source.cellIds) {
    maxCellId = Math.max(maxCellId, cellId);
    const vertexIds = getValidVertexIds(source.cellVertices[cellId], source.vertexPoints);
    if (!vertexIds) continue;

    const cellBounds = getBounds(vertexIds, source.vertexPoints);
    cells.push({ bounds: cellBounds, cellId, vertexIds });
    vertexCount += vertexIds.length;
    triangleCount += vertexIds.length - 2;
    bounds = mergeSceneBounds(bounds, cellBounds);
  }

  const positions = new Float32Array(vertexCount * 2);
  const indices = vertexCount > 65_535 ? new Uint32Array(triangleCount * 3) : new Uint16Array(triangleCount * 3);
  const cellRangeIndices = new Int32Array(maxCellId + 1);
  cellRangeIndices.fill(-1);
  const cellRanges: CellGeometryRange[] = [];
  let vertexOffset = 0;
  let indexOffset = 0;

  for (const { bounds: cellBounds, cellId, vertexIds } of cells) {
    const triangleOffset = indexOffset / 3;
    const cellTriangleCount = vertexIds.length - 2;
    const cellIndexCount = cellTriangleCount * 3;

    for (let vertexIndex = 0; vertexIndex < vertexIds.length; vertexIndex++) {
      const point = source.vertexPoints[vertexIds[vertexIndex]]!;
      const positionOffset = (vertexOffset + vertexIndex) * 2;
      positions[positionOffset] = point[0];
      positions[positionOffset + 1] = point[1];
    }

    for (let triangleIndex = 0; triangleIndex < cellTriangleCount; triangleIndex++) {
      const target = indexOffset + triangleIndex * 3;
      indices[target] = vertexOffset;
      indices[target + 1] = vertexOffset + triangleIndex + 1;
      indices[target + 2] = vertexOffset + triangleIndex + 2;
    }

    cellRangeIndices[cellId] = cellRanges.length;
    cellRanges.push({
      bounds: cellBounds,
      cellId,
      indexCount: cellIndexCount,
      indexOffset,
      triangleCount: cellTriangleCount,
      triangleOffset,
      vertexCount: vertexIds.length,
      vertexOffset
    });
    vertexOffset += vertexIds.length;
    indexOffset += cellIndexCount;
  }

  return {
    bounds,
    cellRangeIndices,
    cellRanges,
    indices,
    positions,
    revision: source.revision,
    triangleCount,
    vertexCount
  };
}

export function getCellGeometryRange(topology: RetainedCellTopology, cellId: number): CellGeometryRange | undefined {
  const rangeIndex = topology.cellRangeIndices[cellId] ?? -1;
  return rangeIndex < 0 ? undefined : topology.cellRanges[rangeIndex];
}

export class RetainedCellTopologyCache {
  private topology: RetainedCellTopology | null = null;

  get(source: CellTopologySource): RetainedCellTopology {
    if (this.topology?.revision === source.revision) return this.topology;
    this.topology = buildRetainedCellTopology(source);
    return this.topology;
  }

  clear(): void {
    this.topology = null;
  }
}

function getValidVertexIds(
  sourceIds: readonly number[] | undefined,
  points: CellTopologySource["vertexPoints"]
): readonly number[] | null {
  if (!sourceIds || sourceIds.length < 3) return null;
  const hasClosingVertex = sourceIds.length > 3 && sourceIds[0] === sourceIds.at(-1);
  const vertexIds = hasClosingVertex ? sourceIds.slice(0, -1) : sourceIds;
  if (vertexIds.length < 3 || vertexIds.some(vertexId => !points[vertexId])) return null;
  return vertexIds;
}

function getBounds(vertexIds: readonly number[], points: CellTopologySource["vertexPoints"]): SceneBounds {
  const first = points[vertexIds[0]]!;
  const bounds = { maxX: first[0], maxY: first[1], minX: first[0], minY: first[1] };
  for (let index = 1; index < vertexIds.length; index++) {
    const [x, y] = points[vertexIds[index]]!;
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
  }
  return bounds;
}

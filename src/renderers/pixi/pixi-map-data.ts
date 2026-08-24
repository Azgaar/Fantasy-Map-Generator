export interface CellFillSource {
  cellIds: Iterable<number>;
  cellVertices: number[][];
  colors: readonly { color?: string }[];
  groups: ArrayLike<number>;
  heights: ArrayLike<number>;
  vertexPoints: readonly (readonly [number, number])[];
}

export interface CellFillBatch {
  color: string;
  groupId: number;
  polygons: number[][];
}

const FALLBACK_COLOR = "#888888";

/** Group convex Voronoi polygons so Pixi can fill each map category as one graphics batch. */
export function buildCellFillBatches(source: CellFillSource): CellFillBatch[] {
  const batches = new Map<number, CellFillBatch>();

  for (const cellId of source.cellIds) {
    if (source.heights[cellId] < 20) continue;
    const groupId = source.groups[cellId];
    if (!groupId) continue;

    const polygon = getCellPolygon(source.cellVertices[cellId], source.vertexPoints);
    if (polygon.length < 6) continue;

    let batch = batches.get(groupId);
    if (!batch) {
      batch = { color: normalizeFillColor(source.colors[groupId]?.color), groupId, polygons: [] };
      batches.set(groupId, batch);
    }
    batch.polygons.push(polygon);
  }

  return [...batches.values()];
}

function getCellPolygon(vertexIds: number[] | undefined, points: readonly (readonly [number, number])[]): number[] {
  if (!vertexIds) return [];
  const polygon: number[] = [];
  for (const vertexId of vertexIds) {
    const point = points[vertexId];
    if (!point) return [];
    polygon.push(point[0], point[1]);
  }
  return polygon;
}

export function normalizeFillColor(color: string | undefined): string {
  return color && !color.startsWith("url(") ? color : FALLBACK_COLOR;
}

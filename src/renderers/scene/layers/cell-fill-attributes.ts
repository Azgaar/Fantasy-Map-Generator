import type { RetainedCellTopology } from "./retained-cell-topology";

export interface CellFillAttributeSource {
  assignments: ArrayLike<number>;
  colors: readonly { color?: string }[];
  fallbackColor: string;
  heights: ArrayLike<number>;
}

export interface CellFillAttributeUpdate {
  vertexCount: number;
  vertexOffset: number;
}

export function buildCellFillAttributes(topology: RetainedCellTopology, source: CellFillAttributeSource): Float32Array {
  const attributes = new Float32Array(topology.vertexCount * 4);
  updateCellFillAttributes(
    attributes,
    topology,
    source,
    topology.cellRanges.map(range => range.cellId)
  );
  return attributes;
}

export function updateCellFillAttributes(
  attributes: Float32Array,
  topology: RetainedCellTopology,
  source: CellFillAttributeSource,
  cellIds: Iterable<number>
): CellFillAttributeUpdate | null {
  let firstVertex = Number.POSITIVE_INFINITY;
  let lastVertex = -1;
  const fallback = parseColor(source.fallbackColor) ?? [0.533, 0.533, 0.533];

  for (const cellId of cellIds) {
    const rangeIndex = topology.cellRangeIndices[cellId] ?? -1;
    const range = rangeIndex < 0 ? undefined : topology.cellRanges[rangeIndex];
    if (!range) continue;
    const groupId = source.assignments[cellId];
    const color =
      source.heights[cellId] >= 20 && groupId ? (parseColor(source.colors[groupId]?.color) ?? fallback) : null;
    for (let vertex = range.vertexOffset; vertex < range.vertexOffset + range.vertexCount; vertex++) {
      const offset = vertex * 4;
      attributes[offset] = color?.[0] ?? 0;
      attributes[offset + 1] = color?.[1] ?? 0;
      attributes[offset + 2] = color?.[2] ?? 0;
      attributes[offset + 3] = color ? 1 : 0;
    }
    firstVertex = Math.min(firstVertex, range.vertexOffset);
    lastVertex = Math.max(lastVertex, range.vertexOffset + range.vertexCount);
  }

  return lastVertex < 0 ? null : { vertexCount: lastVertex - firstVertex, vertexOffset: firstVertex };
}

export function parseColor(color: string | undefined): readonly [number, number, number] | null {
  if (!color || color.startsWith("url(")) return null;
  const hex = color.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 ? [...hex].map(character => character.repeat(2)).join("") : hex;
    return [0, 2, 4].map(
      offset => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255
    ) as unknown as readonly [number, number, number];
  }
  const rgb = color.trim().match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  if (!rgb) return null;
  return [Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255];
}

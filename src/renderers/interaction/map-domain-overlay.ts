import type { TypedArray } from "@/types/PackedGraph";
import { getIsolines } from "@/utils/pathUtils";
import { buildBaseGeographyScene } from "../scene/layers/base-geography-scene";
import type { MapInteractionGeometry, MapInteractionGeometryStyle } from "./map-interaction-overlay";

export function getAssignmentPath(assignments: TypedArray, domainId: number): string {
  return (
    getIsolines(pack, cellId => (assignments[cellId] === domainId ? domainId : null), { fill: true })[domainId]?.fill ??
    ""
  );
}

export function getAssignmentOverlay(
  assignments: TypedArray,
  domainId: number,
  style?: MapInteractionGeometryStyle
): MapInteractionGeometry[] {
  const path = getAssignmentPath(assignments, domainId);
  return path ? [{ kind: "path", path, style }] : [];
}

/** Uses the same smoothed coastline as the map while retaining exact political borders inland. */
export function getCountrySelectionOverlay(
  countryId: number,
  style: MapInteractionGeometryStyle
): MapInteractionGeometry[] {
  const selectionPath = getAssignmentPath(pack.cells.state, countryId);
  if (!selectionPath) return [];

  const fillStyle = { ...style, stroke: "none", strokeScaling: undefined, strokeWidth: undefined };
  const outlineStyle = { ...style, fill: "none" };
  const geometries: MapInteractionGeometry[] = [{ kind: "path", path: selectionPath, style: fillStyle }];
  const borderPath = getCountryLandBorderPath(countryId);
  if (borderPath) geometries.push({ kind: "path", path: borderPath, style: outlineStyle });

  const coastlinePath = getCountryCoastlinePath(countryId);
  if (coastlinePath) {
    geometries.push({
      kind: "masked-path",
      maskPath: selectionPath,
      maskStrokeWidth: 12,
      path: coastlinePath,
      style: outlineStyle
    });
  }
  return geometries;
}

export function getCellsOverlay(
  cellIds: readonly number[],
  style?: MapInteractionGeometryStyle
): MapInteractionGeometry[] {
  const path = getCellsPath(cellIds);
  return path ? [{ kind: "path", path, style }] : [];
}

export function getCellsPath(cellIds: readonly number[]): string {
  const cellSet = new Set(cellIds);
  return getIsolines(pack, cellId => (cellSet.has(cellId) ? 1 : null), { fill: true })[1]?.fill ?? "";
}

function getCountryLandBorderPath(countryId: number): string {
  const { cells, vertices } = pack;
  const seenEdges = new Set<string>();
  const segments: string[] = [];
  for (const cellId of cells.i) {
    if (cells.h[cellId] < 20 || cells.state[cellId] !== countryId) continue;
    const cellVertices = cells.v[cellId];
    for (let index = 0; index < cellVertices.length; index++) {
      const startId = cellVertices[index];
      const endId = cellVertices[(index + 1) % cellVertices.length];
      const edgeId = startId < endId ? `${startId}:${endId}` : `${endId}:${startId}`;
      if (seenEdges.has(edgeId)) continue;
      seenEdges.add(edgeId);
      const adjacent = vertices.c[startId]?.filter(
        neighbor => neighbor < cells.i.length && vertices.c[endId]?.includes(neighbor)
      );
      if (!adjacent?.some(neighbor => cells.h[neighbor] >= 20 && cells.state[neighbor] !== countryId)) continue;
      const start = vertices.p[startId];
      const end = vertices.p[endId];
      if (start && end) segments.push(`M${start} L${end}`);
    }
  }
  return segments.join("");
}

function getCountryCoastlinePath(countryId: number): string {
  const featureIds = new Set<number>();
  for (const cellId of pack.cells.i) {
    if (pack.cells.state[cellId] === countryId) featureIds.add(pack.cells.f[cellId]);
  }
  const geography = buildBaseGeographyScene(pack, { height: graphHeight, width: graphWidth });
  return geography.coastline.paths
    .filter(path => featureIds.has(Number(path.domainId)))
    .map(path => `M${path.points.join(" L")}Z`)
    .join("");
}

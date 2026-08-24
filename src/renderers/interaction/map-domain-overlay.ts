import type { TypedArray } from "@/types/PackedGraph";
import { getIsolines } from "@/utils/pathUtils";
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

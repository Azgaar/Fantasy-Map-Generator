import type { Label, LabelType } from "@/generators/labels-generator";
import { getNextReliefIconId, type ReliefIcon } from "@/generators/relief-generator";
import type { River } from "@/generators/river-generator";
import type { Route } from "@/generators/routes-generator";
import type { Zone } from "@/generators/zones-generator";
import type { MapLayerId } from "@/renderers/core/layer-registry";
import type { PackedGraph, TypedArray } from "@/types/PackedGraph";

type RouteControlPoint = [number, number, number];
type RiverControlPoint = [number, number];

const FEATURE_GEOMETRY_LAYERS: MapLayerId[] = [
  "landmass",
  "lakes",
  "biomes",
  "cells",
  "religions",
  "cultures",
  "states",
  "provinces",
  "borders",
  "coastline"
];

export interface EditorMutationResult {
  affectedCellIds: number[];
  affectedDomainIds: Array<number | string>;
  changed: boolean;
  layers: MapLayerId[];
}

export function moveMarker(
  graph: Pick<PackedGraph, "markers">,
  markerId: number,
  point: { x: number; y: number },
  cellId: number
): EditorMutationResult {
  const marker = graph.markers.find(item => item.i === markerId);
  if (!marker || (marker.x === point.x && marker.y === point.y && marker.cell === cellId)) {
    return unchanged("markers");
  }
  marker.x = point.x;
  marker.y = point.y;
  marker.cell = cellId;
  return changed("markers", [markerId], [cellId]);
}

export function moveIce(
  graph: Pick<PackedGraph, "ice">,
  iceId: number,
  point: { x: number; y: number }
): EditorMutationResult {
  const ice = graph.ice.find(item => item.i === iceId);
  if (!ice) return unchanged("ice");
  const count = Math.max(ice.points.length, 1);
  const center = {
    x: ice.points.reduce((sum, [x]) => sum + x, 0) / count,
    y: ice.points.reduce((sum, [, y]) => sum + y, 0) / count
  };
  const offset: [number, number] = [point.x - center.x, point.y - center.y];
  if (ice.offset?.[0] === offset[0] && ice.offset[1] === offset[1]) return unchanged("ice");
  ice.offset = offset;
  return changed("ice", [iceId]);
}

export function toggleCellGood(
  graph: Pick<PackedGraph, "cells" | "goods">,
  cellId: number,
  selectedGoodId: number
): EditorMutationResult {
  const previousGoodId = Number(graph.cells.good[cellId]) || 0;
  const nextGoodId = previousGoodId ? 0 : selectedGoodId;
  if (previousGoodId === nextGoodId) return unchanged("goods");
  const good = nextGoodId ? graph.goods.find(item => item.i === nextGoodId) : undefined;
  if (nextGoodId && !good) return unchanged("goods");
  graph.cells.good[cellId] = nextGoodId;
  if (good) good.visible = true;
  return changed("goods", [previousGoodId, nextGoodId].filter(Boolean), [cellId]);
}

export function paintMarketAssignments(
  assignments: Uint16Array,
  cellIds: readonly number[],
  marketId: number
): EditorMutationResult {
  const affectedMarkets = new Set<number>([marketId]);
  const affectedCellIds: number[] = [];
  for (const cellId of cellIds) {
    const previous = assignments[cellId];
    if (previous === marketId) continue;
    if (previous) affectedMarkets.add(previous);
    assignments[cellId] = marketId;
    affectedCellIds.push(cellId);
  }
  return affectedCellIds.length ? changed("markets", [...affectedMarkets], affectedCellIds) : unchanged("markets");
}

export function commitMarketAssignments(
  graph: Pick<PackedGraph, "burgs" | "cells">,
  assignments: Uint16Array
): EditorMutationResult {
  const affectedCellIds: number[] = [];
  const affectedMarkets = new Set<number>();
  for (let cellId = 0; cellId < assignments.length; cellId++) {
    const previous = Number(graph.cells.market[cellId]) || 0;
    const next = assignments[cellId];
    if (previous !== next) {
      graph.cells.market[cellId] = next;
      affectedCellIds.push(cellId);
      if (previous) affectedMarkets.add(previous);
      if (next) affectedMarkets.add(next);
    }
    const burgId = graph.cells.burg[cellId];
    if (burgId && graph.burgs[burgId]) graph.burgs[burgId].market = next;
  }
  return affectedCellIds.length ? changed("markets", [...affectedMarkets], affectedCellIds) : unchanged("markets");
}

export function paintTerritoryAssignments(
  layer: MapLayerId,
  assignments: TypedArray,
  cellIds: readonly number[],
  domainId: number
): EditorMutationResult {
  const affectedDomainIds = new Set<number>([domainId]);
  const affectedCellIds: number[] = [];
  for (const cellId of cellIds) {
    const previous = assignments[cellId];
    if (previous === domainId) continue;
    affectedDomainIds.add(previous);
    assignments[cellId] = domainId;
    affectedCellIds.push(cellId);
  }
  return affectedCellIds.length ? changed(layer, [...affectedDomainIds], affectedCellIds) : unchanged(layer);
}

export function commitTerritoryAssignments(
  layer: MapLayerId,
  target: TypedArray,
  assignments: TypedArray
): EditorMutationResult {
  const affectedDomainIds = new Set<number>();
  const affectedCellIds: number[] = [];
  const length = Math.min(target.length, assignments.length);
  for (let cellId = 0; cellId < length; cellId++) {
    const previous = target[cellId];
    const next = assignments[cellId];
    if (previous === next) continue;
    affectedDomainIds.add(previous);
    affectedDomainIds.add(next);
    target[cellId] = next;
    affectedCellIds.push(cellId);
  }
  return affectedCellIds.length ? changed(layer, [...affectedDomainIds], affectedCellIds) : unchanged(layer);
}

export function moveTerritoryCenter(
  layer: MapLayerId,
  domains: Array<{ center?: number; i: number }>,
  domainId: number,
  cellId: number
): EditorMutationResult {
  const domain = domains.find(candidate => candidate.i === domainId);
  if (!domain || domain.center === undefined || domain.center === cellId) return unchanged(layer);
  const previousCellId = domain.center;
  domain.center = cellId;
  return changed(layer, [domainId], uniqueIds([previousCellId, cellId]));
}

export function setZoneCells(zones: Zone[], zoneId: number, cellIds: readonly number[]): EditorMutationResult {
  const zone = zones.find(candidate => candidate.i === zoneId);
  if (!zone) return unchanged("zones");
  const previous = new Set(zone.cells);
  const next = uniqueIds([...cellIds]);
  if (previous.size === next.length && next.every(cellId => previous.has(cellId))) return unchanged("zones");
  const nextSet = new Set(next);
  const affectedCellIds = uniqueIds([
    ...zone.cells.filter(cellId => !nextSet.has(cellId)),
    ...next.filter(cellId => !previous.has(cellId))
  ]);
  zone.cells = next;
  return changed("zones", [zoneId], affectedCellIds);
}

export function moveFeatureVertex(
  graph: Pick<PackedGraph, "features" | "vertices">,
  featureId: number,
  vertexId: number,
  point: [number, number]
): EditorMutationResult {
  const feature = graph.features.find(candidate => candidate.i === featureId);
  const previous = graph.vertices.p[vertexId];
  if (!feature?.vertices.includes(vertexId) || !previous) return unchangedFeatureGeometry();
  if (previous[0] === point[0] && previous[1] === point[1]) return unchangedFeatureGeometry();
  graph.vertices.p[vertexId] = point;
  feature.area = Math.abs(getPolygonArea(feature.vertices.map(id => graph.vertices.p[id])));
  return {
    affectedCellIds: graph.vertices.c[vertexId]?.filter(cellId => cellId >= 0) ?? [],
    affectedDomainIds: [featureId],
    changed: true,
    layers: FEATURE_GEOMETRY_LAYERS
  };
}

export function setFeatureGroup(
  graph: Pick<PackedGraph, "features">,
  featureId: number,
  group: string
): EditorMutationResult {
  const feature = graph.features.find(candidate => candidate.i === featureId);
  const layer = feature?.type === "lake" ? "lakes" : "coastline";
  if (!feature || feature.group === group) return unchanged(layer);
  feature.group = group;
  return changed(layer, [featureId]);
}

export function moveReliefIcon(
  graph: Pick<PackedGraph, "relief">,
  reliefId: number,
  point: { x: number; y: number }
): EditorMutationResult {
  const icon = graph.relief.find(candidate => candidate.i === reliefId);
  if (!icon || (icon.x === point.x && icon.y === point.y)) return unchanged("relief");
  icon.x = point.x;
  icon.y = point.y;
  return changed("relief", [reliefId]);
}

export function resizeReliefIcon(
  graph: Pick<PackedGraph, "relief">,
  reliefId: number,
  size: number
): EditorMutationResult {
  const icon = graph.relief.find(candidate => candidate.i === reliefId);
  if (!icon || icon.s === size) return unchanged("relief");
  const shift = (size - icon.s) / 2;
  icon.s = size;
  icon.x -= shift;
  icon.y -= shift;
  return changed("relief", [reliefId]);
}

export function setReliefIconType(
  graph: Pick<PackedGraph, "relief">,
  reliefId: number,
  iconType: string
): EditorMutationResult {
  const icon = graph.relief.find(candidate => candidate.i === reliefId);
  if (!icon || icon.icon === iconType) return unchanged("relief");
  icon.icon = iconType;
  return changed("relief", [reliefId]);
}

export function insertReliefIcon(
  graph: Pick<PackedGraph, "relief">,
  icon: ReliefIcon,
  index = graph.relief.length
): EditorMutationResult {
  icon.i ??= getNextReliefIconId(graph.relief);
  if (graph.relief.some(candidate => candidate.i === icon.i)) return unchanged("relief");
  graph.relief.splice(Math.max(0, Math.min(index, graph.relief.length)), 0, icon);
  return changed("relief", [icon.i]);
}

export function removeReliefIcons(
  graph: Pick<PackedGraph, "relief">,
  reliefIds: ReadonlySet<number>
): EditorMutationResult {
  const removed = graph.relief.filter(icon => icon.i !== undefined && reliefIds.has(icon.i));
  if (!removed.length) return unchanged("relief");
  graph.relief = graph.relief.filter(icon => icon.i === undefined || !reliefIds.has(icon.i));
  return changed(
    "relief",
    removed.map(icon => icon.i!)
  );
}

export function reorderReliefIcon(
  graph: Pick<PackedGraph, "relief">,
  reliefId: number,
  direction: "back" | "front"
): EditorMutationResult {
  const index = graph.relief.findIndex(icon => icon.i === reliefId);
  if (
    index < 0 ||
    (direction === "front" && index === graph.relief.length - 1) ||
    (direction === "back" && index === 0)
  ) {
    return unchanged("relief");
  }
  const [icon] = graph.relief.splice(index, 1);
  if (direction === "front") graph.relief.push(icon);
  else graph.relief.unshift(icon);
  return changed("relief", [reliefId]);
}

export function setLabelOverride(
  entity: { i: number; label?: Label },
  type: LabelType,
  label: Label
): EditorMutationResult {
  if (sameLabel(entity.label, label)) return unchanged("labels");
  entity.label = structuredClone(label);
  return changed("labels", [`${type}:${entity.i}`]);
}

export function insertRoutePoint(route: Route, index: number, point: RouteControlPoint): EditorMutationResult {
  if (index < 0 || index > route.points.length) return unchanged("routes");
  route.points.splice(index, 0, point);
  return changed("routes", [route.i], [point[2]]);
}

export function moveRoutePoint(route: Route, index: number, point: RouteControlPoint): EditorMutationResult {
  const previous = route.points[index];
  if (!previous || (previous[0] === point[0] && previous[1] === point[1] && previous[2] === point[2])) {
    return unchanged("routes");
  }
  route.points[index] = point;
  return changed("routes", [route.i], uniqueIds([previous[2], point[2]]));
}

export function removeRoutePoint(route: Route, index: number): EditorMutationResult {
  const point = route.points[index];
  if (!point) return unchanged("routes");
  route.points.splice(index, 1);
  return changed("routes", [route.i], [point[2]]);
}

export function replaceRoutePoints(route: Route, points: number[][]): EditorMutationResult {
  if (samePoints(route.points, points)) return unchanged("routes");
  const affectedCellIds = uniqueIds([...route.points.map(point => point[2]), ...points.map(point => point[2])]);
  route.points = points;
  return changed("routes", [route.i], affectedCellIds);
}

export function insertRiverPoint(
  river: River,
  index: number,
  point: RiverControlPoint,
  cellId: number
): EditorMutationResult {
  if (!river.points || index < 0 || index > river.points.length) return unchanged("rivers");
  river.points.splice(index, 0, point);
  return changed("rivers", [river.i], [cellId]);
}

export function moveRiverPoint(
  river: River,
  index: number,
  point: RiverControlPoint,
  previousCellId: number,
  cellId: number
): EditorMutationResult {
  const previous = river.points?.[index];
  if (!previous || (previous[0] === point[0] && previous[1] === point[1])) return unchanged("rivers");
  river.points![index] = point;
  return changed("rivers", [river.i], uniqueIds([previousCellId, cellId]));
}

export function removeRiverPoint(river: River, index: number, cellId: number): EditorMutationResult {
  if (!river.points?.[index]) return unchanged("rivers");
  river.points.splice(index, 1);
  return changed("rivers", [river.i], [cellId]);
}

function changed(
  layer: MapLayerId,
  affectedDomainIds: Array<number | string>,
  affectedCellIds: number[] = []
): EditorMutationResult {
  return { affectedCellIds, affectedDomainIds, changed: true, layers: [layer] };
}

function unchanged(layer: MapLayerId): EditorMutationResult {
  return { affectedCellIds: [], affectedDomainIds: [], changed: false, layers: [layer] };
}

function unchangedFeatureGeometry(): EditorMutationResult {
  return { affectedCellIds: [], affectedDomainIds: [], changed: false, layers: FEATURE_GEOMETRY_LAYERS };
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function samePoints(left: number[][], right: number[][]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (point, index) => point[0] === right[index][0] && point[1] === right[index][1] && point[2] === right[index][2]
    )
  );
}

function getPolygonArea(points: readonly [number, number][]): number {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function sameLabel(left: Label | undefined, right: Label): boolean {
  if (!left) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

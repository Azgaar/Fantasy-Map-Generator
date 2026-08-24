import { findClosestCell } from "@/utils/graphUtils";
import type { MapLayerId } from "../core/layer-registry";
import { MAP_LAYER_REGISTRY } from "../core/layer-registry";
import type { MapDomainKind, MapHitKind, ScreenPoint } from "../core/map-renderer";
import { estimateTextWidth } from "../labels/fit-state-label";
import { buildBaseGeographyScene } from "../scene/layers/base-geography-scene";
import { buildIceScene, buildMarketScene } from "../scene/layers/economic-ice-scene";
import { buildEmblemScene } from "../scene/layers/emblem-scene";
import { buildLabelScene } from "../scene/layers/label-scene";
import { buildBurgPointSymbolScene, buildMarkerPointSymbolScene } from "../scene/layers/point-symbol-scene";
import { buildMilitaryScene } from "../scene/layers/population-military-scene";
import { buildReliefSpriteScene } from "../scene/layers/relief-sprite-scene";
import { buildRiverScene, buildRouteScene } from "../scene/layers/river-route-scene";
import { buildZoneScene } from "../scene/layers/zone-scene";
import type { MapRenderWorld } from "../scene/render-world";
import type { MapStyle } from "../scene/styles";

interface PickEntryBase {
  active?: boolean;
  dependency?: MapLayerId | null;
  domainId: number | string;
  domainKind: MapDomainKind;
  kind: MapHitKind;
  layer: MapLayerId;
  maxScale?: number | null;
  minScale?: number | null;
  priority?: number;
  subPart?: Readonly<Record<string, boolean | number | string>>;
}

export interface PointPickEntry extends PickEntryBase {
  radius: number;
  rescale?: boolean;
  shape: "point";
  x: number;
  y: number;
}

export interface LinePickEntry extends PickEntryBase {
  hitWidth: number;
  points: readonly (readonly [number, number])[];
  shape: "line";
}

export interface PolygonPickEntry extends PickEntryBase {
  hitWidth?: number;
  points: readonly (readonly [number, number])[];
  shape: "polygon";
  strict?: boolean;
}

export interface BoxPickEntry extends PickEntryBase {
  height: number;
  rescale?: boolean;
  shape: "box";
  width: number;
  x: number;
  y: number;
}

export type MapPickEntry = PointPickEntry | LinePickEntry | PolygonPickEntry | BoxPickEntry;

export interface IndexedMapHit {
  distance: number;
  domainId: number | string;
  domainKind: MapDomainKind;
  kind: MapHitKind;
  layer: MapLayerId;
  mapPoint: ScreenPoint;
  subPart?: Readonly<Record<string, boolean | number | string>>;
}

export interface MapPickingQuery {
  cameraScale: number;
  isLayerVisible: (layer: MapLayerId) => boolean;
  tolerance: number;
}

interface Bounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

const LAYER_PRIORITY = new Map(MAP_LAYER_REGISTRY.map(layer => [layer.id, layer.order]));

export class MapPickingIndex {
  private readonly spatial = new BoundsSpatialIndex<MapPickEntry>();
  private world: MapRenderWorld | null = null;
  private worldBounds: Bounds | null = null;

  replace(world: MapRenderWorld, style: MapStyle): void {
    this.replaceEntries(buildMapPickEntries(world, style), world);
  }

  replaceEntries(entries: readonly MapPickEntry[], areaWorld: MapRenderWorld | null = null): void {
    this.world = areaWorld;
    this.worldBounds = areaWorld ? getWorldBounds(areaWorld) : null;
    this.spatial.replace(entries, getEntryBounds);
  }

  clear(): void {
    this.world = null;
    this.worldBounds = null;
    this.spatial.clear();
  }

  getSize(): number {
    return this.spatial.size;
  }

  pick(mapPoint: ScreenPoint, query: MapPickingQuery): IndexedMapHit | null {
    const cameraScale = Math.max(query.cameraScale, 0.01);
    const searchRadius = query.tolerance + 24 / cameraScale;
    const candidates = this.spatial
      .query({
        maxX: mapPoint.x + searchRadius,
        maxY: mapPoint.y + searchRadius,
        minX: mapPoint.x - searchRadius,
        minY: mapPoint.y - searchRadius
      })
      .filter(entry => isEntryVisible(entry, query, cameraScale))
      .map(entry => ({ distance: distanceToEntry(mapPoint, entry, cameraScale), entry }))
      .filter(candidate => Number.isFinite(candidate.distance) && candidate.distance <= query.tolerance)
      .sort(compareCandidates);
    const candidate = candidates[0];
    if (candidate) {
      const { entry, distance } = candidate;
      return {
        distance,
        domainId: entry.domainId,
        domainKind: entry.domainKind,
        kind: entry.kind,
        layer: entry.layer,
        mapPoint,
        subPart: entry.subPart
      };
    }
    return this.pickArea(mapPoint, query);
  }

  private pickArea(mapPoint: ScreenPoint, query: MapPickingQuery): IndexedMapHit | null {
    const world = this.world;
    const bounds = this.worldBounds;
    if (!world || !bounds || !containsPoint(bounds, mapPoint)) return null;
    const cellId = findClosestCell(mapPoint.x, mapPoint.y, undefined, world);
    if (cellId === undefined) return null;

    for (const [layer, domainKind, assignments] of [
      ["provinces", "province", world.cells.province],
      ["states", "state", world.cells.state],
      ["cultures", "culture", world.cells.culture],
      ["religions", "religion", world.cells.religion],
      ["biomes", "biome", world.cells.biome]
    ] as const) {
      const domainId = Number(assignments[cellId]);
      if (domainId && query.isLayerVisible(layer)) {
        return {
          distance: 0,
          domainId,
          domainKind,
          kind: "area",
          layer,
          mapPoint,
          subPart: { cellId }
        };
      }
    }

    if (query.isLayerVisible("cells")) {
      return {
        distance: 0,
        domainId: cellId,
        domainKind: "cell",
        kind: "area",
        layer: "cells",
        mapPoint,
        subPart: { cellId }
      };
    }
    const layer = Number(world.cells.h[cellId]) >= 20 ? "landmass" : "ocean";
    if (!query.isLayerVisible(layer)) return null;
    return {
      distance: 0,
      domainId: cellId,
      domainKind: "cell",
      kind: "area",
      layer,
      mapPoint,
      subPart: { featureId: Number(world.cells.f[cellId]) || 0 }
    };
  }
}

export function buildMapPickEntries(world: MapRenderWorld, style: MapStyle): MapPickEntry[] {
  const bounds = getWorldBounds(world);
  if (!bounds) return [];
  const mapBounds = { height: bounds.maxY - bounds.minY, width: bounds.maxX - bounds.minX };
  const entries: MapPickEntry[] = [];

  const geography = buildBaseGeographyScene(world, mapBounds);
  for (const polygon of geography.lakes.polygons) {
    entries.push(polygonEntry("lakes", "lake", polygon.domainId, polygon.points, true));
  }
  for (const path of geography.coastline.paths) {
    entries.push(
      lineEntry("coastline", "coastline", path.domainId, path.points, lineWidth(style.coastline, path.role))
    );
  }

  if (style.rivers.opacity > 0 && style.rivers.fill.opacity > 0) {
    const rivers = buildRiverScene(world, mapBounds);
    for (const polygon of rivers.polygons) {
      entries.push(polygonEntry("rivers", "river", polygon.domainId, polygon.points, false, 1));
    }
  }
  const routes = buildRouteScene(world);
  for (const path of routes.paths) {
    const routeStyle = style.routes.roles[path.role ?? ""] ?? style.routes.default;
    if (routeStyle.opacity > 0 && routeStyle.width > 0) {
      entries.push(lineEntry("routes", "route", path.domainId, path.points, routeStyle.width));
    }
  }

  if (style.zones.opacity > 0) {
    const zones = buildZoneScene(world, 0, { filterType: style.zones.filterType });
    for (const zone of zones.zones) {
      for (const polygon of zone.polygons) {
        entries.push(polygonEntry("zones", "zone", zone.zoneId, polygon.points, true));
      }
    }
  }
  if (style.ice.opacity > 0) {
    const ice = buildIceScene(world, 0);
    for (const polygon of ice.polygons)
      entries.push(polygonEntry("ice", "ice", polygon.domainId, polygon.points, true));
  }

  if (style.relief.opacity > 0) {
    const relief = buildReliefSpriteScene(world.relief, 0);
    for (const icon of relief.instances) {
      entries.push({
        domainId: icon.domainId,
        domainKind: "relief",
        height: icon.height,
        kind: "point",
        layer: "relief",
        shape: "box",
        width: icon.width,
        x: icon.x + icon.width / 2,
        y: icon.y + icon.height / 2
      });
    }
  }

  const burgs = buildBurgPointSymbolScene(world.burgs, style.burgIcons, 0);
  for (const symbol of burgs.icons.instances) {
    if (style.burgIcons.opacity > 0 && symbol.opacity > 0) {
      entries.push(pointEntry("burgIcons", "burg", symbol.domainId, symbol.x, symbol.y, symbol.size / 2));
    }
  }
  const markers = buildMarkerPointSymbolScene(
    world.markers,
    style.markers,
    world.markerRenderState ?? { pinnedOnly: false, visibleIds: null },
    0
  );
  for (const marker of markers.instances) {
    if (style.markers.opacity > 0 && marker.opacity > 0) {
      entries.push({
        ...pointEntry("markers", "marker", marker.domainId, marker.x, marker.y, marker.size / 2),
        rescale: marker.rescale
      });
    }
  }

  if (style.markets.opacity > 0) {
    const markets = buildMarketScene(world, 0);
    for (const market of markets.markets) {
      if (!market.center) continue;
      entries.push(
        pointEntry("markets", "market", market.marketId, market.center.x, market.center.y, style.markets.iconSize / 2)
      );
    }
  }
  if (style.military.opacity > 0) {
    const military = buildMilitaryScene(world, 0);
    for (const regiment of military.regiments) {
      entries.push({
        ...pointEntry("military", "regiment", regiment.domainId, regiment.x, regiment.y, style.military.boxSize * 2),
        subPart: { regimentId: regiment.regimentId, stateId: regiment.stateId }
      });
    }
  }

  if (style.emblems.opacity > 0) {
    const emblems = buildEmblemScene(world, mapBounds, style.emblems, 0);
    for (const group of emblems.groups) {
      for (const emblem of group.items) {
        entries.push({
          ...pointEntry("emblems", "emblem", emblem.entityId, emblem.x, emblem.y, emblem.size / 2),
          maxScale: style.emblems.automaticVisibility ? 300 / Math.max(group.baseSize, 0.01) : null,
          minScale: style.emblems.automaticVisibility ? 25 / Math.max(group.baseSize, 0.01) : null,
          subPart: { type: emblem.type }
        });
      }
    }
  }

  if (world.labelRenderState) {
    const labels = buildLabelScene(world.labelRenderState, 0);
    for (const group of labels.groups) {
      if (!group.active || group.style.opacity <= 0) continue;
      for (const label of group.labels) {
        const common = {
          active: group.active,
          dependency: group.dependency,
          domainId: label.domainId,
          domainKind: "label" as const,
          kind: "label" as const,
          layer: "labels" as const,
          maxScale: labels.showAll ? null : group.maxScale,
          minScale: labels.showAll ? null : group.minScale,
          rescale: labels.resizeOnZoom,
          subPart: { entityId: label.entityId, type: label.type }
        };
        if (label.curvedGlyphs?.length) {
          for (const glyph of label.curvedGlyphs) {
            entries.push({ ...common, radius: label.fontSize / 2, shape: "point", x: glyph.x, y: glyph.y });
          }
        } else {
          const lines = label.text.split("\n");
          entries.push({
            ...common,
            height: lines.length * label.fontSize,
            shape: "box",
            width: Math.max(...lines.map(line => estimateTextWidth(line) * label.fontSize)),
            x: label.anchorX,
            y: label.anchorY
          });
        }
      }
    }
  }
  return entries;
}

class BoundsSpatialIndex<T> {
  private readonly buckets = new Map<string, number[]>();
  private items: T[] = [];

  constructor(private readonly bucketSize = 64) {}

  get size(): number {
    return this.items.length;
  }

  replace(items: readonly T[], getBounds: (item: T) => Bounds): void {
    this.clear();
    this.items = [...items];
    items.forEach((item, index) => {
      const bounds = getBounds(item);
      for (
        let column = Math.floor(bounds.minX / this.bucketSize);
        column <= Math.floor(bounds.maxX / this.bucketSize);
        column++
      ) {
        for (
          let row = Math.floor(bounds.minY / this.bucketSize);
          row <= Math.floor(bounds.maxY / this.bucketSize);
          row++
        ) {
          const key = `${column}:${row}`;
          const bucket = this.buckets.get(key);
          if (bucket) bucket.push(index);
          else this.buckets.set(key, [index]);
        }
      }
    });
  }

  query(bounds: Bounds): T[] {
    const indexes = new Set<number>();
    for (
      let column = Math.floor(bounds.minX / this.bucketSize);
      column <= Math.floor(bounds.maxX / this.bucketSize);
      column++
    ) {
      for (
        let row = Math.floor(bounds.minY / this.bucketSize);
        row <= Math.floor(bounds.maxY / this.bucketSize);
        row++
      ) {
        for (const index of this.buckets.get(`${column}:${row}`) ?? []) indexes.add(index);
      }
    }
    return [...indexes].sort((left, right) => left - right).map(index => this.items[index]);
  }

  clear(): void {
    this.buckets.clear();
    this.items = [];
  }
}

function isEntryVisible(entry: MapPickEntry, query: MapPickingQuery, cameraScale: number): boolean {
  if (entry.active === false || !query.isLayerVisible(entry.layer)) return false;
  if (entry.dependency && !query.isLayerVisible(entry.dependency)) return false;
  if (entry.minScale != null && cameraScale < entry.minScale) return false;
  if (entry.maxScale != null && cameraScale > entry.maxScale) return false;
  return true;
}

function compareCandidates(
  left: { distance: number; entry: MapPickEntry },
  right: { distance: number; entry: MapPickEntry }
): number {
  const priority = getPriority(right.entry) - getPriority(left.entry);
  if (priority) return priority;
  const distance = left.distance - right.distance;
  if (distance) return distance;
  return `${left.entry.domainKind}:${left.entry.domainId}`.localeCompare(
    `${right.entry.domainKind}:${right.entry.domainId}`
  );
}

function getPriority(entry: MapPickEntry): number {
  return entry.priority ?? LAYER_PRIORITY.get(entry.layer) ?? 0;
}

function distanceToEntry(point: ScreenPoint, entry: MapPickEntry, cameraScale: number): number {
  if (entry.shape === "point") {
    const radius = entry.rescale ? Math.max((entry.radius * 2) / 5 + 24 / cameraScale, 1) / 2 : entry.radius;
    return Math.max(0, Math.hypot(point.x - entry.x, point.y - entry.y) - radius);
  }
  if (entry.shape === "box") {
    const scale = entry.rescale ? Math.max((1 + 1 / cameraScale) / 2, 0.01) : 1;
    return distanceToBox(point, {
      maxX: entry.x + (entry.width * scale) / 2,
      maxY: entry.y + (entry.height * scale) / 2,
      minX: entry.x - (entry.width * scale) / 2,
      minY: entry.y - (entry.height * scale) / 2
    });
  }
  if (entry.shape === "line") return Math.max(0, distanceToPolyline(point, entry.points, false) - entry.hitWidth / 2);
  if (pointInPolygon(point, entry.points)) return 0;
  if (entry.strict) return Number.POSITIVE_INFINITY;
  return Math.max(0, distanceToPolyline(point, entry.points, true) - (entry.hitWidth ?? 0) / 2);
}

function getEntryBounds(entry: MapPickEntry): Bounds {
  if (entry.shape === "point") {
    return {
      maxX: entry.x + entry.radius,
      maxY: entry.y + entry.radius,
      minX: entry.x - entry.radius,
      minY: entry.y - entry.radius
    };
  }
  if (entry.shape === "box") {
    return {
      maxX: entry.x + entry.width / 2,
      maxY: entry.y + entry.height / 2,
      minX: entry.x - entry.width / 2,
      minY: entry.y - entry.height / 2
    };
  }
  return getPointsBounds(entry.points);
}

function distanceToBox(point: ScreenPoint, bounds: Bounds): number {
  const dx = Math.max(bounds.minX - point.x, 0, point.x - bounds.maxX);
  const dy = Math.max(bounds.minY - point.y, 0, point.y - bounds.maxY);
  return Math.hypot(dx, dy);
}

function distanceToPolyline(
  point: ScreenPoint,
  points: readonly (readonly [number, number])[],
  closed: boolean
): number {
  let distance = Number.POSITIVE_INFINITY;
  const segmentCount = Math.max(0, points.length - 1) + (closed && points.length > 2 ? 1 : 0);
  for (let index = 0; index < segmentCount; index++) {
    distance = Math.min(distance, distanceToSegment(point, points[index], points[(index + 1) % points.length]));
  }
  return distance;
}

function distanceToSegment(
  point: ScreenPoint,
  start: readonly [number, number],
  end: readonly [number, number]
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const progress = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - start[0]) * dx + (point.y - start[1]) * dy) / lengthSquared))
    : 0;
  return Math.hypot(point.x - (start[0] + progress * dx), point.y - (start[1] + progress * dy));
}

function pointInPolygon(point: ScreenPoint, points: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [x, y] = points[index];
    const [previousX, previousY] = points[previous];
    if (y > point.y === previousY > point.y) continue;
    const intersectionX = ((previousX - x) * (point.y - y)) / (previousY - y) + x;
    if (point.x < intersectionX) inside = !inside;
  }
  return inside;
}

function pointEntry(
  layer: MapLayerId,
  domainKind: MapDomainKind,
  domainId: number | string,
  x: number,
  y: number,
  radius: number
): PointPickEntry {
  return { domainId, domainKind, kind: "point", layer, radius: Math.max(0, radius), shape: "point", x, y };
}

function lineEntry(
  layer: MapLayerId,
  domainKind: MapDomainKind,
  domainId: number | string,
  points: readonly (readonly [number, number])[],
  hitWidth: number
): LinePickEntry {
  return { domainId, domainKind, hitWidth, kind: "line", layer, points, shape: "line" };
}

function polygonEntry(
  layer: MapLayerId,
  domainKind: MapDomainKind,
  domainId: number | string,
  points: readonly (readonly [number, number])[],
  strict: boolean,
  hitWidth = 0
): PolygonPickEntry {
  return { domainId, domainKind, hitWidth, kind: "area", layer, points, shape: "polygon", strict };
}

function lineWidth(style: MapStyle["coastline"], role: string | undefined): number {
  return (role ? style.roles[role] : undefined)?.width ?? style.default.width;
}

function getPointsBounds(points: readonly (readonly [number, number])[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { maxX, maxY, minX, minY };
}

function getWorldBounds(world: MapRenderWorld): Bounds | null {
  if (!world.vertices.p.length) return null;
  return getPointsBounds(world.vertices.p);
}

function containsPoint(bounds: Bounds, point: ScreenPoint): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

import type { Point } from "@/types/global";
import { sampleCatmullRom } from "@/utils/curve";
import { meander } from "@/utils/meander";
import type { LineBatchPrimitive, PolygonPathBatchPrimitive, SceneBounds, SceneRevision } from "../primitives";
import type { MapRenderWorld } from "../render-world";

export interface RiverRouteSceneBounds {
  height: number;
  width: number;
}

const FLUX_FACTOR = 500;
const MAX_FLUX_WIDTH = 1;
const LENGTH_FACTOR = 200;
const LENGTH_PROGRESSION = [1, 1, 2, 3, 5, 8, 13, 21, 34].map(value => value / LENGTH_FACTOR);

export function buildRiverScene(
  world: Pick<MapRenderWorld, "cells" | "rivers">,
  bounds: RiverRouteSceneBounds,
  revision: SceneRevision = 0
): PolygonPathBatchPrimitive {
  const polygons = world.rivers.flatMap(river => {
    if (!river.cells || river.cells.length < 2) return [];
    const anchors = river.points?.length === river.cells.length ? river.points : undefined;
    const sourceCell = river.cells[0];
    const { points, anchorIndices } = meander(river.cells, world.cells.p, {
      anchors,
      bounds,
      isWaterCell: river.cells.map(cellId => cellId !== -1 && world.cells.h[cellId] < 20),
      meandering: 0.5,
      startStep: sourceCell !== -1 && world.cells.h[sourceCell] < 20 ? 1 : 10
    });
    if (points.length < 2) return [];

    const flux = new Array<number>(points.length).fill(0);
    anchorIndices.forEach((pointIndex, anchorIndex) => {
      const cellId = river.cells[anchorIndex];
      const fluxCell = cellId === -1 ? river.cells[anchorIndex - 1] : cellId;
      flux[pointIndex] = fluxCell === undefined ? 0 : Number(world.cells.fl[fluxCell]) || 0;
    });
    const polygon = buildVariableWidthRiver(points, flux, river.widthFactor, river.sourceWidth);
    if (polygon.length < 3) return [];
    return [{ domainId: river.i, points: polygon, role: `basin:${river.basin}` }];
  });

  return {
    bounds: getPathBounds(polygons),
    domainIds: polygons.map(polygon => polygon.domainId),
    kind: "polygon-path-batch",
    layer: "rivers",
    polygons,
    revision
  };
}

export function buildRouteScene(
  world: Pick<MapRenderWorld, "routes">,
  revision: SceneRevision = 0
): LineBatchPrimitive {
  const paths = world.routes.flatMap(route => {
    if (!route.points || route.points.length < 2) return [];
    const anchors = route.points.map(([x, y]) => [x, y] as Point);
    const points = sampleCatmullRom(anchors, route.group === "searoutes" ? 0.5 : 0.1);
    if (points.length < 2) return [];
    return [{ domainId: route.i, points, role: route.group || "default" }];
  });

  return {
    bounds: getPathBounds(paths),
    domainIds: paths.map(path => path.domainId),
    kind: "line-batch",
    layer: "routes",
    paths,
    revision
  };
}

function buildVariableWidthRiver(
  points: readonly Point[],
  fluxAtPoint: readonly number[],
  widthFactor: number,
  sourceWidth: number
): Point[] {
  const left: Point[] = [];
  const right: Point[] = [];
  let flux = 0;

  for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
    const [x0, y0] = points[pointIndex - 1] ?? points[pointIndex];
    const [x1, y1] = points[pointIndex];
    const [x2, y2] = points[pointIndex + 1] ?? points[pointIndex];
    flux = Math.max(flux, fluxAtPoint[pointIndex] || 0);
    const offset = getRiverOffset(flux, pointIndex, widthFactor, sourceWidth);
    const angle = Math.atan2(y0 - y2, x0 - x2);
    const sinOffset = Math.sin(angle) * offset;
    const cosOffset = Math.cos(angle) * offset;
    left.push([x1 - sinOffset, y1 + cosOffset]);
    right.push([x1 + sinOffset, y1 - cosOffset]);
  }

  return [...sampleCatmullRom(right.reverse(), 0.1), ...sampleCatmullRom(left, 0.1)];
}

function getRiverOffset(flux: number, pointIndex: number, widthFactor: number, sourceWidth: number): number {
  if (pointIndex === 0) return sourceWidth;
  const fluxWidth = Math.min(flux ** 0.7 / FLUX_FACTOR, MAX_FLUX_WIDTH);
  const lengthWidth = pointIndex / LENGTH_FACTOR + (LENGTH_PROGRESSION[pointIndex] ?? LENGTH_PROGRESSION.at(-1) ?? 0);
  return widthFactor * (lengthWidth + fluxWidth) + sourceWidth;
}

function getPathBounds(paths: readonly { points: readonly Point[] }[]): SceneBounds | null {
  let bounds: SceneBounds | null = null;
  for (const path of paths) {
    for (const [x, y] of path.points) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      bounds = bounds
        ? {
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y),
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y)
          }
        : { maxX: x, maxY: y, minX: x, minY: y };
    }
  }
  return bounds;
}

import type { LabelNameMode, PathLabel } from "@/generators/labels";
import type { Province } from "@/generators/provinces-generator";
import type { State } from "@/generators/states-generator";
import type { TypedArray } from "@/types/PackedGraph";
import { ANGLES, findBestRayPair, raycast } from "./label-raycast";
import type { PathLabelData } from "./types";

export interface LabelTypography {
  averageCharacterWidth: number;
  letterSpacing: number;
}

export function createRegionLabel(data: State | Province, type: "state" | "province"): PathLabelData {
  // implement minimal logic to create a label for a region (state or province) based on its properties
  const pathPoints = data.label?.pathPoints || [];
  return {
    id: `${type}Label${data.i}`,
    type,
    text: data.label?.text || data.name,
    group: data.label?.group || type,
    dx: data.label?.dx,
    dy: data.label?.dy,
    fontSize: data.label?.fontSize,
    letterSpacing: data.label?.letterSpacing,
    pathPoints
  };
}

export function selectRegionLabelName(
  name: string,
  fullName: string,
  mode: LabelNameMode,
  pathCapacity = Number.POSITIVE_INFINITY
): string {
  if (mode === "short") return name;
  if (mode === "full") return fullName;
  return fullName.length <= pathCapacity ? fullName : name;
}

function _getEffectiveCharacterWidth(
  groupTypography: LabelTypography,
  override: Pick<PathLabel, "fontSize" | "letterSpacing"> | undefined
): number {
  const relativeSize = (override?.fontSize ?? 100) / 100;
  const averageGlyphWidth = Math.max(groupTypography.averageCharacterWidth - groupTypography.letterSpacing, 0);
  const letterSpacing = override?.letterSpacing ?? groupTypography.letterSpacing;
  return averageGlyphWidth * relativeSize + letterSpacing;
}

function _getRegionLabelPath(
  regionId: number,
  regionIds: TypedArray,
  pole: [number, number],
  cellsNumber: number
): [number, number][] {
  if (cellsNumber <= 0) return [];
  const offset = cellsNumber < 40 ? 0 : cellsNumber < 200 ? 5 : 10;
  const maxLakeSize = cellsNumber / 20;
  const [x0, y0] = pole;
  const rays = ANGLES.map(({ angle, dx, dy }) => ({
    angle,
    ...raycast({ regionId, regionIds, x0, y0, dx, dy, maxLakeSize, offset })
  }));
  const [ray1, ray2] = findBestRayPair(rays);
  if (ray1.length <= 0 && ray2.length <= 0) return [];
  const path: [number, number][] = [[ray1.x, ray1.y], pole, [ray2.x, ray2.y]];
  if (ray1.x > ray2.x) path.reverse();
  return path;
}

function _getPathCapacity(points: readonly [number, number][], averageCharacterWidth = 4): number {
  if (!points.length) return 0;
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];
    length += Math.hypot(x2 - x1, y2 - y1);
  }
  const safeCharacterWidth =
    Number.isFinite(averageCharacterWidth) && averageCharacterWidth > 0 ? averageCharacterWidth : 4;
  return Math.max(Math.floor(length / safeCharacterWidth), 1);
}

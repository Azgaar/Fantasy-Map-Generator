import type { PathLabel } from "@/generators/labels";
import type { LabelNameMode } from "@/types/labels";
import type { TypedArray } from "@/types/PackedGraph";
import { ANGLES, findBestRayPair, raycast } from "./label-raycast";

type RegionLabelInput = {
  id: number;
  prefix: "state" | "province";
  name: string;
  fullName: string;
  pole: [number, number];
  cellsNumber: number;
  regionIds: TypedArray;
  mode: LabelNameMode;
  averageCharacterWidth?: number;
  override?: PathLabel;
};

export interface LabelTypography {
  averageCharacterWidth: number;
  letterSpacing: number;
}

export function createRegionLabel(input: RegionLabelInput): PathLabel & { id: string; text: string } {
  const pathPoints =
    input.cellsNumber <= 0
      ? []
      : input.override?.pathPoints?.length
        ? input.override.pathPoints
        : getRegionLabelPath(input.id, input.regionIds, input.pole, input.cellsNumber);
  return {
    ...input.override,
    id: `${input.prefix}Label${input.id}`,
    text:
      input.override?.text ??
      selectRegionLabelName(
        input.name,
        input.fullName,
        input.mode,
        getPathCapacity(pathPoints, input.averageCharacterWidth)
      ),
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

export function getEffectiveCharacterWidth(
  groupTypography: LabelTypography,
  override: Pick<PathLabel, "fontSize" | "letterSpacing"> | undefined
): number {
  const relativeSize = (override?.fontSize ?? 100) / 100;
  const averageGlyphWidth = Math.max(groupTypography.averageCharacterWidth - groupTypography.letterSpacing, 0);
  const letterSpacing = override?.letterSpacing ?? groupTypography.letterSpacing;
  return averageGlyphWidth * relativeSize + letterSpacing;
}

export function getRegionLabelPath(
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

function getPathCapacity(points: readonly [number, number][], averageCharacterWidth = 4): number {
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

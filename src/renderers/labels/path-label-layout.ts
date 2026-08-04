import type { LabelType, PathLabel } from "@/generators/labels";
import type { Point } from "@/types/global";
import type { PathLabelData } from "./types";

export function getPathLabel(
  entity: { i: number; name?: string; type?: string; label?: PathLabel },
  type: LabelType,
  points: (() => Point[]) | number[][]
): PathLabelData {
  const getPoints = typeof points === "function" ? points : () => points.map(([x, y]) => [x, y] as Point);
  return {
    ...entity.label,
    id: `${type}Label${entity.i}`,
    type,
    text: entity.label?.text ?? (entity.type ? `${entity.name} ${entity.type}` : entity.name || ""),
    group: entity.label?.group || type,
    pathPoints: entity.label?.pathPoints || formatPoints(getPoints()),
    startOffset: entity.label?.startOffset ?? 50
  };
}

function formatPoints(points: Point[]) {
  if (points.length && points.at(0)![0] > points.at(-1)![0]) points.reverse();
  return points;
}

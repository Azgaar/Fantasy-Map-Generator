import type { LabelType } from "@/generators/labels-generator";
import type { Point } from "@/types/global";

interface BaseLabelData {
  id: string;
  entityId: number; // stateId, provinceId, burgId, labelId
  text: string;
  type: LabelType;
  group: string;
  anchor: Point;
  fontSize?: number;
  letterSpacing?: number;
  dx?: number;
  dy?: number;
}

export interface PathLabelData extends BaseLabelData {
  pathPoints: Point[];
  startOffset?: number;
}

export interface PointLabelData extends BaseLabelData {
  x: number;
  y: number;
}

export type LabelData = PathLabelData | PointLabelData;

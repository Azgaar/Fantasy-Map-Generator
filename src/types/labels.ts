import type { LabelGroup, LabelType } from "@/generators/labels";
import type { Point } from "@/types/global";

export type LabelsOptions = { resizeOnZoom: boolean; showAll: boolean; groups: LabelGroup[] };

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

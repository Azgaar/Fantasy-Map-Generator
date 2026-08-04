import type {
  LabelGroup,
  LabelGroupStyle,
  LabelNameMode,
  LabelStyles,
  LabelType,
  LabelZoomBounds
} from "@/generators/labels";
import type { Point } from "@/types/global";

export type LabelGroupType = LabelType;
export type LabelGroupOptions = LabelGroup;
export type LabelsOptions = { resizeOnZoom: boolean; showAll: boolean; groups: LabelGroup[] };

interface BaseLabelData {
  id: string;
  text: string;
  type: LabelType;
  group: string;
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
export type { LabelGroupStyle, LabelNameMode, LabelStyles, LabelType, LabelZoomBounds };

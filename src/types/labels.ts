import type {
  LabelGroup,
  LabelGroupStyle,
  LabelNameMode,
  LabelStyles,
  LabelType,
  LabelZoomBounds
} from "@/generators/labels";

export type LabelGroupType = LabelType;
export type LabelGroupOptions = LabelGroup;
export type LabelsOptions = { resizeOnZoom: boolean; showAll: boolean; groups: LabelGroup[] };
export type { LabelGroupStyle, LabelNameMode, LabelStyles, LabelType, LabelZoomBounds };

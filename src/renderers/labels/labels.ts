import type { LabelType } from "@/generators/labels-generator";
import type { Point } from "@/types/global";

// A label ready to be rendered. It is drawn as plain text placed at the anchor,
// unless pathPoints are set: then the text is curved along them
export interface LabelData {
  id: string;
  entityId: number; // stateId, provinceId, burgId, labelId, etc.
  text: string;
  type: LabelType;
  group: string;
  hidden?: boolean;
  anchor: Point; // position before the dx/dy shift is applied
  pathPoints?: Point[]; // set only when non-empty
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
  dx?: number;
  dy?: number;
}

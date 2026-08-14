import type { ReliefSet } from "@/types/relief";

export type { LayerId, PresentationValue, Style, StyleNode } from "@/services/styles/schema";
export { LAYER_IDS } from "@/services/styles/schema";

// legacy shape, removed in the re-homing task (Task 12)
export interface ReliefStyle {
  set: ReliefSet;
  size: number;
  density: number;
}

// legacy shape, removed in the re-homing task (Task 12)
export interface LegacyStyle {
  burgIcons: { [key: string]: { [key: string]: string } };
  anchors: { [key: string]: { [key: string]: string } };
  labels: { groups: Record<string, LabelGroupStyle> };
  relief: ReliefStyle;
}

export interface LabelGroupStyle {
  opacity: Opacity;
  fill: Fill;
  stroke: Stroke;
  "stroke-width": StrokeWidth;
  "letter-spacing": LetterSpacing;
  "font-size": FontSizePercentage;
  "font-family": FontFamily;
  style: StyleArrt | null;
  filter: Filter | null;
  "data-dx"?: number;
  "data-dy"?: number;
}

type Opacity = number;
type Fill = string;
type Stroke = string;
type StrokeWidth = number;
type LetterSpacing = number;
type FontFamily = string;
type FontSizePercentage = string;
type StyleArrt = string; // text-shadow
type Filter = string;

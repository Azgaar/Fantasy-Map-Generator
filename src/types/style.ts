import type { ReliefSet } from "@/types/relief";

export interface Style {
  // TODO: style = {burgs: { icons, anchors }, labels } is more semantic
  burgIcons: { [key: string]: { [key: string]: string } };
  anchors: { [key: string]: { [key: string]: string } };
  labels: { groups: Record<string, LabelGroupStyle> };
  relief: ReliefStyle;
}

export interface ReliefStyle {
  set: ReliefSet;
  size: number;
  density: number;
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

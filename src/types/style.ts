import type { MapLayerId } from "@/renderers/core/layer-registry";
import type { MapStyle } from "@/renderers/scene/styles";
import type { ReliefSet } from "@/types/relief";

export interface Style {
  labels: { groups: Record<string, LabelGroupStyle> };
  mapLayerVisibility?: Partial<Record<MapLayerId, boolean>>;
  mapRenderer?: MapStyle;
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

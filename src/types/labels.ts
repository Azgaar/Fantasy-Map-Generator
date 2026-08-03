export type LabelNameMode = "auto" | "short" | "full";
export type LabelType = "state" | "burg" | "province" | "added";

interface LabelGroupStyle {
  [key: string]: string | number | null;
}

export interface LabelStyles {
  groups: Record<string, LabelGroupStyle>;
}

export interface LabelZoomBounds {
  min: number | null;
  max: number | null;
}

export interface LabelGroupOptions {
  name: string;
  type: LabelType;
  active: boolean;
  layerDependency: string | null;
  zoom: LabelZoomBounds;
  mode: LabelNameMode;
}

export interface LabelsOptions {
  resizeOnZoom: boolean;
  showAll: boolean;
  groups: LabelGroupOptions[];
}

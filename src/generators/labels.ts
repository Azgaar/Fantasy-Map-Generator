import type { Point } from "@/types/global";

export const DEFAULT_LABEL_TYPES = ["state", "province", "burg", "added"] as const;

export type LabelType = (typeof DEFAULT_LABEL_TYPES)[number];

export type LabelNameMode = "auto" | "short" | "full";

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

interface LabelGroupStyle {
  [key: string]: string | number | null;
}

export interface LabelStyles {
  groups: Record<string, LabelGroupStyle>;
}

export interface Label {
  text?: string;
  group?: string;
  dx?: number;
  dy?: number;
  fontSize?: number;
  letterSpacing?: number;
}

export interface PathLabel extends Label {
  pathPoints?: Point[];
  startOffset?: number;
}

declare global {
  var AddedLabels: AddedLabelsModule;
}

// Custom labels are the only labels stored independently from map entities
export interface AddedLabel extends PathLabel {
  i: number;
  text: string;
  pathPoints: Point[];
  group: string;
}

export class AddedLabelsModule {
  initiate(): void {
    pack.labels = [];
  }

  get(i: number): AddedLabel | undefined {
    return pack.labels.find(label => label.i === i);
  }

  add(data: Omit<AddedLabel, "i">): AddedLabel {
    const i = pack.labels.reduce((max, label) => Math.max(max, label.i), -1) + 1;
    const label = { ...data, i };
    pack.labels.push(label);
    return label;
  }

  remove(i: number): void {
    pack.labels = pack.labels.filter(label => label.i !== i);
    notes = notes.filter(note => note.id !== `addedLabel${i}`);
  }
}

window.AddedLabels = new AddedLabelsModule();

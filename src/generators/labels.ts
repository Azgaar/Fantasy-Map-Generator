import type { Point } from "./voronoi";

export interface Label {
  text?: string;
  group?: string;
  dx?: number;
  dy?: number;
  pathPoints?: Point[];
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
}

export const DEFAULT_STATE_LABEL_GROUP = "states";
export const DEFAULT_BURG_LABEL_GROUP = "town";
export const DEFAULT_ADDED_LABEL_GROUP = "addedLabels";

export type LabelType = "state" | "burg" | "added";

export function resolveLabelGroup(type: LabelType, requestedGroup?: string): string {
  const fallback =
    type === "state"
      ? DEFAULT_STATE_LABEL_GROUP
      : type === "burg"
        ? DEFAULT_BURG_LABEL_GROUP
        : DEFAULT_ADDED_LABEL_GROUP;
  const group = requestedGroup || fallback;
  return style.labels.groups[group] ? group : fallback;
}

declare global {
  var AddedLabels: AddedLabelsModule;
}

// Custom labels are the only labels stored independently from map entities
export interface AddedLabel extends Label {
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
  }
}

window.AddedLabels = new AddedLabelsModule();

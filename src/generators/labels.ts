import type { Point } from "./voronoi";

export interface Label {
  text?: string;
  dx?: number;
  dy?: number;
  pathPoints?: Point[];
  startOffset?: number;
  fontSize?: number;
  letterSpacing?: number;
}

// Custom labels are the only labels stored independently from map entities
export interface AddedLabel extends Label {
  i: number;
  text: string;
  pathPoints: Point[];
  group: string;
}

export class AddedLabelsModule {
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

declare global {
  var AddedLabels: AddedLabelsModule;
}

window.AddedLabels = new AddedLabelsModule();

import type { Point } from "@/types/global";

export type { LabelType } from "@/types/labels";

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

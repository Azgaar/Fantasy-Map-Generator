import type { Label } from "./labels-generator";

declare global {
  var AddedLabels: AddedLabelsModule;
}

// A free-standing map object that exists only to carry a label
export interface AddedLabel {
  i: number;
  x: number;
  y: number;
  label: Label;
}

export class AddedLabelsModule {
  initiate(): void {
    pack.addedLabels = []; // empty on map creation
  }

  get(i: number): AddedLabel | undefined {
    return pack.addedLabels.find(addedLabel => addedLabel.i === i);
  }

  add(data: Omit<AddedLabel, "i">): AddedLabel {
    const i = pack.addedLabels.reduce((max, addedLabel) => Math.max(max, addedLabel.i), 0) + 1;
    const addedLabel = { ...data, i };
    pack.addedLabels.push(addedLabel);
    return addedLabel;
  }

  remove(i: number): void {
    pack.addedLabels = pack.addedLabels.filter(addedLabel => addedLabel.i !== i);
    notes = notes.filter(note => note.id !== `addedLabel${i}`);
  }
}

window.AddedLabels = new AddedLabelsModule();

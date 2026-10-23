import { requireName, requireOneOf } from "@/utils/validationUtils";
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
  note?: string;
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

  /** Place a text label at a map point, in an "added" label group (default: the first one). Returns its id */
  place(x: number, y: number, text: string, group?: string): number {
    Pack.requireCell(x, y);
    const groups = options.map.labels.groups.filter(({ type }) => type === "added").map(({ name }) => name);
    const name = group === undefined ? Labels.findGroup("", "added").name : requireOneOf(group, groups, "The group");
    return this.add({ x, y, label: { text: requireName(text), group: name } }).i;
  }

  /** Change the text of a label placed on the map */
  rename(labelId: number, text: string): void {
    this.living(labelId).label.text = requireName(text);
  }

  /** Remove a label placed on the map */
  remove(labelId: number): void {
    this.living(labelId);
    pack.addedLabels = pack.addedLabels.filter(addedLabel => addedLabel.i !== labelId);
  }

  private living(labelId: number): AddedLabel {
    const addedLabel = this.get(labelId);
    if (!addedLabel) throw new Error(`Label ${labelId} does not exist`);
    return addedLabel;
  }
}

// biome-ignore lint/suspicious/noRedeclare: legacy seam
export const AddedLabels = new AddedLabelsModule();
window.AddedLabels = AddedLabels;

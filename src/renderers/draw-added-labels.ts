import { DEFAULT_ADDED_LABEL_GROUP } from "@/generators/labels";
import { getLabelPathMarkup, getLabelTextMarkup } from "./labels/draw-label-utils";
import { getLabelGroup } from "./labels/label-groups";

export function drawAddedLabels(): void {
  clearAddedLabels();

  let paths = "";
  const texts = new Map<string, string>();
  for (const addedLabel of pack.labels) {
    const label = { ...addedLabel, id: `addedLabel${addedLabel.i}` };
    paths += getLabelPathMarkup(label);
    const group = label.group || DEFAULT_ADDED_LABEL_GROUP;
    texts.set(group, (texts.get(group) || "") + getLabelTextMarkup(label));
  }

  document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", paths);
  for (const [group, markup] of texts) {
    getLabelGroup(group, "added").insertAdjacentHTML("beforeend", markup);
  }
}

export function drawAddedLabel(labelId: number): void {
  const addedLabel = pack.labels.find(label => label.i === labelId);
  if (!addedLabel) return;

  const label = { ...addedLabel, id: `addedLabel${addedLabel.i}` };
  removeAddedLabel(labelId);
  document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", getLabelPathMarkup(label));
  getLabelGroup(label.group, "added").insertAdjacentHTML("beforeend", getLabelTextMarkup(label));
}

export function removeAddedLabel(labelId: number): void {
  document.getElementById(`addedLabel${labelId}`)?.remove();
  document.getElementById(`textPath_addedLabel${labelId}`)?.remove();
}

function clearAddedLabels(): void {
  document.querySelectorAll("#labels > g > [data-label-type='added']").forEach(label => {
    label.remove();
  });
  document.querySelectorAll("#textPaths > path[id^='textPath_addedLabel']").forEach(path => {
    path.remove();
  });
}

import type { AddedLabel } from "../generators/labels";
import { drawPathLabel, drawPathLabels, type PathLabel, removePathLabel } from "./draw-path-label";

const toPathLabel = (label: AddedLabel): PathLabel => ({ ...label, id: `addedLabel${label.i}` });

export function drawAddedLabels(id?: number): void {
  if (id !== undefined) {
    const label = pack.labels.find(label => label.i === id);
    if (label) drawPathLabel(toPathLabel(label));
    return;
  }

  syncGroups();
  document.querySelectorAll("#textPaths > path[id^='textPath_addedLabel']").forEach(path => {
    path.remove();
  });
  drawPathLabels(pack.labels.map(toPathLabel));
}

export function removeAddedLabel(label: AddedLabel): void {
  removePathLabel(toPathLabel(label));
}

function syncGroups(): void {
  const groups = new Set(pack.labels.map(label => label.group));
  document.querySelectorAll<SVGGElement>("g#labels > g:not(#states):not(#burgLabels)").forEach(group => {
    if (group.id === "addedLabels" || groups.has(group.id)) group.replaceChildren();
    else group.remove();
  });
}

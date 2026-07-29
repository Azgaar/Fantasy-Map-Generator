import { ensureLabelGroup, getLabelPathMarkup, getLabelTextMarkup } from "./draw-label-utils";

export function drawAddedLabels(): void {
  clearAddedLabels();

  let paths = "";
  const texts = new Map<string, string>();
  for (const addedLabel of pack.labels) {
    const label = { ...addedLabel, id: `addedLabel${addedLabel.i}` };
    paths += getLabelPathMarkup(label);
    texts.set(label.group, (texts.get(label.group) || "") + getLabelTextMarkup(label));
  }

  document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", paths);
  for (const [group, markup] of texts) {
    ensureLabelGroup(group, "added").insertAdjacentHTML("beforeend", markup);
  }
}

export function drawAddedLabel(labelId: number): void {
  const addedLabel = pack.labels.find(label => label.i === labelId);
  if (!addedLabel) return;

  const label = { ...addedLabel, id: `addedLabel${addedLabel.i}` };
  removeAddedLabel(labelId);
  document.getElementById("textPaths")!.insertAdjacentHTML("beforeend", getLabelPathMarkup(label));
  ensureLabelGroup(label.group, "added").insertAdjacentHTML("beforeend", getLabelTextMarkup(label));
}

export function removeAddedLabel(labelId: number): void {
  document.getElementById(`addedLabel${labelId}`)?.remove();
  document.getElementById(`textPath_addedLabel${labelId}`)?.remove();
}

function clearAddedLabels(): void {
  const groups = new Set(pack.labels.map(label => label.group));
  document.querySelectorAll<SVGGElement>("g#labels > g:not(#states):not(#burgLabels)").forEach(group => {
    if (group.id === "addedLabels" || groups.has(group.id)) group.replaceChildren();
    else group.remove();
  });
  document.querySelectorAll("#textPaths > path[id^='textPath_addedLabel']").forEach(path => {
    path.remove();
  });
}

import { type CustomLabel, isPathLabel, type LabelData, Labels, type StateLabel } from "../generators/labels";
import { drawBurgLabel, removeBurgLabel } from "./draw-burg-labels";
import {
  buildPathLabelElements,
  drawPathLabel,
  ensureLabelGroup,
  getPathLabelElementId,
  removePathLabel
} from "./draw-path-label";
import { fitLabels } from "./fit-state-labels";

// remove this section once layer.js is refactored--------------------------------
window.drawCustomLabels = drawCustomLabels;
window.drawCustomLabel = drawPathLabel;
window.drawStateLabels = drawStateLabels;
window.ensureLabelGroup = ensureLabelGroup;
// -------------------------------------------------------------------------------

// render a single label based on its shape: along a path or at a point
export function drawLabel(label: LabelData): void {
  if (isPathLabel(label)) drawPathLabel(label);
  else drawBurgLabel(label);
}

// remove a label's rendered elements based on its shape
export function removeLabel(label: LabelData): void {
  if (isPathLabel(label)) removePathLabel(label);
  else removeBurgLabel(label.burgId);
}

export function getStateLabels(list?: number[]): StateLabel[] {
  const stateLabels = Labels.getByType("state");
  if (list && list.length > 0) return stateLabels.filter(label => list.includes(label.stateId));
  return stateLabels;
}

/**
 * Render state labels from pack.labels data to SVG.
 * Labels without stored pathPoints (not fitted yet) are fitted first;
 * already fitted labels are drawn as-is, preserving user edits.
 * list - optional array of stateIds to re-render
 */
export function drawStateLabels(list?: number[]): void {
  TIME && console.time("drawStateLabels");
  const { states } = pack;

  const stateLabels = getStateLabels(list);
  const unfitted = stateLabels.filter(label => !label.pathPoints?.length);
  if (unfitted.length) fitLabels(unfitted);

  const fitted = stateLabels.filter(label => {
    if (unfitted.includes(label)) return false; // drawn by the fitting pass
    const state = states[label.stateId];
    return Boolean(state?.i) && !state.removed;
  });

  drawPathLabelsBatch(fitted);
  TIME && console.timeEnd("drawStateLabels");
}

export function drawCustomLabels(): void {
  TIME && console.time("drawCustomLabels");
  const customLabels = Labels.getByType("custom");

  // clear rendered groups first so removed labels don't linger
  for (const group of new Set(customLabels.map(label => label.group))) {
    document.querySelector<SVGGElement>(`g#labels > g#${group}`)?.replaceChildren();
  }

  drawPathLabelsBatch(customLabels);
  TIME && console.timeEnd("drawCustomLabels");
}

// collect all elements first, then insert with one DOM operation per container
function drawPathLabelsBatch(labelList: (StateLabel | CustomLabel)[]): void {
  const pathGroup = document.querySelector<SVGGElement>("defs > g#deftemp > g#textPaths")!;
  const textsByGroup = new Map<string, SVGTextElement[]>();
  const paths: SVGPathElement[] = [];

  for (const label of labelList) {
    const { text, path } = buildPathLabelElements(label);
    if (!textsByGroup.has(label.group)) textsByGroup.set(label.group, []);
    textsByGroup.get(label.group)!.push(text);
    paths.push(path);

    // drop stale elements; the batch append below replaces them
    document.getElementById(getPathLabelElementId(label))?.remove();
    document.getElementById(path.id)?.remove();
  }

  pathGroup.append(...paths);
  for (const [group, texts] of textsByGroup) {
    ensureLabelGroup(group).append(...texts);
  }
}

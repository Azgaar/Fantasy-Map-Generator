import { type CustomLabel, isPathLabel, type LabelData, type StateLabel } from "../generators/labels";
import { drawBurgLabel } from "./draw-burg-labels";
import { drawPathLabel } from "./draw-path-label";
import { fitLabels } from "./fit-state-labels";

// remove this section once layer.js is refactored--------------------------------
window.drawCustomLabels = drawCustomLabels;
window.drawCustomLabel = drawPathLabel;
window.drawStateLabels = drawStateLabels;
// -------------------------------------------------------------------------------

// render a single label based on its shape: along a path or at a point
export function drawLabel(label: LabelData): void {
  if (isPathLabel(label)) drawPathLabel(label);
  else drawBurgLabel(label);
}

export function getStateLabels(list?: number[]): StateLabel[] {
  const stateLabels = Labels.getAll().filter((label): label is StateLabel => label.type === "state");
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

  for (const label of stateLabels) {
    if (unfitted.includes(label)) continue; // drawn by the fitting pass
    const state = states[label.stateId];
    if (!state?.i || state.removed) continue;
    drawPathLabel(label);
  }

  TIME && console.timeEnd("drawStateLabels");
}

export function drawCustomLabels(): void {
  TIME && console.time("drawCustomLabels");
  const customLabels = Labels.getAll().filter((label): label is CustomLabel => label.type === "custom");

  // clear rendered groups first so removed labels don't linger
  for (const group of new Set(customLabels.map(label => label.group))) {
    document.querySelector<SVGGElement>(`g#labels > g#${group}`)?.replaceChildren();
  }

  for (const label of customLabels) drawPathLabel(label);
  TIME && console.timeEnd("drawCustomLabels");
}

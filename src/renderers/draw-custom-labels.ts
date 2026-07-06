import type { CustomLabel } from "../generators/labels";
import { drawPathLabel } from "./draw-path-label";

// remove this section once layer.js is refactored--------------------------------
declare global {
  var drawCustomLabels: () => void;
  var drawCustomLabel: (label: CustomLabel) => void;
}

window.drawCustomLabels = customLabelsRenderer;
window.drawCustomLabel = customLabelRenderer;
// -------------------------------------------------------------------------------

export function customLabelsRenderer() {
  TIME && console.time("drawCustomLabels");
  const customLabels = Labels.getAll().filter((label): label is CustomLabel => label.type === "custom");

  // clear rendered groups first so removed labels don't linger
  for (const group of new Set(customLabels.map(label => label.group))) {
    document.querySelector<SVGGElement>(`g#labels > g#${group}`)?.replaceChildren();
  }

  for (const label of customLabels) drawPathLabel(label);
  TIME && console.timeEnd("drawCustomLabels");
}

export function customLabelRenderer(label: CustomLabel) {
  drawPathLabel(label);
}

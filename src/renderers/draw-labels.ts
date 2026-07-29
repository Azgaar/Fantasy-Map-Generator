import type { LabelType } from "@/generators/labels";
import { drawAddedLabel, drawAddedLabels, removeAddedLabel } from "./draw-added-labels";
import { drawBurgLabel, drawBurgLabels, removeBurgLabel } from "./draw-burg-labels";
import { drawStateLabel, drawStateLabels } from "./draw-state-labels";
import { renderLabelGroups } from "./label-groups";

export type { LabelType } from "@/generators/labels";

export function drawLabels(): void {
  if (!layerIsOn("toggleLabels")) {
    removeLabels();
    return;
  }

  TIME && console.time("drawLabels");
  removeLabels();
  renderLabelGroups();
  drawStateLabels();
  drawBurgLabels();
  drawAddedLabels();
  invokeActiveZooming();
  TIME && console.timeEnd("drawLabels");
}

export function drawLabel(type: LabelType, id?: number): void {
  if (!layerIsOn("toggleLabels")) {
    removeLabels();
    return;
  }

  if (type === "state") {
    if (id === undefined) drawStateLabels();
    else drawStateLabel(id);
  } else if (type === "burg") {
    if (id === undefined) drawBurgLabels();
    else {
      const burg = pack.burgs[id];
      if (burg && !burg.removed) {
        drawBurgLabel(burg);
      }
    }
  } else if (type === "added") {
    if (id === undefined) drawAddedLabels();
    else drawAddedLabel(id);
  }

  invokeActiveZooming();
}

export function removeLabel(type: LabelType, id: number): void {
  if (type === "burg") removeBurgLabel(id);
  else if (type === "added") removeAddedLabel(id);
  else {
    document.getElementById(`stateLabel${id}`)?.remove();
    document.getElementById(`textPath_stateLabel${id}`)?.remove();
  }
}

export function removeLabels(): void {
  document.querySelector("#labels")?.replaceChildren();
  document
    .querySelectorAll("#textPaths > path[id^='textPath_stateLabel'], #textPaths > path[id^='textPath_addedLabel']")
    .forEach(path => {
      path.remove();
    });
}

window.drawLabels = drawLabels;
window.removeLabels = removeLabels;

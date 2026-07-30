import type { LabelType } from "@/generators/labels";
import { drawAddedLabel, drawAddedLabels, removeAddedLabel } from "../draw-added-labels";
import { drawBurgLabel, drawBurgLabels, removeBurgLabel } from "./draw-burg-labels";
import { drawStateLabel, drawStateLabels, removeStateLabel } from "./draw-state-labels";
import { renderLabelGroups } from "./label-groups";

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

const renderers: Record<LabelType, (id?: number) => void> = {
  state: id => (id === undefined ? drawStateLabels() : drawStateLabel(id)),
  burg: id => (id === undefined ? drawBurgLabels() : drawBurgLabel(id)),
  added: id => (id === undefined ? drawAddedLabels() : drawAddedLabel(id))
};

export function drawLabel(type: LabelType, id?: number): void {
  if (!layerIsOn("toggleLabels")) {
    removeLabels();
    return;
  }

  renderers[type](id);
  invokeActiveZooming();
}

export function removeLabels(): void {
  document.querySelector("#labels")?.replaceChildren();
  document
    .querySelectorAll("#textPaths > path[id^='textPath_stateLabel'], #textPaths > path[id^='textPath_addedLabel']")
    .forEach(path => {
      path.remove();
    });
}

export function removeLabel(type: LabelType, id: number): void {
  if (type === "state") return void removeStateLabel(id);
  if (type === "burg") return void removeBurgLabel(id);
  if (type === "added") return void removeAddedLabel(id);
}

window.drawLabels = drawLabels;
window.removeLabels = removeLabels;

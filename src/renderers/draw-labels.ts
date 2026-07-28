import { drawAddedLabels, removeAddedLabel } from "./draw-added-labels";
import { drawBurgLabel, drawBurgLabels, removeBurgLabel } from "./draw-burg-labels";
import { drawStateLabel, drawStateLabels } from "./draw-state-labels";

export type LabelType = "state" | "burg" | "added";

export function drawLabels(): void {
  if (!layerIsOn("toggleLabels")) {
    removeLabels();
    return;
  }

  removeLabels();
  drawStateLabels();
  drawBurgLabels();
  drawAddedLabels();
  invokeActiveZooming();
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
    drawAddedLabels(id);
  }

  invokeActiveZooming();
}

export function removeLabel(type: LabelType, id: number): void {
  if (type === "burg") removeBurgLabel(id);
  else if (type === "added") {
    const label = pack.labels.find(label => label.i === id);
    if (label) removeAddedLabel(label);
  } else {
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

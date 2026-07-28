import { drawAddedLabels } from "./draw-added-labels";
import { drawBurgLabels } from "./draw-burg-labels";
import { drawStateLabels } from "./draw-state-labels";

export function drawLabels(): void {
  drawStateLabels();
  drawBurgLabels();
  drawAddedLabels();
  invokeActiveZooming();
}

window.drawLabels = drawLabels;

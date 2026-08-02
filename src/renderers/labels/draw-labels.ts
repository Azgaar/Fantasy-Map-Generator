import type { LabelType } from "@/generators/labels";
import { findEl } from "@/utils";
import { drawAddedLabel, drawAddedLabels, removeAddedLabel } from "../draw-added-labels";
import { drawBurgLabel, drawBurgLabels, removeBurgLabel } from "./draw-burg-labels";
import { drawProvinceLabel, drawProvinceLabels, removeProvinceLabel } from "./draw-province-labels";
import { drawStateLabel, drawStateLabels, removeStateLabel } from "./draw-state-labels";

export function drawLabels(): void {
  if (!layerIsOn("toggleLabels")) {
    removeLabels();
    return;
  }

  TIME && console.time("drawLabels");
  removeLabels();
  // renderLabelGroups(); // TODO: each renderer should render own groups
  drawStateLabels();
  drawProvinceLabels();
  drawBurgLabels();
  drawAddedLabels();
  invokeActiveZooming();
  TIME && console.timeEnd("drawLabels");
}

const renderers: Record<LabelType, (id?: number) => void> = {
  state: id => (id === undefined ? drawStateLabels() : drawStateLabel(id)),
  province: id => (id === undefined ? drawProvinceLabels() : drawProvinceLabel(id)),
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
  const labels = document.querySelector<SVGGElement>("#labels");
  if (!labels) throw new Error("Labels container not found");

  labels.replaceChildren();
  findEl("#labelPaths")?.replaceChildren(); // TODO: ensure label textPaths are only rendered to #labelPaths
}

export function removeLabel(type: LabelType, id: number): void {
  if (type === "state") return void removeStateLabel(id);
  if (type === "province") return void removeProvinceLabel(id);
  if (type === "burg") return void removeBurgLabel(id);
  if (type === "added") return void removeAddedLabel(id);
}

window.drawLabels = drawLabels;
window.removeLabels = removeLabels;

import type { Burg } from "@/generators/burgs-generator";
import type { LabelGroup, LabelType } from "@/generators/labels-generator";
import { invalidatePixiRendererLayer } from "@/renderers/pixi/pixi-renderer-controller";
import { type ViewportBounds, ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { getLabelsData } from "./label-data";
import type { LabelData } from "./labels";

let sceneLabels: LabelData[] = [];

export function drawLabels(): void {
  sceneLabels = layerIsOn("toggleLabels") ? getLabelsData() : [];
  invalidatePixiRendererLayer("labels");
}

export function redrawLabel(_label: LabelData): void {
  drawLabels();
}

export function getSceneLabel(type: LabelType, id: number): LabelData | undefined {
  if (!sceneLabels.length) sceneLabels = getLabelsData();
  return sceneLabels.find(label => label.type === type && label.entityId === id);
}

export function getVisibleLabels(): LabelData[] {
  if (!layerIsOn("toggleLabels")) return [];
  if (!sceneLabels.length) sceneLabels = getLabelsData();
  const bounds = ViewportLayers.getVisibleBounds();
  const visibleGroups = new Set(
    options.labels.groups.filter(group => isGroupVisible(group, bounds)).map(({ name }) => name)
  );
  return sceneLabels.filter(label => visibleGroups.has(label.group) && isLabelVisible(bounds, label));
}

function isGroupVisible(group: LabelGroup, bounds: ViewportBounds): boolean {
  if (group.active === false) return false;
  if (!options.labels.showAll) {
    if (group.zoom.min !== null && bounds.scale < group.zoom.min) return false;
    if (group.zoom.max !== null && bounds.scale > group.zoom.max) return false;
  }
  return !group.layerDependency || layerIsOn(group.layerDependency);
}

function isLabelVisible(bounds: ViewportBounds, label: LabelData): boolean {
  if (label.hidden) return false;
  const x = label.anchor[0] + (label.dx || 0);
  const y = label.anchor[1] + (label.dy || 0);
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

function drawBurgLabel(burg: Burg): void {
  if (!burg.removed) drawLabels();
}

function removeBurgLabel(_burgId: number): void {
  drawLabels();
}

window.drawLabels = drawLabels;
window.drawStateLabels = drawLabels;
window.drawBurgLabels = drawLabels;
window.drawBurgLabel = drawBurgLabel;
window.removeBurgLabel = removeBurgLabel;

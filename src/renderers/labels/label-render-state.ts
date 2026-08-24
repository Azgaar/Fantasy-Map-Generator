import type { LabelRenderState } from "@/renderers/scene/layers/label-scene";
import { getLabelsData } from "./label-data";
import { getGroupStyle } from "./label-groups";
import type { LabelData } from "./labels";

let sceneLabels: LabelData[] | null = null;

export function refreshLabelRenderState(): void {
  sceneLabels = getLabelsData();
}

export function getLabelRenderState(): LabelRenderState {
  sceneLabels ??= getLabelsData();
  const groups = options.labels.groups.map(group => ({ ...group, zoom: { ...group.zoom } }));
  return {
    groups,
    labels: sceneLabels,
    resizeOnZoom: options.labels.resizeOnZoom,
    showAll: options.labels.showAll,
    styles: Object.fromEntries(groups.map(group => [group.name, getGroupStyle(group)]))
  };
}

export function getSceneLabels(): readonly LabelData[] {
  sceneLabels ??= getLabelsData();
  return sceneLabels;
}

import { rn } from "../utils";
import { type RenderContext, registerLayer, unregisterLayer } from "./layer_registry";

const registeredLabelLayers = new Set<string>();

export function syncLabelLayers(): void {
  const labelsRoot = document.getElementById("labels");
  if (!(labelsRoot instanceof SVGGElement)) return;

  const currentLayers = new Set<string>();
  const labelGroups = Array.from(labelsRoot.children)
    .filter((child): child is SVGGElement => child instanceof SVGGElement && child.id !== "burgLabels")
    .map(group => group.id)
    .filter(Boolean);

  for (const groupId of labelGroups) {
    const layerId = `labels.${groupId}`;
    currentLayers.add(layerId);
    registerLabelLayer(layerId, "labels", groupId);
  }

  const burgLabelsRoot = document.getElementById("burgLabels");
  const burgLabelGroups = burgLabelsRoot
    ? Array.from(burgLabelsRoot.children)
        .filter((child): child is SVGGElement => child instanceof SVGGElement)
        .map(group => group.id)
        .filter(Boolean)
    : [];

  for (const groupId of burgLabelGroups) {
    const layerId = `burg_labels.${groupId}`;
    currentLayers.add(layerId);
    registerLabelLayer(layerId, "burgLabels", groupId);
  }

  for (const layerId of registeredLabelLayers) {
    if (currentLayers.has(layerId)) continue;
    unregisterLayer(layerId);
    registeredLabelLayers.delete(layerId);
  }
}

function registerLabelLayer(layerId: string, rootId: string, groupId: string): void {
  registeredLabelLayers.add(layerId);
  registerLayer({
    id: layerId,
    rootId,
    groupId,
    enabled: () => layerIsOn("toggleLabels"),
    update: updateLabelGroup
  });
}

function updateLabelGroup(group: SVGGElement, { scale }: RenderContext): void {
  const desired = Number(group.dataset.size);
  const relative = Math.max(rn((desired + desired / scale) / 2, 2), 1);
  if (rescaleLabels.checked) group.setAttribute("font-size", String(relative));

  const hidden = hideLabels.checked && (relative * scale < 6 || relative * scale > 60);
  group.classList.toggle("hidden", hidden);
}

import type { MapLayerId } from "@/renderers/core/layer-registry";

export const LAYER_CONTROLS_CHANGE_EVENT = "fmg-layer-controls-change";

export interface LayerView {
  description: string;
  fixed: boolean;
  id: string;
  label: string;
  shortcut: string;
  visible: boolean;
}

export interface LayerPresetOption {
  hidden: boolean;
  label: string;
  value: string;
}

export interface LayerControlsSnapshot {
  canRemovePreset: boolean;
  canSavePreset: boolean;
  layers: LayerView[];
  presetSelectionDisabled: boolean;
  presetOptions: LayerPresetOption[];
  selectedPreset: string;
}

export interface LayerToggleModifiers {
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export interface LegacyLayerControls {
  applyPreset: (preset: string) => void;
  drawActiveLayers: () => void;
  getLayerOrder: () => MapLayerId[];
  getSnapshot: () => LayerControlsSnapshot;
  isLayerOn: (id: string) => boolean;
  moveLayer: (id: string, previousId?: string, nextId?: string) => void;
  redrawLayer: (id: string) => boolean;
  removePreset: () => void;
  restoreSavedPreset: () => void;
  savePreset: (name: string) => void;
  setLayerOrder: (order: readonly MapLayerId[]) => void;
  setPresetState: (preset: string, disabled: boolean) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
  syncPreset: (disabled?: boolean) => void;
  toggleLayer: (id: string, modifiers?: LayerToggleModifiers) => boolean;
}

let target: LegacyLayerControls | null = null;

function getTarget(): LegacyLayerControls {
  if (!target) throw new Error("Layer controls runtime is not initialized");
  return target;
}

export function bindLayerControls(nextTarget: LegacyLayerControls): () => void {
  target = nextTarget;
  return () => {
    if (target === nextTarget) target = null;
  };
}

/**
 * Stable typed entry point for bundled callers. `window.LayerControls` remains a
 * compatibility alias until the remaining legacy-oriented modules import this facade.
 */
export const LayerControls: LegacyLayerControls = {
  applyPreset: preset => getTarget().applyPreset(preset),
  drawActiveLayers: () => getTarget().drawActiveLayers(),
  getLayerOrder: () => getTarget().getLayerOrder(),
  getSnapshot: () => getTarget().getSnapshot(),
  isLayerOn: id => getTarget().isLayerOn(id),
  moveLayer: (id, previousId, nextId) => getTarget().moveLayer(id, previousId, nextId),
  redrawLayer: id => getTarget().redrawLayer(id),
  removePreset: () => getTarget().removePreset(),
  restoreSavedPreset: () => getTarget().restoreSavedPreset(),
  savePreset: name => getTarget().savePreset(name),
  setLayerOrder: order => getTarget().setLayerOrder(order),
  setPresetState: (preset, disabled) => getTarget().setPresetState(preset, disabled),
  setLayerVisibility: (id, visible) => getTarget().setLayerVisibility(id, visible),
  syncPreset: disabled => getTarget().syncPreset(disabled),
  toggleLayer: (id, modifiers) => getTarget().toggleLayer(id, modifiers)
};

export type LayerMoveDirection = -1 | 1;

export function moveLayerByDirection(
  layers: readonly LayerView[],
  layerId: string,
  direction: LayerMoveDirection
): LayerView[] {
  const sourceIndex = layers.findIndex(layer => layer.id === layerId);
  if (sourceIndex < 0 || layers[sourceIndex]?.fixed) return [...layers];

  let targetIndex = sourceIndex + direction;
  while (targetIndex >= 0 && targetIndex < layers.length && layers[targetIndex]?.fixed) targetIndex += direction;
  if (targetIndex < 0 || targetIndex >= layers.length) return [...layers];

  const reordered = [...layers];
  const [layer] = reordered.splice(sourceIndex, 1);
  if (!layer) return reordered;
  reordered.splice(targetIndex, 0, layer);
  return reordered;
}

export function moveLayerBefore(layers: readonly LayerView[], layerId: string, targetId: string): LayerView[] {
  const sourceIndex = layers.findIndex(layer => layer.id === layerId);
  const targetIndex = layers.findIndex(layer => layer.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return [...layers];
  if (layers[sourceIndex]?.fixed || layers[targetIndex]?.fixed) return [...layers];

  const reordered = [...layers];
  const [layer] = reordered.splice(sourceIndex, 1);
  if (!layer) return reordered;
  reordered.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, layer);
  return reordered;
}

export function getLayerNeighbors(
  layers: readonly LayerView[],
  layerId: string
): [string | undefined, string | undefined] {
  const index = layers.findIndex(layer => layer.id === layerId);
  if (index < 0) return [undefined, undefined];
  return [layers[index - 1]?.id, layers[index + 1]?.id];
}

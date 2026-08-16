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
  presetOptions: LayerPresetOption[];
  selectedPreset: string;
}

export interface LayerToggleModifiers {
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export interface LegacyLayerControls {
  applyPreset: (preset: string) => void;
  getSnapshot: () => LayerControlsSnapshot;
  moveLayer: (id: string, previousId?: string, nextId?: string) => void;
  removePreset: () => void;
  savePreset: (name: string) => void;
  toggleLayer: (id: string, modifiers?: LayerToggleModifiers) => boolean;
}

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

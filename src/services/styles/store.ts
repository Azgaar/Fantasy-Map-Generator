import { applyLayerStyle } from "./apply";
import { LAYER_IDS, type LayerId, type PresentationValue, type Style, type StyleNode } from "./schema";

export function ensureStyleShape(input: Style): Style {
  const layers = { ...input.layers };
  for (const id of LAYER_IDS) layers[id] ??= {};
  return { ...input, layers };
}

export function getStyleNode(layerId: LayerId, ...childIds: string[]): StyleNode {
  // biome-ignore lint/suspicious/noAssignInExpressions: write-through accessor materializes chain on demand
  let node = (style.layers[layerId] ??= {});
  for (const childId of childIds) {
    node.children ??= {};
    node = node.children[childId] ??= {};
  }
  return node;
}

export function getLayerOptions<T extends object>(layerId: LayerId, ...childIds: string[]): T {
  return (getStyleNode(layerId, ...childIds).options ?? {}) as T;
}

interface StyleTarget {
  layerId: LayerId;
  childIds?: string[];
}

export function setPresentation(target: StyleTarget, attr: string, value: PresentationValue): void {
  const node = getStyleNode(target.layerId, ...(target.childIds ?? []));
  node.presentation ??= {};
  if (value === null) node.presentation[attr] = null;
  else node.presentation[attr] = value;
  applyLayerStyle(target.layerId);
}

export function setOptions(target: StyleTarget, patch: Record<string, unknown>): void {
  const node = getStyleNode(target.layerId, ...(target.childIds ?? []));
  node.options = { ...node.options, ...patch };
}

window.ensureStyleShape = ensureStyleShape;
window.getStyleNode = getStyleNode;
window.getLayerOptions = getLayerOptions;
window.setPresentation = setPresentation;
window.setOptions = setOptions;

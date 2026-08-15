import { applyLayerStyle } from "./apply";
import { LAYER_IDS, type LayerId, type PresentationValue, type Style, type StyleNode } from "./schema";

export function ensureStyleShape(input: Style): Style {
  const layers = { ...input.layers };
  for (const id of LAYER_IDS) layers[id] ??= {};
  return { ...input, layers };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// recursive merge where override wins on conflicting leaf keys; plain-object values on both
// sides merge their children instead of one replacing the other whole
export function deepMerge<A extends Record<string, unknown>, B extends Record<string, unknown>>(
  base: A,
  override: B
): A & B {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    result[key] = isPlainObject(value) && isPlainObject(baseValue) ? deepMerge(baseValue, value) : value;
  }
  return result as A & B;
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

// non-materializing counterpart of getStyleNode: a plain read must never create the child, since
// an empty-but-present node is indistinguishable from a styled one to the fallback paths
// (createIconGroups' default-group fallback, applyStylePreset's uncovered-label-group pass)
export function getStyleNodeIfSet(layerId: LayerId, ...childIds: string[]): StyleNode | undefined {
  let node: StyleNode | undefined = style.layers[layerId];
  for (const childId of childIds) node = node?.children?.[childId];
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

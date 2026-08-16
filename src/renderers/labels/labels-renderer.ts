import type { Burg } from "@/generators/burgs-generator";
import type { LabelGroup, LabelType } from "@/generators/labels-generator";
import type { LabelData } from "@/renderers/labels/labels";
import {
  Scene,
  SpatialIndex,
  ViewportLayers,
  type ViewportRenderContext
} from "@/renderers/viewport/viewport-renderer";
import { getLabelsData } from "./label-data";
import { renderLabelGroups } from "./label-groups";
import { createLabelElements } from "./label-markup";

const scene = new Scene<LabelData>();
const index = new SpatialIndex<LabelData>();
const layer = ViewportLayers.register({ id: "labels", render: reconcileLabels, clear: removeLabels });

export function drawLabels(): void {
  if (!layerIsOn("toggleLabels")) return void removeLabels();

  TIME && console.time("drawLabels");
  renderLabelGroups();
  document.getElementById("textPaths")?.replaceChildren();
  scene.replace(getLabelsData());
  reindexLabels();
  layer.render();
  TIME && console.timeEnd("drawLabels");
}

function removeLabels(): void {
  scene.invalidate();
  index.clear();
  const labels = findElement(document, "labels");
  if (labels) labels.replaceChildren();
  const textPaths = findElement(document, "textPaths");
  if (textPaths) textPaths.replaceChildren();
}

// Re-materialize a single edited label, leaving the rest of the layer untouched
export function redrawLabel(label: LabelData): void {
  if (!scene.valid || !layerIsOn("toggleLabels")) return;

  removeMaterialized(label.id, document);

  const stored = { ...label };
  scene.set(stored);
  reindexLabels();
  materializeLabel(stored, ViewportLayers.getContext());
}

export function getSceneLabel(type: LabelType, id: number): LabelData | undefined {
  return scene.get(`${type}Label${id}`);
}

export function getVisibleLabels(): LabelData[] {
  if (!scene.valid || !index.valid || !layerIsOn("toggleLabels")) return [];
  const bounds = ViewportLayers.getVisibleBounds();
  const visibleGroups = new Set(
    options.labels.groups.filter(group => isGroupVisible({ group, bounds })).map(({ name }) => name)
  );
  return [...index.values(bounds)].filter(label => visibleGroups.has(label.group) && isLabelVisible(bounds, label));
}

function materializeLabel(label: LabelData, context: ViewportRenderContext): void {
  const groupOptions = options.labels.groups.find(({ name }) => name === label.group);
  if (!groupOptions || !isGroupVisible({ group: groupOptions, bounds: context.bounds })) return;
  if (!isLabelVisible(context.bounds, label)) return;

  const group = findElement(context.root, `labels-${label.group}`);
  const textPaths = findElement(context.root, "textPaths");
  if (!group || !textPaths) return;

  materialize(label, group, textPaths);
}

function materialize(label: LabelData, group: Element, textPaths: Element): void {
  const { text, path } = createLabelElements(label, group.ownerDocument);
  if (path) textPaths.appendChild(path);
  group.appendChild(text);
}

function reconcileLabels(context: ViewportRenderContext): void {
  if (!scene.valid || !index.valid || !layerIsOn("toggleLabels")) return;
  const labels = findElement(context.root, "labels");
  const textPaths = findElement(context.root, "textPaths");
  if (!labels || !textPaths) return;

  const materializedPaths = new Map(Array.from(textPaths.children, path => [path.id, path]));
  const visibleByGroup = new Map<string, LabelData[]>();
  for (const label of index.values(context.bounds)) {
    if (!isLabelVisible(context.bounds, label)) continue;
    const visible = visibleByGroup.get(label.group) || [];
    visible.push(label);
    visibleByGroup.set(label.group, visible);
  }

  for (const group of options.labels.groups) {
    reconcileGroup(labels, textPaths, materializedPaths, group, visibleByGroup.get(group.name) || [], context);
  }
}

function reconcileGroup(
  labels: Element,
  textPaths: Element,
  materializedPaths: Map<string, Element>,
  groupOptions: LabelGroup,
  candidates: LabelData[],
  context: ViewportRenderContext
): void {
  const groupName = groupOptions.name;
  const group = labels.querySelector<SVGGElement>(`#${CSS.escape(`labels-${groupName}`)}`);
  if (!group) return;

  const isVisible = isGroupVisible({ group: groupOptions, bounds: context.bounds });
  const visibleLabels = isVisible ? candidates : [];
  const visibleIds = new Set(visibleLabels.map(label => label.id));
  const materializedIds = new Set<string>();

  for (const child of Array.from(group.children)) {
    if (visibleIds.has(child.id)) {
      materializedIds.add(child.id);
      continue;
    }
    child.remove();
    const pathId = `textPath_${child.id}`;
    materializedPaths.get(pathId)?.remove();
    materializedPaths.delete(pathId);
  }

  for (const label of visibleLabels) {
    if (!materializedIds.has(label.id)) materialize(label, group, textPaths);
  }
}

function isGroupVisible({ group, bounds }: { group: LabelGroup; bounds: ViewportRenderContext["bounds"] }): boolean {
  if (group.active === false) return false;
  if (!options.labels.showAll) {
    if (group.zoom.min !== null && bounds.scale < group.zoom.min) return false;
    if (group.zoom.max !== null && bounds.scale > group.zoom.max) return false;
  }
  return !group.layerDependency || layerIsOn(group.layerDependency);
}

function isLabelVisible(bounds: ViewportRenderContext["bounds"], label: LabelData): boolean {
  if (label.hidden) return false;
  const x = label.anchor[0] + (label.dx || 0);
  const y = label.anchor[1] + (label.dy || 0);
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

function removeMaterialized(id: string, root: ParentNode): void {
  findElement(root, id)?.remove();
  findElement(root, `textPath_${id}`)?.remove();
}

function findElement(root: ParentNode, id: string): Element | null {
  if (root instanceof Element && root.id === id) return root;
  return root.querySelector(`#${CSS.escape(id)}`);
}

function reindexLabels(): void {
  if (!scene.valid) return void index.clear();
  index.replace(scene.values(), label => [label.anchor[0] + (label.dx || 0), label.anchor[1] + (label.dy || 0)]);
}

function drawBurgLabel(burg: Burg): void {
  if (!burg.removed) drawLabels();
}

function removeBurgLabel(burgId: number): void {
  const id = `burgLabel${burgId}`;
  scene.remove(id);
  reindexLabels();
  removeMaterialized(id, document);
}

window.drawLabels = drawLabels;
window.drawStateLabels = drawLabels;
window.drawBurgLabels = drawLabels;
window.drawBurgLabel = drawBurgLabel;
window.removeBurgLabel = removeBurgLabel;

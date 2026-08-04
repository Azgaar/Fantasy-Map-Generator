import { getLabelParentFontSize, isLabelGroupVisible } from "@/controllers/label-policy";
import {
  containsPoint,
  getViewportBounds,
  shouldReconcileViewport,
  type ViewportBounds,
  type ViewportRenderContext,
  ViewportRenderer
} from "@/renderers/viewport/viewport-renderer";
import { renderLabelGroups } from "./label-groups";
import { getLabelPath } from "./label-markup";
import { LabelScene, type SceneLabel } from "./label-scene";
import type { LabelData, PathLabelData } from "./types";

const LAYER_PREFIX = "labels:";
const OVERSCAN_PIXELS = 40;
const GUARD_PIXELS = 20;

export const labelScene = new LabelScene();
const renderer = new ViewportRenderer();
let materializedBounds: ViewportBounds | null = null;

export function syncLabelViewportLayers(): void {
  renderer.clear(LAYER_PREFIX);
  for (const group of options.labels.groups) {
    renderer.register({
      id: `${LAYER_PREFIX}${group.name}`,
      render: context => reconcileGroup(group.name, context)
    });
  }
}

export function renderLabelsNow(): void {
  if (!labelScene.valid || !layerIsOn("toggleLabels")) return;
  const bounds = currentBounds(OVERSCAN_PIXELS);
  materializedBounds = bounds;
  renderer.renderNow({ root: document, bounds, renderAll: false });
  applyParentFontSize(document, bounds.scale);
}

export function updateLabelsViewport(): void {
  if (!labelScene.valid || !layerIsOn("toggleLabels")) return;
  const visible = currentBounds(0);
  if (!shouldReconcileViewport(materializedBounds, visible, GUARD_PIXELS)) return;
  const bounds = currentBounds(OVERSCAN_PIXELS);
  materializedBounds = bounds;
  renderer.schedule({ root: document, bounds, renderAll: false });
}

export function renderAllLabels(root: ParentNode): void {
  if (!labelScene.valid) return;
  renderLabelGroups(root);
  findElement(root, "textPaths")?.replaceChildren();
  syncLabelViewportLayers();
  const bounds = { scale: 1, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
  renderer.renderAll(root, bounds);
  applyParentFontSize(root, 1);
}

export function forceLabel(id: string): SVGTextElement | null {
  labelScene.force(id);
  renderLabelsNow();
  return document.getElementById(id) as SVGTextElement | null;
}

export function releaseLabel(id: string): void {
  labelScene.release(id);
  renderLabelsNow();
}

export function getCachedLabel(id: string): LabelData | undefined {
  return labelScene.get(id)?.data;
}

export function resetLabelViewport(): void {
  materializedBounds = null;
}

function reconcileGroup(groupName: string, context: ViewportRenderContext): void {
  const labelsRoot = findElement(context.root, "labels");
  const pathsRoot = findElement(context.root, "textPaths");
  const group = labelsRoot?.querySelector<SVGGElement>(`#labels-${groupName}`);
  const groupOptions = options.labels.groups.find(group => group.name === groupName);
  if (!group || !pathsRoot || !groupOptions) return;

  const visible =
    context.renderAll ||
    isLabelGroupVisible({
      labelsLayerOn: layerIsOn("toggleLabels"),
      labels: options.labels,
      group: groupOptions,
      scale: context.bounds.scale,
      layerIsOn
    });
  const desired = labelScene
    .getGroup(groupName)
    .filter(
      label =>
        context.renderAll ||
        labelScene.isForced(label.data.id) ||
        (visible && containsPoint(context.bounds, label.anchor))
    );
  const desiredIds = new Set(desired.map(label => label.data.id));
  let membershipChanged = false;

  for (const child of Array.from(group.children)) {
    if (!(child instanceof SVGTextElement) || desiredIds.has(child.id)) continue;
    removeMaterialized(child.id, context.root);
    membershipChanged = true;
  }

  for (const label of desired) {
    const existing = group.querySelector<SVGTextElement>(`#${label.data.id}`);
    if (existing?.dataset.labelRevision === String(label.revision)) continue;
    if (existing) removeMaterialized(label.data.id, context.root);
    const { text, path } = createLabelElements(label, group.ownerDocument);
    if (path) pathsRoot.appendChild(path);
    group.appendChild(text);
    membershipChanged = true;
  }

  if (membershipChanged) {
    for (const label of desired) {
      const text = group.querySelector<SVGTextElement>(`#${label.data.id}`);
      if (text) group.appendChild(text);
    }
  }
  group.classList.remove("hidden");
}

function createLabelElements(label: SceneLabel, document: Document): { text: SVGTextElement; path?: SVGPathElement } {
  const data = label.data;
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.id = data.id;
  text.dataset.labelType = data.type;
  text.dataset.id = String(getEntityId(data));
  text.dataset.labelRevision = String(label.revision);
  text.setAttribute("text-rendering", "optimizeSpeed");
  setTransform(text, data);

  if ("pathPoints" in data) {
    const path = createSupportPath(data, document);
    const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
    textPath.setAttribute("href", `#${path.id}`);
    textPath.setAttribute("startOffset", `${data.startOffset ?? 50}%`);
    textPath.setAttribute("text-anchor", "middle");
    textPath.setAttribute("font-size", `${data.fontSize ?? 100}%`);
    if (data.letterSpacing !== undefined) textPath.setAttribute("letter-spacing", `${data.letterSpacing}px`);
    appendText(textPath, data.text, "0");
    text.appendChild(textPath);
    return { text, path };
  }

  text.setAttribute("x", String(data.x));
  text.setAttribute("y", String(data.y));
  if (data.fontSize !== undefined) text.setAttribute("font-size", `${data.fontSize}%`);
  if (data.letterSpacing !== undefined) text.setAttribute("letter-spacing", `${data.letterSpacing}px`);
  appendText(text, data.text, String(data.x));
  return { text };
}

function createSupportPath(data: PathLabelData, document: Document): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = `textPath_${data.id}`;
  path.dataset.labelType = data.type;
  path.dataset.id = String(getEntityId(data));
  path.setAttribute("d", getLabelPath(data));
  return path;
}

function appendText(parent: SVGTextElement | SVGTextPathElement, value: string, x: string): void {
  const lines = value.split("|");
  if (lines.length === 1) return void parent.append(lines[0]);
  lines.forEach((line, index) => {
    const tspan = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", x);
    tspan.setAttribute("dy", index ? "1em" : `${(lines.length - 1) / -2}em`);
    tspan.textContent = line;
    parent.appendChild(tspan);
  });
}

function setTransform(element: SVGTextElement, label: Pick<LabelData, "dx" | "dy">): void {
  if (label.dx || label.dy) element.setAttribute("transform", `translate(${label.dx || 0}, ${label.dy || 0})`);
}

function removeMaterialized(id: string, root: ParentNode): void {
  findElement(root, id)?.remove();
  findElement(root, `textPath_${id}`)?.remove();
}

function getEntityId(data: LabelData): number {
  return Number(data.id.match(/\d+$/)?.[0] ?? -1);
}

function currentBounds(paddingPixels: number): ViewportBounds {
  return getViewportBounds({ scale, x: viewX, y: viewY }, { width: svgWidth, height: svgHeight }, paddingPixels);
}

function applyParentFontSize(root: ParentNode, currentScale: number): void {
  findElement(root, "labels")?.setAttribute(
    "font-size",
    `${getLabelParentFontSize(currentScale, options.labels.resizeOnZoom)}px`
  );
}

function findElement(root: ParentNode, id: string): Element | null {
  return root.querySelector(`#${id}`);
}

window.renderLabelsNow = renderLabelsNow;
window.updateLabelsViewport = updateLabelsViewport;

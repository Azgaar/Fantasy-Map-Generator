import { getLabelParentFontSize, isLabelGroupVisible, resolveLabelGroup } from "@/controllers/label-policy";
import type { LabelType, PathLabel } from "@/generators/labels";
import { containsPoint, type ViewportRenderContext, viewportLayers } from "@/renderers/viewport/viewport-renderer";
import type { Point } from "@/types/global";
import type { LabelData, PathLabelData, PointLabelData } from "@/types/labels";
import { renderLabelGroups } from "./label-groups";
import { getLabelPath } from "./label-markup";
import { getRegionLabel } from "./region-label-layout";

const dataAdapters: Record<LabelType, (ids?: number[]) => LabelData[]> = {
  state: getStateLabelsData,
  province: getProvinceLabelsData,
  added: getAddedLabelsData,
  burg: getBurgLabelsData,
  river: getRiverLabelsData,
  route: getRouteLabelsData
};

export function drawLabels(): void {
  if (!layerIsOn("toggleLabels")) return void removeLabels();

  TIME && console.time("drawLabels");
  renderLabelGroups();
  labelScene.replaceAll(getLabelsData());
  viewportLayers.renderNow();
  TIME && console.timeEnd("drawLabels");
}

export function drawLabel(type: LabelType, id?: number): void {
  if (!layerIsOn("toggleLabels")) return void removeLabels();
  drawLabelsByType(type, id === undefined ? undefined : [id]);
}

export function drawLabelsByType(type: LabelType, ids?: number[]): void {
  if (!labelScene.valid) return void drawLabels();
  labelScene.updateType(type, dataAdapters[type](ids).map(resolveGroup), ids);
  viewportLayers.renderNow();
}

export function removeLabels(): void {
  document.querySelectorAll("#labels > g").forEach(group => {
    group.replaceChildren();
  });
  document.getElementById("textPaths")?.replaceChildren();
  labelScene.invalidate();
}

export function removeLabel(type: LabelType, id: number): void;
export function removeLabel(id: string): void;
export function removeLabel(typeOrId: LabelType | string, id?: number): void {
  const labelId = id === undefined ? typeOrId : `${typeOrId}Label${id}`;
  const type =
    id === undefined ? (labelId.match(/^([a-z]+)Label/)?.[1] as LabelType | undefined) : (typeOrId as LabelType);
  const entityId = id ?? Number(labelId.match(/\d+$/)?.[0]);
  if (type && Number.isFinite(entityId)) labelScene.remove(type, entityId);
  removeMaterialized(labelId, document);
}

export function getLabelsData(type?: LabelType, ids?: number[]): LabelData[] {
  const labels = type ? dataAdapters[type](ids) : Object.values(dataAdapters).flatMap(adapter => adapter());
  return labels.map(resolveGroup);
}

export function forceLabel(id: string): SVGTextElement | null {
  labelScene.force(id);
  viewportLayers.renderNow();
  return document.getElementById(id) as SVGTextElement | null;
}

export function releaseLabel(id: string): void {
  labelScene.release(id);
  viewportLayers.renderNow();
}

export function getCachedLabel(id: string): LabelData | undefined {
  return labelScene.get(id)?.data;
}

function getBurgLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const result: PointLabelData[] = [];
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || (selected && !selected.has(burg.i))) continue;
    result.push({
      ...burg.label,
      id: `burgLabel${burg.i}`,
      text: burg.label?.text ?? burg.name ?? "",
      type: "burg",
      group: burg.label?.group || burg.group || "burg",
      x: burg.x,
      y: burg.y
    });
  }
  return result;
}

function getProvinceLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const result: PointLabelData[] = [];
  for (const province of pack.provinces) {
    if (!province.i || province.removed || (selected && !selected.has(province.i))) continue;
    const [x, y] = province.pole || pack.cells.p[province.center];
    result.push({
      ...province.label,
      id: `provinceLabel${province.i}`,
      text: province.label?.text ?? province.name,
      type: "province",
      group: province.label?.group || "province",
      x,
      y
    });
  }
  return result;
}

function getStateLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const result: PathLabelData[] = [];
  for (const state of pack.states) {
    if (!state.i || state.removed || (selected && !selected.has(state.i))) continue;
    const pole = state.pole || pack.cells.p[state.center];
    result.push(getRegionLabel(state, "state", pack.cells.state, pole, state.cells || 0));
  }
  return result;
}

function getRiverLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const labels: LabelData[] = [];
  for (const river of pack.rivers) {
    if (!river.cells.length || !river.name || (selected && !selected.has(river.i))) continue;
    const points = river.label?.pathPoints || Rivers.addMeandering(river.cells, river.points).map;
    if (!points.length) continue;
    labels.push({
      ...river.label,
      id: `riverLabel${river.i}`,
      type: "river",
      text: river.label?.text ?? river.name ?? "",
      group: river.label?.group || "river",
      pathPoints: formatPathPoints(points as Point[]),
      startOffset: river.label?.startOffset
    });
  }
  return labels;
}

function getRouteLabelsData(ids?: number[]): PathLabelData[] {
  const selected = ids && new Set(ids);
  const labels: PathLabelData[] = [];
  for (const route of pack.routes) {
    if (!route.label?.pathPoints || !route.name || (selected && !selected.has(route.i))) continue;
    labels.push({
      ...route.label,
      id: `routeLabel${route.i}`,
      type: "route",
      text: route.label?.text ?? route.name ?? "",
      group: route.label?.group || "route",
      pathPoints: formatPathPoints(route.label?.pathPoints),
      startOffset: route.label?.startOffset
    });
  }
  return labels;
}

function getAddedLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  return pack.labels
    .filter(label => !selected || selected.has(label.i))
    .map(label => ({ id: `addedLabel${label.i}`, type: "added", ...label }));
}

function resolveGroup(label: LabelData): LabelData {
  return {
    ...label,
    group: resolveLabelGroup(label.type, label.group, options.labels, options.burgs.groups)
  } as LabelData;
}

function reconcileLabels(context: ViewportRenderContext): void {
  if (!labelScene.valid || (!context.renderAll && !layerIsOn("toggleLabels"))) return;
  if (!findElement(context.root, "labels") || !findElement(context.root, "textPaths")) return;
  if (context.renderAll) {
    renderLabelGroups(context.root);
    findElement(context.root, "textPaths")?.replaceChildren();
  }
  for (const group of options.labels.groups) reconcileGroup(group.name, context);
  findElement(context.root, "labels")?.setAttribute(
    "font-size",
    `${getLabelParentFontSize(context.bounds.scale, options.labels.resizeOnZoom)}px`
  );
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

interface SceneLabel {
  data: LabelData;
  anchor: Point;
  order: number;
  revision: number;
}

function createLabelElements(label: SceneLabel, document: Document): { text: SVGTextElement; path?: SVGPathElement } {
  const data = label.data;
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.id = data.id;
  text.dataset.labelType = data.type;
  text.dataset.id = String(getEntityId(data));
  text.dataset.labelRevision = String(label.revision);
  text.setAttribute("text-rendering", "optimizeSpeed");
  if (data.dx || data.dy) text.setAttribute("transform", `translate(${data.dx || 0}, ${data.dy || 0})`);

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

function removeMaterialized(id: string, root: ParentNode): void {
  findElement(root, id)?.remove();
  findElement(root, `textPath_${id}`)?.remove();
}

function getEntityId(data: LabelData): number {
  return Number(data.id.match(/\d+$/)?.[0] ?? -1);
}

function findElement(root: ParentNode, id: string): Element | null {
  if (root instanceof Element && root.id === id) return root;
  return root.querySelector(`#${id}`);
}

export class LabelScene {
  private labels = new Map<string, SceneLabel>();
  private forced = new Set<string>();
  private groups = new Map<string, SceneLabel[]>();
  private nextOrder = 0;
  private nextRevision = 0;
  valid = false;

  replaceAll(labels: LabelData[]): void {
    this.labels.clear();
    this.groups.clear();
    this.nextOrder = 0;
    for (const data of labels) this.set(data);
    this.valid = true;
  }

  updateType(type: LabelType, labels: LabelData[], ids?: number[]): void {
    const selected = ids && new Set(ids.map(id => `${type}Label${id}`));
    const orders = new Map<string, number>();
    for (const [id, label] of this.labels) {
      if (label.data.type !== type || (selected && !selected.has(id))) continue;
      orders.set(id, label.order);
      this.labels.delete(id);
    }
    for (const data of labels) this.set(data, orders.get(data.id));
    this.groups.clear();
    this.valid = true;
  }

  remove(type: LabelType, id: number): void {
    const labelId = `${type}Label${id}`;
    this.labels.delete(labelId);
    this.groups.clear();
    this.forced.delete(labelId);
  }

  invalidate(): void {
    this.labels.clear();
    this.groups.clear();
    this.forced.clear();
    this.valid = false;
  }

  force(id: string): void {
    this.forced.add(id);
  }

  release(id: string): void {
    this.forced.delete(id);
  }

  isForced(id: string): boolean {
    return this.forced.has(id);
  }

  get(id: string): SceneLabel | undefined {
    return this.labels.get(id);
  }

  getGroup(group: string): SceneLabel[] {
    if (!this.groups.size) {
      for (const label of this.getAll()) {
        const labels = this.groups.get(label.data.group) || [];
        labels.push(label);
        this.groups.set(label.data.group, labels);
      }
    }
    return this.groups.get(group) || [];
  }

  private getAll(): SceneLabel[] {
    return Array.from(this.labels.values()).toSorted((a, b) => a.order - b.order);
  }

  private set(data: LabelData, order?: number): void {
    const existing = this.labels.get(data.id);
    this.labels.set(data.id, {
      data,
      anchor: getLabelAnchor(data),
      order: order ?? existing?.order ?? this.nextOrder++,
      revision: ++this.nextRevision
    });
  }
}

const labelScene = new LabelScene();
viewportLayers.register({ id: "labels", render: reconcileLabels });

function formatPathPoints(points: Point[]): Point[] {
  if (points.length && points.at(0)![0] > points.at(-1)![0]) points.reverse();
  return points;
}

export function getLabelAnchor(label: LabelData): Point {
  const [x, y] = "pathPoints" in label ? interpolatePath(label) : [label.x, label.y];
  return [x + (label.dx || 0), y + (label.dy || 0)];
}

function interpolatePath(label: PathLabelData): Point {
  const points = label.pathPoints;
  if (!points.length) return [0, 0];
  if (points.length === 1) return points[0];

  const lengths = points
    .slice(1)
    .map((point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return points[0];

  let distance = total * ((label.startOffset ?? 50) / 100);
  for (let i = 0; i < lengths.length; i++) {
    if (distance > lengths[i]) {
      distance -= lengths[i];
      continue;
    }
    const ratio = distance / lengths[i];
    return [
      points[i][0] + (points[i + 1][0] - points[i][0]) * ratio,
      points[i][1] + (points[i + 1][1] - points[i][1]) * ratio
    ];
  }
  return points.at(-1)!;
}

window.drawLabels = drawLabels;
window.removeLabels = removeLabels;

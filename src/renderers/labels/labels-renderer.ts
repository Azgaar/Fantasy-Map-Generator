import { getLabelParentFontSize, isLabelGroupVisible } from "@/controllers/label-policy";
import type { LabelType } from "@/generators/labels";
import { Scene, type ViewportRenderContext, viewportLayers } from "@/renderers/viewport/viewport-renderer";
import type { Point } from "@/types/global";
import type { LabelData, PathLabelData, PointLabelData } from "@/types/labels";
import { fitStateLabel } from "./fit-state-label";
import { renderLabelGroups } from "./label-groups";
import { getLabelPath } from "./label-markup";

const labelScene = new Scene<LabelData>();
const labelsByGroup = new Map<string, LabelData[]>();
const labelViewport = viewportLayers.register({ id: "labels", render: reconcileLabels });

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
  document.getElementById("textPaths")?.replaceChildren();
  const labels = Object.values(dataAdapters).flatMap(adapter => adapter());
  labelScene.replace(labels);
  indexLabelGroups();
  labelViewport.renderNow();
  TIME && console.timeEnd("drawLabels");
}

export function drawLabelsByType(type: LabelType, ids?: number[]): void {
  if (!layerIsOn("toggleLabels")) return void removeLabels();
  if (!labelScene.valid) return void drawLabels();

  TIME && console.time("drawLabelsByType");
  const selected = ids && new Set(ids);
  const changed = labelScene.replaceWhere(
    label => label.type === type && (!selected || selected.has(getEntityId(label))),
    dataAdapters[type](ids)
  );
  indexLabelGroups();
  for (const id of changed) removeMaterialized(id, document);
  labelViewport.renderNow();
  TIME && console.timeEnd("drawLabelsByType");
}

export function removeLabels(): void {
  document.querySelectorAll("#labels > g").forEach(group => {
    group.replaceChildren();
  });
  document.getElementById("textPaths")?.replaceChildren();
  labelScene.invalidate();
  labelsByGroup.clear();
}

export function removeLabel(type: LabelType, id: number): void {
  const labelId = `${type}Label${id}`;
  labelScene.remove(labelId);
  indexLabelGroups();
  removeMaterialized(labelId, document);
}

export function getCachedLabel(type: LabelType, id: number): LabelData | undefined {
  const labelId = `${type}Label${id}`;
  return labelScene.get(labelId);
}

export function renderLabelsNow(): void {
  labelViewport.renderNow();
}

function getBurgLabelsData(ids?: number[]): PointLabelData[] {
  const selected = ids && new Set(ids);
  const labels: PointLabelData[] = [];
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || (selected && !selected.has(burg.i))) continue;
    labels.push({
      ...burg.label,
      id: `burgLabel${burg.i}`,
      entityId: burg.i,
      text: burg.label?.text ?? burg.name ?? "",
      type: "burg",
      group: burg.label?.group || burg.group || "burg",
      x: burg.x,
      y: burg.y,
      anchor: getAchor(burg.x, burg.y, burg.label?.dx, burg.label?.dy)
    });
  }
  return labels;
}

function getProvinceLabelsData(ids?: number[]): PointLabelData[] {
  const selected = ids && new Set(ids);
  const labels: PointLabelData[] = [];
  for (const province of pack.provinces) {
    if (!province.i || province.removed || (selected && !selected.has(province.i))) continue;
    const [x, y] = province.pole || pack.cells.p[province.center];
    labels.push({
      ...province.label,
      id: `provinceLabel${province.i}`,
      entityId: province.i,
      text: province.label?.text ?? province.name,
      type: "province",
      group: province.label?.group || "province",
      x,
      y,
      anchor: getAchor(x, y, province.label?.dx, province.label?.dy)
    });
  }
  return labels;
}

function getStateLabelsData(ids?: number[]): PathLabelData[] {
  const selected = ids && new Set(ids);
  const labels: PathLabelData[] = [];
  for (const state of pack.states) {
    if (!state.i || state.removed || (selected && !selected.has(state.i))) continue;
    const group = state.label?.group || "state";
    const labelData = state.label?.pathPoints?.length ? state.label : fitStateLabel(state, group);
    const { pathPoints, text, fontSize } = labelData;
    if (!pathPoints || !text) continue;
    const anchor = getAchor(...getMiddlePoint(pathPoints), state.label?.dx, state.label?.dy);
    const label: PathLabelData = {
      id: `stateLabel${state.i}`,
      entityId: state.i,
      type: "state",
      group,
      pathPoints,
      text,
      fontSize,
      anchor
    };
    labels.push(label);
  }
  return labels;
}

function getRiverLabelsData(ids?: number[]): PathLabelData[] {
  const selected = ids && new Set(ids);
  const labels: PathLabelData[] = [];
  for (const river of pack.rivers) {
    if (!river.cells.length || !river.name || (selected && !selected.has(river.i))) continue;
    const points = formatPathPoints(
      (river.label?.pathPoints || Rivers.addMeandering(river.cells, river.points)) as Point[]
    );
    if (!points.length) continue;
    labels.push({
      ...river.label,
      id: `riverLabel${river.i}`,
      entityId: river.i,
      type: "river",
      text: river.label?.text ?? `${river.name} ${river.type}`,
      group: river.label?.group || "river",
      pathPoints: formatPathPoints(points as Point[]),
      startOffset: river.label?.startOffset,
      anchor: getAchor(...getMiddlePoint(points), river.label?.dx, river.label?.dy)
    });
  }
  return labels;
}

function getRouteLabelsData(ids?: number[]): PathLabelData[] {
  const selected = ids && new Set(ids);
  const labels: PathLabelData[] = [];
  for (const route of pack.routes) {
    if (!route.label?.pathPoints || !route.name || (selected && !selected.has(route.i))) continue;
    const points = formatPathPoints(route.label?.pathPoints);
    labels.push({
      ...route.label,
      id: `routeLabel${route.i}`,
      entityId: route.i,
      type: "route",
      text: route.label?.text ?? route.name ?? "",
      group: route.label?.group || "route",
      pathPoints: points,
      startOffset: route.label?.startOffset,
      anchor: getAchor(...getMiddlePoint(points), route.label?.dx, route.label?.dy)
    });
  }
  return labels;
}

function getAddedLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const labels: PathLabelData[] = [];
  for (const label of pack.labels) {
    if (!label.i || !label.pathPoints.length || (selected && !selected.has(label.i))) continue;
    labels.push({
      id: `addedLabel${label.i}`,
      entityId: label.i,
      type: "added",
      anchor: getAchor(...getMiddlePoint(label.pathPoints), label?.dx, label?.dy),
      ...label
    });
  }
  return labels;
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
  const desired = (labelsByGroup.get(groupName) || []).filter(
    label => context.renderAll || (visible && containsPoint(context.bounds, label.anchor))
  );
  const desiredIds = new Set(desired.map(label => label.id));
  let membershipChanged = false;

  for (const child of Array.from(group.children)) {
    if (!(child instanceof SVGTextElement) || desiredIds.has(child.id)) continue;
    removeMaterialized(child.id, context.root);
    membershipChanged = true;
  }

  for (const label of desired) {
    const existing = group.querySelector<SVGTextElement>(`#${label.id}`);
    if (existing) continue;
    const { text, path } = createLabelElements(label, group.ownerDocument);
    if (path) pathsRoot.appendChild(path);
    group.appendChild(text);
    membershipChanged = true;
  }

  if (membershipChanged) {
    for (const label of desired) {
      const text = group.querySelector<SVGTextElement>(`#${label.id}`);
      if (text) group.appendChild(text);
    }
  }
  group.classList.remove("hidden");
}

function createLabelElements(data: LabelData, document: Document): { text: SVGTextElement; path?: SVGPathElement } {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.id = data.id;
  text.dataset.labelType = data.type;
  text.dataset.id = String(getEntityId(data));
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

function indexLabelGroups(): void {
  labelsByGroup.clear();
  for (const label of labelScene.values()) {
    const labels = labelsByGroup.get(label.group) || [];
    labels.push(label);
    labelsByGroup.set(label.group, labels);
  }
}

function formatPathPoints(points: Point[]): Point[] {
  const simple = simplify(points, 0.5);
  if (simple.length && simple.at(0)![0] > simple.at(-1)![0]) simple.reverse();
  return simple;
}

function getAchor(x: number, y: number, dx = 0, dy = 0): Point {
  return [x + dx, y + dy];
}

function getMiddlePoint(points: Point[]): Point {
  if (!points.length) return [0, 0];
  const middleIndex = Math.floor(points.length / 2);
  return points.at(middleIndex)!;
}

function containsPoint(bounds: ViewportRenderContext["bounds"], [x, y]: Point): boolean {
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

window.drawLabels = drawLabels;
window.removeLabels = removeLabels;

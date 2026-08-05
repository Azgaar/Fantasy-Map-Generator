import { getLabelParentFontSize, isLabelGroupVisible } from "@/controllers/label-policy";
import type { LabelType } from "@/generators/labels";
import {
  containsPoint,
  Scene,
  type ViewportRenderContext,
  viewportLayers
} from "@/renderers/viewport/viewport-renderer";
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
  document.getElementById("textPaths")?.replaceChildren();
  const labels = Object.values(dataAdapters).flatMap(adapter => adapter());
  labelScene.replace(labels);
  indexLabelGroups();
  viewportLayers.renderNow();
  TIME && console.timeEnd("drawLabels");
}

export function drawLabelsByType(type: LabelType, ids?: number[]): void {
  if (!layerIsOn("toggleLabels")) return void removeLabels();
  if (!labelScene.valid) drawLabels();

  TIME && console.time("drawLabelsByType");
  const selected = ids && new Set(ids);
  const changed = labelScene.replaceWhere(
    label => label.type === type && (!selected || selected.has(getEntityId(label))),
    dataAdapters[type](ids)
  );
  indexLabelGroups();
  for (const id of changed) removeMaterialized(id, document);
  viewportLayers.renderNow();
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

export function forceLabel(id: string): SVGTextElement | null {
  labelScene.pin(id);
  viewportLayers.renderNow();
  return document.getElementById(id) as SVGTextElement | null;
}

export function releaseLabel(id: string): void {
  labelScene.unpin(id);
  viewportLayers.renderNow();
}

export function getCachedLabel(id: string): LabelData | undefined {
  return labelScene.get(id);
}

function getBurgLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const result: PointLabelData[] = [];
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || (selected && !selected.has(burg.i))) continue;
    result.push(
      withAnchor({
        ...burg.label,
        id: `burgLabel${burg.i}`,
        text: burg.label?.text ?? burg.name ?? "",
        type: "burg",
        group: burg.label?.group || burg.group || "burg",
        x: burg.x,
        y: burg.y
      })
    );
  }
  return result;
}

function getProvinceLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const result: PointLabelData[] = [];
  for (const province of pack.provinces) {
    if (!province.i || province.removed || (selected && !selected.has(province.i))) continue;
    const [x, y] = province.pole || pack.cells.p[province.center];
    result.push(
      withAnchor({
        ...province.label,
        id: `provinceLabel${province.i}`,
        text: province.label?.text ?? province.name,
        type: "province",
        group: province.label?.group || "province",
        x,
        y
      })
    );
  }
  return result;
}

function getStateLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const result: PathLabelData[] = [];
  for (const state of pack.states) {
    if (!state.i || state.removed || (selected && !selected.has(state.i))) continue;
    const pole = state.pole || pack.cells.p[state.center];
    result.push(withAnchor(getRegionLabel(state, "state", pack.cells.state, pole, state.cells || 0)));
  }
  return result;
}

function getRiverLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  const labels: LabelData[] = [];
  for (const river of pack.rivers) {
    if (!river.cells.length || !river.name || (selected && !selected.has(river.i))) continue;
    const points = river.label?.pathPoints || Rivers.addMeandering(river.cells, river.points);
    if (!points.length) continue;
    labels.push(
      withAnchor({
        ...river.label,
        id: `riverLabel${river.i}`,
        type: "river",
        text: river.label?.text ?? `${river.name} ${river.type}`,
        group: river.label?.group || "river",
        pathPoints: formatPathPoints(points as Point[]),
        startOffset: river.label?.startOffset
      })
    );
  }
  return labels;
}

function getRouteLabelsData(ids?: number[]): PathLabelData[] {
  const selected = ids && new Set(ids);
  const labels: PathLabelData[] = [];
  for (const route of pack.routes) {
    if (!route.label?.pathPoints || !route.name || (selected && !selected.has(route.i))) continue;
    labels.push(
      withAnchor({
        ...route.label,
        id: `routeLabel${route.i}`,
        type: "route",
        text: route.label?.text ?? route.name ?? "",
        group: route.label?.group || "route",
        pathPoints: formatPathPoints(route.label?.pathPoints),
        startOffset: route.label?.startOffset
      })
    );
  }
  return labels;
}

function getAddedLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  return pack.labels
    .filter(label => !selected || selected.has(label.i))
    .map(label => withAnchor({ id: `addedLabel${label.i}`, type: "added", ...label }));
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
    label =>
      context.renderAll || labelScene.isPinned(label.id) || (visible && containsPoint(context.bounds, label.anchor))
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

const labelScene = new Scene<LabelData>();
const labelsByGroup = new Map<string, LabelData[]>();
viewportLayers.register({ id: "labels", render: reconcileLabels });

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

type PathLabelInput = Omit<PathLabelData, "anchor">;
type PointLabelInput = Omit<PointLabelData, "anchor">;
type LabelInput = PathLabelInput | PointLabelInput;

function withAnchor(label: PathLabelInput): PathLabelData;
function withAnchor(label: PointLabelInput): PointLabelData;
function withAnchor(label: LabelInput): LabelData {
  const [x, y] = "pathPoints" in label ? interpolatePath(label) : [label.x, label.y];
  const anchor = [x + (label.dx || 0), y + (label.dy || 0)];
  return { ...label, anchor } as LabelData;
}

function interpolatePath(label: PathLabelInput): Point {
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

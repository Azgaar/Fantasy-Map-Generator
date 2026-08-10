import type { LabelGroup, LabelType } from "@/generators/labels-generator";
import type { LabelData, PathLabelData, PointLabelData } from "@/renderers/labels/labels";
import { Scene, ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { Point } from "@/types/global";
import { fitStateLabel } from "./fit-state-label";
import { renderLabelGroups } from "./label-groups";
import { createLabelElements } from "./label-markup";

const scene = new Scene<LabelData>();
const layer = ViewportLayers.register({ id: "labels", render: reconcileLabels });
const labelsByGroup = new Map<string, LabelData[]>();

export const labelDataAdapters: Record<LabelType, () => LabelData[]> = {
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
  const labels = Object.values(labelDataAdapters).flatMap(adapter => adapter());
  scene.replace(labels);
  indexLabelsByGroup();
  layer.render();
  TIME && console.timeEnd("drawLabels");
}

function removeLabels(): void {
  scene.invalidate();
  labelsByGroup.clear();
  const labels = findElement(document, "labels");
  if (labels) labels.replaceChildren();
  const textPaths = findElement(document, "textPaths");
  if (textPaths) textPaths.replaceChildren();
}

export function getSceneLabel(type: LabelType, id: number): LabelData | undefined {
  const labelId = `${type}Label${id}`;
  return scene.get(labelId);
}

function getBurgLabelsData(): PointLabelData[] {
  const labels: PointLabelData[] = [];
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed) continue;
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

function getProvinceLabelsData(): PointLabelData[] {
  const labels: PointLabelData[] = [];
  for (const province of pack.provinces) {
    if (!province.i || province.removed) continue;
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

function getStateLabelsData(): PathLabelData[] {
  const labels: PathLabelData[] = [];
  for (const state of pack.states) {
    if (!state.i || state.removed) continue;
    const group = state.label?.group || "state";
    const labelData = state.label?.pathPoints?.length ? state.label : fitStateLabel(state, group);
    const { pathPoints, text, fontSize } = labelData;
    if (!pathPoints?.length || !text) continue;
    const label: PathLabelData = {
      ...labelData,
      id: `stateLabel${state.i}`,
      entityId: state.i,
      type: "state",
      group,
      pathPoints,
      text,
      fontSize,
      anchor: getAchor(...getMiddlePoint(pathPoints), state.label?.dx, state.label?.dy)
    };
    labels.push(label);
  }
  return labels;
}

function getRiverLabelsData(): PathLabelData[] {
  const labels: PathLabelData[] = [];
  for (const river of pack.rivers) {
    if (!river.cells.length || !river.name) continue;
    const points = formatPathPoints(river.label?.pathPoints || Rivers.addMeandering(river.cells, river.points));
    if (!points.length) continue;
    labels.push({
      ...river.label,
      id: `riverLabel${river.i}`,
      entityId: river.i,
      type: "river",
      text: river.label?.text ?? `${river.name} ${river.type}`,
      group: river.label?.group || "river",
      pathPoints: points,
      startOffset: river.label?.startOffset,
      anchor: getAchor(...getMiddlePoint(points), river.label?.dx, river.label?.dy)
    });
  }
  return labels;
}

function getRouteLabelsData(): PathLabelData[] {
  const labels: PathLabelData[] = [];
  for (const route of pack.routes) {
    if (!route.name) continue;
    const points = formatPathPoints(route.label?.pathPoints || route.points);
    if (!points.length) continue;
    labels.push({
      ...route.label,
      id: `routeLabel${route.i}`,
      entityId: route.i,
      type: "route",
      text: route.label?.text ?? route.name,
      group: route.label?.group || "route",
      pathPoints: points,
      startOffset: route.label?.startOffset,
      anchor: getAchor(...getMiddlePoint(points), route.label?.dx, route.label?.dy)
    });
  }
  return labels;
}

function getAddedLabelsData(): LabelData[] {
  const labels: PathLabelData[] = [];
  for (const label of pack.addedLabels) {
    if (!label.i || !label.pathPoints.length) continue;
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
  if (!scene.valid || !layerIsOn("toggleLabels")) return;
  const labels = findElement(context.root, "labels");
  const textPaths = findElement(context.root, "textPaths");
  if (!labels || !textPaths) return;

  for (const group of options.labels.groups) reconcileGroup(labels, textPaths, group.name, context);
}

function reconcileGroup(labels: Element, textPaths: Element, groupName: string, context: ViewportRenderContext): void {
  const group = labels.querySelector<SVGGElement>(`#labels-${groupName}`);
  const groupOptions = options.labels.groups.find(group => group.name === groupName);
  if (!group || !groupOptions) return;

  const isVisible = isGroupVisible({ group: groupOptions, context });
  const visibleLabels = isVisible
    ? (labelsByGroup.get(groupName) || []).filter(label => isLabelVisible(context.bounds, label.anchor))
    : [];
  const visibleIds = new Set(visibleLabels.map(label => label.id));

  for (const child of Array.from(group.children)) {
    if (visibleIds.has(child.id)) continue;
    removeMaterialized(child.id, context.root);
  }

  for (const label of visibleLabels) {
    const isMaterialized = group.querySelector<SVGTextElement>(`#${label.id}`);
    if (isMaterialized) continue;
    const { text, path } = createLabelElements(label, group.ownerDocument);
    if (path) textPaths.appendChild(path);
    group.appendChild(text);
  }
}

function isGroupVisible({ group, context }: { group: LabelGroup; context: ViewportRenderContext }): boolean {
  if (group.active === false) return false;
  if (!options.labels.showAll) {
    if (group.zoom.min !== null && context.bounds.scale < group.zoom.min) return false;
    if (group.zoom.max !== null && context.bounds.scale > group.zoom.max) return false;
  }
  return !group.layerDependency || layerIsOn(group.layerDependency);
}

function isLabelVisible(bounds: ViewportRenderContext["bounds"], [x, y]: Point): boolean {
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

function removeMaterialized(id: string, root: ParentNode): void {
  findElement(root, id)?.remove();
  findElement(root, `textPath_${id}`)?.remove();
}

function findElement(root: ParentNode, id: string): Element | null {
  if (root instanceof Element && root.id === id) return root;
  return root.querySelector(`#${id}`);
}

function indexLabelsByGroup(): void {
  labelsByGroup.clear();
  for (const label of scene.values()) {
    const groupLabels = labelsByGroup.get(label.group) || [];
    groupLabels.push(label);
    labelsByGroup.set(label.group, groupLabels);
  }
}

function formatPathPoints(pointLike: number[][]): Point[] {
  const points: Point[] = pointLike.map(([x, y]) => [x, y]);
  const trimmed = trimAroundCenter(points);
  if (trimmed.length && trimmed.at(0)![0] > trimmed.at(-1)![0]) trimmed.reverse();
  return trimmed;
}

const LABEL_PATH_POINTS_RADIUS = 4;
function trimAroundCenter(points: Point[], radius = LABEL_PATH_POINTS_RADIUS) {
  if (points.length <= radius * 2 + 1) return points;
  const middleIndex = Math.floor(points.length / 2);
  const start = Math.max(0, middleIndex - radius);
  const end = Math.min(points.length, middleIndex + radius + 1);
  return points.slice(start, end);
}

function getAchor(x: number, y: number, dx = 0, dy = 0): Point {
  return [x + dx, y + dy];
}

function getMiddlePoint(points: Point[]): Point {
  if (!points.length) return [0, 0];
  const middleIndex = Math.floor(points.length / 2);
  const [x, y] = points.at(middleIndex)!;
  return [x, y];
}

window.drawLabels = drawLabels;

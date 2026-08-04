import { getLabelParentFontSize, resolveLabelGroup } from "@/controllers/label-policy";
import type { LabelType } from "@/generators/labels";
import type { Point } from "@/types/global";
import { renderLabelGroups } from "./label-groups";
import { labelScene, renderLabelsNow, resetLabelViewport, syncLabelViewportLayers } from "./label-materializer";
import { getPathLabel } from "./path-label-layout";
import { getRegionLabel } from "./region-label-layout";
import type { LabelData, PathLabelData, PointLabelData } from "./types";

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
  document
    .getElementById("labels")
    ?.setAttribute("font-size", `${getLabelParentFontSize(scale, options.labels.resizeOnZoom)}px`);
  labelScene.replaceAll(
    Object.values(dataAdapters)
      .flatMap(adapter => adapter())
      .map(resolveGroup)
  );
  syncLabelViewportLayers();
  resetLabelViewport();
  renderLabelsNow();
  TIME && console.timeEnd("drawLabels");
}

export function drawLabel(type: LabelType, id?: number): void {
  if (!layerIsOn("toggleLabels")) return void removeLabels();
  drawLabelsByType(type, id === undefined ? undefined : [id]);
}

export function drawLabelsByType(type: LabelType, ids?: number[]): void {
  if (!labelScene.valid) return void drawLabels();
  labelScene.updateType(type, dataAdapters[type](ids).map(resolveGroup), ids);
  syncLabelViewportLayers();
  renderLabelsNow();
}

export function removeLabels(): void {
  document.querySelectorAll("#labels > g").forEach(group => {
    group.replaceChildren();
  });
  document.getElementById("textPaths")?.replaceChildren();
  labelScene.invalidate();
  resetLabelViewport();
}

export function removeLabel(type: LabelType, id: number): void;
export function removeLabel(id: string): void;
export function removeLabel(typeOrId: LabelType | string, id?: number): void {
  const labelId = id === undefined ? typeOrId : `${typeOrId}Label${id}`;
  const type =
    id === undefined ? (labelId.match(/^([a-z]+)Label/)?.[1] as LabelType | undefined) : (typeOrId as LabelType);
  const entityId = id ?? Number(labelId.match(/\d+$/)?.[0]);
  if (type && Number.isFinite(entityId)) labelScene.remove(type, entityId);
  document.getElementById(labelId)?.remove();
  document.getElementById(`textPath_${labelId}`)?.remove();
}

export function getLabelsData(type?: LabelType, ids?: number[]): LabelData[] {
  const labels = type ? dataAdapters[type](ids) : Object.values(dataAdapters).flatMap(adapter => adapter());
  return labels.map(resolveGroup);
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
  return pack.rivers
    .filter(river => river.cells.length > 1 && river.name && (!selected || selected.has(river.i)))
    .map(river =>
      getPathLabel(river, "river", () =>
        Rivers.addMeandering(river.cells, river.points ?? null).map(([x, y]) => [x, y] as Point)
      )
    );
}

function getRouteLabelsData(ids?: number[]): LabelData[] {
  const selected = ids && new Set(ids);
  return pack.routes
    .filter(route => route.points.length > 1 && route.name && (!selected || selected.has(route.i)))
    .map(route => getPathLabel(route, "route", () => route.points as Point[]));
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

window.drawLabels = drawLabels;
window.removeLabels = removeLabels;

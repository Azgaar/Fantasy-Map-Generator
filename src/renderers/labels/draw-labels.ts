import type { LabelType } from "@/generators/labels";
import type { Point } from "@/types/global";
import { applyLabelZoom, ensureLabelGroup, renderLabelGroups } from "./label-groups";
import { getLabelMarkup } from "./label-markup";
import { getPathLabel } from "./path-label-layout";
import { getRegionLabel } from "./region-label-layout";
import type { LabelData, PathLabelData, PointLabelData } from "./types";

const dataAdapters: Record<LabelType, (labelsData: LabelsData, ids?: number[]) => void> = {
  state: addStateLabelsData,
  province: addProvinceLabelsData,
  added: addAddedLabelsData,
  burg: addBurgLabelsData,
  river: addRiverLabelsData,
  route: addRouteLabelsData
};

export function drawLabels(): void {
  if (!layerIsOn("toggleLabels")) {
    removeLabels();
    return;
  }

  TIME && console.time("drawLabels");
  renderLabelGroups();

  const labelsData = new LabelsData();
  Object.values(dataAdapters).forEach(adapter => void adapter(labelsData));

  removeLabels();
  renderLabelsData(labelsData);
  applyLabelZoom();
  TIME && console.timeEnd("drawLabels");
}

export function drawLabel(type: LabelType, id?: number): void {
  if (!layerIsOn("toggleLabels")) {
    removeLabels();
    return;
  }

  if (id === undefined) drawLabelsByType(type);
  else drawLabelsByType(type, [id]);
}

export function drawLabelsByType(type: LabelType, ids?: number[]): void {
  const labelsData = new LabelsData();
  dataAdapters[type](labelsData, ids);

  const data = labelsData.get();
  for (const group in data) {
    for (const labelData of data[group]) {
      removeLabel(labelData.id);
    }
  }

  renderLabelsData(labelsData);
  applyLabelZoom();
}

function renderLabelsData(labelsData: LabelsData): void {
  const paths: string[] = [];

  for (const [groupName, groupLabels] of Object.entries(labelsData.get())) {
    const groupMarkup: string[] = [];
    for (const labelData of groupLabels) {
      const [path, markup] = getLabelMarkup(labelData);
      if (path) paths.push(path);
      if (markup) groupMarkup.push(markup);
    }

    if (!groupMarkup.length) continue;
    ensureLabelGroup(groupName, groupLabels[0].type).insertAdjacentHTML("beforeend", groupMarkup.join(""));
  }

  document.getElementById("textPaths")?.insertAdjacentHTML("beforeend", paths.join(""));
}

export function removeLabels(): void {
  const labels = document.querySelector<SVGGElement>("#labels");
  if (!labels) throw new Error("Labels container not found");

  for (const group of Array.from(labels.children)) group.replaceChildren();
  document.getElementById("textPaths")?.replaceChildren();
}

export function removeLabel(id: string): void {
  document.getElementById(id)?.remove();
  document.getElementById(`textPath_${id}`)?.remove();
}

// LABELS DATA ADAPTERS
function addBurgLabelsData(labelsData: LabelsData, ids?: number[]): void {
  const selectedIds = ids && new Set(ids);
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || (selectedIds && !selectedIds.has(burg.i))) continue;

    const label: PointLabelData = {
      ...burg.label,
      id: `burgLabel${burg.i}`,
      text: burg.label?.text ?? burg.name ?? "",
      type: "burg",
      group: burg.label?.group || burg.group || "burg",
      x: burg.x,
      y: burg.y
    };
    labelsData.add(label);
  }
}

function addProvinceLabelsData(labelsData: LabelsData, ids?: number[]): void {
  const selectedIds = ids && new Set(ids);
  for (const province of pack.provinces) {
    if (!province.i || province.removed || (selectedIds && !selectedIds.has(province.i))) continue;

    const [x, y] = province.pole || pack.cells.p[province.center];
    const label: PointLabelData = {
      ...province.label,
      id: `provinceLabel${province.i}`,
      text: province.label?.text ?? province.name,
      type: "province",
      group: province.label?.group || "province",
      x,
      y
    };
    labelsData.add(label);
  }
}

function addStateLabelsData(labelsData: LabelsData, ids?: number[]): void {
  const selectedIds = ids && new Set(ids);
  for (const state of pack.states) {
    if (!state.i || state.removed || (selectedIds && !selectedIds.has(state.i))) continue;

    const pole = state.pole || pack.cells.p[state.center];
    const label: PathLabelData = getRegionLabel(state, "state", pack.cells.state, pole, state.cells || 0);
    labelsData.add(label);
  }
}

function addRiverLabelsData(labelsData: LabelsData, ids?: number[]): void {
  const selectedIds = ids && new Set(ids);
  const rivers = pack.rivers.filter(river => river.cells.length > 1);
  for (const river of rivers) {
    if (selectedIds && !selectedIds.has(river.i)) continue;
    if (!river.name) continue;

    const getPoints = () => Rivers.addMeandering(river.cells, river.points ?? null).map(([x, y]) => [x, y] as Point);
    const label = getPathLabel(river, "river", getPoints);
    labelsData.add(label);
  }
}

function addRouteLabelsData(labelsData: LabelsData, ids?: number[]): void {
  const selectedIds = ids && new Set(ids);
  const routes = pack.routes.filter(route => route.points.length > 1);
  for (const route of routes) {
    if (selectedIds && !selectedIds.has(route.i)) continue;
    if (!route.name) continue;

    const label = getPathLabel(route, "route", () => route.points as Point[]);
    labelsData.add(label);
  }
}

function addAddedLabelsData(labelsData: LabelsData, ids?: number[]): void {
  const selectedIds = ids && new Set(ids);

  for (const addedLabel of pack.labels) {
    if (selectedIds && !selectedIds.has(addedLabel.i)) continue;

    const label: PathLabelData = { id: `addedLabel${addedLabel.i}`, type: "added", ...addedLabel };
    labelsData.add(label);
  }
}

class LabelsData {
  private data: Record<string, LabelData[]> = {};

  add(label: LabelData): void {
    if (!this.data[label.group]) this.data[label.group] = [];
    this.data[label.group].push(label);
  }

  get(): Record<string, LabelData[]> {
    return this.data;
  }
}

window.drawLabels = drawLabels;
window.removeLabels = removeLabels;

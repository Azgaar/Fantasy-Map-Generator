import type { LabelType } from "@/generators/labels";
import type { Point } from "@/types/global";
import { applyLabelZoom, ensureLabelGroup, renderLabelGroups } from "./label-groups";
import { getLabelMarkup } from "./label-markup";
import { createRegionLabel } from "./region-label-layout";

interface BaseLabelData {
  id: string;
  text: string;
  type: LabelType;
  group: string;
  fontSize?: number;
  letterSpacing?: number;
  dx?: number;
  dy?: number;
}

export interface PathLabelData extends BaseLabelData {
  pathPoints: Point[];
  startOffset?: number;
}

export interface PointLabelData extends BaseLabelData {
  x: number;
  y: number;
}

export type LabelData = PathLabelData | PointLabelData;

const dataAdapters: Record<LabelType, (labelsData: LabelsData, ids?: number[]) => void> = {
  state: addStateLabelsData,
  province: addProvinceLabelsData,
  added: addAddedLabelsData,
  burg: addBurgLabelsData
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

    const label = createRegionLabel(province, "province");
    labelsData.add(label);
  }
}

function addStateLabelsData(labelsData: LabelsData, ids?: number[]): void {
  const selectedIds = ids && new Set(ids);

  for (const state of pack.states) {
    if (!state.i || state.removed || (selectedIds && !selectedIds.has(state.i))) continue;

    const label = createRegionLabel(state, "state");
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

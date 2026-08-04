import type { LabelGroup, LabelType } from "@/generators/labels";

export function renderLabelGroups(): void {
  const labels = document.querySelector<SVGGElement>("#labels");
  if (!labels) throw new Error("Labels container not found");

  labels.replaceChildren();
  for (const groupOptions of options.labels.groups) {
    renderLabelGroup(labels, groupOptions);
  }
}

export function ensureLabelGroup(groupName: string, type: LabelType): SVGGElement {
  const labels = document.querySelector<SVGGElement>("#labels");
  if (!labels) throw new Error("Labels container not found");

  let group = labels.querySelector<SVGGElement>(`#labels-${groupName}`);
  if (!group) {
    ERROR && console.error(`Label group ${groupName} not found, applying fallback group for type ${type}`);
    const fallbackGroup = Labels.getFallbackGroup(type);
    group = labels.querySelector<SVGGElement>(`#labels-${fallbackGroup.name}`);
    if (!group) throw new Error(`Fallback label group for type ${type} not rendered`);
  }

  return group;
}

function renderLabelGroup(labels: SVGGElement, groupOptions: LabelGroup): SVGGElement {
  const group = labels.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = `labels-${groupOptions.name}`;
  group.dataset.group = groupOptions.name;

  const groupStyle = getGroupStyle(groupOptions);
  for (const [attribute, value] of Object.entries(groupStyle)) {
    if (value !== null) group.setAttribute(attribute, String(value));
  }

  const dx = Number(group.dataset.dx) || 0;
  const dy = Number(group.dataset.dy) || 0;
  group.style.transform = dx || dy ? `translate(${dx}em, ${dy}em)` : "";

  labels.appendChild(group);
  return group;
}

const BASE_STYLE = {
  fill: "#3e3e4b",
  opacity: 1,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "font-family": "Almendra SC",
  "font-size": "18%"
} as const;

const FALLBACK_STYLES: Record<LabelType, Record<string, string | number>> = {
  state: { ...BASE_STYLE, "font-size": "22%" },
  burg: { ...BASE_STYLE, "font-size": "4%" },
  province: { ...BASE_STYLE, "font-size": "10%" },
  river: { ...BASE_STYLE, "font-size": "3%" },
  route: { ...BASE_STYLE, "font-size": "3%" },
  added: { ...BASE_STYLE, "font-size": "18%" }
};

export function getGroupStyle(group: { name: string; type: LabelType }) {
  const groupStyle = style.labels.groups[group.name];
  if (groupStyle) return groupStyle;

  const fallbackGroup = Labels.getFallbackGroup(group.type);
  const fallbackStyle = FALLBACK_STYLES[fallbackGroup.type];
  if (fallbackStyle) return fallbackStyle;

  ERROR && console.error(`No style or fallback style found for label group ${group.name} of type ${group.type}`);
  return BASE_STYLE;
}

export function applyLabelZoom(): void {
  const labels = document.querySelector<SVGGElement>("#labels");
  if (!labels) return;

  labels.setAttribute("font-size", `${getScaledFontSize()}px`);

  for (const groupOptions of options.labels.groups) {
    const group = labels.querySelector<SVGGElement>(`#labels-${groupOptions.name}`);
    if (group) group.classList.toggle("hidden", !isGroupVisible(groupOptions));
  }
}

function getScaledFontSize(): number {
  if (!options.labels.resizeOnZoom) return 100;
  return Math.max(Math.round(((100 + 100 / scale) / 2) * 100) / 100, 1);
}

function isGroupVisible(group: LabelGroup): boolean {
  if (!layerIsOn("toggleLabels")) return false;
  if (options.labels.showAll) return true;
  if (group.active === false) return false;
  if (group.zoom.min !== null && scale < group.zoom.min) return false;
  if (group.zoom.max !== null && scale > group.zoom.max) return false;
  if (group.layerDependency && !layerIsOn(group.layerDependency)) return false;
  return true;
}

window.applyLabelZoom = applyLabelZoom;

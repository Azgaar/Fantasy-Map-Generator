import type { LabelGroupOptions, LabelType } from "@/generators/labels";
import { getLabelParentFontSize, isLabelGroupVisible, resolveLabelGroup } from "@/utils/label-policy";

export function renderLabelGroups(): void {
  const labels = document.querySelector<SVGGElement>("#labels");
  if (!labels) throw new Error("Labels container not found");

  labels.replaceChildren();
  for (const groupOptions of options.labels.groups) {
    renderLabelGroup(labels, groupOptions);
  }

  applyLabelZoom();
}

function renderLabelGroup(labels: SVGGElement, groupOptions: LabelGroupOptions): SVGGElement {
  const group = labels.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = `labels-${groupOptions.name}`;
  group.dataset.group = groupOptions.name;

  const groupStyle = style.labels.groups[groupOptions.name] || getFallbackStyle(groupOptions);
  for (const [attribute, value] of Object.entries(groupStyle)) {
    if (value !== null) group.setAttribute(attribute, String(value));
  }

  const dx = Number(group.dataset.dx) || 0;
  const dy = Number(group.dataset.dy) || 0;
  group.style.transform = dx || dy ? `translate(${dx}em, ${dy}em)` : "";

  labels.appendChild(group);
  return group;
}

export function getLabelGroup(requestedGroup: string | undefined, type: LabelType): SVGGElement {
  const labels = document.querySelector<SVGGElement>("#labels")!;
  const groupName = resolveLabelGroup(type, requestedGroup, options.labels, options.burgs.groups);
  const groupOptions = getLabelGroupOptions(groupName);
  const group = findLabelGroup(labels, groupName) || renderLabelGroup(labels, groupName);
  setGroupStyle(group, style.labels.groups[groupName] || getFallbackStyle(groupOptions), groupName);
  return group;
}

export function getLabelGroupStyle(requestedGroup: string | undefined, type: LabelType) {
  const groupName = resolveLabelGroup(type, requestedGroup, options.labels, options.burgs.groups);
  return style.labels.groups[groupName] || getFallbackStyle(getLabelGroupOptions(groupName));
}

export function getLabelGroupOptions(name: string): LabelGroupOptions | undefined {
  return typeof options === "undefined" ? undefined : options.labels?.groups.find(group => group.name === name);
}

export function readLabelGroupStyle(group: Element) {
  const groupStyle = Object.fromEntries(
    Array.from(group.attributes)
      .filter(attribute => !["id", "class", "data-group"].includes(attribute.name))
      .map(attribute => [
        attribute.name,
        attribute.name === "style" ? getStoredStyle(group as SVGGElement) : attribute.value
      ])
      .filter(([, value]) => value !== "")
  );

  const legacySize = groupStyle["data-size"];
  if (legacySize !== undefined) {
    groupStyle["font-size"] = `${Number(legacySize) || 18}%`;
    delete groupStyle["data-size"];
  }
  return groupStyle;
}

const BASE_STYLE = {
  fill: "#3e3e4b",
  opacity: 1,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "font-family": "Almendra SC",
  "font-size": "18%"
} as const;

const FALLBACK_GROUPS = {
  states: { id: "states", style: { ...BASE_STYLE, "font-size": "22%" } },
  burgs: { id: "burgs", style: { ...BASE_STYLE, "font-size": "4%" } },
  provinces: { id: "provinces", style: { ...BASE_STYLE, "font-size": "10%" } },
  added: { id: "added", style: { ...BASE_STYLE, "font-size": "18%" } }
};

function getFallbackStyle(group: LabelGroupOptions) {
  const fallback = FALLBACK_GROUPS[group.type];
  const fallbackStyle = style.labels.groups[fallback.id] || fallback.style || BASE_STYLE;
  return { ...fallbackStyle };
}

function findLabelGroup(labels: SVGGElement, groupName: string): SVGGElement | undefined {
  return Array.from(labels.children).find(
    child => child.tagName === "g" && (child as SVGGElement).dataset.group === groupName
  ) as SVGGElement | undefined;
}

function getStoredStyle(group: SVGGElement): string {
  return Array.from(group.style)
    .filter(property => property !== "transform")
    .map(property => `${property}: ${group.style.getPropertyValue(property)}`)
    .join("; ");
}

export function applyLabelZoom(currentScale = scale): void {
  const labels = document.querySelector<SVGGElement>("#labels");
  if (!labels || typeof options === "undefined" || !options.labels) return;
  labels.setAttribute("font-size", `${getLabelParentFontSize(currentScale, options.labels.resizeOnZoom)}px`);
  const labelsLayerOn = layerIsOn("toggleLabels");

  for (const groupOptions of options.labels.groups) {
    const group = findLabelGroup(labels, groupOptions.name);
    if (!group) continue;
    const visible = isLabelGroupVisible({
      labelsLayerOn,
      labels: options.labels,
      group: groupOptions,
      scale: currentScale,
      layerIsOn: dependency => Boolean(document.getElementById(dependency)) && layerIsOn(dependency)
    });
    group.classList.toggle("hidden", !visible);
  }
}

window.applyLabelZoom = applyLabelZoom;

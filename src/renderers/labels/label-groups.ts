import {
  DEFAULT_ADDED_LABEL_GROUP,
  DEFAULT_BURG_LABEL_GROUP,
  DEFAULT_PROVINCE_LABEL_GROUP,
  DEFAULT_STATE_LABEL_GROUP,
  type LabelType
} from "@/generators/labels";
import type { LabelGroupOptions, LabelGroupStyle } from "@/types/labels";
import { getLabelParentFontSize, isLabelGroupVisible, resolveLabelGroup } from "@/utils/label-policy";

const BASE_STYLE: LabelGroupStyle = {
  fill: "#3e3e4b",
  opacity: 1,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "font-family": "Almendra SC",
  "font-size": "18%"
};

const FALLBACK_STYLES: Record<string, LabelGroupStyle> = {
  [DEFAULT_STATE_LABEL_GROUP]: { ...BASE_STYLE, "font-size": "22%" },
  [DEFAULT_BURG_LABEL_GROUP]: { ...BASE_STYLE, "font-size": "4%" },
  [DEFAULT_PROVINCE_LABEL_GROUP]: { ...BASE_STYLE, "font-size": "10%" },
  [DEFAULT_ADDED_LABEL_GROUP]: { ...BASE_STYLE }
};

export function renderLabelGroups(labels = document.querySelector<SVGGElement>("#labels")!): void {
  labels.setAttribute("font-size", "100px");

  const configuredNames = new Set(options.labels.groups.map(group => group.name));
  Array.from(labels.children).forEach(child => {
    if (child.tagName === "g" && !configuredNames.has((child as SVGGElement).dataset.group || "")) child.remove();
  });

  for (const groupOptions of options.labels.groups) {
    const groupStyle = style.labels.groups[groupOptions.name] || cloneFallbackStyle(groupOptions);
    const group = findLabelGroup(labels, groupOptions.name) || createLabelGroup(labels, groupOptions.name);
    setGroupStyle(group, groupStyle, groupOptions.name);
    labels.appendChild(group);
  }
  applyLabelZoom();
}

export function getLabelGroup(requestedGroup: string | undefined, type: LabelType): SVGGElement {
  const labels = document.querySelector<SVGGElement>("#labels")!;
  const groupName = resolveLabelGroup(type, requestedGroup, options.labels, options.burgs.groups);
  const groupOptions = getLabelGroupOptions(groupName);
  const group = findLabelGroup(labels, groupName) || createLabelGroup(labels, groupName);
  setGroupStyle(group, style.labels.groups[groupName] || cloneFallbackStyle(groupOptions), groupName);
  return group;
}

export function getLabelGroupStyle(requestedGroup: string | undefined, type: LabelType): LabelGroupStyle {
  const groupName = resolveLabelGroup(type, requestedGroup, options.labels, options.burgs.groups);
  return style.labels.groups[groupName] || cloneFallbackStyle(getLabelGroupOptions(groupName));
}

export function getLabelGroupOptions(name: string): LabelGroupOptions | undefined {
  return typeof options === "undefined" ? undefined : options.labels?.groups.find(group => group.name === name);
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

export function readLabelGroupStyle(group: Element): LabelGroupStyle {
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

function cloneFallbackStyle(group: LabelGroupOptions | undefined): LabelGroupStyle {
  const fallbackName =
    group?.type === "states"
      ? DEFAULT_STATE_LABEL_GROUP
      : group?.type === "provinces"
        ? DEFAULT_PROVINCE_LABEL_GROUP
        : group?.type === "burgs"
          ? DEFAULT_BURG_LABEL_GROUP
          : DEFAULT_ADDED_LABEL_GROUP;
  return { ...(style.labels.groups[fallbackName] || FALLBACK_STYLES[fallbackName] || BASE_STYLE) };
}

function findLabelGroup(labels: SVGGElement, groupName: string): SVGGElement | undefined {
  return Array.from(labels.children).find(
    child => child.tagName === "g" && (child as SVGGElement).dataset.group === groupName
  ) as SVGGElement | undefined;
}

function createLabelGroup(labels: SVGGElement, groupName: string): SVGGElement {
  const group = labels.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = `labels-${groupName}`;
  group.dataset.group = groupName;
  labels.appendChild(group);
  return group;
}

function setGroupStyle(group: SVGGElement, groupStyle: LabelGroupStyle, groupName: string): void {
  Array.from(group.attributes).forEach(attribute => {
    if (!["id", "data-group", "class"].includes(attribute.name)) group.removeAttribute(attribute.name);
  });
  group.id = `labels-${groupName}`;
  group.dataset.group = groupName;
  for (const [attribute, rawValue] of Object.entries(groupStyle)) {
    if (rawValue === null || attribute === "data-size") continue;
    const value = attribute === "font-size" && typeof rawValue === "number" ? `${rawValue}%` : rawValue;
    group.setAttribute(attribute, String(value));
  }
  applyGroupOffset(group);
}

function applyGroupOffset(group: SVGGElement): void {
  const dx = Number(group.dataset.dx) || 0;
  const dy = Number(group.dataset.dy) || 0;
  group.style.transform = dx || dy ? `translate(${dx}em, ${dy}em)` : "";
}

function getStoredStyle(group: SVGGElement): string {
  return Array.from(group.style)
    .filter(property => property !== "transform")
    .map(property => `${property}: ${group.style.getPropertyValue(property)}`)
    .join("; ");
}

window.applyLabelZoom = applyLabelZoom;

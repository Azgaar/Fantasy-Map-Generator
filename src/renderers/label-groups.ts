import {
  DEFAULT_ADDED_LABEL_GROUP,
  DEFAULT_BURG_LABEL_GROUP,
  DEFAULT_STATE_LABEL_GROUP,
  type LabelType,
  resolveLabelGroup
} from "@/generators/labels";

export type LabelGroupStyle = Record<string, string | number | null>;

const BASE_STYLE: LabelGroupStyle = {
  fill: "#3e3e4b",
  opacity: 1,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "font-family": "Almendra SC",
  "font-size": 18,
  "data-size": 18
};

const FALLBACK_STYLES: Record<string, LabelGroupStyle> = {
  [DEFAULT_STATE_LABEL_GROUP]: { ...BASE_STYLE, "font-size": 22, "data-size": 22 },
  [DEFAULT_BURG_LABEL_GROUP]: { ...BASE_STYLE, "font-size": 4, "data-size": 4 },
  [DEFAULT_ADDED_LABEL_GROUP]: { ...BASE_STYLE }
};

export function renderLabelGroups(labels = document.querySelector<SVGGElement>("#labels")!): void {
  ensureFallbackStyles();
  for (const [groupId, groupStyle] of Object.entries(style.labels.groups)) {
    const group = findLabelGroup(labels, groupId);
    if (group) setGroupStyle(group, groupStyle);
    else createLabelGroup(labels, groupId, groupStyle);
  }
}

export function getLabelGroup(requestedGroup: string | undefined, type: LabelType): SVGGElement {
  ensureFallbackStyles();
  const labels = document.querySelector<SVGGElement>("#labels")!;
  const groupId = resolveLabelGroup(type, requestedGroup);
  return findLabelGroup(labels, groupId) || createLabelGroup(labels, groupId, style.labels.groups[groupId]);
}

export function readLabelGroupStyle(group: Element): LabelGroupStyle {
  const groupStyle = Object.fromEntries(
    Array.from(group.attributes)
      .filter(attribute => attribute.name !== "id" && attribute.name !== "class")
      .map(attribute => [
        attribute.name,
        attribute.name === "style" ? getStoredStyle(group as SVGGElement) : attribute.value
      ])
      .filter(([, value]) => value !== "")
  );

  if (groupStyle["data-size"] !== undefined) groupStyle["font-size"] = groupStyle["data-size"];
  return groupStyle;
}

function ensureFallbackStyles(): void {
  style.labels ??= { groups: {} };
  style.labels.groups ??= {};
  for (const [groupId, groupStyle] of Object.entries(FALLBACK_STYLES)) {
    style.labels.groups[groupId] ??= { ...groupStyle };
  }
}

function findLabelGroup(labels: SVGGElement, groupId: string): SVGGElement | undefined {
  for (const group of labels.children) {
    if (group.tagName === "g" && group.id === groupId) return group as SVGGElement;
  }
  return undefined;
}

function createLabelGroup(labels: SVGGElement, groupId: string, groupStyle: LabelGroupStyle): SVGGElement {
  const group = labels.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = groupId;
  setGroupStyle(group, groupStyle);
  labels.appendChild(group);
  return group;
}

function setGroupStyle(group: SVGGElement, groupStyle: LabelGroupStyle): void {
  Array.from(group.attributes).forEach(attribute => {
    if (attribute.name !== "id") group.removeAttribute(attribute.name);
  });
  for (const [attribute, value] of Object.entries(groupStyle)) {
    if (value !== null) group.setAttribute(attribute, String(value));
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

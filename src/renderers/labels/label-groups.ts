import type { LabelGroup, LabelType } from "@/generators/labels-generator";
import type { LabelGroupStyle } from "@/types/style";

export function renderLabelGroups(root: ParentNode = document): void {
  const labels = findElement<SVGGElement>(root, "labels");
  if (!labels) throw new Error("Labels container not found");

  labels.replaceChildren();
  for (const groupOptions of options.labels.groups) {
    renderLabelGroup(labels, groupOptions);
  }
}

export function ensureLabelGroup(groupName: string, type: LabelType, root: ParentNode = document): SVGGElement {
  const labels = findElement<SVGGElement>(root, "labels");
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

export function renderLabelGroup(labels: SVGGElement, groupOptions: LabelGroup): SVGGElement {
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

const BASE_STYLE: LabelGroupStyle = {
  fill: "#3e3e4b",
  opacity: 1,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "font-family": "Almendra SC",
  "font-size": "18%",
  "letter-spacing": 0,
  style: null,
  filter: null
};

const FALLBACK_STYLES: Record<LabelType, LabelGroupStyle> = {
  state: { ...BASE_STYLE, "font-size": "22%" },
  burg: { ...BASE_STYLE, "font-size": "4%" },
  province: { ...BASE_STYLE, "font-size": "10%" },
  river: { ...BASE_STYLE, "font-size": "3%" },
  route: { ...BASE_STYLE, "font-size": "3%" },
  added: { ...BASE_STYLE, "font-size": "18%" }
};

export function getGroupStyle(group: { name: string; type: LabelType }): LabelGroupStyle {
  const groupStyle = style.labels.groups[group.name];
  if (groupStyle) return groupStyle;

  const fallbackGroup = Labels.getFallbackGroup(group.type);
  const fallbackStyle = FALLBACK_STYLES[fallbackGroup.type];
  if (fallbackStyle) return fallbackStyle;

  ERROR && console.error(`No style or fallback style found for label group ${group.name} of type ${group.type}`);
  return BASE_STYLE;
}

export const getLabelGroupStyle = (requestedGroup: string | undefined, type: LabelType): LabelGroupStyle => {
  const group = options.labels.groups.find(group => group.name === requestedGroup) || Labels.getFallbackGroup(type);
  return getGroupStyle(group);
};

function findElement<T extends Element>(root: ParentNode, id: string): T | null {
  if (root instanceof Element && root.id === id) return root as T;
  return root.querySelector<T>(`#${id}`);
}

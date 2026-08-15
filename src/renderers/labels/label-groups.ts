import type { LabelGroup, LabelType } from "@/generators/labels-generator";
import type { PresentationValue, StyleNode } from "@/types/style";

export type LabelGroupStyle = Record<string, PresentationValue>;

// read-only: a getStyleNode() lookup would materialize an empty child for every group merely
// asked about, and an empty-but-present child hides a group from the preset fallback pass
const getLabelGroupNode = (name: string): StyleNode => style.layers.labels?.children?.[name] ?? {};

export function renderLabelGroups(root: ParentNode = document): void {
  const labels = root.querySelector<SVGGElement>("#labels");
  if (!labels) throw new Error("Labels container not found");

  labels.replaceChildren();
  for (const groupOptions of options.labels.groups) {
    renderLabelGroup(labels, groupOptions);
  }
}

export function renderLabelGroup(labels: SVGGElement, groupOptions: LabelGroup): SVGGElement {
  const group = labels.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = `labels-${groupOptions.name}`;
  group.dataset.group = groupOptions.name;

  applyLabelGroupStyle(group, groupOptions);
  labels.appendChild(group);
  return group;
}

// label groups are the only style.layers children the renderer creates itself, so the styling an
// applyLayerStyle pass gives the live groups has to be reproducible on a group built from scratch
export function applyLabelGroupStyle(group: SVGGElement, groupOptions: { name: string; type: LabelType }): void {
  for (const [attribute, value] of Object.entries(getGroupStyle(groupOptions))) {
    if (value !== null) group.setAttribute(attribute, String(value));
  }
  applyLabelGroupShift(group, groupOptions.name);
}

// dx/dy are options (the shift is data the label solver reads, not a look), projected onto the
// group as data-dx/data-dy + an inline transform. Assigning style.transform - rather than writing
// the whole style attribute - keeps the text-shadow the `style` presentation attr carries
export function applyLabelGroupShift(group: SVGGElement, name: string): void {
  const { dx, dy } = getLabelGroupNode(name).options ?? {};
  setDataAttribute(group, "data-dx", dx);
  setDataAttribute(group, "data-dy", dy);
  group.style.transform = dx || dy ? `translate(${Number(dx) || 0}em, ${Number(dy) || 0}em)` : "";
  if (!group.getAttribute("style")) group.removeAttribute("style");
}

// applyLayerStyle rewrites the whole style attribute of every label group it touches, dropping
// the transform assigned above; re-derive it for the live groups after such a pass
export function applyLabelGroupShifts(labels: ParentNode | null = document.getElementById("labels")): void {
  for (const group of labels?.querySelectorAll<SVGGElement>(":scope > [data-group]") ?? []) {
    applyLabelGroupShift(group, group.dataset.group as string);
  }
}

function setDataAttribute(group: SVGGElement, attribute: string, value: unknown): void {
  if (value === undefined || value === null) group.removeAttribute(attribute);
  else group.setAttribute(attribute, String(value));
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
  const typeStyle = FALLBACK_STYLES[group.type];
  if (!typeStyle) ERROR && console.error(`No fallback style for label group ${group.name} of type ${group.type}`);

  const baseStyle = typeStyle ?? BASE_STYLE;
  return { ...baseStyle, ...getLabelGroupNode(group.name).presentation };
}

window.applyLabelGroupShifts = applyLabelGroupShifts;

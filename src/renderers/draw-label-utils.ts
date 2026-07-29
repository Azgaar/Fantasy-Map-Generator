import { curveNatural, line } from "d3";
import type { Label } from "../generators/labels";

type LabelGroupStyle = Record<string, string | number | null>;

const DEFAULT_LABEL_STYLE: LabelGroupStyle = {
  fill: "#3e3e4b",
  opacity: 1,
  stroke: "#3a3a3a",
  "stroke-width": 0,
  "font-family": "Almendra SC",
  "font-size": 18,
  "data-size": 18
};

export type LabelGroupType = "state" | "burg" | "added";

export function ensureLabelGroup(group: string, type: LabelGroupType): SVGGElement {
  const labels = document.querySelector<SVGGElement>("g#labels")!;
  const parent = type === "burg" ? ensureBurgLabelsContainer() : labels;
  const existing = Array.from(parent.children).find(child => child.tagName === "g" && child.id === group);
  if (existing) return existing as SVGGElement;

  const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
  container.id = group;
  for (const [attribute, value] of getLabelGroupAttributesFor(group, type)) {
    if (value !== null) container.setAttribute(attribute, String(value));
  }
  parent.appendChild(container);
  return container;
}

export function getLabelGroupMarkup(group: string, type: LabelGroupType, content: string): string {
  const attributes = getLabelGroupAttributesFor(group, type)
    .filter(([, value]) => value !== null)
    .map(([attribute, value]) => `${attribute}="${String(value)}"`)
    .join(" ");
  return `<g id="${group}" ${attributes}>${content}</g>`;
}

export function getLabelGroupAttributesFor(group: string, type: LabelGroupType): [string, string | number | null][] {
  return getLabelGroupAttributes({ ...DEFAULT_LABEL_STYLE, ...getLabelGroupStyle(group, type) });
}

export function ensureBurgLabelsContainer(): SVGGElement {
  const labels = document.querySelector<SVGGElement>("g#labels")!;
  const existing = document.querySelector<SVGGElement>("#labels > #burgLabels");
  if (existing) return existing;

  const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
  container.id = "burgLabels";
  labels.appendChild(container);
  return container;
}

function getLabelGroupStyle(group: string, type: LabelGroupType): LabelGroupStyle {
  if (type === "state") return style.stateLabels;
  if (type === "burg") {
    return style.burgLabels[group] || style.burgLabels.town || Object.values(style.burgLabels)[0] || {};
  }
  return style.addedLabels[group] || style.addedLabels.addedLabels || {};
}

export function getLabelGroupAttributes(groupStyle: LabelGroupStyle): [string, string | number | null][] {
  return Object.entries(groupStyle).filter(([attribute]) => attribute !== "id");
}

const lineGen = line<[number, number]>().curve(curveNatural);

export function getLabelPath(label: Label): string {
  return lineGen(label.pathPoints || []) || "";
}

export function getLabelPathMarkup(label: Label & { id: string }): string {
  return /*html*/ `<path id="${`textPath_${label.id}`}" d="${getLabelPath(label)}"></path>`;
}

export function getLabelTextMarkup(label: Label & { text: string; id: string }): string {
  const lines = label.text.split("|");
  const tspans = lines
    .map(
      (text, index) => /*html*/ `<tspan x="0" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${text}</tspan>`
    )
    .join("");
  const transform = label.dx || label.dy ? ` transform="translate(${label.dx || 0}, ${label.dy || 0})"` : "";
  const letterSpacing = label.letterSpacing ? ` letter-spacing="${label.letterSpacing}px"` : "";
  const startOffset = `${label.startOffset ?? 50}%`;
  const fontSize = `${label.fontSize ?? 100}%`;

  return /*html*/ `<text text-rendering="optimizeSpeed" id="${label.id}"${transform}>
      <textPath href="#${`textPath_${label.id}`}" startOffset="${startOffset}" font-size="${fontSize}"${letterSpacing}>${tspans}</textPath>
    </text>`;
}

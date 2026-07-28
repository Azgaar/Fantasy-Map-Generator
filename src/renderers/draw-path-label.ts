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

export function ensureLabelGroup(group: string): SVGGElement {
  const labels = document.querySelector<SVGGElement>("g#labels")!;
  const existing = labels.querySelector<SVGGElement>(`:scope > g#${group}`);
  if (existing) return existing;

  const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
  container.id = group;
  const groupStyle =
    group === "states" ? style.stateLabels : style.addedLabels[group] || style.addedLabels.addedLabels || {};
  for (const [attribute, value] of Object.entries({ ...DEFAULT_LABEL_STYLE, ...groupStyle })) {
    if (value !== null) container.setAttribute(attribute, String(value));
  }
  labels.appendChild(container);
  return container;
}

const lineGen = line<[number, number]>().curve(curveNatural);

export function getLabelPathMarkup(label: { id: string; pathPoints: [number, number][] }): string {
  return /*html*/ `<path id="${`textPath_${label.id}`}" d="${lineGen(label.pathPoints)}"></path>`;
}

export function getLabelTextMarkup(label: Label & { text: string; id: string }): string {
  const lines = label.text.split("|");
  const tspans = lines
    .map(
      (text, index) => /*html*/ `<tspan x="0" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${text}</tspan>`
    )
    .join("");
  const transform = label.dx || label.dy ? ` transform="${`translate(${label.dx || 0}, ${label.dy || 0})`}"` : "";
  const letterSpacing = label.letterSpacing ? `${label.letterSpacing}px` : null;
  const id = label.id;
  const startOffset = `${label.startOffset ?? 50}%`;
  const fontSize = `${label.fontSize ?? 100}%`;

  return /*html*/ `<text text-rendering="optimizeSpeed" id="${id}"${transform}>
      <textPath href="#${`textPath_${label.id}`}" startOffset="${startOffset}" font-size="${fontSize}" letter-spacing="${letterSpacing}">${tspans}</textPath>
    </text>`;
}

import { curveNatural, line } from "d3";
import type { CustomLabel, StateLabel } from "../generators/labels";

// any label of the PathLabel family; rendered into g#labels > g#{label.group}
type RenderablePathLabel = StateLabel | CustomLabel;

const lineGen = line<[number, number]>().curve(curveNatural);

export const getPathLabelElementId = (label: { i: number }): string => `pathLabel${label.i}`;

// create or update the defs path the label text follows; returns the path element
export function upsertLabelPath(label: RenderablePathLabel): SVGPathElement {
  const pathGroup = document.querySelector<SVGGElement>("defs > g#deftemp > g#textPaths")!;
  const pathId = `textPath_${getPathLabelElementId(label)}`;

  let pathElement = pathGroup.querySelector<SVGPathElement>(`#${pathId}`);
  if (!pathElement) {
    pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("id", pathId);
    pathGroup.appendChild(pathElement);
  }

  pathElement.setAttribute("d", lineGen(label.pathPoints || []) || "");
  return pathElement;
}

// render a path-following label from its data; replaces an existing element with the same id
export function drawPathLabel(label: RenderablePathLabel): SVGTextElement | null {
  const container = document.querySelector<SVGGElement>(`g#labels > g#${label.group}`);
  if (!container) return null;

  const pathElement = upsertLabelPath(label);
  const elementId = getPathLabelElementId(label);

  const lines = label.text.split("|");
  const tspans = lines.map((lineText, index) => {
    const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", "0");
    tspan.setAttribute("dy", index ? "1em" : `${(lines.length - 1) / -2}em`);
    tspan.textContent = lineText;
    return tspan;
  });

  const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
  textPath.setAttribute("href", `#${pathElement.id}`);
  textPath.setAttribute("startOffset", `${label.startOffset ?? 50}%`);
  textPath.setAttribute("font-size", `${label.fontSize ?? 100}%`);
  if (label.letterSpacing) textPath.setAttribute("letter-spacing", `${label.letterSpacing}px`);
  textPath.append(...tspans);

  const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textElement.setAttribute("text-rendering", "optimizeSpeed");
  textElement.setAttribute("id", elementId);
  if (label.dx || label.dy) {
    textElement.setAttribute("transform", `translate(${label.dx || 0}, ${label.dy || 0})`);
  }
  textElement.appendChild(textPath);

  const existing = document.getElementById(elementId);
  if (existing?.parentNode === container) existing.replaceWith(textElement);
  else {
    existing?.remove();
    container.appendChild(textElement);
  }

  return textElement;
}

// remove a path label's text element and its defs path
export function removePathLabel(label: { i: number }): void {
  const elementId = getPathLabelElementId(label);
  document.getElementById(elementId)?.remove();
  document.getElementById(`textPath_${elementId}`)?.remove();
}

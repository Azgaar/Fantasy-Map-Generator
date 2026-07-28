import { curveNatural, line } from "d3";
import type { Label } from "../generators/labels";

export type PathLabel = Label & { id: string; text: string; group: string; pathPoints: [number, number][] };
const lineGen = line<[number, number]>().curve(curveNatural);

export const getPathLabelElementId = (label: PathLabel): string => label.id;

const getPathId = (label: PathLabel): string => `textPath_${getPathLabelElementId(label)}`;

// get a label group container, creating it with the default label style if missing,
// so labels render even when their group is not part of the loaded SVG
export function ensureLabelGroup(group: string): SVGGElement {
  const labels = document.querySelector<SVGGElement>("g#labels")!;
  const existing = labels.querySelector<SVGGElement>(`:scope > g#${group}`);
  if (existing) return existing;

  const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
  container.id = group;
  container.setAttribute("fill", "#3e3e4b");
  container.setAttribute("opacity", "1");
  container.setAttribute("stroke", "#3a3a3a");
  container.setAttribute("stroke-width", "0");
  container.setAttribute("font-family", "Almendra SC");
  container.setAttribute("font-size", "18");
  container.setAttribute("data-size", "18");
  labels.appendChild(container);
  return container;
}

// build a detached defs path element the label text follows;
// pathId overrides the default id so measurement copies don't collide with rendered elements
function buildLabelPath(label: PathLabel, pathId?: string): SVGPathElement {
  const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathElement.setAttribute("id", pathId ?? getPathId(label));
  pathElement.setAttribute("d", lineGen(label.pathPoints || []) || "");
  return pathElement;
}

// build a detached text element referencing the label's path
function buildLabelText(label: PathLabel, pathId?: string): SVGTextElement {
  const lines = (label.text || "").split("|");
  const tspans = lines.map((lineText, index) => {
    const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", "0");
    tspan.setAttribute("dy", index ? "1em" : `${(lines.length - 1) / -2}em`);
    tspan.textContent = lineText;
    return tspan;
  });

  const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
  textPath.setAttribute("href", `#${pathId ?? getPathId(label)}`);
  textPath.setAttribute("startOffset", `${label.startOffset ?? 50}%`);
  textPath.setAttribute("font-size", `${label.fontSize ?? 100}%`);
  if (label.letterSpacing) textPath.setAttribute("letter-spacing", `${label.letterSpacing}px`);
  textPath.append(...tspans);

  const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textElement.setAttribute("text-rendering", "optimizeSpeed");
  textElement.setAttribute("id", pathId ? `${pathId}_text` : getPathLabelElementId(label));
  if (label.dx || label.dy) {
    textElement.setAttribute("transform", `translate(${label.dx || 0}, ${label.dy || 0})`);
  }
  textElement.appendChild(textPath);

  return textElement;
}

// build both detached elements for batched insertion by bulk renderers;
// pass pathId to get a measurement copy whose ids don't collide with rendered elements
export function buildPathLabelElements(
  label: PathLabel,
  pathId?: string
): { text: SVGTextElement; path: SVGPathElement } {
  return { text: buildLabelText(label, pathId), path: buildLabelPath(label, pathId) };
}

// create or update the defs path in the DOM; returns the attached path element
export function upsertLabelPath(label: PathLabel): SVGPathElement {
  const pathGroup = document.querySelector<SVGGElement>("defs > g#deftemp > g#textPaths")!;
  const pathElement = buildLabelPath(label);

  const existing = pathGroup.querySelector(`#${pathElement.id}`);
  if (existing) existing.replaceWith(pathElement);
  else pathGroup.appendChild(pathElement);

  return pathElement;
}

// render a single path-following label from its data; replaces an existing element with the same id
export function drawPathLabel(label: PathLabel): SVGTextElement {
  const container = ensureLabelGroup(label.group);

  upsertLabelPath(label);
  const textElement = buildLabelText(label);

  const existing = document.getElementById(getPathLabelElementId(label));
  if (existing?.parentNode === container) existing.replaceWith(textElement);
  else {
    existing?.remove();
    container.appendChild(textElement);
  }

  return textElement;
}

export function drawPathLabels(labels: PathLabel[]): void {
  const paths = document.querySelector<SVGGElement>("defs > g#deftemp > g#textPaths")!;
  const texts = new Map<string, SVGTextElement[]>();

  for (const label of labels) {
    const { text, path } = buildPathLabelElements(label);
    document.getElementById(label.id)?.remove();
    document.getElementById(path.id)?.remove();
    paths.appendChild(path);
    const groupTexts = texts.get(label.group) || [];
    groupTexts.push(text);
    texts.set(label.group, groupTexts);
  }

  for (const [group, groupTexts] of texts) ensureLabelGroup(group).append(...groupTexts);
}

// remove a path label's text element and its defs path
export function removePathLabel(label: PathLabel): void {
  document.getElementById(getPathLabelElementId(label))?.remove();
  document.getElementById(getPathId(label))?.remove();
}

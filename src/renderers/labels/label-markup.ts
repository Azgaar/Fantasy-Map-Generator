import { curveNatural, line } from "d3";
import type { LabelData, PathLabelData } from "@/renderers/labels/labels";
import type { Point } from "@/types/global";

const lineGen = line<[number, number]>().curve(curveNatural);

export function createLabelElements(label: LabelData, document: Document) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.id = label.id;
  text.dataset.labelType = label.type;
  text.dataset.id = String(label.entityId);
  if (label.dx || label.dy) text.setAttribute("transform", `translate(${label.dx || 0}, ${label.dy || 0})`);

  if ("pathPoints" in label) {
    const path = createTextPath(label, document);
    const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
    textPath.setAttribute("href", `#${path.id}`);
    textPath.setAttribute("startOffset", `${label.startOffset ?? 50}%`);
    textPath.setAttribute("text-anchor", "middle");
    textPath.setAttribute("font-size", `${label.fontSize ?? 100}%`);
    if (label.letterSpacing !== undefined) textPath.setAttribute("letter-spacing", `${label.letterSpacing}px`);
    appendText(textPath, label.text, "0");
    text.appendChild(textPath);
    return { text, path };
  }

  text.setAttribute("x", String(label.x));
  text.setAttribute("y", String(label.y));
  text.setAttribute("font-size", `${label.fontSize}%`);
  if (label.letterSpacing) text.setAttribute("letter-spacing", `${label.letterSpacing}px`);
  appendText(text, label.text, String(label.x));
  return { text };
}

function createTextPath(label: PathLabelData, document: Document): SVGPathElement {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = `textPath_${label.id}`;
  path.dataset.labelType = label.type;
  path.dataset.id = String(label.entityId);
  path.setAttribute("d", getLabelPath(label));
  return path;
}

function appendText(parent: SVGTextElement | SVGTextPathElement, value: string, x: string): void {
  const lines = value.split("|");
  if (lines.length === 1) return void parent.append(lines[0]);
  lines.forEach((line, index) => {
    const tspan = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", x);
    tspan.setAttribute("dy", index ? "1em" : `${(lines.length - 1) / -2}em`);
    tspan.textContent = line;
    parent.appendChild(tspan);
  });
}

export function getLabelPath(label: { pathPoints: Point[] }): string {
  return lineGen(label.pathPoints || []) || "";
}

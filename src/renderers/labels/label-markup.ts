import { curveNatural, line } from "d3";
import type { LabelData } from "@/renderers/labels/labels";
import { rn } from "@/utils/number-utils";
import { estimateLabelLength } from "./label-arc";

const lineGen = line<[number, number]>().curve(curveNatural);
const FIT_MARGIN = 1.7; // the length estimate is typeface-blind: a wide face runs up to half over it

export function createLabelElements(label: LabelData, document: Document) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.id = label.id;
  text.dataset.labelType = label.type;
  text.dataset.id = String(label.entityId);
  if (label.dx || label.dy) text.setAttribute("transform", `translate(${label.dx || 0}, ${label.dy || 0})`);

  const fontSize = `${label.fontSize ?? 100}%`;

  if (label.pathPoints?.length) {
    text.dataset.labelShape = "path";
    const path = createTextPath(label, document);
    const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
    textPath.setAttribute("href", `#${path.id}`);
    textPath.setAttribute("startOffset", `${label.startOffset ?? 50}%`);
    textPath.setAttribute("text-anchor", "middle");
    textPath.setAttribute("font-size", fontSize);
    if (label.letterSpacing !== undefined) textPath.setAttribute("letter-spacing", `${label.letterSpacing}px`);
    appendText(textPath, label.text, "0");
    text.appendChild(textPath);
    return { text, path };
  }

  const [x, y] = label.anchor;
  text.dataset.labelShape = "point";
  text.setAttribute("x", String(x));
  text.setAttribute("y", String(y));
  text.setAttribute("font-size", fontSize);
  if (label.letterSpacing) text.setAttribute("letter-spacing", `${label.letterSpacing}px`);
  appendText(text, label.text, String(x));
  return { text };
}

function createTextPath(label: LabelData, document: Document): SVGPathElement {
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

type PathSource = Pick<LabelData, "pathPoints"> & Partial<Pick<LabelData, "text" | "type" | "group">>;

/** The path a label's text runs along: its points, with straight tails when the text needs more room */
export function getLabelPath(label: PathSource): string {
  const points = label.pathPoints || [];
  const d = lineGen(points) || "";
  if (points.length < 2 || !label.text || !label.type || !label.group) return d;

  const length = points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0);
  const shortfall = estimateLabelLength(label as LabelData) * FIT_MARGIN - length;
  return shortfall > 0 ? extendEnds(d, shortfall / 2) : d;
}

// text past the end of its path is not drawn, and the text is centered: equal tails keep it in place
function extendEnds(d: string, extension: number): string {
  const n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
  const tail = (fromX: number, fromY: number, x: number, y: number, fallback: number): string => {
    const length = Math.hypot(x - fromX, y - fromY);
    const [dx, dy] = length ? [(x - fromX) / length, (y - fromY) / length] : [fallback, 0]; // no direction: level
    return `${rn(x + dx * extension, 2)},${rn(y + dy * extension, 2)}`;
  };
  const start = tail(n[2], n[3], n[0], n[1], -1);
  const end = tail(n.at(-4)!, n.at(-3)!, n.at(-2)!, n.at(-1)!, 1);
  return `M${start}L${d.slice(1)}L${end}`;
}

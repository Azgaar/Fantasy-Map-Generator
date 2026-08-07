import { curveNatural, line } from "d3";
import type { LabelData, PathLabelData, PointLabelData } from "@/renderers/labels/labels";
import type { Point } from "@/types/global";

const lineGen = line<[number, number]>().curve(curveNatural);

export function getLabelMarkup(label: LabelData) {
  if ("pathPoints" in label) return [getLabelPathMarkup(label), getLabelTextMarkup(label)];
  return [null, getPointLabelMarkup(label)];
}

export function getLabelPath(label: { pathPoints: Point[] }): string {
  return lineGen(label.pathPoints || []) || "";
}

function getLabelPathMarkup(label: PathLabelData): string {
  return /*html*/ `<path id="textPath_${label.id}" data-label-type="${label.type}" d="${getLabelPath(label)}"></path>`;
}

function getLabelTextMarkup(label: PathLabelData): string {
  const lines = label.text.split("|");
  const tspan = (line: string, index: number) =>
    /*html*/ `<tspan x="0" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${line}</tspan>`;

  const transform = getTransform(label);
  const letterSpacing = label.letterSpacing !== undefined ? ` letter-spacing="${label.letterSpacing}px"` : "";
  const startOffset = `${label.startOffset ?? 50}%`;
  const fontSize = `${label.fontSize ?? 100}%`;

  return /*html*/ `<text text-rendering="optimizeSpeed" id="${label.id}" data-label-type="${label.type}" ${transform}>
      <textPath href="#textPath_${label.id}" startOffset="${startOffset}" text-anchor="middle" font-size="${fontSize}"${letterSpacing}>${
        lines.length === 1 ? lines[0] : lines.map(tspan).join("")
      }</textPath>
    </text>`;
}

export function getPointLabelMarkup(label: PointLabelData): string {
  const lines = label.text.split("|");
  const tspan = (line: string, index: number) =>
    /*html*/ `<tspan x="${label.x}" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${line}</tspan>`;

  const text = lines.length === 1 ? lines[0] : lines.map(tspan).join("");
  const fontSize = label.fontSize === undefined ? "" : ` font-size="${label.fontSize}%"`;
  const letterSpacing = label.letterSpacing === undefined ? "" : ` letter-spacing="${label.letterSpacing}px"`;

  return /*html*/ `<text text-rendering="optimizeSpeed" id="${label.id}" data-label-type="${label.type}" x="${label.x}" y="${label.y}"${fontSize}${letterSpacing}${getTransform(label)}>${text}</text>`;
}

function getTransform(label: Pick<LabelData, "dx" | "dy">): string {
  return label.dx || label.dy ? ` transform="translate(${label.dx || 0}, ${label.dy || 0})"` : "";
}

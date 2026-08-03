import { curveNatural, line } from "d3";
import type { PathLabel } from "@/generators/labels";

const lineGen = line<[number, number]>().curve(curveNatural);

export function getLabelMarkup(label: LabelData): [path: string, text: string] {
  if ("pathPoints" in label) return [getLabelPathMarkup(label), getLabelTextMarkup(label)];
  return ["", getPointLabelMarkup(label)];
}

export function getLabelPath(label: PathLabel): string {
  return lineGen(label.pathPoints || []) || "";
}

export function getLabelPathMarkup(label: PathLabelData): string {
  const dataId = getLabelDataId(label);
  return /*html*/ `<path id="textPath_${label.id}" data-label-type="${label.type}" data-id="${dataId}" d="${getLabelPath(label)}"></path>`;
}

export function getLabelTextMarkup(label: PathLabelData): string {
  const lines = label.text.split("|");
  const tspans = lines
    .map(
      (text, index) =>
        /*html*/ `<tspan x="0" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${escapeMarkup(text)}</tspan>`
    )
    .join("");
  const transform = getTransform(label);
  const letterSpacing = label.letterSpacing !== undefined ? ` letter-spacing="${label.letterSpacing}px"` : "";
  const startOffset = `${label.startOffset ?? 50}%`;
  const fontSize = `${label.fontSize ?? 100}%`;
  const dataId = getLabelDataId(label);

  return /*html*/ `<text text-rendering="optimizeSpeed" id="${label.id}" data-label-type="${label.type}" data-id="${dataId}"${transform}>
      <textPath href="#textPath_${label.id}" startOffset="${startOffset}" font-size="${fontSize}"${letterSpacing}>${tspans}</textPath>
    </text>`;
}

export function getPointLabelMarkup(label: PointLabelData): string {
  const lines = label.text.split("|");
  const text =
    lines.length === 1
      ? escapeMarkup(lines[0])
      : lines
          .map(
            (line, index) =>
              `<tspan x="${label.x}" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${escapeMarkup(line)}</tspan>`
          )
          .join("");
  const fontSize = label.fontSize === undefined ? "" : ` font-size="${label.fontSize}%"`;
  const letterSpacing = label.letterSpacing === undefined ? "" : ` letter-spacing="${label.letterSpacing}px"`;
  const dataId = getLabelDataId(label);

  return /*html*/ `<text text-rendering="optimizeSpeed" id="${label.id}" data-label-type="${label.type}" data-id="${dataId}" x="${label.x}" y="${label.y}"${fontSize}${letterSpacing}${getTransform(label)}>${text}</text>`;
}

export function escapeMarkup(text: string): string {
  return text.replace(
    /[&<>"']/g,
    character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character
  );
}

function getTransform(label: Pick<LabelData, "dx" | "dy">): string {
  return label.dx || label.dy ? ` transform="translate(${label.dx || 0}, ${label.dy || 0})"` : "";
}

function getLabelDataId(label: LabelData): string {
  if (label.type === "state") return label.id.slice("stateLabel".length);
  if (label.type === "province") return label.id.slice("provinceLabel".length);
  if (label.type === "burg") return label.id.slice("burgLabel".length);
  return label.id.slice("addedLabel".length);
}

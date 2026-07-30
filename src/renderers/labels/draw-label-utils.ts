import { curveNatural, line } from "d3";
import type { LabelType, PathLabel } from "../../generators/labels";

const lineGen = line<[number, number]>().curve(curveNatural);

export function getLabelPath(label: PathLabel): string {
  return lineGen(label.pathPoints || []) || "";
}

export function getLabelPathMarkup(label: PathLabel & { id: string }): string {
  return /*html*/ `<path id="textPath_${label.id}" d="${getLabelPath(label)}"></path>`;
}

export function getLabelTextMarkup(label: PathLabel & { text: string; id: string }): string {
  const lines = label.text.split("|");
  const tspans = lines
    .map(
      (text, index) =>
        /*html*/ `<tspan x="0" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${escapeMarkup(text)}</tspan>`
    )
    .join("");
  const transform = label.dx || label.dy ? ` transform="translate(${label.dx || 0}, ${label.dy || 0})"` : "";
  const letterSpacing = label.letterSpacing !== undefined ? ` letter-spacing="${label.letterSpacing}px"` : "";
  const startOffset = `${label.startOffset ?? 50}%`;
  const fontSize = `${label.fontSize ?? 100}%`;

  const [type, dataId] = getLabelIdentity(label.id);
  return /*html*/ `<text text-rendering="optimizeSpeed" id="${label.id}" data-label-type="${type}" data-id="${dataId}"${transform}>
      <textPath href="#textPath_${label.id}" startOffset="${startOffset}" font-size="${fontSize}"${letterSpacing}>${tspans}</textPath>
    </text>`;
}

export function escapeMarkup(text: string): string {
  return text.replace(
    /[&<>"']/g,
    character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character
  );
}

function getLabelIdentity(id: string): [LabelType, string] {
  if (id.startsWith("stateLabel")) return ["state", id.slice(10)];
  if (id.startsWith("provinceLabel")) return ["province", id.slice(13)];
  if (id.startsWith("burgLabel")) return ["burg", id.slice(9)];
  return ["added", id.slice(10)];
}

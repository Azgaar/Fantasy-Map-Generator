import type { Burg } from "../generators/burgs-generator";
import { DEFAULT_BURG_LABEL_GROUP } from "../generators/labels";
import { getLabelGroup } from "./label-groups";

export function drawBurgLabels(): void {
  document.querySelectorAll("#labels > g > [data-label-type='burg']").forEach(label => {
    label.remove();
  });

  const burgs = pack.burgs.filter(burg => burg.i && !burg.removed);
  const labelsByGroup = new Map<string, string>();

  for (const burg of burgs) {
    const group = burg.label?.group || burg.group || DEFAULT_BURG_LABEL_GROUP;
    labelsByGroup.set(group, (labelsByGroup.get(group) || "") + getBurgLabelMarkup(burg));
  }

  for (const [group, markup] of labelsByGroup) {
    if (markup) getLabelGroup(group, "burg").insertAdjacentHTML("beforeend", markup);
  }
}

export function drawBurgLabel(burg: Burg): void {
  removeBurgLabel(burg.i);
  getLabelGroup(burg.label?.group || burg.group || DEFAULT_BURG_LABEL_GROUP, "burg").insertAdjacentHTML(
    "beforeend",
    getBurgLabelMarkup(burg)
  );
}

export function removeBurgLabel(burgId: number): void {
  document.getElementById(`burgLabel${burgId}`)?.remove();
}

export function getBurgLabelMarkup(burg: Burg): string {
  const transform =
    burg.label?.dx || burg.label?.dy ? ` transform="translate(${burg.label.dx || 0}, ${burg.label.dy || 0})"` : "";
  const label = burg.label;
  const lines = (label?.text ?? burg.name ?? "").split("|");
  const text =
    lines.length === 1
      ? lines[0]
      : lines
          .map(
            (line, index) =>
              `<tspan x="${burg.x}" dy="${index ? "1em" : `${(lines.length - 1) / -2}em`}">${line}</tspan>`
          )
          .join("");
  const fontSize = label?.fontSize === undefined ? "" : ` font-size="${label.fontSize}%"`;
  const letterSpacing = label?.letterSpacing ? ` letter-spacing="${label.letterSpacing}px"` : "";
  return /*html*/ `<text text-rendering="optimizeSpeed" id="burgLabel${burg.i}" data-label-type="burg" data-id="${burg.i}" x="${burg.x}" y="${burg.y}"${fontSize}${letterSpacing}${transform}>${text}</text>`;
}

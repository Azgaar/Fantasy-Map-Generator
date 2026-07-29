import type { Burg } from "../generators/burgs-generator";
import {
  ensureBurgLabelsContainer,
  ensureLabelGroup,
  getLabelGroupAttributesFor,
  getLabelGroupMarkup
} from "./draw-label-utils";

export function drawBurgLabels(): void {
  const container = ensureBurgLabelsContainer();
  container.replaceChildren();

  const burgs = pack.burgs.filter(burg => burg.i && !burg.removed);
  const configuredGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order).map(({ name }) => name);
  const labelsByGroup = new Map(configuredGroups.map(group => [group, ""]));
  const attributesByGroup = new Map<string, Record<string, string | number | null>>();

  for (const burg of burgs) {
    const group = burg.group || "town";
    const groupAttributes =
      attributesByGroup.get(group) || Object.fromEntries(getLabelGroupAttributesFor(group, "burg"));
    attributesByGroup.set(group, groupAttributes);
    labelsByGroup.set(group, (labelsByGroup.get(group) || "") + getBurgLabelMarkup(burg, groupAttributes));
  }

  const markup = [...labelsByGroup].map(([group, labels]) => getLabelGroupMarkup(group, "burg", labels)).join("");
  container.insertAdjacentHTML("beforeend", markup);
}

export function drawBurgLabel(burg: Burg): void {
  ensureBurgLabelsContainer();
  const group = ensureLabelGroup(burg.group || "town", "burg");

  removeBurgLabel(burg.i);
  const groupAttributes = Object.fromEntries(getLabelGroupAttributesFor(burg.group || "town", "burg"));
  group.insertAdjacentHTML("beforeend", getBurgLabelMarkup(burg, groupAttributes));
}

export function removeBurgLabel(burgId: number): void {
  document.getElementById(`burgLabel${burgId}`)?.remove();
}

function getBurgLabelMarkup(burg: Burg, groupAttributes: Record<string, string | number | null>): string {
  const transform =
    burg.label?.dx || burg.label?.dy ? ` transform="translate(${burg.label.dx || 0}, ${burg.label.dy || 0})"` : "";
  const text = burg.label?.text ?? burg.name ?? "";
  return `<text text-rendering="optimizeSpeed" id="burgLabel${burg.i}" data-id="${burg.i}" x="${burg.x}" y="${
    burg.y
  }" dx="${groupAttributes["data-dx"] || 0}em" dy="${groupAttributes["data-dy"] || 0}em"${transform}>${text}</text>`;
}

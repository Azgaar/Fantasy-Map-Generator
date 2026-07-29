import type { Burg } from "../generators/burgs-generator";
import { ensureBurgLabelsContainer, ensureLabelGroup } from "./draw-label-utils";

export function drawBurgLabels(): void {
  const container = ensureBurgLabelsContainer();
  container.replaceChildren();

  const burgs = pack.burgs.filter(burg => burg.i && !burg.removed);
  const configuredGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order).map(({ name }) => name);
  const dataGroups = burgs.map(burg => burg.group || "town");
  const groups = [...new Set([...configuredGroups, ...dataGroups])];

  for (const name of groups) {
    const group = ensureLabelGroup(name, "burg");
    const labels = burgs.filter(burg => (burg.group || "town") === name).map(burg => buildBurgLabel(burg, group));
    group.append(...labels);
  }
}

export function drawBurgLabel(burg: Burg): void {
  ensureBurgLabelsContainer();
  const group = ensureLabelGroup(burg.group || "town", "burg");

  removeBurgLabel(burg.i);
  group.appendChild(buildBurgLabel(burg, group));
}

export function removeBurgLabel(burgId: number): void {
  document.getElementById(`burgLabel${burgId}`)?.remove();
}

function buildBurgLabel(burg: Burg, group: SVGGElement): SVGTextElement {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("text-rendering", "optimizeSpeed");
  text.setAttribute("id", `burgLabel${burg.i}`);
  text.setAttribute("data-id", String(burg.i));
  text.setAttribute("x", String(burg.x));
  text.setAttribute("y", String(burg.y));
  text.setAttribute("dx", `${group?.getAttribute("data-dx") || 0}em`);
  text.setAttribute("dy", `${group?.getAttribute("data-dy") || 0}em`);
  if (burg.label?.dx || burg.label?.dy) {
    text.setAttribute("transform", `translate(${burg.label.dx || 0}, ${burg.label.dy || 0})`);
  }
  text.textContent = burg.label?.text ?? burg.name ?? "";
  return text;
}

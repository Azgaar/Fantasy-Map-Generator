import type { Burg } from "../generators/burgs-generator";

export function drawBurgLabels(): void {
  const container = ensureBurgLabelsContainer();
  container.replaceChildren();

  const defaultStyle = style.burgLabels.town || Object.values(style.burgLabels)[0] || {};
  for (const { name } of [...options.burgs.groups].sort((a, b) => a.order - b.order)) {
    const group = createGroup(name, style.burgLabels[name] || defaultStyle);
    const labels = pack.burgs
      .filter(burg => burg.i && !burg.removed && burg.group === name)
      .map(burg => buildBurgLabel(burg, group));
    group.append(...labels);
    container.appendChild(group);
  }
}

export function drawBurgLabel(burg: Burg): void {
  const container = ensureBurgLabelsContainer();
  let group = container.querySelector<SVGGElement>(`:scope > g#${burg.group}`);
  if (!group) {
    const defaultStyle = style.burgLabels.town || Object.values(style.burgLabels)[0] || {};
    group = createGroup(burg.group || "town", style.burgLabels[burg.group || "town"] || defaultStyle);
    container.appendChild(group);
  }

  removeBurgLabel(burg.i);
  group.appendChild(buildBurgLabel(burg, group));
}

export function removeBurgLabel(burgId: number): void {
  document.getElementById(`burgLabel${burgId}`)?.remove();
}

function ensureBurgLabelsContainer(): SVGGElement {
  const labels = document.querySelector<SVGGElement>("#labels")!;
  const existing = labels.querySelector<SVGGElement>(":scope > #burgLabels");
  if (existing) return existing;

  const container = document.createElementNS("http://www.w3.org/2000/svg", "g");
  container.id = "burgLabels";
  labels.appendChild(container);
  return container;
}

function createGroup(name: string, groupStyle: Record<string, string>): SVGGElement {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = name;
  for (const [attribute, value] of Object.entries(groupStyle)) {
    if (value !== null) group.setAttribute(attribute, String(value));
  }
  return group;
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

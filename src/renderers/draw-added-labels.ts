import type { AddedLabel } from "../generators/labels";
import { drawPathLabel, drawPathLabels, type PathLabel } from "./draw-path-label";

const toPathLabel = (label: AddedLabel): PathLabel => ({ ...label, id: `addedLabel${label.i}` });

export function drawAddedLabels(): void {
  const labels = pack.labels.map(toPathLabel);
  syncGroups(labels.map(label => label.group));
  document.querySelectorAll("#textPaths > path[id^='textPath_addedLabel']").forEach(path => {
    path.remove();
  });
  drawPathLabels(labels);
}

export function drawAddedLabel(i: number): void {
  const label = pack.labels.find(label => label.i === i);
  if (!label) return;
  ensureGroup(label.group);
  drawPathLabel(toPathLabel(label));
}

export function copyAddedLabelGroupStyle(source: string, target: string): void {
  const sourceGroup = document.querySelector<SVGGElement>(`g#labels > g#${source}`);
  style.addedLabels[target] = sourceGroup
    ? Object.fromEntries(Array.from(sourceGroup.attributes, attribute => [attribute.name, attribute.value]))
    : { ...style.addedLabels[source] };
}

function syncGroups(names: string[]): void {
  const labels = document.querySelector<SVGGElement>("g#labels")!;
  const groups = new Set(names);
  labels.querySelectorAll<SVGGElement>(":scope > g:not(#states):not(#burgLabels)").forEach(group => {
    style.addedLabels[group.id] = Object.fromEntries(Array.from(group.attributes, attr => [attr.name, attr.value]));
    if (group.id === "addedLabels" || groups.has(group.id)) group.replaceChildren();
    else group.remove();
  });
  for (const name of groups) ensureGroup(name);
}

function ensureGroup(name: string): void {
  const labels = document.querySelector<SVGGElement>("g#labels")!;
  if (labels.querySelector(`:scope > g#${name}`)) return;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = name;
  for (const [attr, value] of Object.entries(style.addedLabels[name] || style.addedLabels.addedLabels || {})) {
    group.setAttribute(attr, value);
  }
  labels.appendChild(group);
}

window.drawCustomLabels = drawAddedLabels;

import type { Burg } from "../generators/burgs-generator";
import { type Bounds, registerLayer, unregisterLayer } from "./layer_registry";

type BurgGroup = { name: string; order: number };

const svgNamespace = "http://www.w3.org/2000/svg";
const registeredGroups = new Set<string>();

export function syncBurgIconLayers(): void {
  const definitions = [...(options.burgs.groups as BurgGroup[])].sort((a, b) => a.order - b.order);
  const activeGroups = new Set(definitions.map(group => group.name));
  const iconRoot = document.getElementById("burgIcons");
  const anchorRoot = document.getElementById("anchors");
  if (!(iconRoot instanceof SVGGElement) || !(anchorRoot instanceof SVGGElement)) return;

  const defaultIconStyle = style.burgIcons.town || Object.values(style.burgIcons)[0] || {};
  const defaultAnchorStyle = style.anchors.town || Object.values(style.anchors)[0] || {};

  for (const { name } of definitions) {
    iconRoot.appendChild(ensureStyledGroup(iconRoot, name, style.burgIcons[name] || defaultIconStyle));
    anchorRoot.appendChild(ensureStyledGroup(anchorRoot, name, style.anchors[name] || defaultAnchorStyle));
    registerBurgGroup(name);
  }

  removeInactiveGroups(iconRoot, activeGroups);
  removeInactiveGroups(anchorRoot, activeGroups);

  for (const groupName of registeredGroups) {
    if (activeGroups.has(groupName)) continue;
    unregisterLayer(`burg_icons.${groupName}`);
    unregisterLayer(`anchors.${groupName}`);
    registeredGroups.delete(groupName);
  }
}

function registerBurgGroup(groupName: string): void {
  registeredGroups.add(groupName);
  const scaleMin = getScaleMin(groupName);

  registerLayer<Burg>({
    id: `burg_icons.${groupName}`,
    rootId: "burgIcons",
    groupId: groupName,
    enabled: () => layerIsOn("toggleBurgIcons"),
    scaleMin,
    getItems: getBurgs,
    filter: burg => burg.group === groupName,
    inViewport: isBurgInViewport,
    render: renderBurgIcons
  });

  registerLayer<Burg>({
    id: `anchors.${groupName}`,
    rootId: "anchors",
    groupId: groupName,
    enabled: () => layerIsOn("toggleBurgIcons"),
    scaleMin,
    getItems: getBurgs,
    filter: burg => burg.group === groupName && Boolean(burg.port),
    inViewport: isBurgInViewport,
    render: renderAnchors
  });
}

function getBurgs(): Burg[] {
  return (pack.burgs || []).filter(burg => Boolean(burg.i) && !burg.removed);
}

function isBurgInViewport(burg: Burg, bounds: Bounds): boolean {
  return burg.x >= bounds.x0 && burg.x <= bounds.x1 && burg.y >= bounds.y0 && burg.y <= bounds.y1;
}

function renderBurgIcons(group: SVGGElement, burgs: Burg[]): void {
  const icon = group.dataset.icon || "#icon-circle";
  group.replaceChildren(
    ...burgs.map(burg => {
      const use = document.createElementNS(svgNamespace, "use");
      use.id = `burg${burg.i}`;
      use.dataset.id = String(burg.i);
      use.setAttribute("href", icon);
      use.setAttribute("x", String(burg.x));
      use.setAttribute("y", String(burg.y));
      return use;
    })
  );
}

function renderAnchors(group: SVGGElement, burgs: Burg[]): void {
  group.replaceChildren(
    ...burgs.map(burg => {
      const use = document.createElementNS(svgNamespace, "use");
      use.id = `anchor${burg.i}`;
      use.dataset.id = String(burg.i);
      use.setAttribute("href", "#icon-anchor");
      use.setAttribute("x", String(burg.x));
      use.setAttribute("y", String(burg.y));
      return use;
    })
  );
}

function ensureStyledGroup(root: SVGGElement, groupId: string, attributes: Record<string, string>): SVGGElement {
  const existing = Array.from(root.children).find(child => child instanceof SVGGElement && child.id === groupId);
  if (existing instanceof SVGGElement) return existing;

  const group = document.createElementNS(svgNamespace, "g");
  for (const [name, value] of Object.entries(attributes)) group.setAttribute(name, value);
  group.id = groupId;
  return group;
}

function removeInactiveGroups(root: SVGGElement, activeGroups: Set<string>): void {
  for (const group of Array.from(root.children)) {
    if (group instanceof SVGGElement && !activeGroups.has(group.id)) group.remove();
  }
}

function getScaleMin(groupName: string): number {
  if (groupName === "capital") return 1;
  if (groupName === "city") return 1.5;
  if (groupName === "town") return 2.5;
  return 3;
}

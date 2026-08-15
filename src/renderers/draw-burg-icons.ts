import { select } from "d3";
import { applyStyleNode } from "@/services/styles/apply";
import type { Burg } from "../generators/burgs-generator";

declare global {
  var drawBurgIcons: () => void;
}

const burgIconsRenderer = (): void => {
  TIME && console.time("drawBurgIcons");
  createIconGroups();

  for (const { name } of options.burgs.groups) {
    const burgsInGroup = pack.burgs.filter(b => b.group === name && !b.removed);
    if (!burgsInGroup.length) continue;

    const iconsGroup = document.querySelector<SVGGElement>(`#burgIcons > g#${name}`);
    if (!iconsGroup) continue;

    const icon = iconsGroup.dataset.icon || "#icon-circle";
    iconsGroup.innerHTML = burgsInGroup
      .map(b => `<use id="burg${b.i}" data-id="${b.i}" href="${icon}" x="${b.x}" y="${b.y}"></use>`)
      .join("");

    const portsInGroup = burgsInGroup.filter(b => b.port);
    if (!portsInGroup.length) continue;

    const portGroup = document.querySelector<SVGGElement>(`#anchors > g#${name}`);
    if (!portGroup) continue;

    portGroup.innerHTML = portsInGroup
      .map(b => `<use id="anchor${b.i}" data-id="${b.i}" href="#icon-anchor" x="${b.x}" y="${b.y}"></use>`)
      .join("");
  }

  TIME && console.timeEnd("drawBurgIcons");
};

const drawBurgIconRenderer = (burg: Burg): void => {
  const iconGroup = select("#burgIcons").select<SVGGElement>(`#${burg.group}`);
  if (iconGroup.empty()) {
    drawBurgIcons();
    return; // redraw all icons if group is missing
  }

  removeBurgIconRenderer(burg.i!);
  const icon = iconGroup.attr("data-icon") || "#icon-circle";
  select("#burgIcons")
    .select(`#${burg.group}`)
    .append("use")
    .attr("href", icon)
    .attr("id", `burg${burg.i}`)
    .attr("data-id", burg.i!)
    .attr("x", burg.x)
    .attr("y", burg.y);

  if (burg.port) {
    select("#anchors")
      .select(`#${burg.group}`)
      .append("use")
      .attr("href", "#icon-anchor")
      .attr("id", `anchor${burg.i}`)
      .attr("data-id", burg.i!)
      .attr("x", burg.x)
      .attr("y", burg.y);
  }
};

const removeBurgIconRenderer = (burgId: number): void => {
  const existingIcon = document.getElementById(`burg${burgId}`);
  if (existingIcon) existingIcon.remove();

  const existingAnchor = document.getElementById(`anchor${burgId}`);
  if (existingAnchor) existingAnchor.remove();
};

// icon groups are recreated on every draw (a burg group may have been added, removed or
// reordered), so their look comes from style.layers, not from the groups being replaced
function createIconGroups(): void {
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);

  for (const layerId of ["burgIcons", "anchors"] as const) {
    const container = document.getElementById(layerId);
    if (!container) continue;
    container.replaceChildren();

    const children = style.layers[layerId]?.children ?? {};
    // a group the style doesn't cover (a custom burg group) takes the look of the default one
    const fallback = children.town ?? Object.values(children)[0] ?? {};

    for (const { name } of sortedGroups) {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("id", name);
      container.appendChild(group);

      const node = children[name] ?? fallback;
      applyStyleNode(group, node);
      // size is an option (the icon size the burg editor and the style editor read), projected
      // onto the group as the font-size the <use> icons are scaled by
      const size = node.options?.size;
      if (size !== undefined && size !== null) group.setAttribute("font-size", String(size));
    }
  }
}

window.drawBurgIcons = burgIconsRenderer;

export { drawBurgIconRenderer as drawBurgIcon, removeBurgIconRenderer as removeBurgIcon };

// burgs-generator still draws icons directly; it cannot import upwards, so the bridge stays
window.drawBurgIcon = drawBurgIconRenderer;
window.removeBurgIcon = removeBurgIconRenderer;

export { burgIconsRenderer as drawBurgIcons };

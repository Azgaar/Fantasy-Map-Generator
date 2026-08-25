import { select } from "d3";
import { burgGroupFromElement } from "@/generators/styles-legacy";

export const drawBurgIcons = (): void => {
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

/** drop the icons, keeping the burg groups: they carry the styles edited in the Style editor */
export const removeBurgIcons = (): void => {
  for (const icon of Array.from(document.querySelectorAll("#icons use, #icons circle"))) icon.remove();
};

export const removeBurgIcon = (burgId: number): void => {
  const existingIcon = document.getElementById(`burg${burgId}`);
  if (existingIcon) existingIcon.remove();

  const existingAnchor = document.getElementById(`anchor${burgId}`);
  if (existingAnchor) existingAnchor.remove();
};

function createIconGroups(): void {
  // save existing styles (the style editor edits the DOM) and remove all groups
  const { burgIcons, anchors } = styles.burgIcons;
  document.querySelectorAll("g#burgIcons > g").forEach(group => {
    burgIcons.groups[group.id] = burgGroupFromElement(group);
    group.remove();
  });

  document.querySelectorAll("g#anchors > g").forEach(group => {
    anchors.groups[group.id] = burgGroupFromElement(group);
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const defaultIconStyle = burgIcons.groups.town || Object.values(burgIcons.groups)[0];
  const defaultAnchorStyle = anchors.groups.town || Object.values(anchors.groups)[0];
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);
  for (const { name } of sortedGroups) {
    const burgGroup = select("#burgIcons").append("g");
    const iconStyle = burgIcons.groups[name] || defaultIconStyle;
    if (iconStyle) {
      for (const [key, value] of Object.entries(iconStyle.attrs)) burgGroup.attr(key, value);
      burgGroup.attr("font-size", iconStyle.options.size).attr("data-icon", iconStyle.options.icon);
    }
    burgGroup.attr("id", name).attr("data-group", name);

    const anchorGroup = select("#anchors").append("g");
    const anchorStyle = anchors.groups[name] || defaultAnchorStyle;
    if (anchorStyle) {
      for (const [key, value] of Object.entries(anchorStyle.attrs)) anchorGroup.attr(key, value);
      anchorGroup.attr("font-size", anchorStyle.options.size);
    }
    anchorGroup.attr("id", name).attr("data-group", name);
  }
}

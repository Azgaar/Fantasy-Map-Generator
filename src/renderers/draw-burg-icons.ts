import { select } from "d3";
import type { Burg } from "../generators/burgs-generator";
import { Scene, ViewportLayers, type ViewportRenderContext } from "./viewport/viewport-renderer";

declare global {
  var drawBurgIcons: () => void;
}

interface BurgIconSceneItem {
  id: string;
  burg: Burg;
}

const scene = new Scene<BurgIconSceneItem>();
const layer = ViewportLayers.register({ id: "burg-icons", render: reconcileBurgIcons });

const burgIconsRenderer = (): void => {
  TIME && console.time("drawBurgIcons");
  createIconGroups();
  scene.replace(
    pack.burgs.filter(burg => burg.i && burg.group && !burg.removed).map(burg => ({ id: `burg${burg.i}`, burg }))
  );
  layer.render();

  TIME && console.timeEnd("drawBurgIcons");
};

const drawBurgIconRenderer = (burg: Burg): void => {
  if (!scene.valid || !burg.i || !burg.group) {
    drawBurgIcons();
    return;
  }
  scene.set({ id: `burg${burg.i}`, burg });
  layer.invalidate();
};

const removeBurgIconRenderer = (burgId: number): void => {
  if (scene.valid) {
    scene.remove(`burg${burgId}`);
    layer.invalidate();
  }
  document.getElementById(`burg${burgId}`)?.remove();
  document.getElementById(`anchor${burgId}`)?.remove();
};

function reconcileBurgIcons(context: ViewportRenderContext): void {
  const icons = context.root.querySelector<SVGGElement>("#burgIcons");
  const anchors = context.root.querySelector<SVGGElement>("#anchors");
  if (!icons || !anchors) return;
  if (!scene.valid) return;

  const burgsByGroup = new Map<string, Burg[]>();
  const { x0, y0, x1, y1 } = context.bounds;
  for (const { burg } of scene.values()) {
    if (burg.x < x0 || burg.x > x1 || burg.y < y0 || burg.y > y1) continue;
    const groupName = burg.group;
    if (!groupName) continue;
    const group = burgsByGroup.get(groupName) || [];
    group.push(burg);
    burgsByGroup.set(groupName, group);
  }

  for (const { name } of options.burgs.groups) {
    const iconGroup = icons.querySelector<SVGGElement>(`:scope > #${CSS.escape(name)}`);
    const anchorGroup = anchors.querySelector<SVGGElement>(`:scope > #${CSS.escape(name)}`);
    if (!iconGroup || !anchorGroup) continue;

    const burgs = burgsByGroup.get(name) || [];
    const icon = iconGroup.dataset.icon || "#icon-circle";
    iconGroup.innerHTML = burgs
      .map(burg => `<use id="burg${burg.i}" data-id="${burg.i}" href="${icon}" x="${burg.x}" y="${burg.y}"></use>`)
      .join("");
    anchorGroup.innerHTML = burgs
      .filter(burg => burg.port)
      .map(
        burg => `<use id="anchor${burg.i}" data-id="${burg.i}" href="#icon-anchor" x="${burg.x}" y="${burg.y}"></use>`
      )
      .join("");
  }
}

function createIconGroups(): void {
  // save existing styles and remove all groups
  document.querySelectorAll("g#burgIcons > g").forEach(group => {
    style.burgIcons[group.id] = Array.from(group.attributes).reduce((acc: { [key: string]: string }, attribute) => {
      acc[attribute.name] = attribute.value;
      return acc;
    }, {});
    group.remove();
  });

  document.querySelectorAll("g#anchors > g").forEach(group => {
    style.anchors[group.id] = Array.from(group.attributes).reduce((acc: { [key: string]: string }, attribute) => {
      acc[attribute.name] = attribute.value;
      return acc;
    }, {});
    group.remove();
  });

  // create groups for each burg group and apply stored or default style
  const defaultIconStyle = style.burgIcons.town || Object.values(style.burgIcons)[0] || {};
  const defaultAnchorStyle = style.anchors.town || Object.values(style.anchors)[0] || {};
  const sortedGroups = [...options.burgs.groups].sort((a, b) => a.order - b.order);
  for (const { name } of sortedGroups) {
    const burgGroup = select("#burgIcons").append("g");
    const iconStyles = style.burgIcons[name] || defaultIconStyle;
    Object.entries(iconStyles).forEach(([key, value]) => {
      burgGroup.attr(key, value);
    });
    burgGroup.attr("id", name);

    const anchorGroup = select("#anchors").append("g");
    const anchorStyles = style.anchors[name] || defaultAnchorStyle;
    Object.entries(anchorStyles).forEach(([key, value]) => {
      anchorGroup.attr(key, value);
    });
    anchorGroup.attr("id", name);
  }
}

window.drawBurgIcons = burgIconsRenderer;

export {
  burgIconsRenderer as drawBurgIcons,
  drawBurgIconRenderer as drawBurgIcon,
  removeBurgIconRenderer as removeBurgIcon
};

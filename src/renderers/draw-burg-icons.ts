import { Layers } from "@/components/layers";
import type { Burg } from "@/generators/burgs-generator";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import { escapeHtml } from "@/utils/stringUtils";

const layer = ViewportLayers.register({ id: "burgIcons", render: reconcileBurgIcons });

export const drawBurgIcons = (): void => {
  TIME && console.time("drawBurgIcons");
  layer.render();
  TIME && console.timeEnd("drawBurgIcons");
};

function reconcileBurgIcons({ root, bounds }: ViewportRenderContext): void {
  if (!Layers.isOn("burgIcons")) return;

  const burgsByGroup = new Map<string, Burg[]>();
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.group) continue;
    const group = burgsByGroup.get(burg.group);
    if (group) group.push(burg);
    else burgsByGroup.set(burg.group, [burg]);
  }

  const groups = [...options.map.burgs.groups].sort((a, b) => a.order - b.order);
  for (const type of ["burgIcons", "anchors"] as const) {
    const container = root.querySelector<SVGGElement>(`#${type}`);
    if (!container) continue;
    const groupStyles = styles.burgIcons[type].groups;
    const defaultStyle = groupStyles.town || Object.values(groupStyles)[0];
    const isAnchor = type === "anchors";

    const markup: string[] = [];

    for (const { name } of groups) {
      const groupStyle = groupStyles[name] || defaultStyle;
      const groupName = escapeHtml(name);
      const icon = escapeHtml(isAnchor ? "#icon-anchor" : groupStyle?.options.icon || "#icon-circle");
      markup.push(`<g id="${groupName}" data-group="${groupName}"`);
      if (groupStyle) {
        for (const [key, value] of Object.entries(groupStyle.attrs)) {
          if (value !== null && value !== undefined) markup.push(` ${key}="${escapeHtml(String(value))}"`);
        }
        markup.push(` font-size="${groupStyle.options.size}"`);
      }
      if (!isAnchor) markup.push(` data-icon="${icon}"`);
      markup.push(">");

      // Symbols overflow their viewBox; the tallest burg artwork reaches two em above its anchor.
      const padding = 2 * (Math.abs(groupStyle?.options.size ?? 1) + (groupStyle?.attrs["stroke-width"] ?? 0));
      const { x0, y0, x1, y1 } = bounds;
      for (const { i, x, y, port } of burgsByGroup.get(name) || []) {
        if (isAnchor && !port) continue;
        if (x + padding < x0 || x - padding > x1 || y + padding < y0 || y - padding > y1) continue;
        markup.push(`<use id="${isAnchor ? "anchor" : "burg"}${i}" data-id="${i}" href="${icon}" x="${x}" y="${y}"/>`);
      }
      markup.push("</g>");
    }

    container.innerHTML = markup.join("");
  }
}

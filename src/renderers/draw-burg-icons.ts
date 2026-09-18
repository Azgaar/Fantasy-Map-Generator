import { Layers } from "@/components/layers";
import type { Burg } from "@/generators/burgs-generator";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { StylesData } from "@/types/styles";
import { escapeHtml } from "@/utils/stringUtils";

const layer = ViewportLayers.register({ id: "icons", render: reconcileBurgIcons });

export const drawBurgIcons = (): void => {
  TIME && console.time("drawBurgIcons");
  layer.render();
  TIME && console.timeEnd("drawBurgIcons");
};

type BurgPart =
  | StylesData["icons"]["groups"][string]["groups"]["icons"]
  | StylesData["icons"]["groups"][string]["groups"]["anchors"];

type Bounds = { x0: number; y0: number; x1: number; y1: number };

function reconcileBurgIcons({ root, bounds }: ViewportRenderContext): void {
  if (!Layers.isOn("icons")) return;

  const burgsByGroup = new Map<string, Burg[]>();
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.group) continue;
    const group = burgsByGroup.get(burg.group);
    if (group) group.push(burg);
    else burgsByGroup.set(burg.group, [burg]);
  }

  const container = root.querySelector<SVGGElement>("#icons");
  if (!container) return;

  const stylesByGroup = styles.icons.groups;
  const fallback = stylesByGroup.town ?? Object.values(stylesByGroup)[0];
  const markup: string[] = [];

  for (const { name } of [...options.map.burgs.groups].sort((a, b) => a.order - b.order)) {
    const entry = stylesByGroup[name] ?? fallback;
    if (!entry) continue;
    const groupName = escapeHtml(name);
    const burgs = burgsByGroup.get(name) ?? [];
    markup.push(`<g id="${groupName}" data-group="${groupName}">`);
    markup.push(part("icons", entry.groups.icons, burgs, bounds, false));
    markup.push(part("anchors", entry.groups.anchors, burgs, bounds, true));
    markup.push("</g>");
  }

  container.innerHTML = markup.join("");
}

/** One part of a burg group — the icons or the anchors — as its own data-group element */
function part(name: "icons" | "anchors", style: BurgPart, burgs: Burg[], bounds: Bounds, anchors: boolean): string {
  const icon = escapeHtml(style.options.icon || (anchors ? "#icon-anchor" : "#icon-circle"));
  const size = style.options.size ?? 1;
  const shift = anchors ? (style.options as { dx?: number; dy?: number }) : undefined;
  const dx = (shift?.dx ?? 0) * size;
  const dy = (shift?.dy ?? 0) * size;

  const attrs: string[] = [];
  for (const [key, value] of Object.entries(style.attrs)) {
    if (value !== null && value !== undefined) attrs.push(` ${key}="${escapeHtml(String(value))}"`);
  }

  const markup = [`<g data-group="${name}" data-icon="${icon}"${attrs.join("")} font-size="${size}">`];
  // Symbols overflow their viewBox; the tallest burg artwork reaches two em above its anchor.
  const padding = 2 * (Math.abs(size) + (style.attrs["stroke-width"] ?? 0));

  for (const { i, x: burgX, y: burgY, port } of burgs) {
    if (anchors && !port) continue;
    const x = burgX + dx;
    const y = burgY + dy;
    if (x + padding < bounds.x0 || x - padding > bounds.x1 || y + padding < bounds.y0 || y - padding > bounds.y1)
      continue;
    markup.push(`<use id="${anchors ? "anchor" : "burg"}${i}" data-id="${i}" href="${icon}" x="${x}" y="${y}"/>`);
  }

  markup.push("</g>");
  return markup.join("");
}

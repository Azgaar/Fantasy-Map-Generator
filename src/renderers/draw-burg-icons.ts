import { type IconSetId, IconSets } from "@/components/icon-sets";
import { Icons } from "@/components/icons";
import { Layers } from "@/components/layers";
import { zoomFontSize } from "@/components/viewport";
import type { Burg } from "@/generators/burgs-generator";
import { ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { StylesData } from "@/types/styles";
import { rn } from "@/utils/numberUtils";
import { escapeHtml } from "@/utils/stringUtils";

const layer = ViewportLayers.register({ id: "burgIcons", render: reconcileBurgIcons });

export async function drawBurgIcons(): Promise<void> {
  TIME && console.time("drawBurgIcons");
  const icons = Object.values(styles.burgIcons.groups).flatMap(({ groups }) => [
    groups.icons.options.icon,
    groups.anchors.options.icon
  ]);
  const referenced = icons.map(icon => icon && IconSets.setForId(icon)).filter((set): set is IconSetId => Boolean(set));
  const setIds: readonly IconSetId[] = [
    ...new Set([...Burgs.iconSets.map(set => set.id), ...referenced, "burgs" as const])
  ];
  await Icons.loadAll(setIds);
  layer.render();
  TIME && console.timeEnd("drawBurgIcons");
}

type BurgPart =
  | StylesData["burgIcons"]["groups"][string]["groups"]["icons"]
  | StylesData["burgIcons"]["groups"][string]["groups"]["anchors"];

type Bounds = ViewportRenderContext["bounds"];

export function isStateCapital(burg: Burg): boolean {
  if (typeof pack === "undefined" || !pack) return Boolean(burg.capital);
  return Boolean(burg.capital || (burg.state && pack.states?.[burg.state]?.capital === burg.i));
}

export function isProvinceCapital(burg: Burg): boolean {
  if (typeof pack === "undefined" || !pack?.provinces) return false;
  if (isStateCapital(burg)) return false;
  return Boolean(pack.provinces.some(p => p && p.burg === burg.i && p.i > 0));
}

function reconcileBurgIcons({ root, bounds }: ViewportRenderContext): void {
  if (!Layers.isOn("burgIcons")) return;

  const burgsByGroup = new Map<string, Burg[]>();
  for (const burg of pack.burgs) {
    if (!burg.i || burg.removed || !burg.group) continue;
    const group = burgsByGroup.get(burg.group);
    if (group) group.push(burg);
    else burgsByGroup.set(burg.group, [burg]);
  }

  const container = root.querySelector<SVGGElement>("#burgIcons");
  if (!container) return;

  const stylesByGroup = styles.burgIcons.groups;
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
  const id = style.options.icon;
  const icon = escapeHtml(Icons.href(id));
  // anchored art stands on the burg by its own frame; any other icon is a 1em box centred on it
  const [boxX, boxY, boxWidth, boxHeight] = Icons.anchoredBox(id) ?? [-0.5, -0.5, 1, 1];
  const size = style.options.size ?? 1;
  const shift = anchors ? (style.options as { dx?: number; dy?: number }) : undefined;
  const shiftX = shift?.dx ?? 0;
  const shiftY = shift?.dy ?? 0;

  const attrs: string[] = [];
  for (const [key, value] of Object.entries(style.attrs)) {
    if (value !== null && value !== undefined) attrs.push(` ${key}="${escapeHtml(String(value))}"`);
  }
  // The box and the shift are in icon em, so they stay true to the icon as the zoom resizes it
  const [translateX, translateY] = [rn(shiftX + boxX, 4), rn(shiftY + boxY, 4)];
  if (translateX || translateY) attrs.push(` style="transform: translate(${translateX}em, ${translateY}em)"`);

  // An icon is sized in % of the layer font, so it follows the zoom on the burg icons curve
  const markup = [`<g data-group="${name}" data-icon="${escapeHtml(id)}"${attrs.join("")} font-size="${size}%">`];
  const em = (size * zoomFontSize("burgIcons", bounds.scale)) / 100; // the icon em in map units at this zoom
  // Symbols overflow their viewBox; the tallest burg artwork reaches two em above its anchor.
  const padding = 2 * (Math.abs(em) * 2.5 + (style.attrs["stroke-width"] ?? 0));

  for (const burg of burgs) {
    const { i, x, y, port } = burg;
    if (!id || (anchors && !port)) continue;
    const cx = x + shiftX * em;
    const cy = y + shiftY * em;
    if (cx + padding < bounds.x0 || cx - padding > bounds.x1 || cy + padding < bounds.y0 || cy - padding > bounds.y1)
      continue;

    if (anchors) {
      markup.push(
        `<use id="anchor${i}" data-id="${i}" href="${icon}" x="${x}" y="${y}" width="${rn(boxWidth, 4)}em" height="${rn(boxHeight, 4)}em"/>`
      );
      continue;
    }

    let burgIcon = icon;
    let scale = 1;
    if (isStateCapital(burg)) {
      burgIcon = escapeHtml(Icons.href("burgs-atlas-star-circled"));
      scale = 2.2 / size;
    } else if (isProvinceCapital(burg)) {
      burgIcon = escapeHtml(Icons.href("burgs-atlas-star"));
      scale = 1.4 / size;
    }

    const extraShift = scale !== 1 ? rn(-0.5 * (scale - 1), 4) : 0;
    const transformAttr = extraShift ? ` transform="translate(${extraShift}em, ${extraShift}em)"` : "";
    const w = rn(boxWidth * scale, 4);
    const h = rn(boxHeight * scale, 4);

    markup.push(
      `<use id="burg${i}" data-id="${i}" href="${burgIcon}" x="${x}" y="${y}" width="${w}em" height="${h}em"${transformAttr}/>`
    );
  }

  markup.push("</g>");
  return markup.join("");
}

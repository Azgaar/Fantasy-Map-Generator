import { color, curveBasisClosed, line } from "d3";
import { Icons } from "@/model/icons";
import { Layers } from "@/renderers/layers";
import { boundsIntersect, ViewportLayers, type ViewportRenderContext } from "@/renderers/viewport/viewport-renderer";
import type { PackedGraph } from "@/types/packed-graph";
import { log } from "@/utils/logger";
import { findEl } from "@/utils/node-utils";
import { rn } from "@/utils/number-utils";
import { getIsolines } from "@/utils/path-utils";
import { escapeHtml } from "@/utils/string-utils";

type Bounds = Omit<ViewportRenderContext["bounds"], "scale">;

const layer = ViewportLayers.register({ id: "markets", render: reconcileMarkets });
const territories = new Map<number, Bounds & { path: string }>();
let sourcePack: PackedGraph | null = null;
let sourceMarkets: Uint16Array | null = null;

export function drawMarkets(): void {
  log.time("drawMarkets");
  buildTerritories();
  layer.render();
  log.timeEnd("drawMarkets");
}

function buildTerritories(): void {
  const linegen = line().curve(curveBasisClosed);
  const isolines = getIsolines(pack, cellId => pack.cells.market[cellId], { polygons: true });
  territories.clear();

  for (const [id, { polygons }] of Object.entries(isolines)) {
    if (!polygons?.length) continue;
    const territory = { path: "", x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    territory.path = polygons.map(polygon => linegen(polygon) ?? "").join("");
    for (const polygon of polygons) {
      for (const [x, y] of polygon) {
        territory.x0 = Math.min(territory.x0, x);
        territory.y0 = Math.min(territory.y0, y);
        territory.x1 = Math.max(territory.x1, x);
        territory.y1 = Math.max(territory.y1, y);
      }
    }
    territories.set(Number(id), territory);
  }

  sourcePack = pack;
  sourceMarkets = pack.cells.market;
}

/** Layer teardown: drop the cached scene and the drawn content */
export function removeMarkets(): void {
  sourcePack = null;
  sourceMarkets = null;
  territories.clear();
  findEl("markets")?.replaceChildren();
}

function reconcileMarkets({ root, bounds }: ViewportRenderContext): void {
  const container = root.querySelector<SVGGElement>("#markets");
  if (!container || !Layers.isOn("markets")) return;
  if (sourcePack !== pack || sourceMarkets !== pack.cells.market) buildTerritories();

  const { size, iconSize: baseSize, icon } = styles.markets.options;
  const radius = Math.max(rn(size + 1 / bounds.scale, 2), 2);
  const iconSize = Math.max(rn(baseSize + 1 / bounds.scale, 2), 2);
  const strokeWidth = rn(radius / 8, 2);
  // a pin: an upside-down triangle with its tip on the center burg and the icon in its incircle of `radius`
  const halfWidth = radius * Math.sqrt(3);
  const pinHeight = radius * 3;
  const href = escapeHtml(Icons.href(icon));
  const paint = Icons.paintAttributes(icon);
  const markup: string[] = [];

  const renderPin = (x: number, y: number, fill: string, stroke: string) => {
    const top = rn(y - pinHeight, 2);
    const pin = `M${x},${y}L${rn(x - halfWidth, 2)},${top}L${rn(x + halfWidth, 2)},${top}Z`;
    const icon = href
      ? `<use href="${href}" x="${rn(x - iconSize / 2, 2)}" y="${rn(y - 2 * radius - iconSize / 2, 2)}" width="${iconSize}" height="${iconSize}" fill-opacity="1"${paint}/>`
      : "";
    return /*html*/ `<path class="pin" d="${pin}" fill="${fill}" fill-opacity="1" stroke="${stroke}" stroke-width="${strokeWidth}"/>${icon}`;
  };

  for (const market of pack.markets) {
    const territory = territories.get(market.i);
    const center = pack.burgs[market.centerBurgId];
    const showTerritory = territory && boundsIntersect(territory, bounds);
    const showCenter =
      center &&
      boundsIntersect(
        { x0: center.x - halfWidth, y0: center.y - pinHeight, x1: center.x + halfWidth, y1: center.y },
        bounds
      );
    if (!showTerritory && !showCenter) continue;

    const fill = market.color || "#dababf";
    const stroke = color(fill)?.darker().hex() || "#000";

    const territoryMarkup = showTerritory
      ? /*html*/ `<clipPath id="market-clip-${market.i}"><path d="${territory.path}"/></clipPath>
        <path class="fill" d="${territory.path}" fill="${fill}" stroke="none"/>
        <path class="border" d="${territory.path}" fill="none" stroke="${stroke}" clip-path="url(#market-clip-${market.i})"/>`
      : "";
    const centerMarkup = showCenter ? renderPin(center.x, center.y, fill, stroke) : "";

    const marker = /*html*/ `<g id="market${market.i}" data-id="${market.i}">${territoryMarkup}${centerMarkup}</g>`;
    markup.push(marker);
  }

  container.innerHTML = markup.join("");
  if (root === document) {
    container.onmouseover = onMarketHover;
    container.onmouseout = onMarketHover;
  }
}

function onMarketHover(event: MouseEvent): void {
  const group = event.target instanceof Element ? event.target.closest<SVGGElement>("g[data-id]") : null;
  if (!group || group.parentNode !== event.currentTarget) return;
  if (event.relatedTarget instanceof Node && group.contains(event.relatedTarget)) return;
  if (event.type === "mouseover") highlightMarketOn(group.dataset.id!);
  else highlightMarketOff(group.dataset.id!);
}

export function highlightMarketOn(marketId: number | string): void {
  const group = document.querySelector(`#markets #market${marketId}`);
  const path = group?.querySelector<SVGPathElement>("path.fill");
  if (!path) return;
  group!.querySelector(".highlight")?.remove();

  const twin = path.cloneNode() as SVGPathElement;
  twin.setAttribute("class", "highlight");
  twin.setAttribute("fill-opacity", "0.7");
  twin.setAttribute("stroke", "#d0240f");
  twin.setAttribute("stroke-width", "1");
  twin.setAttribute("pointer-events", "none");
  path.after(twin);
  twin.animate(
    [
      { fillOpacity: 0, strokeWidth: 0 },
      { fillOpacity: 0.7, strokeWidth: 1 }
    ],
    { duration: 1000 }
  );
}

export function highlightMarketOff(marketId: number | string): void {
  const path = document.querySelector<SVGPathElement>(`#markets #market${marketId} .highlight`);
  if (!path) return;
  const { fillOpacity, strokeWidth } = getComputedStyle(path);
  for (const animation of path.getAnimations()) animation.cancel();
  const animation = path.animate(
    [
      { fillOpacity, strokeWidth },
      { fillOpacity: 0, strokeWidth: 0 }
    ],
    { duration: 600, fill: "forwards" }
  );
  animation.onfinish = () => path.remove();
}

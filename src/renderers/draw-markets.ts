import { color, curveBasisClosed, line, select } from "d3";
import { rn } from "../utils";
import { getIsolines } from "../utils/pathUtils";

export function toggleMarketsLayer(event?: MouseEvent) {
  if (!layerIsOn("toggleMarketsLayer")) {
    turnButtonOn("toggleMarketsLayer");
    drawMarketsLayer();
    if (event && isCtrlClick(event)) editStyle("markets");
  } else {
    if (event && isCtrlClick(event)) return editStyle("markets");
    markets.html("");
    turnButtonOff("toggleMarketsLayer");
  }
}

export function drawMarketsLayer() {
  TIME && console.time("drawMarketsLayer");
  markets.html(buildMarketsContent());
  highlightMarketsOnHover();
  markets.style("display", null);
  TIME && console.timeEnd("drawMarketsLayer");
}

const MARKET_RADIUS = 3;
const MARKET_FONT = 5;
const MARKET_ICON = "⚖️";

function buildMarketsContent(): string {
  const linegen = line().curve(curveBasisClosed);
  const getType = (cellId: number) => pack.cells.market[cellId];
  const isolines = getIsolines(pack, getType, { polygons: true });

  // marker circle size, emoji size and emoji icon are independently user-configurable
  const baseRadius = +markets.attr("data-size") || MARKET_RADIUS;
  const baseFont = +markets.attr("font-size") || MARKET_FONT;
  const icon = markets.attr("data-icon") || MARKET_ICON;

  return pack.markets
    .map(market => {
      let content = "";
      const fillColor = market.color || "#dababf";
      const strokeColor = color(fillColor)?.darker().hex() || "#000";

      const polygons = isolines[market.i]?.polygons;
      if (polygons) {
        const path = polygons.map(p => linegen(p) ?? "").join("");
        const clipId = `market-clip-${market.i}`;
        content += `<clipPath id="${clipId}"><path d="${path}"/></clipPath>`;
        content += `<path class="fill" d="${path}" fill="${fillColor}" stroke="none"/>`;
        content += `<path class="border" d="${path}" fill="none" stroke="${strokeColor}" stroke-width="0.7" clip-path="url(#${clipId})"/>`;
      }

      const centerBurg = pack.burgs[market.centerBurgId];
      if (centerBurg) {
        const { x, y } = centerBurg;
        const radius = Math.max(rn(baseRadius + 1 / scale, 2), 2);
        const fontSize = Math.max(rn(baseFont + 1 / scale, 2), 2);
        const strokeWidth = rn(radius / 8, 2);

        content += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${fillColor}" fill-opacity="1" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
        content += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px" fill-opacity="1">${icon}</text>`;
      }

      return `<g id="market${market.i}" data-id="${market.i}">${content}</g>`;
    })
    .join("");
}

function highlightMarketsOnHover(): void {
  select("#markets")
    .selectAll("g")
    .on("mouseover", e => highlightMarketOn((e.currentTarget as SVGGElement).dataset.id!))
    .on("mouseout", e => highlightMarketOff((e.currentTarget as SVGGElement).dataset.id!));
}

export function highlightMarketOn(marketId: number | string): void {
  const group = select(`#markets #market${marketId}`);
  const path = group.select<SVGPathElement>("path.fill").node();
  if (!path) return;

  group.select(".highlight").remove();

  const twin = path.cloneNode() as SVGPathElement;
  path.after(twin);
  select(twin)
    .attr("class", "highlight")
    .attr("fill-opacity", 0)
    .attr("stroke", "#d0240f")
    .attr("stroke-width", 0)
    .attr("pointer-events", "none")
    .transition()
    .duration(1000)
    .attr("fill-opacity", 0.7)
    .attr("stroke-width", 1);
}

export function highlightMarketOff(marketId: number | string): void {
  select(`#markets #market${marketId} .highlight`)
    .transition()
    .duration(600)
    .attr("fill-opacity", 0)
    .attr("stroke-width", 0)
    .remove();
}

declare global {
  interface Window {
    toggleMarketsLayer: typeof toggleMarketsLayer;
    drawMarketsLayer: typeof drawMarketsLayer;
    highlightMarketOn: typeof highlightMarketOn;
    highlightMarketOff: typeof highlightMarketOff;
  }
}

window.toggleMarketsLayer = toggleMarketsLayer;
window.drawMarketsLayer = drawMarketsLayer;
window.highlightMarketOn = highlightMarketOn;
window.highlightMarketOff = highlightMarketOff;

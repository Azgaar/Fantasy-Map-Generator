import { color, curveBasisClosed, line } from "d3";
import type { Market } from "../modules/trade-generator";
import { rn } from "../utils";
import { getIsolines } from "../utils/pathUtils";

declare global {
  var drawTrade: () => void;
}

function renderMarketCells(markets: Market[]): string {
  if (!pack.cells.market) return "";

  const linegen = line().curve(curveBasisClosed);
  const fillOpacity = trade.attr("data-fill-opacity") ?? "0.28";
  let html = "";

  const getType = (cellId: number) => pack.cells.market[cellId];
  const isolines = getIsolines(pack, getType, { polygons: true });
  for (const [marketIdStr, { polygons }] of Object.entries(isolines)) {
    if (!polygons) continue;
    const fillColor = markets.find(m => m.i === +marketIdStr)?.color || "#dababf";
    const strokeColor = color(fillColor)?.darker().hex() || "#000";

    const path = polygons.map(linegen).join("");
    html += `<path d="${path}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="${strokeColor}" id="market-fill${marketIdStr}"/>`;
  }
  return html;
}

function renderMarkerCenters(markets: Market[]): string {
  const html = markets.map(market => {
    const centerBurg = pack.burgs[market.centerBurgId];
    if (!centerBurg) return "";

    const { x, y } = centerBurg;
    const radius = Math.max(rn(5 + 1 / scale, 2), 2);
    const fontSize = Math.max(rn(7 + 1 / scale, 2), 2);
    const stroke = color(market.color)?.darker().hex() || "#000";
    const strokeWidth = rn(radius / 8, 2);

    return /* html */ `
    <g id="market${market.i}" class="market" data-id="${market.i}">
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${market.color}" stroke="${stroke}" stroke-width="${strokeWidth}" />
      <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px">⚖️</text>
    </g>`;
  });
  return html.join("");
}

const tradeRenderer = (): void => {
  TIME && console.time("drawTrade");

  trade.style("display", "block");
  const marketCells = renderMarketCells(pack.markets);
  const marketCenters = renderMarkerCenters(pack.markets);
  trade.html(`${marketCells}${marketCenters}`);

  TIME && console.timeEnd("drawTrade");
};

window.drawTrade = tradeRenderer;

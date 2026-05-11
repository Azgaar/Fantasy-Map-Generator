import {color} from "d3";
import type {Market} from "../modules/trade-generator";
import {rn} from "../utils";
import {getColors} from "../utils/colorUtils";
import {getIsolines} from "../utils/pathUtils";

declare global {
  var drawTrade: () => void;
}

function renderMarketCells(colorByMarketId: Record<number, string>): string {
  if (!pack.cells.market) return "";

  const fillOpacity = trade.attr("data-fill-opacity") ?? "0.28";
  let html = "";

  const getType = (cellId: number) => pack.cells.market[cellId];
  const isolines = getIsolines(pack, getType, {fill: true});
  for (const [marketIdStr, {fill}] of Object.entries(isolines)) {
    const fillColor = colorByMarketId[+marketIdStr] || "#dababf";
    const strokeColor = color(fillColor)?.darker().hex() || "#000";
    html += `<path d="${fill}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="${strokeColor}" id="market-fill${marketIdStr}"/>`;
  }
  return html;
}

function marketRenderer(market: Market, colorByMarketId: Record<number, string>): string {
  const centerBurg = pack.burgs[market.centerBurgId];
  if (!centerBurg) return "";

  const {x, y} = centerBurg;
  const radius = Math.max(rn(3 + 1 / scale, 2), 2);
  const fontSize = Math.max(rn(3 + 2 / scale, 2), 3);
  const fill = colorByMarketId[market.i] || "#dababf";
  const stroke = color(fill)?.darker().hex() || "#000";
  const strokeWidth = rn(radius / 8, 2);

  return /* html */ `
    <g id="market${market.i}" class="market" data-id="${market.i}">
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
      <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px">⚖️</text>
    </g>`;
}

function getMarketColorById(markets: Market[]): Record<number, string> {
  const marketColors = getColors(Math.max(markets.length, 1));
  const colorByMarketId: Record<number, string> = {};

  for (let i = 0; i < markets.length; i++) {
    colorByMarketId[markets[i].i] = marketColors[i] || "#dababf";
  }

  return colorByMarketId;
}

const tradeRenderer = (): void => {
  TIME && console.time("drawTrade");

  trade.style("display", "block");
  const colorByMarketId = getMarketColorById(pack.markets);
  const marketCells = renderMarketCells(colorByMarketId);
  const marketCenters = pack.markets.map(market => marketRenderer(market, colorByMarketId)).join("");
  trade.html(`${marketCells}${marketCenters}`);

  TIME && console.timeEnd("drawTrade");
};

window.drawTrade = tradeRenderer;

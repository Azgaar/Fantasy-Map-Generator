import type {Market} from "../modules/trade-generator";
import {rn} from "../utils";

declare global {
  var drawTrade: () => void;
}

const MARKET_FILL = "#f5df9b";
const MARKET_STROKE = "#7a5c00";
const MARKET_ICON = "⚖️";
const TRADE_LINK_STROKE = "#7a5c00";
const TRADE_LINK_WIDTH = 0.4;

function tradeLinkRenderer(market: Market): string {
  const centerBurg = pack.burgs[market.centerBurgId];
  if (!centerBurg) return "";

  const {x: mx, y: my} = centerBurg;
  const burgIds = (pack.burgs as any[])
    .filter(burg => burg?.i && !burg.removed && burg.marketId === market.i)
    .map(burg => burg.i as number);
  const burgs = pack.burgs;
  if (!burgs) return "";

  return burgIds
    .map((burgId, idx) => {
      const burg = burgs[burgId];
      if (!burg) return "";
      const {x: bx, y: by} = burg;

      return /* html */ `
        <line
          class="trade-link"
          x1="${rn(mx, 1)}" y1="${rn(my, 1)}"
          x2="${rn(bx, 1)}" y2="${rn(by, 1)}"
          stroke="${TRADE_LINK_STROKE}"
          stroke-width="${TRADE_LINK_WIDTH}"
          opacity="0.5"
          stroke-dasharray="4,4"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to="8"
            dur="${2 + (idx % 2)}s"
            repeatCount="indefinite"
          />
        </line>
      `;
    })
    .join("");
}

function marketRenderer(market: Market): string {
  const {i} = market;
  const centerBurg = pack.burgs[market.centerBurgId];
  if (!centerBurg) return "";

  const {x, y, name} = centerBurg;
  const id = `market${i}`;

  const radius = Math.max(rn(2 + 1 / scale, 2), 2);
  const fontSize = Math.max(rn(3 + 2 / scale, 2), 3);

  return /* html */ `
    <g id="${id}" class="market" data-id="${i}" style="cursor:pointer" transform="translate(${rn(x, 1)},${rn(y, 1)})">
      <circle r="${radius}" fill="${MARKET_FILL}" stroke="${MARKET_STROKE}" stroke-width="${rn(radius / 5, 2)}" />
      <text text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px">${MARKET_ICON}</text>
      <text class="market-label" text-anchor="middle" y="${radius + fontSize}" font-size="${rn(fontSize * 0.85, 2)}px"
        fill="${MARKET_STROKE}" stroke="#fff" stroke-width="${rn(fontSize * 0.12, 2)}" paint-order="stroke">${name}</text>
    </g>`;
}

const tradeRenderer = (): void => {
  TIME && console.time("drawTrade");

  trade.style("display", "block");

  const links = pack.markets.map(tradeLinkRenderer).join("");
  const marketElements = pack.markets.map(marketRenderer).join("");
  trade.html(links + marketElements);

  TIME && console.timeEnd("drawTrade");
};

window.drawTrade = tradeRenderer;

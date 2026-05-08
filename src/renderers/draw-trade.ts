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
  const burgIds = pack.burgs
    .filter(burg => burg?.i && !burg.removed && burg.marketId === market.i)
    .map(burg => burg.i as number);

  return burgIds
    .map((burgId, idx) => {
      const burg = pack.burgs[burgId];
      if (!burg) return "";
      const {x: bx, y: by} = burg;

      return /* html */ `
        <line
          x1="${mx}" y1="${my}"
          x2="${bx}" y2="${by}"
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
  const centerBurg = pack.burgs[market.centerBurgId];
  if (!centerBurg) return "";

  const {x, y} = centerBurg;
  const radius = Math.max(rn(2 + 1 / scale, 2), 2);
  const fontSize = Math.max(rn(3 + 2 / scale, 2), 3);
  const links = tradeLinkRenderer(market);

  return /* html */ `
    <g id="market${market.i}" class="market" data-id="${market.i}">
      <g class="trade-links">
        ${links}
      </g>
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${MARKET_FILL}" stroke="${MARKET_STROKE}" stroke-width="${rn(radius / 5, 2)}" />
      <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px">${MARKET_ICON}</text>
    </g>`;
}

const tradeRenderer = (): void => {
  TIME && console.time("drawTrade");

  trade.style("display", "block");
  const marketElements = pack.markets.map(marketRenderer).join("");
  trade.html(marketElements);
  trade.selectAll<SVGGElement, unknown>("g.market").on("click", event => {
    const currentTarget = event?.currentTarget;
    if (!(currentTarget instanceof SVGGElement)) return;
    const marketId = Number(currentTarget.getAttribute("data-id") || 0);
    if (marketId) MarkerOverview.open(marketId);
  });

  TIME && console.timeEnd("drawTrade");
};

window.drawTrade = tradeRenderer;

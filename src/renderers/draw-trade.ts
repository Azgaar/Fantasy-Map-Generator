import type {Market} from "../modules/trade-generator";
import {rn} from "../utils";

declare global {
  var drawTrade: () => void;
}

const MARKET_FILL = "#f5df9b";
const MARKET_STROKE = "#7a5c00";
const MARKET_ICON = "⚖️";

function marketRenderer(market: Market): string {
  const {i, name, x, y} = market;
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

  const markets: Market[] = pack.markets || [];
  const html = markets.map(market => marketRenderer(market));
  trade.html(html.join(""));

  TIME && console.timeEnd("drawTrade");
};

window.drawTrade = tradeRenderer;

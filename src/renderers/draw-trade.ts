import type {TradeCenter} from "../modules/trade-generator";
import {rn} from "../utils";

declare global {
  var drawTrade: () => void;
}

function tradeCenterRenderer(center: TradeCenter): string {
  const {i, name, x, y, icon = "🏪", fill = "#ffd700", stroke = "#b8860b"} = center;
  const id = `tradeCenter${i}`;

  const radius = Math.max(rn(2 + 1 / scale, 2), 2);
  const fontSize = Math.max(rn(3 + 2 / scale, 2), 3);

  const isExternal = icon.startsWith("http") || icon.startsWith("data:image");

  return /* html */ `
    <g id="${id}" class="trade-center" data-id="${i}" style="cursor:pointer" transform="translate(${rn(x, 1)},${rn(y, 1)})">
      <circle r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${rn(radius / 5, 2)}" />
      ${
        isExternal
          ? `<image href="${icon}" x="-${rn(radius * 0.6, 1)}" y="-${rn(radius * 0.6, 1)}" width="${rn(radius * 1.2, 1)}" height="${rn(radius * 1.2, 1)}" />`
          : `<text text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px">${icon}</text>`
      }
      <text class="trade-center-label" text-anchor="middle" y="${radius + fontSize}" font-size="${rn(fontSize * 0.85, 2)}px"
        fill="${stroke}" stroke="#fff" stroke-width="${rn(fontSize * 0.12, 2)}" paint-order="stroke">${name}</text>
    </g>`;
}

const tradeRenderer = (): void => {
  TIME && console.time("draTrade");

  const centers: TradeCenter[] = pack.markets || [];
  const html = centers.map(center => tradeCenterRenderer(center));
  trade.html(html.join(""));

  TIME && console.timeEnd("drawTrade");
};

window.drawTrade = tradeRenderer;

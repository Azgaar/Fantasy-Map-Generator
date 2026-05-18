import { color, curveBasisClosed, line } from "d3";
import { rn } from "../utils";
import { getIsolines } from "../utils/pathUtils";

export const drawMarkets = (): void => {
  TIME && console.time("drawMarkets");

  const linegen = line().curve(curveBasisClosed);
  const fillOpacity = markets.attr("data-fill-opacity") ?? "0.28";
  const getType = (cellId: number) => pack.cells.market[cellId];
  const isolines = getIsolines(pack, getType, { polygons: true });

  const html = pack.markets.map(market => {
    let content = "";
    const fillColor = market.color || "#dababf";
    const strokeColor = color(fillColor)?.darker().hex() || "#000";

    const polygons = isolines[market.i].polygons;
    if (polygons) {
      const path = polygons.map(linegen).join("");
      content += /*html*/ `<path d="${path}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="${strokeColor}"/>`;
    }

    const centerBurg = pack.burgs[market.centerBurgId];
    if (centerBurg) {
      const { x, y } = centerBurg;
      const radius = Math.max(rn(5 + 1 / scale, 2), 2);
      const fontSize = Math.max(rn(7 + 1 / scale, 2), 2);
      const strokeWidth = rn(radius / 8, 2);

      content += /*html*/ `
        <circle cx="${x}" cy="${y}" r="${radius}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
        <text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}px">⚖️</text>
      `;
    }

    return /* html */ `<g id="market${market.i}" data-id="${market.i}">${content}</g>`;
  });

  markets.html(html.join(""));
  TIME && console.timeEnd("drawMarkets");
};

declare global {
  interface Window {
    drawMarkets: typeof drawMarkets;
  }
}

window.drawMarkets = drawMarkets;

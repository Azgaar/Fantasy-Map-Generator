/**
 * layers/settlements.ts — `twSettlements`: capital stars and settlement dots.
 *
 * Ported from the overlay's `map/settlements.js`. Markers scale inversely with the
 * zoom so they hold a constant screen size, which is why the layer redraws on
 * zoom (see `installZoomRedraw` in index.ts).
 */
import { r1, xmlEscape } from "../color";
import { zoomScale } from "../geometry";
import { getSource } from "../session";
import type { TwLayerParams } from "./index";

const FIXED = 2; // "screen px at scale 1"

export const twSettlements: TwLayerParams = {
  id: "twSettlements",
  parent: "viewbox",
  draw(layer) {
    const group = layer.getEl();
    const source = getSource();
    if (source.empty) {
      group.replaceChildren();
      return;
    }
    const k = zoomScale();
    const parts: string[] = [];

    for (const settlement of source.settlements()) {
      const x = r1(settlement.x);
      const y = r1(settlement.y);
      const name = xmlEscape(settlement.name);
      if (settlement.capital) {
        // a region capital reads as a star, everything else as a dot
        const size = (14 * FIXED * 0.5) / k;
        parts.push(
          `<g class="tw-settlement tw-settlement--capital" data-tw-settlement="${settlement.id}" ` +
            `transform="translate(${x},${y})">` +
            `<text text-anchor="middle" dominant-baseline="central" font-size="${size.toFixed(2)}" ` +
            `fill="#ffd76a" stroke="#000000" stroke-width="${(1.5 / k).toFixed(2)}" paint-order="stroke">★` +
            `<title>${name}</title></text></g>`
        );
      } else {
        const radius = 3.5 / k;
        parts.push(
          `<g class="tw-settlement tw-settlement--minor" data-tw-settlement="${settlement.id}" ` +
            `transform="translate(${x},${y})">` +
            `<circle cx="0" cy="0" r="${radius.toFixed(2)}" fill="#ffd76a" stroke="#000000" ` +
            `stroke-width="${(1.4 / k).toFixed(2)}"><title>${name}</title></circle></g>`
        );
      }
    }

    group.innerHTML = parts.join("");
  },
  erase(layer) {
    layer.getEl().replaceChildren();
  }
};

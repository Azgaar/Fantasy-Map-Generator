/**
 * layers/armies.ts — `twArmies`: army tokens at their cell.
 *
 * Ported from the overlay's `map/armies.js`. Tokens scale inversely with zoom so
 * they keep a constant screen size, and they carry `data-tw-army` so the click
 * handler can pick one without hit-testing geometry (see ui/selection.ts).
 *
 * Phase A draws FMG's own regiments grouped by army id — real armies on the real
 * map, but not a campaign: no orders, no movement. Phase B swaps the source, not
 * this file.
 */
import { formatMen, r1, xmlEscape } from "../color";
import { zoomScale } from "../geometry";
import { getSource } from "../session";
import type { TwLayerParams } from "./index";

/** Token radius in screen px at scale 1. */
const TOKEN_R = 7.5;

export const twArmies: TwLayerParams = {
  id: "twArmies",
  parent: "viewbox",
  draw(layer) {
    const group = layer.getEl();
    const source = getSource();
    if (source.empty) {
      group.replaceChildren();
      return;
    }
    const k = zoomScale();
    const scale = k > 0 ? 1 / k : 1;
    const size = TOKEN_R * scale;
    const parts: string[] = [];

    for (const army of source.armies()) {
      const ring = army.own ? "#ffd76a" : "rgba(12, 16, 22, 0.85)";
      const strokeWidth = (army.own ? 2.2 : 1.4) * scale;
      const iconSize = 16 * scale;
      const label =
        k >= 1.2
          ? `<text class="tw-army-count" x="0" y="${(-size - 4 * scale).toFixed(2)}" ` +
            `font-size="${(10 * scale).toFixed(2)}">${xmlEscape(formatMen(army.troops))}</text>`
          : "";
      parts.push(
        `<g class="tw-army${army.own ? " tw-army--own" : ""}" data-tw-army="${xmlEscape(army.id)}" ` +
          `transform="translate(${r1(army.x)},${r1(army.y)})" style="cursor: pointer; pointer-events: auto;">` +
          `<title>${xmlEscape(army.name)}</title>` +
          `<circle cx="0" cy="0" r="${(size * 1.15).toFixed(2)}" fill="rgba(12, 16, 22, 0.85)" ` +
          `stroke="${ring}" stroke-width="${strokeWidth.toFixed(2)}"></circle>` +
          `<text class="tw-army-icon" x="0" y="${(0.5 * scale).toFixed(2)}" text-anchor="middle" ` +
          `dominant-baseline="central" font-size="${iconSize.toFixed(2)}" fill="${army.color}">` +
          `${army.fleet ? "⚓" : "⚔"}</text>` +
          `${label}</g>`
      );
    }

    group.innerHTML = parts.join("");
  },
  erase(layer) {
    layer.getEl().replaceChildren();
  }
};

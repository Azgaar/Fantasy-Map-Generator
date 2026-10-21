/**
 * layers/selection.ts — `twSelection`: the highlight of whatever is selected.
 *
 * A layer, not a mode. That is the whole of Phase A's answer to the overlay's
 * "game mode": the map keeps every one of FMG's own interactions, and this layer
 * simply shows the current selection (MOD-PLAN A.3).
 */
import { r1 } from "../color";
import { cellPolygon } from "../geometry";
import { getSelection, getSource } from "../session";
import type { TwLayerParams } from "./index";

const FILL = "rgba(255, 240, 190, 0.22)";
const STROKE = "rgba(255, 235, 170, 0.95)";

function polygonPath(polygon: number[][] | null): string {
  if (!polygon || polygon.length < 3) return "";
  let d = `M${r1(polygon[0][0])} ${r1(polygon[0][1])}`;
  for (let i = 1; i < polygon.length; i++) d += `L${r1(polygon[i][0])} ${r1(polygon[i][1])}`;
  return `${d}Z`;
}

export const twSelection: TwLayerParams = {
  id: "twSelection",
  parent: "viewbox",
  draw(layer) {
    const group = layer.getEl();
    const selection = getSelection();

    if (selection.kind === "army") {
      const army = getSource()
        .armies()
        .find(candidate => candidate.id === selection.armyId);
      group.innerHTML = army
        ? `<circle class="tw-selection-ring" cx="${r1(army.x)}" cy="${r1(army.y)}" r="16" fill="none" ` +
          `stroke="${STROKE}" stroke-width="2" vector-effect="non-scaling-stroke"></circle>`
        : "";
      return;
    }

    if (selection.kind !== "region") {
      group.replaceChildren();
      return;
    }
    const region = getSource().regionById(selection.regionId);
    if (!region) {
      group.replaceChildren();
      return;
    }
    let d = "";
    for (const cell of region.cells) d += polygonPath(cellPolygon(cell));
    group.innerHTML = d
      ? `<path class="tw-selection-region" d="${d}" fill="${FILL}" stroke="${STROKE}" stroke-width="1.5" ` +
        `vector-effect="non-scaling-stroke"></path>`
      : "";
  },
  erase(layer) {
    layer.getEl().replaceChildren();
  }
};

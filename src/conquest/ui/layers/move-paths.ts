/**
 * layers/move-paths.ts — `twMovePaths`: where the campaign intends to move.
 *
 * Registered in Phase A with nothing to draw. The wiring is the point: the layer
 * exists, toggles, persists in the `.map` file and repaints with the rest, so when
 * Phase B's engine starts producing paths nothing about the plumbing changes.
 *
 * An empty layer must still clear its group — FMG calls `draw` on layer state
 * changes, and a stale path from a previous world would otherwise survive.
 */
import { getSource } from "../session";
import type { TwLayerParams } from "./index";

export const twMovePaths: TwLayerParams = {
  id: "twMovePaths",
  parent: "viewbox",
  draw(layer) {
    const group = layer.getEl();
    const paths = getSource().movePaths();
    if (paths.length === 0) {
      group.replaceChildren();
      return;
    }
    const parts = paths.map(path => {
      const [x1, y1] = path.from;
      const [x2, y2] = path.to;
      return (
        `<path class="tw-move-path${path.own ? " tw-move-path--own" : ""}" ` +
        `d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${path.color}" stroke-width="1.5" ` +
        `stroke-dasharray="6 4" stroke-linecap="round" stroke-opacity="0.8" ` +
        `vector-effect="non-scaling-stroke"></path>`
      );
    });
    group.innerHTML = parts.join("");
  },
  erase(layer) {
    layer.getEl().replaceChildren();
  }
};

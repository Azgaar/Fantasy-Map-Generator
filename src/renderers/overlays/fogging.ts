// Fogging: dim everything outside the focused area by punching its shape out of the fog overlay
import { easeSinInOut, select, transition } from "d3";
import { Layers } from "@/renderers/layers/layers";
import { foggingLayer } from "@/renderers/layers/map-layers";

/** Reveal the area described by the path, fading the fog in on the first call */
export function fog(id: string, path: string): void {
  const fogLayer = select("#fog");
  if (fogLayer.select(`#${id}`).size()) return;

  const fadeIn = transition().duration(2000).ease(easeSinInOut);

  if (fogLayer.select("path").size()) {
    fogLayer.append("path").attr("d", path).attr("id", id).attr("opacity", 0).transition(fadeIn).attr("opacity", 1);
    return;
  }

  fogLayer.append("path").attr("d", path).attr("id", id).attr("opacity", 1);

  Layers.show(foggingLayer);
  const fogging = select(foggingLayer.getEl());
  const opacity = fogging.attr("opacity");
  fogging.attr("opacity", 0).transition(fadeIn).attr("opacity", opacity);
}

/** Remove one revealed area, or all of them if no id is given */
export function unfog(id?: string): void {
  const fogLayer = select("#fog");
  const selector = id && fogLayer.select(`#${id}`).size() ? `#${id}` : "path";
  fogLayer.selectAll(selector).remove();

  if (!fogLayer.selectAll("path").size()) Layers.hide(foggingLayer);
}

export const Fogging = { fog, unfog };

window.fog = fog;
window.unfog = unfog;

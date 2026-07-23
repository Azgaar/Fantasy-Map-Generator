// Fogging: dim everything outside the focused area by punching its shape out of the fog overlay.
// A transient overlay — driven by what the user is looking at, not by world state

import { easeSinInOut, select, transition } from "d3";

const getFog = () => select("#fog");
const getFogging = () => select("#fogging");

/** Reveal the area described by the path, fading the fog in on the first call */
export function fog(id: string, path: string): void {
  const fogLayer = getFog();
  if (fogLayer.select(`#${id}`).size()) return;

  const fadeIn = transition().duration(2000).ease(easeSinInOut);

  if (fogLayer.select("path").size()) {
    fogLayer.append("path").attr("d", path).attr("id", id).attr("opacity", 0).transition(fadeIn).attr("opacity", 1);
    return;
  }

  fogLayer.append("path").attr("d", path).attr("id", id).attr("opacity", 1);

  const fogging = getFogging();
  const opacity = fogging.attr("opacity");
  fogging.style("display", "block").attr("opacity", 0).transition(fadeIn).attr("opacity", opacity);
}

/** Remove one revealed area, or all of them if no id is given */
export function unfog(id?: string): void {
  const fogLayer = getFog();
  const selector = id && fogLayer.select(`#${id}`).size() ? `#${id}` : "path";
  fogLayer.selectAll(selector).remove();

  if (!fogLayer.selectAll("path").size()) getFogging().style("display", "none");
}

export const Fogging = { fog, unfog };

window.fog = fog;
window.unfog = unfog;

import { select } from "d3";
import { rn } from "../utils";

// A transient "in radius" ring drawn around a marker. It lives inside #viewbox so it pans and zooms with
// the map (a 24 km ring stays 24 km). Not persisted — save.ts clears #markerRadiusRing on the clone.
// NB: the id must not collide with the Marker Editor's #markerRadius button, or ensureEl() would grab the
// leftover empty group instead of the button and wire the click handler to the wrong element.
const GROUP_ID = "markerRadiusRing";

function ensureGroup() {
  const existing = select<SVGGElement, unknown>(`#${GROUP_ID}`);
  if (!existing.empty()) return existing;
  return select<SVGGElement, unknown>("#viewbox")
    .append<SVGGElement>("g")
    .attr("id", GROUP_ID)
    .attr("pointer-events", "none");
}

/** Draw (or replace) the radius ring of `radiusPx` map-pixels centered on (x, y). */
export function drawMarkerRadius(x: number, y: number, radiusPx: number, color = "#d4351c"): void {
  const group = ensureGroup();
  group.selectAll("*").remove();

  // Outline only — no fill. A large semi-transparent disc has to be alpha-composited every pan/zoom
  // frame, which makes the whole map feel sluggish while the ring is shown; a stroked ring is cheap.
  group
    .append("circle")
    .attr("cx", rn(x, 1))
    .attr("cy", rn(y, 1))
    .attr("r", rn(radiusPx, 1))
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "5 4")
    .attr("vector-effect", "non-scaling-stroke"); // keep the outline crisp at any zoom
}

/** Remove the ring (does not delete the group, so save-time cleanup stays a no-op cost). */
export function clearMarkerRadius(): void {
  select(`#${GROUP_ID}`).selectAll("*").remove();
}

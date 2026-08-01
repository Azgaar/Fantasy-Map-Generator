import { select } from "d3";
import { rn } from "../utils";

// A transient "travel range" ring drawn around the party marker. It lives inside #viewbox so it pans and
// zooms with the map (a 24 km ring stays 24 km). Not persisted — save.ts clears #partyRange on the clone.
const GROUP_ID = "partyRange";

function ensureGroup() {
  const existing = select<SVGGElement, unknown>(`#${GROUP_ID}`);
  if (!existing.empty()) return existing;
  return select<SVGGElement, unknown>("#viewbox")
    .append<SVGGElement>("g")
    .attr("id", GROUP_ID)
    .attr("pointer-events", "none");
}

/** Draw (or replace) the travel-range ring of radius `radiusPx` map-pixels centered on (x, y). */
export function drawPartyRange(x: number, y: number, radiusPx: number, label = "", color = "#d4351c"): void {
  const group = ensureGroup();
  group.selectAll("*").remove();

  group
    .append("circle")
    .attr("cx", rn(x, 1))
    .attr("cy", rn(y, 1))
    .attr("r", rn(radiusPx, 1))
    .attr("fill", color)
    .attr("fill-opacity", 0.05)
    .attr("stroke", color)
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "5 4")
    .attr("vector-effect", "non-scaling-stroke"); // keep the outline crisp at any zoom

  // radius label at the top of the ring — sized relative to the radius so it scales with the ring,
  // making the real distance readable and directly comparable to the scale bar
  if (label) {
    const fontSize = Math.max(rn(radiusPx * 0.28, 1), 1);
    group
      .append("text")
      .attr("x", rn(x, 1))
      .attr("y", rn(y - radiusPx, 1))
      .attr("dy", rn(-fontSize * 0.4, 1))
      .attr("text-anchor", "middle")
      .attr("font-size", fontSize)
      .attr("font-family", "var(--serif)")
      .attr("fill", color)
      .attr("paint-order", "stroke")
      .attr("stroke", "#fff")
      .attr("stroke-width", rn(fontSize * 0.18, 2))
      .text(label);
  }
}

/** Remove the ring (does not delete the group, so save-time cleanup stays a no-op cost). */
export function clearPartyRange(): void {
  select(`#${GROUP_ID}`).selectAll("*").remove();
}

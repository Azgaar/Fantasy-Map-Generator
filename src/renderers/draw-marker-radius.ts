import { select } from "d3";
import { rn } from "../utils";

const GROUP_ID = "markerRadiusRing";

function ensureGroup() {
  const existing = select<SVGGElement, unknown>(`#${GROUP_ID}`);
  if (!existing.empty()) return existing;
  return select<SVGGElement, unknown>("#viewbox")
    .append<SVGGElement>("g")
    .attr("id", GROUP_ID)
    .attr("pointer-events", "none");
}

export function drawMarkerRadius(x: number, y: number, radiusPx: number, color = "#d4351c"): void {
  const group = ensureGroup();
  group.selectAll("*").remove();

  group
    .append("circle")
    .attr("cx", rn(x, 1))
    .attr("cy", rn(y, 1))
    .attr("r", rn(radiusPx, 1))
    .attr("fill", "none")
    .attr("stroke", color)
    .attr("stroke-width", 1.4)
    .attr("stroke-dasharray", "5 4")
    .attr("vector-effect", "non-scaling-stroke");
}

export function clearMarkerRadius(): void {
  select(`#${GROUP_ID}`).remove();
}

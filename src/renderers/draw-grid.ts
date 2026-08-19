import { select } from "d3";
import { ensureEl } from "@/utils";

export function drawGrid(): void {
  const gridOverlay = select(ensureEl<SVGGElement>("gridOverlay"));
  gridOverlay.selectAll("*").remove();

  const pattern = `#pattern_${gridOverlay.attr("type") || "pointyHex"}`;
  const scale = gridOverlay.attr("scale") || 1;
  const dx = gridOverlay.attr("dx") || 0;
  const dy = gridOverlay.attr("dy") || 0;

  select(pattern)
    .attr("stroke", gridOverlay.attr("stroke") || "#808080")
    .attr("stroke-width", gridOverlay.attr("stroke-width") || 0.5)
    .attr("stroke-dasharray", gridOverlay.attr("stroke-dasharray"))
    .attr("stroke-linecap", gridOverlay.attr("stroke-linecap"))
    .attr("patternTransform", `scale(${scale}) translate(${dx} ${dy})`);

  gridOverlay
    .append("rect")
    .attr("width", Math.max(+ensureEl<HTMLInputElement>("mapWidthInput").value, graphWidth))
    .attr("height", Math.max(+ensureEl<HTMLInputElement>("mapHeightInput").value, graphHeight))
    .attr("fill", `url(${pattern})`)
    .attr("stroke", "none");
}

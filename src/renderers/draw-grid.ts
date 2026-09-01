import { select } from "d3";
import { ensureEl } from "@/utils";

export function drawGrid(): void {
  const gridOverlay = select(ensureEl<SVGGElement>("gridOverlay"));
  gridOverlay.selectAll("*").remove();

  const { type, scale, dx, dy } = styles.grid.options;
  const { attrs } = styles.grid;
  const pattern = `#pattern_${type || "pointyHex"}`;

  select(pattern)
    .attr("stroke", attrs.stroke || "#808080")
    .attr("stroke-width", attrs["stroke-width"] || 0.5)
    .attr("stroke-dasharray", attrs["stroke-dasharray"])
    .attr("stroke-linecap", attrs["stroke-linecap"])
    .attr("patternTransform", `scale(${scale}) translate(${dx} ${dy})`);

  gridOverlay
    .append("rect")
    .attr("width", Math.max(+ensureEl<HTMLInputElement>("mapWidthInput").value, graphWidth))
    .attr("height", Math.max(+ensureEl<HTMLInputElement>("mapHeightInput").value, graphHeight))
    .attr("fill", `url(${pattern})`)
    .attr("stroke", "none");
}

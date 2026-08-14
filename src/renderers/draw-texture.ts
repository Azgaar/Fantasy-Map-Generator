import { select } from "d3";
import { ensureEl } from "@/utils";

export function drawTexture(): void {
  const texture = select(ensureEl<SVGGElement>("texture"));
  const x = Number(texture.attr("data-x") || 0);
  const y = Number(texture.attr("data-y") || 0);

  texture
    .append("image")
    .attr("preserveAspectRatio", "xMidYMid slice")
    .attr("x", x)
    .attr("y", y)
    .attr("width", graphWidth - x)
    .attr("height", graphHeight - y)
    .attr("href", texture.attr("data-href"));
}

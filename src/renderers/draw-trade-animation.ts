import { curveCatmullRom, easeLinear, line } from "d3";
import type { TradeAnimationBatch } from "../modules/trade-animation";
import type { Point } from "../modules/voronoi";

export function drawTradeAnimation(batch: TradeAnimationBatch, points: Point[]): void {
  const lineGen = line<Point>().curve(curveCatmullRom.alpha(0.3));
  const pathsGroup = tradeAnimation.select("g#trade-paths");
  const markersGroup = tradeAnimation.select("g#trade-markers");

  const pathElement = pathsGroup
    .append("path")
    .attr("d", lineGen(points))
    .attr("fill", "none")
    .attr("stroke-opacity", 0);

  const fade = Number(tradeAnimation.attr("data-fade-duration")) || 1000;
  pathElement.transition().duration(fade).attr("stroke-opacity", 1);

  const group = markersGroup.append("g");

  const size = Number(tradeAnimation.attr("data-size")) || 4;
  group.append("circle").attr("r", size).attr("stroke-dasharray", "0").attr("stroke-opacity", 1);

  // The visual dot stays small, while the invisible target remains comfortable to click.
  group
    .append("circle")
    .attr("r", Math.max(12, size * 3))
    .attr("fill", "none")
    .attr("stroke", "none")
    .attr("pointer-events", "all")
    .style("cursor", "pointer")
    .on("click", () => TradeDetails.open(batch));

  const pathNode = pathElement.node()!;
  const length = pathNode.getTotalLength();

  const startPoint = pathNode.getPointAtLength(0);
  group.attr("transform", `translate(${startPoint.x}, ${startPoint.y})`);

  const duration = Number(tradeAnimation.attr("data-duration")) || 50;
  group
    .transition()
    .duration(length * duration)
    .ease(easeLinear)
    .attrTween(
      "transform",
      () => t => `translate(${pathNode.getPointAtLength(t * length).x}, ${pathNode.getPointAtLength(t * length).y})`
    )
    .on("end", () => {
      group.remove();
      pathElement.transition().duration(fade).attr("stroke-opacity", 0).remove();
    });
}

export function clearTradeAnimations(): void {
  tradeAnimation.select("g#trade-paths").selectAll("*").interrupt().remove();
  tradeAnimation.select("g#trade-markers").selectAll("*").interrupt().remove();
}

declare global {
  interface Window {
    drawTradeAnimation: typeof drawTradeAnimation;
    clearTradeAnimations: typeof clearTradeAnimations;
  }
}

window.drawTradeAnimation = drawTradeAnimation;
window.clearTradeAnimations = clearTradeAnimations;

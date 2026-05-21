import { curveCatmullRom, easeLinear, line } from "d3";
import type { TradeAnimationBatch } from "../modules/trade-animation";
import type { Point } from "../modules/voronoi";

const BASE_DURATION = 50;
const FADE_DURATION = 1000;

export function drawTradeAnimation(batch: TradeAnimationBatch, points: Point[]): void {
  const lineGen = line<Point>().curve(curveCatmullRom.alpha(0.3));
  const pathElement = tradeAnimation
    .append("path")
    .attr("d", lineGen(points))
    .attr("fill", "none")
    .attr("stroke-opacity", 0);
  pathElement.transition().duration(FADE_DURATION).attr("stroke-opacity", 1);

  const group = tradeAnimation.append("g");

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

  const speed = Number(tradeAnimation.attr("data-speed")) || 1;
  group
    .transition()
    .duration((length * BASE_DURATION) / speed)
    .ease(easeLinear)
    .attrTween(
      "transform",
      () => t => `translate(${pathNode.getPointAtLength(t * length).x}, ${pathNode.getPointAtLength(t * length).y})`
    )
    .on("end", () => {
      group.remove();
      pathElement.transition().duration(FADE_DURATION).attr("stroke-opacity", 0).remove();
    });
}

export function clearTradeAnimations(): void {
  tradeAnimation.selectAll("*").interrupt().remove();
}

declare global {
  interface Window {
    drawTradeAnimation: typeof drawTradeAnimation;
    clearTradeAnimations: typeof clearTradeAnimations;
  }
}

window.drawTradeAnimation = drawTradeAnimation;
window.clearTradeAnimations = clearTradeAnimations;

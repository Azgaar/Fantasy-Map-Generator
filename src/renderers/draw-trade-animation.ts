import { curveCatmullRom, easeLinear, line } from "d3";
import type { TradeBatch } from "../modules/trade-animation";
import type { Point } from "../modules/voronoi";

const DEFAULTS = {
  duration: 200,
  fadeDuration: 2000,
  markerSize: 4,
  landDurationModifier: 5,
  segmentChangePause: 1000
} as const;

function setting<K extends keyof typeof DEFAULTS>(key: K): number {
  const value = options.tradeAnimations?.[key];
  return typeof value === "number" ? value : DEFAULTS[key];
}

const lineGen = line<Point>().curve(curveCatmullRom.alpha(0.1));

export function drawTradeAnimation(
  batch: TradeBatch,
  points: Point[],
  segments: { type: "land" | "water"; points: Point[] }[]
): void {
  const pathsGroup = tradeAnimation.select("g#trade-paths");
  const markersGroup = tradeAnimation.select("g#trade-markers");

  // Draw the full path as one
  const pathElement = pathsGroup
    .append("path")
    .attr("d", lineGen(points))
    .attr("fill", "none")
    .attr("stroke-opacity", 0);

  const fade = setting("fadeDuration");
  pathElement.transition().duration(fade).attr("stroke-opacity", 1);

  animateSegment(0);

  function animateSegment(idx: number) {
    if (!segments || idx >= segments.length) {
      pathElement.transition().duration(fade).attr("stroke-opacity", 0).remove();
      return;
    }
    const segment = segments[idx];

    const group = markersGroup.append("g");
    const size = setting("markerSize");
    const imgSize = segment.type === "land" ? size / 2 : size;
    const imgHref = `./images/markers/${segment.type === "land" ? "wagon" : "ship"}.png`;
    const duration = setting("duration");
    const segDuration = segment.type === "land" ? duration * setting("landDurationModifier") : duration;

    group
      .append("image")
      .attr("href", imgHref)
      .attr("width", imgSize)
      .attr("height", imgSize)
      .attr("x", -imgSize / 2)
      .attr("y", -imgSize / 2)
      .attr("pointer-events", "none");

    // Invisible target for click
    group
      .append("circle")
      .attr("r", Math.max(12, size * 3))
      .attr("fill", "none")
      .attr("stroke", "none")
      .attr("pointer-events", "all")
      .style("cursor", "pointer")
      .on("click", () => TradeDetails.open(batch));

    // Animate along this segment;
    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempPath.setAttribute("d", lineGen(segment.points)!);
    const tempLength = tempPath.getTotalLength();
    const startPoint = tempPath.getPointAtLength(0);
    group.attr("transform", `translate(${startPoint.x}, ${startPoint.y})`);

    group
      .transition()
      .duration(tempLength * segDuration)
      .ease(easeLinear)
      .attrTween("transform", () => {
        return t => {
          const p = tempPath.getPointAtLength(t * tempLength);
          const p2 = tempPath.getPointAtLength(t * tempLength + 0.1);
          const angle = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
          return `translate(${p.x}, ${p.y}) rotate(${angle})`;
        };
      })
      .on("end", () => {
        group.remove();
        setTimeout(() => animateSegment(idx + 1), setting("segmentChangePause"));
      });
  }
}

export function clearTradeAnimations(): void {
  tradeAnimation.select("g#trade-paths").selectAll("*").interrupt().remove();
  tradeAnimation.select("g#trade-markers").selectAll("*").interrupt().remove();
}

export function drawTradeHighlight(batch: TradeBatch): void {
  const pathData = TradeAnimation.getPath(batch);
  if (!pathData) return;

  const highlightGroup = tradeAnimation.select("g#trade-highlight");
  highlightGroup.selectAll("*").remove();
  highlightGroup
    .append("path")
    .attr("d", lineGen(pathData.points))
    .attr("fill", "none")
    .attr("stroke", "#cc1111")
    .attr("stroke-width", 0.5)
    .attr("stroke-opacity", 0.7)
    .attr("stroke-linecap", "round");
}

export function clearTradeHighlight(): void {
  tradeAnimation.select("g#trade-highlight").selectAll("*").remove();
}

declare global {
  interface Window {
    drawTradeAnimation: typeof drawTradeAnimation;
    clearTradeAnimations: typeof clearTradeAnimations;
    drawTradeHighlight: typeof drawTradeHighlight;
    clearTradeHighlight: typeof clearTradeHighlight;
  }
}

window.drawTradeAnimation = drawTradeAnimation;
window.clearTradeAnimations = clearTradeAnimations;
window.drawTradeHighlight = drawTradeHighlight;
window.clearTradeHighlight = clearTradeHighlight;

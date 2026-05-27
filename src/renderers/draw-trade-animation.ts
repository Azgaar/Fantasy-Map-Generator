import { curveCatmullRom, easeLinear, line } from "d3";
import type { TradeBatch } from "../modules/trade-animation";
import type { Point } from "../modules/voronoi";
import { minmax } from "../utils";

const lineGen = line<Point>().curve(curveCatmullRom.alpha(0.1));

export function draw(
  batch: TradeBatch,
  points: Point[],
  segments: { type: "land" | "water"; points: Point[] }[],
  onComplete?: () => void
): void {
  const pathsGroup = tradeAnimation.select("g#trade-paths");
  const markersGroup = tradeAnimation.select("g#trade-markers");

  // Draw the full path as one
  const pathElement = pathsGroup
    .append("path")
    .attr("d", lineGen(points))
    .attr("fill", "none")
    .attr("stroke-opacity", 0);
  const fade = options.trade.animation.fadeDuration;
  pathElement.transition().duration(fade).attr("stroke-opacity", 1);

  animateSegment(0);

  function animateSegment(idx: number) {
    if (!segments || idx >= segments.length) {
      pathElement.transition().duration(fade).attr("stroke-opacity", 0).remove();
      onComplete?.();
      return;
    }
    const segment = segments[idx];

    const group = markersGroup.append("g");
    const size = options.trade.animation.markerSize;
    const imgSize = segment.type === "land" ? size / 1.6 : size;
    const imgHref = `./images/markers/${segment.type === "land" ? "wagon" : "ship"}.png`;
    const duration = options.trade.animation.duration;
    const segDuration = segment.type === "land" ? duration * options.trade.animation.landDurationModifier : duration;

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
      .attr("r", minmax(size * 1.5, 4, 8))
      .attr("fill", "none")
      .attr("stroke", "none")
      .attr("pointer-events", "all")
      .style("cursor", "pointer")
      .on("click", () => TradeDetails.open(batch));

    // Animate along the path; samples computed lazily and cached at ~1px spacing
    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempPath.setAttribute("d", lineGen(segment.points)!);
    const length = tempPath.getTotalLength();
    const numSamples = Math.max(2, Math.ceil(length) + 1);
    const lastIdx = numSamples - 1;
    const points: (Point | undefined)[] = new Array(numSamples);
    const getSample = (i: number): Point => {
      const cached = points[i];
      if (cached) return cached;
      const p = tempPath.getPointAtLength((i / lastIdx) * length);
      points[i] = [p.x, p.y];
      return points[i];
    };
    const [sx, sy] = getSample(0);

    group
      .attr("transform", `translate(${sx}, ${sy})`)
      .transition()
      .duration(length * segDuration)
      .ease(easeLinear)
      .attrTween("transform", () => {
        return t => {
          const pos = t * lastIdx;
          const idx = Math.min(lastIdx - 1, Math.floor(pos));
          const frac = pos - idx;
          const [x0, y0] = getSample(idx);
          const [x1, y1] = getSample(idx + 1);
          const x = x0 + (x1 - x0) * frac;
          const y = y0 + (y1 - y0) * frac;
          const angle0 = Math.atan2(y1 - y0, x1 - x0);
          let angle = angle0;
          if (idx + 2 <= lastIdx) {
            const [x2, y2] = getSample(idx + 2);
            const angle1 = Math.atan2(y2 - y1, x2 - x1);
            let delta = angle1 - angle0;
            if (delta > Math.PI) delta -= 2 * Math.PI;
            else if (delta < -Math.PI) delta += 2 * Math.PI;
            angle = angle0 + delta * frac;
          }
          return `translate(${x}, ${y}) rotate(${(angle * 180) / Math.PI})`;
        };
      })
      .on("end", () => {
        group.remove();
        setTimeout(() => animateSegment(idx + 1), options.trade.animation.segmentChangePause);
      });
  }
}

export function clear(): void {
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
    TradeAnimationRenderer: {
      draw: typeof draw;
      clear: typeof clear;
      drawHighlight: typeof drawTradeHighlight;
      clearHighlight: typeof clearTradeHighlight;
    };
  }
}

window.TradeAnimationRenderer = {
  draw,
  clear,
  drawHighlight: drawTradeHighlight,
  clearHighlight: clearTradeHighlight
};

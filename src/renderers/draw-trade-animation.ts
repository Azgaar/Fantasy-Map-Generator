import { curveCatmullRom, easeLinear, line } from "d3";
import { Controllers } from "@/controllers";
import type { Point } from "../generators/voronoi";
import { ensureEl, minmax } from "../utils";
import type { TradeBatch } from "./trade-animation";

const lineGen = line<Point>().curve(curveCatmullRom.alpha(0.1));

const MARKER_SYMBOLS = {
  water: { id: "trade-marker-water", src: "./images/markers/ship.svg" },
  land: { id: "trade-marker-land", src: "./images/markers/wagon.svg" }
} as const;

let symbolsReady: Promise<void> | null = null;

function ensureSymbols(): Promise<void> {
  if (symbolsReady) return symbolsReady;
  const defs = ensureEl("trade-markers");
  symbolsReady = (async () => {
    await Promise.all(
      Object.values(MARKER_SYMBOLS).map(async ({ id, src }) => {
        if (defs.querySelector(`#${id}`)) return;
        const text = await fetch(src).then(r => r.text());
        const svgNode = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
        const symbol = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
        symbol.id = id;
        const vb = svgNode.getAttribute("viewBox");
        if (vb) symbol.setAttribute("viewBox", vb);
        while (svgNode.firstChild) symbol.appendChild(svgNode.firstChild);
        defs.appendChild(symbol);
      })
    );
  })();
  return symbolsReady;
}

export async function draw(
  batch: TradeBatch,
  segments: { type: "land" | "water"; points: Point[] }[],
  onComplete?: () => void,
  isCancelled?: () => boolean
): Promise<void> {
  await ensureSymbols();
  animateSegment(0);

  function animateSegment(idx: number) {
    if (isCancelled?.()) return;
    if (!segments || idx >= segments.length) {
      onComplete?.();
      return;
    }

    const segment = segments[idx];
    const size = options.trade.animation.markerSize;
    const imgSize = segment.type === "land" ? size / 1.6 : size;
    const duration = options.trade.animation.duration;
    const segDuration = segment.type === "land" ? duration * options.trade.animation.landDurationModifier : duration;

    const group = tradeAnimation.append("g");
    group
      .append("use")
      .attr("href", `#trade-marker-${segment.type}`)
      .attr("width", imgSize)
      .attr("height", imgSize)
      .attr("x", -imgSize / 2)
      .attr("y", -imgSize / 2)
      .attr("pointer-events", "none");

    // Invisible target for click
    group
      .append("circle")
      .attr("r", minmax(size, 2, 6))
      .attr("fill", "none")
      .attr("stroke", "none")
      .attr("pointer-events", "all")
      .style("cursor", "pointer")
      .on("click", () => Controllers.TradeDetails.open(batch));

    // Animate along the path; samples computed lazily and cached at ~1px spacing
    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    tempPath.setAttribute("d", lineGen(segment.points) ?? "");
    const length = tempPath.getTotalLength();
    const numSamples = Math.max(2, Math.ceil(length) + 1);
    const lastIdx = numSamples - 1;
    const points: (Point | undefined)[] = new Array(numSamples);
    const getSample = (i: number): Point => {
      const cached = points[i];
      if (cached) return cached;
      const p = tempPath.getPointAtLength((i / lastIdx) * length);
      const pt: Point = [p.x, p.y];
      points[i] = pt;
      return pt;
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
  tradeAnimation.selectAll("g").interrupt().remove();
}

export function getPath(points: Point[]): string {
  return lineGen(points) ?? "";
}

export function highlight(points: Point[]): void {
  tradeAnimation.selectAll("path.highlight").remove();
  tradeAnimation
    .append("path")
    .attr("class", "highlight")
    .attr("d", lineGen(points))
    .attr("fill", "none")
    .attr("stroke", "#cc1111")
    .attr("stroke-width", 0.5)
    .attr("stroke-opacity", 0.7)
    .attr("stroke-linecap", "round");
}

export function clearHighlight(): void {
  tradeAnimation.selectAll("path.highlight").remove();
}

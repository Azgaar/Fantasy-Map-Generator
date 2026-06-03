import type { Selection } from "d3";
import { range } from "d3";
import { rn } from "../utils";

declare global {
  var drawScaleBar: (scaleBar: Selection<SVGGElement, unknown, HTMLElement, unknown>, scaleLevel: number) => void;
  var fitScaleBar: (
    scaleBar: Selection<SVGGElement, unknown, HTMLElement, unknown>,
    fullWidth: number,
    fullHeight: number
  ) => void;
}

type ScaleBarSelection = d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;
type ScaleBarRenderState = {
  length: number;
  labels: string[];
  label: string;
  contentKey: string;
};

type ScaleBarCache = {
  contentKey: string;
  measuredLength: number;
  backgroundWidth: number;
  backgroundHeight: number;
};

type ScaleBarRenderStateInput = {
  size: number;
  scaleLevel: number;
  distanceScale: number;
  unit: string;
  label?: string | null;
};

const scaleBarCache = new WeakMap<SVGGElement, ScaleBarCache>();

const scaleBarRenderer = (scaleBar: ScaleBarSelection, scaleLevel: number): void => {
  if (!scaleBar.size() || scaleBar.style("display") === "none") return;

  const unit = distanceUnitInput.value;
  const size = +scaleBar.attr("data-bar-size");
  const label = scaleBar.attr("data-label");
  const state = getScaleBarRenderState({ size, scaleLevel, distanceScale, unit, label });
  const scaleBarNode = scaleBar.node();
  const cache = scaleBarNode ? scaleBarCache.get(scaleBarNode) : undefined;
  const contentKeyChanged = cache?.contentKey !== state.contentKey;

  let content = scaleBar.select<SVGGElement>("#scaleBarContent");
  if (contentKeyChanged || !content.size()) {
    content.remove();
    content = createScaleBarContent(scaleBar, state);
  }

  updateScaleBarContent(content, state, size);

  const scaleBarBack = scaleBar.select<SVGRectElement>("#scaleBarBack");
  if (scaleBarBack.size()) {
    updateScaleBarBackground(scaleBar, scaleBarBack, content, state, contentKeyChanged);
  }
};

function createScaleBarContent(
  scaleBar: ScaleBarSelection,
  state: ScaleBarRenderState
): d3.Selection<SVGGElement, unknown, HTMLElement, unknown> {
  const content = scaleBar.append("g").attr("id", "scaleBarContent");

  const lines = content.append("g");
  lines.append("line").attr("data-role", "top-line").attr("stroke", "white");
  lines.append("line").attr("data-role", "bottom-line").attr("stroke", "#3d3d3d");
  lines.append("line").attr("data-role", "ticks-line").attr("stroke", "#3d3d3d");

  const texts = content.append("g").attr("text-anchor", "middle").attr("font-family", "var(--serif)");
  texts
    .selectAll("text")
    .data(state.labels)
    .enter()
    .append("text")
    .attr("data-role", "distance-label")
    .attr("text-rendering", "optimizeSpeed")
    .attr("y", 0)
    .attr("dy", "-.6em")
    .text((d: string) => d);

  if (state.label) {
    texts
      .append("text")
      .attr("data-role", "scale-label")
      .attr("text-rendering", "optimizeSpeed")
      .attr("dy", ".6em")
      .attr("dominant-baseline", "text-before-edge");
  }

  return content;
}

function updateScaleBarContent(
  content: d3.Selection<SVGGElement, unknown, HTMLElement, unknown>,
  state: ScaleBarRenderState,
  size: number
): void {
  const length = state.length;

  content
    .select<SVGLineElement>('line[data-role="top-line"]')
    .attr("x1", 0.5)
    .attr("y1", 0)
    .attr("x2", length + size - 0.5)
    .attr("y2", 0)
    .attr("stroke-width", size);
  content
    .select<SVGLineElement>('line[data-role="bottom-line"]')
    .attr("x1", 0)
    .attr("y1", size)
    .attr("x2", length + size)
    .attr("y2", size)
    .attr("stroke-width", size);
  content
    .select<SVGLineElement>('line[data-role="ticks-line"]')
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", length + size)
    .attr("y2", 0)
    .attr("stroke-width", rn(size * 3, 2))
    .attr("stroke-dasharray", `${size} ${rn(length / 5 - size, 2)}`);

  content
    .selectAll<SVGTextElement, string>('text[data-role="distance-label"]')
    .data(state.labels)
    .attr("x", (_d: string, i: number) => rn((i * length) / 5, 2))
    .text((d: string) => d);
  content
    .select<SVGTextElement>('text[data-role="scale-label"]')
    .attr("x", (length + 1) / 2)
    .text(state.label);
}

function updateScaleBarBackground(
  scaleBar: ScaleBarSelection,
  scaleBarBack: d3.Selection<SVGRectElement, unknown, HTMLElement, unknown>,
  content: d3.Selection<SVGGElement, unknown, HTMLElement, unknown>,
  state: ScaleBarRenderState,
  contentKeyChanged: boolean
): void {
  const paddingTop = +scaleBarBack.attr("data-top") || 0;
  const paddingLeft = +scaleBarBack.attr("data-left") || 0;
  const paddingRight = +scaleBarBack.attr("data-right") || 0;
  const paddingBottom = +scaleBarBack.attr("data-bottom") || 0;
  const scaleBarNode = scaleBar.node();
  const cache = scaleBarNode ? scaleBarCache.get(scaleBarNode) : undefined;
  const backgroundBox =
    !cache || contentKeyChanged
      ? measureScaleBarContent(content)
      : {
          width: cache.backgroundWidth + state.length - cache.measuredLength,
          height: cache.backgroundHeight
        };

  scaleBarBack
    .attr("x", -paddingLeft)
    .attr("y", -paddingTop)
    .attr("width", backgroundBox.width + paddingRight)
    .attr("height", backgroundBox.height + paddingBottom);

  if (scaleBarNode) {
    scaleBarCache.set(scaleBarNode, {
      contentKey: state.contentKey,
      measuredLength: state.length,
      backgroundWidth: backgroundBox.width,
      backgroundHeight: backgroundBox.height
    });
  }
}

function measureScaleBarContent(content: d3.Selection<SVGGElement, unknown, HTMLElement, unknown>): {
  width: number;
  height: number;
} {
  const bbox = (content.node() as SVGGElement).getBBox();
  return { width: bbox.width, height: bbox.height };
}

export function getScaleBarRenderState({
  size,
  scaleLevel,
  distanceScale,
  unit,
  label
}: ScaleBarRenderStateInput): ScaleBarRenderState {
  const init = 100;
  let val = (init * size * distanceScale) / scaleLevel; // bar length in distance unit
  if (val > 900)
    val = rn(val, -3); // round to 1000
  else if (val > 90)
    val = rn(val, -2); // round to 100
  else if (val > 9)
    val = rn(val, -1); // round to 10
  else val = rn(val); // round to 1
  const length = (val * scaleLevel) / distanceScale; // actual length in pixels on this scale
  const labels = range(0, 6).map((d: number) => rn((d * val) / 5) + (d < 5 ? "" : ` ${unit}`));
  const normalizedLabel = label || "";
  const contentKey = JSON.stringify({ size, unit, labels, label: normalizedLabel });
  return { length, labels, label: normalizedLabel, contentKey };
}

const scaleBarResize = (scaleBar: ScaleBarSelection, fullWidth: number, fullHeight: number): void => {
  if (!scaleBar.select("rect").size() || scaleBar.style("display") === "none") return;

  const posX = +scaleBar.attr("data-x") || 99;
  const posY = +scaleBar.attr("data-y") || 99;
  const scaleBarBack = scaleBar.select<SVGRectElement>("#scaleBarBack");
  const width = +scaleBarBack.attr("width");
  const height = +scaleBarBack.attr("height");
  if (!width || !height) return;

  const x = rn((fullWidth * posX) / 100 - width + 10);
  const y = rn((fullHeight * posY) / 100 - height + 20);
  scaleBar.attr("transform", `translate(${x},${y})`);
};

window.drawScaleBar = scaleBarRenderer;
window.fitScaleBar = scaleBarResize;

import { range, select } from "d3";
import { ensureEl, rn } from "../utils";

export function drawScaleBar(parent?: SVGSVGElement, scaleLevel = scale, width = svgWidth, height = svgHeight): void {
  const parentEl = parent || ensureEl<SVGSVGElement>("map");
  const scaleBar = select(parentEl).select<SVGGElement>("#scaleBar");

  // getBBox() below throws on a subtree that is not rendered, so never draw into a hidden scale bar
  const scaleBarEl = scaleBar.node();
  if (!scaleBarEl || getComputedStyle(scaleBarEl).display === "none") return;

  const renderedContent = scaleBar.select("#scaleBarContent");
  const isRendered = Boolean(renderedContent.size());
  TIME && !isRendered && console.time("drawScaleBar");

  const unit = distanceUnitInput.value;
  const { barSize: size, label, x: posX, y: posY } = styles.scaleBar.options;

  renderedContent?.remove(); // redraw content every time, but not scaleBarBack
  const content = scaleBar.append("g").attr("id", "scaleBarContent");

  const length = getLength();
  const lines = content.append("g");
  lines
    .append("line")
    .attr("x1", 0.5)
    .attr("y1", 0)
    .attr("x2", length + size - 0.5)
    .attr("y2", 0)
    .attr("stroke-width", size)
    .attr("stroke", "white");
  lines
    .append("line")
    .attr("x1", 0)
    .attr("y1", size)
    .attr("x2", length + size)
    .attr("y2", size)
    .attr("stroke-width", size)
    .attr("stroke", "#3d3d3d");
  lines
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", length + size)
    .attr("y2", 0)
    .attr("stroke-width", rn(size * 3, 2))
    .attr("stroke-dasharray", `${size} ${rn(length / 5 - size, 2)}`)
    .attr("stroke", "#3d3d3d");

  const texts = content.append("g").attr("text-anchor", "middle").attr("font-family", "var(--serif)");
  texts
    .selectAll("text")
    .data(range(0, 6))
    .enter()
    .append("text")
    .attr("text-rendering", "optimizeSpeed")
    .attr("x", (d: number) => rn((d * length) / 5, 2))
    .attr("y", 0)
    .attr("dy", "-.6em")
    .text((d: number) => rn((((d * length) / 5) * distanceScale) / scaleLevel) + (d < 5 ? "" : ` ${unit}`));

  if (label) {
    texts
      .append("text")
      .attr("text-rendering", "optimizeSpeed")
      .attr("x", (length + 1) / 2)
      .attr("dy", ".6em")
      .attr("dominant-baseline", "text-before-edge")
      .text(label);
  }

  const scaleBarBack = scaleBar.select<SVGRectElement>("#scaleBarBack");
  if (scaleBarBack.size()) {
    const bbox = (content.node() as SVGGElement).getBBox();
    const {
      top: paddingTop,
      left: paddingLeft,
      right: paddingRight,
      bottom: paddingBottom
    } = styles.scaleBar.back.options;

    scaleBar
      .select("#scaleBarBack")
      .attr("x", -paddingLeft)
      .attr("y", -paddingTop)
      .attr("width", bbox.width + paddingRight)
      .attr("height", bbox.height + paddingBottom);

    const backBbox = (scaleBarBack.node() as SVGGElement).getBBox();
    const x = rn((width * posX) / 100 - backBbox.width + 10);
    const y = rn((height * posY) / 100 - backBbox.height + 20);
    scaleBar.attr("transform", `translate(${x},${y})`);
  }

  TIME && !isRendered && console.timeEnd("drawScaleBar");

  function getLength(): number {
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
    return length;
  }
}

export function removeScaleBar() {
  select("#scaleBarContent").remove();
}

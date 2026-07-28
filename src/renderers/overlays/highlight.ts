import { easeBounceOut, easeLinear, easeSinIn, select, transition } from "d3";
import { parseTransform } from "@/utils";

const debugLayer = () => select(debug.node() as SVGGElement);

function getBBox(element: Element): DOMRect {
  const attr = (name: string) => Number(element.getAttribute(name));
  return new DOMRect(attr("x"), attr("y"), attr("width"), attr("height"));
}

/** Draw a temporary outline around an element, optionally zooming to it */
export function highlightElement(target: Element | null, zoom?: number): void {
  const element = target as SVGGraphicsElement | null;
  if (!element) return;
  const layer = debugLayer();
  if (layer.select(".highlighted").size()) return; // allow only 1 highlighted element simultaneously

  const box = element.tagName === "svg" ? getBBox(element) : element.getBBox();
  const transformAttr = element.getAttribute("transform");
  const enter = transition().duration(1000).ease(easeBounceOut);

  layer
    .append("rect")
    .attr("x", box.x)
    .attr("y", box.y)
    .attr("width", box.width)
    .attr("height", box.height)
    .classed("highlighted", true)
    .attr("transform", transformAttr)
    .transition(enter)
    .style("outline-offset", "0px")
    .transition()
    .duration(500)
    .ease(easeLinear)
    .style("outline-color", "transparent")
    .delay(1000)
    .remove();

  if (!zoom) return;

  const [shiftX, shiftY] = parseTransform(transformAttr || "");
  const x = box.x + box.width / 2 + (Number(shiftX) || 0);
  const y = box.y + box.height / 2 + (Number(shiftY) || 0);
  zoomTo(x, y, scale > 2 ? scale : zoom, 1600);
}

/** Animate the area or place an emblem belongs to */
export function highlightEmblemElement(type: string, element: { i: number; [key: string]: any }) {
  const { cells } = pack;
  const animation = transition().duration(1000).ease(easeSinIn);
  const layer = debugLayer();

  if (type === "burg") {
    layer
      .append("circle")
      .attr("cx", element.x)
      .attr("cy", element.y)
      .attr("r", 0)
      .attr("fill", "none")
      .attr("stroke", "#d0240f")
      .attr("stroke-width", 1)
      .attr("opacity", 1)
      .transition(animation)
      .attr("r", 20)
      .attr("opacity", 0.1)
      .attr("stroke-width", 0)
      .remove();
    return;
  }

  const [x, y] = element.pole || cells.p[element.center];
  const owner = type === "state" ? cells.state : cells.province;
  const borderCells = cells.i.filter(id => owner[id] === element.i && cells.c[id].some(n => owner[n] !== element.i));
  const rays = borderCells
    .filter((_cellId, index) => !(index % 2))
    .map(cellId => cells.p[cellId])
    .map(([px, py]) => [px, py, Math.hypot(px - x, py - y)]);

  layer
    .selectAll("line")
    .data(rays)
    .enter()
    .append("line")
    .attr("x1", x)
    .attr("y1", y)
    .attr("x2", d => d[0])
    .attr("y2", d => d[1])
    .attr("stroke", "#d0240f")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.2)
    .attr("stroke-dashoffset", d => d[2])
    .attr("stroke-dasharray", d => d[2])
    .transition(animation)
    .attr("stroke-dashoffset", 0)
    .attr("opacity", 1)
    .transition()
    .duration(1000)
    .ease(easeSinIn)
    .delay(1000)
    .attr("stroke-dashoffset", d => d[2])
    .attr("opacity", 0)
    .remove();
}

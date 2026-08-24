import { type Selection, select } from "d3";

export interface ViewportSurface {
  debug: Selection<SVGGElement, unknown, HTMLElement, unknown>;
  defs: Selection<SVGDefsElement, unknown, HTMLElement, unknown>;
  fogging: Selection<SVGGElement, unknown, HTMLElement, unknown>;
  legend: Selection<SVGGElement, unknown, HTMLElement, unknown>;
  ruler: Selection<SVGGElement, unknown, HTMLElement, unknown>;
  scaleBar: Selection<SVGGElement, unknown, HTMLElement, unknown>;
  svg: Selection<SVGSVGElement, unknown, HTMLElement, unknown>;
  viewbox: Selection<SVGGElement, unknown, HTMLElement, unknown>;
}

export function getViewportSurface(): ViewportSurface {
  const svg = select<SVGSVGElement, unknown>("#map");
  const viewbox = svg.select<SVGGElement>("#viewbox");
  return {
    debug: viewbox.select<SVGGElement>("#debug"),
    defs: svg.select<SVGDefsElement>("#deftemp"),
    fogging: viewbox.select<SVGGElement>("#fogging"),
    legend: svg.select<SVGGElement>("#legend"),
    ruler: viewbox.select<SVGGElement>("#ruler"),
    scaleBar: svg.select<SVGGElement>("#scaleBar"),
    svg,
    viewbox
  };
}

export function initializeViewportSurface(): ViewportSurface {
  const initial = getViewportSurface();
  const legend = initial.legend.empty() ? initial.svg.append<SVGGElement>("g").attr("id", "legend") : initial.legend;
  const ruler = initial.ruler.empty()
    ? initial.viewbox.append<SVGGElement>("g").attr("id", "ruler").style("display", "none")
    : initial.ruler;
  const debug = initial.debug.empty() ? initial.viewbox.append<SVGGElement>("g").attr("id", "debug") : initial.debug;

  let fogging = initial.fogging;
  if (fogging.empty()) {
    fogging = initial.viewbox
      .append<SVGGElement>("g")
      .attr("id", "fogging-cont")
      .attr("mask", "url(#fog)")
      .append<SVGGElement>("g")
      .attr("id", "fogging")
      .style("display", "none");
    fogging.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%");
    fogging
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("fill", "#e8f0f6")
      .attr("filter", "url(#splotch)");
  }

  return { ...initial, debug, fogging, legend, ruler };
}

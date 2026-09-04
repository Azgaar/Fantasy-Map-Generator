import { select } from "d3";
import { Layers } from "@/components/layers";
import { setViewportSize, viewport } from "@/components/viewport";
import { setTranslateExtent, setZoomExtent } from "@/components/zoom";
import { fitLegendBox } from "@/renderers/draw-legend";
import { findEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

/** Resize everything that covers the whole map to the graph extent */
export function applyGraphSize(): void {
  const { width, height } = facts.graph;

  const cover = (selector: string, child: string) =>
    select(selector).selectAll(child).attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);

  cover("#landmass", "rect");
  cover("#oceanPattern", "rect");
  cover("#oceanLayers", "rect");
  cover("#fogging", "rect");
  select("#deftemp").select("mask#fog > rect").attr("width", width).attr("height", height);
  select("#deftemp").select("mask#water > rect").attr("width", width).attr("height", height);
}

/** Set the map window on screen and re-fit everything drawn in screen space */
export function setViewport(width: number, height: number): void {
  setViewportSize(width, height);
  select("#map").attr("width", viewport.width).attr("height", viewport.height);

  // the map may never zoom out past covering the window, whatever extent the user asked for
  const { min, max } = options.app.zoomExtent;
  const coverMin = rn(Math.max(viewport.width / facts.graph.width, viewport.height / facts.graph.height), 3);
  setTranslateExtent(0, 0, facts.graph.width, facts.graph.height);
  setZoomExtent(Math.max(min, coverMin), max);

  const showViewport = (id: string, value: number) => {
    const input = findEl<HTMLInputElement>(id);
    if (input) input.value = String(value);
  };
  showViewport("viewportWidth", viewport.width);
  showViewport("viewportHeight", viewport.height);

  Layers.draw("scaleBar");
  fitLegendBox();
}

/**
 * The viewport a map opens at, and the one a window resize settles on: the size the user set if
 * they set one, otherwise as much of the map as the browser window can show. Either way it is
 * bounded by the extent - past that there is nothing but empty canvas to show
 */
export function fitMapToScreen(): void {
  const { width, height } = facts.graph;
  const kept = options.app.viewport;
  const wanted = kept ?? { width: window.innerWidth, height: window.innerHeight };
  setViewport(Math.min(width, wanted.width), Math.min(height, wanted.height));
}

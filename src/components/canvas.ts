// The map canvas. Two sizes meet here and they are not the same thing:
// - `facts.graph` is the coordinate extent the map's geometry lives in, fixed for the life of its
//   graph and asked for, before generation, by `options.generation.graph`
// - the viewport is the window onto it: how much of the map is on screen right now. It is derived
//   from the extent and the browser window, and nothing persists it
// See docs/architecture/configuration.md
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

/**
 * Set the map window on screen and re-fit everything drawn in screen space. The single writer of
 * the viewport, its svg and the inputs that show it
 */
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

/** The viewport a map opens at: as much of it as the browser window can show */
export function fitMapToScreen(): void {
  const { width, height } = facts.graph;
  setViewport(Math.min(width, window.innerWidth), Math.min(height, window.innerHeight));
}

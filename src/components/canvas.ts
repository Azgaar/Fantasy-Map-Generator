// The map canvas: the voronoi extent a map is generated on (options.graph), and the svg viewport
import { select } from "d3";
import { Layers } from "@/components/layers";
import { setTranslateExtent, setZoomExtent } from "@/components/zoom";
import { fitLegendBox } from "@/renderers/draw-legend";
import { rn } from "@/utils/numberUtils";

// The svg viewport resolution
export const viewport = { width: 0, height: 0 };
export function setViewport(width: number, height: number): void {
  viewport.width = width;
  viewport.height = height;
}

/** Resize everything that covers the whole map to the configured graph size */
export function applyGraphSize(): void {
  const { width, height } = options.graph;

  const cover = (selector: string, child: string) =>
    select(selector).selectAll(child).attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);

  cover("#landmass", "rect");
  cover("#oceanPattern", "rect");
  cover("#oceanLayers", "rect");
  cover("#fogging", "rect");
  select("#deftemp").select("mask#fog > rect").attr("width", width).attr("height", height);
  select("#deftemp").select("mask#water > rect").attr("width", width).attr("height", height);
}

/** Size the svg to the window and re-fit everything that is drawn in screen space */
export function fitMapToScreen(): void {
  const { width, height } = options.graph;
  setViewport(Math.min(width, window.innerWidth), Math.min(height, window.innerHeight));
  select("#map").attr("width", viewport.width).attr("height", viewport.height);

  const zoomMin = rn(Math.max(viewport.width / width, viewport.height / height), 3);
  const zoomInput = document.getElementById("zoomExtentMin") as HTMLInputElement | null;
  if (zoomInput) zoomInput.value = String(zoomMin);
  const zoomMax = +((document.getElementById("zoomExtentMax") as HTMLInputElement | null)?.value ?? 20);

  setTranslateExtent(0, 0, width, height);
  setZoomExtent(zoomMin, zoomMax);

  Layers.draw("scaleBar");
  fitLegendBox();
}

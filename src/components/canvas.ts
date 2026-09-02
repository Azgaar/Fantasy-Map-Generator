// The map canvas: the fixed voronoi extent a map is generated on, and the resizable svg viewport
import { select } from "d3";
import { Layers } from "@/components/layers";
import { setTranslateExtent, setZoomExtent } from "@/components/zoom";
import { fitLegendBox } from "@/renderers/draw-legend";
import { rn } from "@/utils/numberUtils";

/** Adopt the configured graph size. Called on map creation only: the extent cannot change after it */
export function applyGraphSize(): void {
  graphWidth = options.graph.width;
  graphHeight = options.graph.height;

  const cover = (selector: string, child: string) =>
    select(selector).selectAll(child).attr("x", 0).attr("y", 0).attr("width", graphWidth).attr("height", graphHeight);

  cover("#landmass", "rect");
  cover("#oceanPattern", "rect");
  cover("#oceanLayers", "rect");
  cover("#fogging", "rect");
  select("#deftemp").select("mask#fog > rect").attr("width", graphWidth).attr("height", graphHeight);
  select("#deftemp").select("mask#water > rect").attr("width", graphWidth).attr("height", graphHeight);
}

/** Size the svg to the window and re-fit everything that is drawn in screen space */
export function fitMapToScreen(): void {
  svgWidth = Math.min(options.graph.width, window.innerWidth);
  svgHeight = Math.min(options.graph.height, window.innerHeight);
  select("#map").attr("width", svgWidth).attr("height", svgHeight);

  const zoomMin = rn(Math.max(svgWidth / graphWidth, svgHeight / graphHeight), 3);
  const zoomInput = document.getElementById("zoomExtentMin") as HTMLInputElement | null;
  if (zoomInput) zoomInput.value = String(zoomMin);
  const zoomMax = +((document.getElementById("zoomExtentMax") as HTMLInputElement | null)?.value ?? 20);

  setTranslateExtent(0, 0, graphWidth, graphHeight);
  setZoomExtent(zoomMin, zoomMax);

  Layers.draw("scaleBar");
  fitLegendBox();
}

// Legacy seam: the classic style scripts refit the map after a style change
declare global {
  // biome-ignore lint/suspicious/noRedeclare: legacy seam
  var applyGraphSize: () => void;
  // biome-ignore lint/suspicious/noRedeclare: legacy seam
  var fitMapToScreen: () => void;
}
window.applyGraphSize = applyGraphSize;
window.fitMapToScreen = fitMapToScreen;

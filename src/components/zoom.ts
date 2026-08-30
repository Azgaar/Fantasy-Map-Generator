import { type D3ZoomEvent, select, zoom, zoomIdentity } from "d3";
import { Layers } from "@/components/layers";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

const DEFAULT_SCALE_EXTENT: [number, number] = [1, 20];
const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent(DEFAULT_SCALE_EXTENT);

export function applyZoomBehavior(): void {
  select<SVGSVGElement, unknown>("#map").call(zoomBehavior.on("zoom", onZoom).on("end", handleZoomEnd));
}

let frameId: number | null = null;
let pendingScaleChange = false;
let pendingPositionChange = false;
let isViewChanged = false;

function onZoom(event: D3ZoomEvent<SVGSVGElement, unknown>): void {
  const { k, x, y } = event.transform;

  const isScaleChanged = scale !== k;
  const isPositionChanged = viewX !== x || viewY !== y;
  if (!isScaleChanged && !isPositionChanged) return;
  isViewChanged = true;

  scale = k;
  viewX = x;
  viewY = y;

  pendingScaleChange = pendingScaleChange || isScaleChanged;
  pendingPositionChange = pendingPositionChange || isPositionChanged;
  if (frameId !== null) return;

  frameId = requestAnimationFrame(() => {
    frameId = null;
    handleZoomPerFrame();
  });
}

/** Per-frame view tracking. Keep this cheap */
function handleZoomPerFrame(): void {
  const didScaleChange = pendingScaleChange;
  const didPositionChange = pendingPositionChange;
  pendingScaleChange = false;
  pendingPositionChange = false;
  if (!didScaleChange && !didPositionChange) return;

  ensureEl<SVGGElement>("viewbox").setAttribute("transform", `translate(${viewX} ${viewY}) scale(${scale})`);

  if (didScaleChange) {
    Layers.draw("scaleBar");

    if (options.labels.resizeOnZoom) applyLabelsZoomSize();
  }

  if (didPositionChange) Layers.draw("coordinates");

  window.updateMinimap?.();
  redrawTracedImage();
  ViewportLayers.schedule();
}

/** Rewrite map content once zoom gesture settles */
function handleZoomEnd(): void {
  if (!isViewChanged) return;
  isViewChanged = false;

  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
    handleZoomPerFrame();
  }

  invokeActiveZooming();
}

/** Mirror the map transform onto the heightmap tracing canvas */
function redrawTracedImage(): void {
  if (customization !== 1) return;
  const canvas = findEl<HTMLCanvasElement>("canvas");
  if (!canvas || canvas.style.opacity === "0") return;
  const image = findEl<HTMLImageElement>("imageToConvert");
  const context = image && canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, viewX, viewY);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
}

/** Rescale zoom-dependent map content to the settled scale. TODO: Legacy, to be reworked */
/** the #labels container font-size is zoom-derived; anything that rewrites the base
 * (preset apply, load) re-derives it here */
function applyLabelsZoomSize(): void {
  const fontSize = Math.max(Math.round(((100 + 100 / scale) / 2) * 100) / 100, 1);
  select("#labels").attr("font-size", `${fontSize}px`);
}

function invokeActiveZooming(): void {
  const isOptimized = ensureEl<HTMLSelectElement>("shapeRendering").value === "optimizeSpeed";

  if (options.labels.resizeOnZoom) applyLabelsZoomSize();
  ViewportLayers.renderNow();

  if (!customization && !isOptimized) {
    const statesHalo = select("#statesHalo");
    const desired = styles.states.statesHalo.options.width;
    const haloSize = rn(desired / scale ** 0.8, 2);
    statesHalo.attr("stroke-width", haloSize).style("display", haloSize > 0.1 ? "block" : "none");
  }

  if (styles.markers.options.rescale) {
    for (const marker of pack.markers ?? []) {
      const { i, x, y, size = 30, hidden } = marker;
      const element = hidden ? null : document.getElementById(`marker${i}`);
      if (!element) continue;

      const zoomedSize = Math.max(rn(size / 5 + 24 / scale, 2), 1);
      element.setAttribute("width", String(zoomedSize));
      element.setAttribute("height", String(zoomedSize));
      element.setAttribute("x", String(rn(x - zoomedSize / 2, 1)));
      element.setAttribute("y", String(rn(y - zoomedSize, 1)));
    }
  }
}

/** Zoom to a specific point */
function zoomTo(x: number, y: number, z = 8, duration = 2000): void {
  const transform = zoomIdentity.translate(x * -z + svgWidth / 2, y * -z + svgHeight / 2).scale(z);
  select<SVGSVGElement, unknown>("#map").transition().duration(duration).call(zoomBehavior.transform, transform);
}

/** Reset zoom to initial */
function resetZoom(duration = 1000): void {
  select<SVGSVGElement, unknown>("#map").transition().duration(duration).call(zoomBehavior.transform, zoomIdentity);
}

export function panMap(x: number, y: number): void {
  zoomBehavior.translateBy(select<SVGSVGElement, unknown>("#map"), x, y);
}

export function setMapZoom(value: number): void {
  zoomBehavior.scaleTo(select<SVGSVGElement, unknown>("#map"), value);
}

export function changeMapZoom(factor: number): void {
  zoomBehavior.scaleBy(select<SVGSVGElement, unknown>("#map"), factor);
}

export function setZoomExtent(min: number, max: number): void {
  zoomBehavior.scaleExtent([min, max]);
}

export function setTranslateExtent(x0: number, y0: number, x1: number, y1: number): void {
  zoomBehavior.translateExtent([
    [x0, y0],
    [x1, y1]
  ]);
}

// Bridges for classic public/ code. These take numbers only, never a selection: the behavior is
// d3 v7 while `public/` still speaks the global d3 v5, and the two must not meet.
window.zoomTo = zoomTo;
window.setZoomExtent = setZoomExtent;
window.setTranslateExtent = setTranslateExtent;
window.resetZoom = resetZoom;
window.invokeActiveZooming = invokeActiveZooming;
window.panMap = panMap;
window.setMapZoom = setMapZoom;
window.changeMapZoom = changeMapZoom;

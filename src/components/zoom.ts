import type { ZoomBehavior } from "d3";
import { renderGroupCOAs } from "@/renderers/draw-emblems";
import { drawScaleBar, fitScaleBar } from "@/renderers/draw-scalebar";
import { Layers } from "@/renderers/layers/layers";
import { coordinatesLayer } from "@/renderers/layers/map-layers";
import { ensureEl, findEl } from "@/utils/nodeUtils";
import { rn } from "@/utils/numberUtils";

// Legacy behaviour from the global d3 v5. TODO: completely migrate to d3v7
const DEFAULT_SCALE_EXTENT: [number, number] = [1, 20];
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;

function zoom(): ZoomBehavior<SVGSVGElement, unknown> {
  zoomBehavior ??= window.d3.zoom<SVGSVGElement, unknown>().scaleExtent(DEFAULT_SCALE_EXTENT);
  return zoomBehavior;
}

export function applyZoomBehavior(): void {
  svg.call(zoom().on("zoom", onZoom).on("end", handleZoomEnd));
}

let frameId: number | null = null;
let pendingScaleChange = false;
let pendingPositionChange = false;

function onZoom(): void {
  const transform = (window.d3 as any).event.transform;
  if (!transform) return;
  const { k, x, y } = transform as { k: number; x: number; y: number };

  const isScaleChanged = scale !== k;
  const isPositionChanged = viewX !== x || viewY !== y;
  if (!isScaleChanged && !isPositionChanged) return;

  scale = k;
  viewX = x;
  viewY = y;

  // Coalesce a burst of zoom events into one paint: the globals already hold the latest transform,
  // so keep OR-ing the change flags until the scheduled frame consumes them.
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

  viewbox.attr("transform", `translate(${viewX} ${viewY}) scale(${scale})`);
  window.updateMinimap?.();
  redrawTracedImage();
  ViewportLayers.schedule();

  if (didScaleChange) {
    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);

    if (options.labels.resizeOnZoom) {
      const fontSize = Math.max(Math.round(((100 + 100 / scale) / 2) * 100) / 100, 1);
      labels.attr("font-size", `${fontSize}px`);
    }
  }

  if (didPositionChange) {
    Layers.draw(coordinatesLayer);
  }
}

/** Rewrite map content once the gesture settles */
function handleZoomEnd(): void {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
    ViewportLayers.renderNow();
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
function invokeActiveZooming(): void {
  const isOptimized = ensureEl<HTMLSelectElement>("shapeRendering").value === "optimizeSpeed";

  if (emblems.style("display") !== "none") {
    const hideSmallEmblems = ensureEl<HTMLInputElement>("hideEmblems").checked;
    for (const group of emblems.selectAll<SVGGElement, unknown>("g").nodes()) {
      const size = Number(group.getAttribute("font-size")) * scale;
      const hidden = hideSmallEmblems && (size < 25 || size > 300);
      group.classList.toggle("hidden", hidden);
      const emblem = group.children[0];
      if (!hidden && window.COArenderer && emblem && !emblem.getAttribute("href")) renderGroupCOAs(group);
    }
  }

  if (!customization && !isOptimized) {
    const desired = Number(statesHalo.attr("data-width"));
    const haloSize = rn(desired / scale ** 0.8, 2);
    statesHalo.attr("stroke-width", haloSize).style("display", haloSize > 0.1 ? "block" : "none");
  }

  if (Number(markers.attr("rescale"))) {
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
  const transform = window.d3.zoomIdentity.translate(x * -z + svgWidth / 2, y * -z + svgHeight / 2).scale(z);
  svg.transition().duration(duration).call(zoom().transform, transform);
}

/** Reset zoom to initial */
function resetZoom(duration = 1000): void {
  svg.transition().duration(duration).call(zoom().transform, window.d3.zoomIdentity);
}

export function panMap(x: number, y: number): void {
  zoom().translateBy(svg, x, y);
}

export function setMapZoom(value: number): void {
  zoom().scaleTo(svg, value);
}

export function changeMapZoom(factor: number): void {
  zoom().scaleBy(svg, factor);
}

// consumed by legacy code; a getter so the lazy behavior is created on the first read
Object.defineProperty(window, "zoom", { get: zoom, configurable: true });
window.zoomTo = zoomTo;
window.resetZoom = resetZoom;
window.invokeActiveZooming = invokeActiveZooming;
window.panMap = panMap;
window.setMapZoom = setMapZoom;
window.changeMapZoom = changeMapZoom;

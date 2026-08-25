import { zoom as createZoom, select, type ZoomBehavior, type ZoomTransform, zoomIdentity } from "d3";
import { drawScaleBar, fitScaleBar } from "@/renderers/draw-scalebar";
import { syncPixiRendererCamera } from "@/renderers/pixi/pixi-renderer-controller";
import { findEl } from "@/utils/nodeUtils";
import { type ZoomChanges, ZoomSettler } from "./zoom-settler";

// One imported D3 v7 behavior owns the SVG input surface and publishes the same camera to Pixi.
const DEFAULT_SCALE_EXTENT: [number, number] = [1, 20];
let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;

function zoom(): ZoomBehavior<SVGSVGElement, unknown> {
  zoomBehavior ??= createZoom<SVGSVGElement, unknown>().scaleExtent(DEFAULT_SCALE_EXTENT);
  return zoomBehavior;
}

export function applyZoomBehavior(): void {
  // D3 v5 set this automatically; D3 v7 expects the app to opt out of browser touch gesture handling.
  select<SVGSVGElement, unknown>("#map")
    .style("touch-action", "none")
    .call(zoom().on("start", handleZoomStart).on("zoom", onZoom).on("end", handleZoomEnd));
}

let frameId: number | null = null;
let effectsFrameId: number | null = null;
let pendingScaleChange = false;
let pendingPositionChange = false;
let gestureScaleChanged = false;
let gesturePositionChanged = false;
const settler = new ZoomSettler(handleZoomSettled);

function handleZoomStart(): void {
  settler.cancel();
  if (effectsFrameId !== null) cancelAnimationFrame(effectsFrameId);
  effectsFrameId = null;
  gestureScaleChanged = false;
  gesturePositionChanged = false;
  select<SVGSVGElement, unknown>("#map").classed("map-zooming", true);
  ViewportLayers.suspend();
}

function onZoom(event: { transform: ZoomTransform }): void {
  const { k, x, y } = event.transform;

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
  gestureScaleChanged = gestureScaleChanged || isScaleChanged;
  gesturePositionChanged = gesturePositionChanged || isPositionChanged;
  if (frameId !== null) return;

  frameId = requestAnimationFrame(() => {
    frameId = null;
    handleZoomPerFrame();
  });
}

/** Per-frame view tracking. Keep this transform-only so Safari can stay on its paint path. */
function handleZoomPerFrame(): void {
  const didScaleChange = pendingScaleChange;
  const didPositionChange = pendingPositionChange;
  pendingScaleChange = false;
  pendingPositionChange = false;
  if (!didScaleChange && !didPositionChange) return;

  document.getElementById("viewbox")?.setAttribute("transform", `translate(${viewX} ${viewY}) scale(${scale})`);
  syncPixiRendererCamera();
  window.updateMinimap?.();
  redrawTracedImage();
  ViewportLayers.schedule();
}

/** Rewrite map content once the gesture settles */
function handleZoomEnd(): void {
  if (frameId !== null) {
    cancelAnimationFrame(frameId);
    frameId = null;
    handleZoomPerFrame();
  }

  settler.schedule({ scale: gestureScaleChanged, position: gesturePositionChanged });
}

function handleZoomSettled({ scale: didScaleChange, position: didPositionChange }: ZoomChanges): void {
  if (didScaleChange) {
    const scaleBar = select<SVGGElement, unknown>("#scaleBar");
    drawScaleBar(scaleBar, scale);
    fitScaleBar(scaleBar, svgWidth, svgHeight);
  }

  if ((didScaleChange || didPositionChange) && window.LayerControls.isLayerOn("toggleCoordinates"))
    window.LayerControls.redrawLayer("toggleCoordinates");

  ViewportLayers.resume();

  // Restore expensive paint effects only after all settled-state DOM updates are complete.
  effectsFrameId = requestAnimationFrame(() => {
    effectsFrameId = null;
    select<SVGSVGElement, unknown>("#map").classed("map-zooming", false);
  });
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

/** Zoom to a specific point */
function zoomTo(x: number, y: number, z = 8, duration = 2000): void {
  const transform = zoomIdentity.translate(x * -z + svgWidth / 2, y * -z + svgHeight / 2).scale(z);
  select<SVGSVGElement, unknown>("#map").transition().duration(duration).call(zoom().transform, transform);
}

/** Reset zoom to initial */
function resetZoom(duration = 1000): void {
  select<SVGSVGElement, unknown>("#map").transition().duration(duration).call(zoom().transform, zoomIdentity);
}

export function panMap(x: number, y: number): void {
  select<SVGSVGElement, unknown>("#map").call(zoom().translateBy, x, y);
}

export function setMapZoom(value: number): void {
  select<SVGSVGElement, unknown>("#map").call(zoom().scaleTo, value);
}

export function changeMapZoom(factor: number): void {
  select<SVGSVGElement, unknown>("#map").call(zoom().scaleBy, factor);
}

export function setMapZoomExtent(min: number, max: number, value?: number): void {
  zoom().scaleExtent([min, max]);
  if (value !== undefined) setMapZoom(value);
}

export function setMapTranslateExtent(extent: [[number, number], [number, number]]): void {
  zoom().translateExtent(extent);
}

window.zoomTo = zoomTo;
window.resetZoom = resetZoom;
window.panMap = panMap;
window.setMapZoom = setMapZoom;
window.changeMapZoom = changeMapZoom;
window.MapZoom = {
  setExtent: setMapZoomExtent,
  setTranslateExtent: setMapTranslateExtent
};

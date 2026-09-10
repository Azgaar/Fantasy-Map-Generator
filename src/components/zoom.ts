import { type D3ZoomEvent, select, zoom, zoomIdentity, zoomTransform } from "d3";
import { Layers } from "@/components/layers";
import { setViewportTransform, viewport } from "@/components/viewport";
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

  const isScaleChanged = viewport.scale !== k;
  const isPositionChanged = viewport.x !== x || viewport.y !== y;
  if (!isScaleChanged && !isPositionChanged) return;
  isViewChanged = true;

  setViewportTransform(k, x, y);

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

  ensureEl<SVGGElement>("viewbox").setAttribute(
    "transform",
    `translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`
  );

  if (didScaleChange) {
    Layers.draw("scaleBar");

    if (options.map.labels.resizeOnZoom) applyLabelsZoomSize();
  }

  if (didPositionChange) Layers.draw("coordinates");

  window.updateMinimap?.();
  redrawTracedImage();
  if (options.app.viewportRedraw === "continuous") ViewportLayers.schedule();
}

/** Rewrite map content once zoom gesture settles */
function handleZoomEnd(): void {
  // Labels and icons recalculate ONCE per gesture, here at its end - and only when the
  // transform actually changed. A pending frame is not a proxy for that: wheel gestures end
  // on d3's idle timeout, long after the last frame was painted, so the change is tracked
  // explicitly. Mid-gesture the materialized content just rides the viewbox transform;
  // per-frame reconciles re-ran materialization and the label-collision reflow pass on every
  // guard-band escape, making long zooms recalculate many times over. A plain click is a
  // zero-movement "gesture" too: rendering on its mouseup would churn the DOM between
  // mousedown and click dispatch and swallow the click.
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
  context.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.x, viewport.y);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function applyLabelsZoomSize(): void {
  const fontSize = Math.max(Math.round(((100 + 100 / viewport.scale) / 2) * 100) / 100, 1);
  select("#labels").attr("font-size", `${fontSize}px`);
}

export function invokeActiveZooming(): void {
  const isOptimized = ensureEl<HTMLSelectElement>("shapeRendering").value === "optimizeSpeed";

  if (options.map.labels.resizeOnZoom) applyLabelsZoomSize();
  ViewportLayers.renderNow();

  if (!customization && !isOptimized) {
    const statesHalo = select("#statesHalo");
    const desired = styles.states.statesHalo.options.width;
    const haloSize = rn(desired / viewport.scale ** 0.8, 2);
    statesHalo.attr("stroke-width", haloSize).style("display", haloSize > 0.1 ? "block" : "none");
  }
}

/** Zoom to a specific point */
export function zoomTo(x: number, y: number, z = 8, duration = 2000): void {
  const transform = zoomIdentity.translate(x * -z + viewport.width / 2, y * -z + viewport.height / 2).scale(z);
  select<SVGSVGElement, unknown>("#map").transition().duration(duration).call(zoomBehavior.transform, transform);
}

/** Reset zoom to the initial view: the map origin at the smallest scale the extents allow */
export function resetZoom(duration = 1000): void {
  const [min] = zoomBehavior.scaleExtent();
  const transform = zoomIdentity.scale(min);
  const selection = select<SVGSVGElement, unknown>("#map");

  if (duration) selection.transition().duration(duration).call(zoomBehavior.transform, transform);
  else zoomBehavior.transform(selection, transform); // no transition: the caller redraws right after
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

/**
 * Pull the current view back inside the extents. d3 applies them to gestures only, so a scale or a
 * translate that a new viewport or a new map has put out of bounds stays there until asked
 */
export function constrainZoom(): void {
  const node = findEl<SVGSVGElement>("map");
  if (!node || !("__zoom" in node)) return; // no zoom behavior on the element yet
  zoomBehavior.scaleTo(select<SVGSVGElement, unknown>(node), zoomTransform(node).k);
}

export function setTranslateExtent(x0: number, y0: number, x1: number, y1: number): void {
  zoomBehavior.translateExtent([
    [x0, y0],
    [x1, y1]
  ]);
}

type ZoomTo = typeof zoomTo;
type ResetZoom = typeof resetZoom;
type InvokeActiveZooming = typeof invokeActiveZooming;

declare global {
  // biome-ignore lint/suspicious/noRedeclare: the bridges registered just below
  var zoomTo: ZoomTo;
  // biome-ignore lint/suspicious/noRedeclare: the bridges registered just below
  var resetZoom: ResetZoom;
  // biome-ignore lint/suspicious/noRedeclare: the bridges registered just below
  var invokeActiveZooming: InvokeActiveZooming;
}

// Bridges for classic public/ code. These take numbers only, never a selection: the behavior is
// d3 v7 while `public/` still speaks the global d3 v5, and the two must not meet.
window.zoomTo = zoomTo;
window.setZoomExtent = setZoomExtent;
window.setTranslateExtent = setTranslateExtent;
window.resetZoom = resetZoom;
window.invokeActiveZooming = invokeActiveZooming;
window.setMapZoom = setMapZoom;

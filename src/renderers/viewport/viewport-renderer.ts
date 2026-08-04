export interface ViewportBounds {
  scale: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ViewportRenderContext {
  bounds: ViewportBounds;
  root: ParentNode;
  renderAll: boolean;
}

export interface ViewportLayer {
  id: string;
  scaleMin?: number | null;
  scaleMax?: number | null;
  enabled?: () => boolean;
  render: (context: ViewportRenderContext) => void;
}

interface ViewportState {
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewportRendererOptions {
  getViewport: () => ViewportState;
  getRoot?: () => ParentNode;
  overscanPixels?: number;
  guardPixels?: number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (id: number) => void;
}

const requestFrame = (callback: FrameRequestCallback) =>
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame(callback)
    : (setTimeout(() => callback(performance.now()), 0) as unknown as number);
const cancelFrame = (id: number) =>
  typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id);

export class ViewportRenderer {
  private layers = new Map<string, ViewportLayer>();
  private frameId: number | null = null;
  private pending: ViewportRenderContext | null = null;
  private materializedBounds: ViewportBounds | null = null;
  private getRoot: () => ParentNode;
  private overscanPixels: number;
  private guardPixels: number;
  private requestFrame: (callback: FrameRequestCallback) => number;
  private cancelFrame: (id: number) => void;

  constructor(private options: ViewportRendererOptions) {
    this.getRoot = options.getRoot || (() => document);
    this.overscanPixels = options.overscanPixels ?? 40;
    this.guardPixels = options.guardPixels ?? 20;
    this.requestFrame = options.requestFrame || requestFrame;
    this.cancelFrame = options.cancelFrame || cancelFrame;
  }

  register(layer: ViewportLayer): () => void {
    this.layers.set(layer.id, layer);
    return () => {
      if (this.layers.get(layer.id) === layer) this.layers.delete(layer.id);
    };
  }

  schedule(): void {
    const visible = this.getBounds(0);
    if (!shouldReconcileViewport(this.materializedBounds, visible, this.guardPixels)) return;
    const bounds = this.getBounds(this.overscanPixels);
    this.materializedBounds = bounds;
    this.scheduleContext({ root: this.getRoot(), bounds, renderAll: false });
  }

  renderNow(): void {
    const bounds = this.getBounds(this.overscanPixels);
    this.materializedBounds = bounds;
    this.renderContext({ root: this.getRoot(), bounds, renderAll: false });
  }

  renderAll(root: ParentNode): void {
    const bounds = { scale: 1, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
    this.renderContext({ root, bounds, renderAll: true });
  }

  private scheduleContext(context: ViewportRenderContext): void {
    this.pending = context;
    if (this.frameId !== null) return;
    this.frameId = this.requestFrame(() => {
      this.frameId = null;
      const pending = this.pending;
      this.pending = null;
      if (pending) this.renderContext(pending);
    });
  }

  private renderContext(context: ViewportRenderContext): void {
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
    this.pending = null;
    for (const layer of this.layers.values()) {
      if (!context.renderAll && !isLayerVisible(layer, context.bounds.scale)) continue;
      layer.render(context);
    }
  }

  private getBounds(paddingPixels: number): ViewportBounds {
    const { scale, x, y, width, height } = this.options.getViewport();
    return getViewportBounds({ scale, x, y }, { width, height }, paddingPixels);
  }
}

export const viewportLayers = new ViewportRenderer({
  getViewport: () => ({ scale, x: viewX, y: viewY, width: svgWidth, height: svgHeight })
});

export function updateViewportLayers(): void {
  viewportLayers.schedule();
}

export function renderViewportLayersNow(): void {
  viewportLayers.renderNow();
}

export function getViewportBounds(
  transform: { scale: number; x: number; y: number },
  size: { width: number; height: number },
  paddingPixels = 80
): ViewportBounds {
  const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
  const padding = paddingPixels / scale;
  return {
    scale,
    x0: -transform.x / scale - padding,
    y0: -transform.y / scale - padding,
    x1: (size.width - transform.x) / scale + padding,
    y1: (size.height - transform.y) / scale + padding
  };
}

export function containsPoint(bounds: ViewportBounds, [x, y]: readonly [number, number]): boolean {
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

export function shouldReconcileViewport(
  materialized: ViewportBounds | null,
  visible: ViewportBounds,
  guardPixels = 40
): boolean {
  if (!materialized) return true;
  const guard = guardPixels / visible.scale;
  return (
    visible.x0 < materialized.x0 + guard ||
    visible.y0 < materialized.y0 + guard ||
    visible.x1 > materialized.x1 - guard ||
    visible.y1 > materialized.y1 - guard
  );
}

function isLayerVisible(layer: ViewportLayer, scale: number): boolean {
  if (layer.enabled && !layer.enabled()) return false;
  if (layer.scaleMin != null && scale < layer.scaleMin) return false;
  if (layer.scaleMax != null && scale > layer.scaleMax) return false;
  return true;
}

window.updateViewportLayers = updateViewportLayers;
window.renderViewportLayersNow = renderViewportLayersNow;

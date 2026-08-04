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

interface ViewportLayerEntry {
  id: string;
  scaleMin?: number | null;
  scaleMax?: number | null;
  enabled?: () => boolean;
  render: (context: ViewportRenderContext) => void;
}

export class ViewportRenderer {
  private entries = new Map<string, ViewportLayerEntry>();
  private frameId: number | null = null;
  private pending: ViewportRenderContext | null = null;

  constructor(
    private requestFrame = (callback: FrameRequestCallback) =>
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(callback)
        : (setTimeout(() => callback(performance.now()), 0) as unknown as number),
    private cancelFrame = (id: number) =>
      typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id)
  ) {}

  register(entry: ViewportLayerEntry): void {
    this.entries.set(entry.id, entry);
  }

  unregister(id: string): void {
    this.entries.delete(id);
  }

  clear(prefix?: string): void {
    if (!prefix) return void this.entries.clear();
    for (const id of this.entries.keys()) if (id.startsWith(prefix)) this.entries.delete(id);
  }

  schedule(context: ViewportRenderContext): void {
    this.pending = context;
    if (this.frameId !== null) return;
    this.frameId = this.requestFrame(() => {
      this.frameId = null;
      const pending = this.pending;
      this.pending = null;
      if (pending) this.renderNow(pending);
    });
  }

  renderNow(context: ViewportRenderContext): void {
    if (this.frameId !== null) this.cancelFrame(this.frameId);
    this.frameId = null;
    this.pending = null;
    for (const entry of this.entries.values()) {
      if (!context.renderAll && !isEntryVisible(entry, context.bounds.scale)) continue;
      entry.render(context);
    }
  }

  renderAll(root: ParentNode, bounds: ViewportBounds): void {
    this.renderNow({ root, bounds, renderAll: true });
  }
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

function isEntryVisible(entry: ViewportLayerEntry, scale: number): boolean {
  if (entry.enabled && !entry.enabled()) return false;
  if (entry.scaleMin != null && scale < entry.scaleMin) return false;
  if (entry.scaleMax != null && scale > entry.scaleMax) return false;
  return true;
}

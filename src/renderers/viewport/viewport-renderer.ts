interface ViewportLayerHandle {
  render: () => void;
  invalidate: () => void;
  clear: () => void;
  unregister: () => void;
}

export interface ViewportRenderContext {
  bounds: ViewportBounds;
  root: ParentNode;
}

interface ViewportLayer {
  id: string;
  render: (context: ViewportRenderContext) => void;
  clear?: () => void;
}

export interface ViewportBounds {
  scale: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A compact bucket index for large, immutable viewport draw lists. */
export class SpatialIndex<T> {
  private readonly buckets = new Map<number, Map<number, number[]>>();
  private items: T[] = [];
  valid = false;

  constructor(private readonly bucketSize = 64) {}

  replace(items: Iterable<T>, getPoint: (item: T) => readonly [number, number] | null): void {
    this.clear();
    for (const item of items) {
      const point = getPoint(item);
      if (!point) continue;

      const itemIndex = this.items.push(item) - 1;
      const columnId = Math.floor(point[0] / this.bucketSize);
      const rowId = Math.floor(point[1] / this.bucketSize);
      let column = this.buckets.get(columnId);
      if (!column) {
        column = new Map();
        this.buckets.set(columnId, column);
      }
      let bucket = column.get(rowId);
      if (!bucket) {
        bucket = [];
        column.set(rowId, bucket);
      }
      bucket.push(itemIndex);
    }
    this.valid = true;
  }

  *values(bounds?: ViewportBounds): IterableIterator<T> {
    if (!bounds || !Number.isFinite(bounds.x0 + bounds.y0 + bounds.x1 + bounds.y1)) {
      yield* this.items;
      return;
    }

    const column0 = Math.floor(bounds.x0 / this.bucketSize);
    const column1 = Math.floor(bounds.x1 / this.bucketSize);
    const row0 = Math.floor(bounds.y0 / this.bucketSize);
    const row1 = Math.floor(bounds.y1 / this.bucketSize);
    const itemIndexes: number[] = [];
    for (let columnId = column0; columnId <= column1; columnId++) {
      const column = this.buckets.get(columnId);
      if (!column) continue;
      for (let rowId = row0; rowId <= row1; rowId++) {
        const bucket = column.get(rowId);
        if (bucket) for (const itemIndex of bucket) itemIndexes.push(itemIndex);
      }
    }
    itemIndexes.sort((a, b) => a - b);
    for (const itemIndex of itemIndexes) yield this.items[itemIndex];
  }

  clear(): void {
    this.buckets.clear();
    this.items = [];
    this.valid = false;
  }
}

export class ViewportRenderer {
  private layers = new Map<string, ViewportLayer>();
  private dirtyLayers = new Set<string>();
  private frameId: number | null = null;
  private pending: ViewportRenderContext | null = null;
  private pendingForceAll = false;
  private materializedBounds: ViewportBounds | null = null;
  private suspended = false;

  constructor(
    private readonly options: {
      getViewport: () => {
        scale: number;
        x: number;
        y: number;
        width: number;
        height: number;
      };
      overscanPixels: number;
      guardPixels: number;
    }
  ) {}

  register(layer: ViewportLayer): ViewportLayerHandle {
    this.layers.set(layer.id, layer);
    return {
      render: () => {
        if (this.layers.get(layer.id) === layer) layer.render(this.getLiveContext());
      },
      invalidate: () => {
        if (this.layers.get(layer.id) !== layer) return;
        this.dirtyLayers.add(layer.id);
        this.schedule();
      },
      clear: () => {
        if (this.layers.get(layer.id) !== layer) return;
        this.dirtyLayers.delete(layer.id);
        layer.clear?.();
      },
      unregister: () => {
        if (this.layers.get(layer.id) === layer) {
          this.layers.delete(layer.id);
          this.dirtyLayers.delete(layer.id);
        }
      }
    };
  }

  invalidateAll(): void {
    for (const id of this.layers.keys()) this.dirtyLayers.add(id);
    this.schedule();
  }

  /** Keep the currently materialized SVG stable while its parent is being transformed. */
  suspend(): void {
    this.suspended = true;
    this.cancelScheduledRender();
  }

  /** Reconcile only viewport layers that need updating after an interaction has settled. */
  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.schedule();
  }

  clearAll(): void {
    this.cancelScheduledRender();
    this.suspended = false;
    this.materializedBounds = null;
    this.dirtyLayers.clear();
    for (const layer of this.layers.values()) layer.clear?.();
  }

  schedule(): void {
    if (this.suspended) return;
    const needsViewportReconcile = this.shouldReconcile();
    if (!needsViewportReconcile && !this.dirtyLayers.size) return;
    const context = this.getLiveContext();
    this.scheduleContext(context, needsViewportReconcile);
  }

  renderNow(): void {
    const context = this.getLiveContext();
    this.materializedBounds = context.bounds;
    this.cancelScheduledRender();
    this.renderLayers(context, true);
  }

  renderTo(root: ParentNode): void {
    const bounds = { scale: 1, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
    this.renderLayers({ root, bounds }, true);
  }

  getContext(): ViewportRenderContext {
    return this.getLiveContext();
  }

  getVisibleBounds(): ViewportBounds {
    return this.getBounds(0);
  }

  private getBounds(paddingPixels: number): ViewportBounds {
    const { scale, x, y, width, height } = this.options.getViewport();
    const padding = paddingPixels / scale;
    return {
      scale,
      x0: -x / scale - padding,
      y0: -y / scale - padding,
      x1: (width - x) / scale + padding,
      y1: (height - y) / scale + padding
    };
  }

  private shouldReconcile(): boolean {
    if (!this.materializedBounds) return true;
    const bounds = this.getBounds(0);
    const guard = this.options.guardPixels / bounds.scale;
    return (
      bounds.scale - this.materializedBounds.scale > 1 ||
      bounds.x0 < this.materializedBounds.x0 + guard ||
      bounds.y0 < this.materializedBounds.y0 + guard ||
      bounds.x1 > this.materializedBounds.x1 - guard ||
      bounds.y1 > this.materializedBounds.y1 - guard
    );
  }

  private scheduleContext(context: ViewportRenderContext, forceAll: boolean): void {
    this.pending = context;
    this.pendingForceAll ||= forceAll;
    if (this.frameId !== null) return;
    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      const pending = this.pending;
      const pendingForceAll = this.pendingForceAll;
      this.pending = null;
      this.pendingForceAll = false;
      if (pending) {
        if (pendingForceAll) this.materializedBounds = pending.bounds;
        this.renderLayers(pending, pendingForceAll);
      }
    });
  }

  private getLiveContext(): ViewportRenderContext {
    return { root: document, bounds: this.getBounds(this.options.overscanPixels) };
  }

  private cancelScheduledRender(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.pending = null;
    this.pendingForceAll = false;
  }

  private renderLayers(context: ViewportRenderContext, forceAll: boolean): void {
    const dirtyLayers = forceAll ? null : new Set(this.dirtyLayers);
    this.dirtyLayers.clear();
    for (const layer of this.layers.values()) {
      if (dirtyLayers && !dirtyLayers.has(layer.id)) continue;
      layer.render(context);
    }
  }
}

const OVERSCAN_PIXELS = 80;
const GUARD_PIXELS = OVERSCAN_PIXELS / 2;

export const ViewportLayers = new ViewportRenderer({
  getViewport: () => ({ scale, x: viewX, y: viewY, width: svgWidth, height: svgHeight }),
  overscanPixels: OVERSCAN_PIXELS,
  guardPixels: GUARD_PIXELS
});

declare global {
  // biome-ignore lint/suspicious/noRedeclare: legacy seam
  var ViewportLayers: ViewportRenderer;
}

window.ViewportLayers = ViewportLayers;

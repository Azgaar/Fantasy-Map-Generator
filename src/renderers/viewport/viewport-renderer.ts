interface ViewportBounds {
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

interface ViewportLayer {
  id: string;
  scaleMin?: number | null;
  scaleMax?: number | null;
  enabled?: () => boolean;
  render: (context: ViewportRenderContext) => void;
}

export interface SceneItem {
  id: string;
}

export class Scene<T extends SceneItem> {
  private items = new Map<string, T>();
  private pinned = new Set<string>();
  valid = false;

  replace(items: T[]): void {
    this.items = new Map(items.map(item => [item.id, item]));
    this.pinned = new Set([...this.pinned].filter(id => this.items.has(id)));
    this.valid = true;
  }

  replaceWhere(match: (item: T) => boolean, replacements: T[]): string[] {
    const next = new Map(replacements.map(item => [item.id, item]));
    const changed = new Set<string>();

    for (const [id, item] of this.items) {
      if (!match(item)) continue;
      changed.add(id);
      const replacement = next.get(id);
      if (replacement) {
        this.items.set(id, replacement);
        next.delete(id);
      } else {
        this.items.delete(id);
        this.pinned.delete(id);
      }
    }

    for (const [id, item] of next) {
      changed.add(id);
      this.items.set(id, item);
    }

    this.valid = true;
    return [...changed];
  }

  remove(id: string): void {
    this.items.delete(id);
    this.pinned.delete(id);
  }

  invalidate(): void {
    this.items.clear();
    this.pinned.clear();
    this.valid = false;
  }

  pin(id: string): void {
    this.pinned.add(id);
  }

  unpin(id: string): void {
    this.pinned.delete(id);
  }

  isPinned(id: string): boolean {
    return this.pinned.has(id);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  values(): IterableIterator<T> {
    return this.items.values();
  }
}

export class ViewportRenderer {
  private layers = new Map<string, ViewportLayer>();
  private frameId: number | null = null;
  private pending: ViewportRenderContext | null = null;
  private materializedBounds: ViewportBounds | null = null;

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

  register(layer: ViewportLayer): () => void {
    this.layers.set(layer.id, layer);
    return () => {
      if (this.layers.get(layer.id) === layer) this.layers.delete(layer.id);
    };
  }

  schedule(): void {
    const bounds = this.getBounds();
    if (!this.shouldReconcileViewport(bounds)) return;
    this.materializedBounds = bounds;
    this.scheduleContext({ root: document, bounds, renderAll: false });
  }

  private getBounds(): ViewportBounds {
    const { scale, x, y, width, height } = this.options.getViewport();
    const padding = this.options.overscanPixels / scale;
    return {
      scale,
      x0: -x / scale - padding,
      y0: -y / scale - padding,
      x1: (width - x) / scale + padding,
      y1: (height - y) / scale + padding
    };
  }

  private shouldReconcileViewport(bounds: ViewportBounds): boolean {
    if (!this.materializedBounds) return true;
    const guard = this.options.guardPixels / bounds.scale;
    return (
      bounds.x0 < this.materializedBounds.x0 + guard ||
      bounds.y0 < this.materializedBounds.y0 + guard ||
      bounds.x1 > this.materializedBounds.x1 - guard ||
      bounds.y1 > this.materializedBounds.y1 - guard
    );
  }

  private scheduleContext(context: ViewportRenderContext): void {
    this.pending = context;
    if (this.frameId !== null) return;
    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      const pending = this.pending;
      this.pending = null;
      if (pending) this.renderContext(pending);
    });
  }

  renderNow(): void {
    const bounds = this.getBounds();
    this.materializedBounds = bounds;
    this.renderContext({ root: document, bounds, renderAll: false });
  }

  renderAll(root: ParentNode): void {
    const bounds = { scale: 1, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
    this.renderContext({ root, bounds, renderAll: true });
  }

  private renderContext(context: ViewportRenderContext): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.pending = null;
    for (const layer of this.layers.values()) {
      if (!context.renderAll && !this.isLayerVisible(layer, context.bounds.scale)) continue;
      layer.render(context);
    }
  }

  private isLayerVisible(layer: ViewportLayer, scale: number): boolean {
    if (layer.enabled && !layer.enabled()) return false;
    if (layer.scaleMin != null && scale < layer.scaleMin) return false;
    if (layer.scaleMax != null && scale > layer.scaleMax) return false;
    return true;
  }
}

const OVERSCAN_PIXELS = 40;
const GUARD_PIXELS = 20;

export const viewportLayers = new ViewportRenderer({
  getViewport: () => ({ scale, x: viewX, y: viewY, width: svgWidth, height: svgHeight }),
  overscanPixels: OVERSCAN_PIXELS,
  guardPixels: GUARD_PIXELS
});

export function containsPoint(bounds: ViewportBounds, [x, y]: readonly [number, number]): boolean {
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

window.updateViewportLayers = () => viewportLayers.schedule();
window.renderViewportLayersNow = () => viewportLayers.renderNow();

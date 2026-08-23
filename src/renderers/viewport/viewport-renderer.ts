interface ViewportLayerHandle {
  render: () => void;
  unregister: () => void;
}

export interface ViewportRenderContext {
  bounds: ViewportBounds;
  root: ParentNode;
}

interface ViewportLayer {
  id: string;
  render: (context: ViewportRenderContext) => void;
}

interface ViewportBounds {
  scale: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export class Scene<T extends { id: string }> {
  private items = new Map<string, T>();
  valid = false;

  replace(items: T[]): void {
    this.items = new Map(items.map(item => [item.id, item]));
    this.valid = true;
  }

  set(item: T): void {
    this.items.set(item.id, item);
  }

  remove(id: string): void {
    this.items.delete(id);
  }

  invalidate(): void {
    this.items.clear();
    this.valid = false;
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

  register(layer: ViewportLayer): ViewportLayerHandle {
    this.layers.set(layer.id, layer);
    return {
      render: () => {
        if (this.layers.get(layer.id) === layer) layer.render(this.getLiveContext());
      },
      unregister: () => {
        if (this.layers.get(layer.id) === layer) this.layers.delete(layer.id);
      }
    };
  }

  schedule(): void {
    if (!this.shouldReconcile()) return;
    const context = this.getLiveContext();
    this.materializedBounds = context.bounds;
    this.scheduleContext(context);
  }

  renderNow(): void {
    const context = this.getLiveContext();
    this.materializedBounds = context.bounds;
    this.cancelScheduledRender();
    this.renderLayers(context);
  }

  renderTo(root: ParentNode): void {
    const bounds = { scale: 1, x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
    this.renderLayers({ root, bounds });
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

  private scheduleContext(context: ViewportRenderContext): void {
    this.pending = context;
    if (this.frameId !== null) return;
    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      const pending = this.pending;
      this.pending = null;
      if (pending) this.renderLayers(pending);
    });
  }

  private getLiveContext(): ViewportRenderContext {
    return { root: document, bounds: this.getBounds(this.options.overscanPixels) };
  }

  private cancelScheduledRender(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.pending = null;
  }

  private renderLayers(context: ViewportRenderContext): void {
    for (const layer of this.layers.values()) {
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

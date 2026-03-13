import type { WebGLLayerConfig } from "./webgl-layer.ts";

export interface Layer {
  readonly id: string;
  readonly kind: "svg" | "webgl";
  readonly surface: Element | null;
  mount(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

export class SvgLayer implements Layer {
  readonly kind = "svg" as const;
  readonly surface: Element;

  constructor(
    readonly id: string,
    surface: Element,
  ) {
    this.surface = surface;
  }

  mount() {}

  setVisible(visible: boolean) {
    (this.surface as HTMLElement).style.display = visible ? "" : "none";
  }

  dispose() {
    this.surface.remove();
  }
}

export class WebGLSurfaceLayer implements Layer {
  readonly kind = "webgl" as const;
  readonly surface = null;
  private mounted = false;

  constructor(
    readonly id: string,
    private readonly config: WebGLLayerConfig,
  ) {}

  mount() {
    if (this.mounted) return;
    WebGLLayer.register(this.config);
    this.mounted = true;
  }

  setVisible(visible: boolean) {
    WebGLLayer.setLayerVisible(this.id, visible);
  }

  dispose() {
    WebGLLayer.unregister(this.id);
    this.mounted = false;
  }
}

import { Group, OrthographicCamera, Scene, WebGLRenderer } from "three";

/**
 * Converts a D3 zoom transform into orthographic camera bounds.
 *
 * D3 applies: screen = map * scale + (viewX, viewY)
 * Inverting:  map = (screen - (viewX, viewY)) / scale
 *
 * Orthographic bounds (visible map region at current zoom/pan):
 *   left   = -viewX / scale
 *   right  = (graphWidth  - viewX) / scale
 *   top    = -viewY / scale
 *   bottom = (graphHeight - viewY) / scale
 *
 * top < bottom: Y-down matches SVG; origin at top-left of map.
 * Do NOT swap top/bottom or negate — this is correct Three.js Y-down config.
 */
export function buildCameraBounds(
  viewX: number,
  viewY: number,
  scale: number,
  graphWidth: number,
  graphHeight: number,
): { left: number; right: number; top: number; bottom: number } {
  return {
    left: (0 - viewX) / scale,
    right: (graphWidth - viewX) / scale,
    top: (0 - viewY) / scale,
    bottom: (graphHeight - viewY) / scale,
  };
}

/**
 * Detects WebGL2 support by probing canvas.getContext("webgl2").
 * Accepts an optional injectable probe canvas for testability (avoids DOM access in tests).
 * Immediately releases the probed context via WEBGL_lose_context if available.
 */
export function detectWebGL2(probe?: HTMLCanvasElement): boolean {
  const canvas = probe ?? document.createElement("canvas");
  const ctx = canvas.getContext("webgl2");
  if (!ctx) return false;
  const ext = ctx.getExtension("WEBGL_lose_context");
  ext?.loseContext();
  return true;
}

/**
 * Returns the CSS z-index for a canvas layer anchored to the given SVG element id.
 * Phase 2 forward-compatible: derives index from DOM sibling position (+1 offset).
 * Falls back to 2 (above #map SVG at z-index 1) when element is absent or document
 * is unavailable (e.g. Node.js test environment).
 *
 * MVP note: #terrain is a <g> inside <svg#map>, not a sibling of #map-container,
 * so this always resolves to the fallback 2 in MVP. Phase 2 (DOM-split) will give
 * true per-layer interleaving values automatically.
 */
export function getLayerZIndex(anchorLayerId: string): number {
  if (typeof document === "undefined") return 2;
  const anchor = document.getElementById(anchorLayerId);
  if (!anchor) return 2;
  const siblings = Array.from(anchor.parentElement?.children ?? []);
  const idx = siblings.indexOf(anchor);
  // +1 so Phase 2 callers get a correct interleaving value automatically
  return idx > 0 ? idx + 1 : 2;
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface WebGLLayerConfig {
  id: string;
  anchorLayerId: string; // SVG <g> id; canvas id derived as `${id}Canvas`
  renderOrder: number; // Three.js renderOrder for this layer's Group
  setup: (group: Group) => void; // called once after WebGL2 confirmed; add meshes to group
  render: (group: Group) => void; // called each frame before renderer.render(); update uniforms/geometry
  dispose: (group: Group) => void; // called on unregister(); dispose all GPU objects in group
}

// Not exported — internal framework bookkeeping only
interface RegisteredLayer {
  config: WebGLLayerConfig;
  group: Group; // framework-owned; passed to all callbacks — abstraction boundary
}

export class WebGL2LayerFrameworkClass {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: WebGLRenderer | null = null;
  private camera: OrthographicCamera | null = null;
  private scene: Scene | null = null;
  private layers: Map<string, RegisteredLayer> = new Map();
  private pendingConfigs: WebGLLayerConfig[] = []; // queue for register() before init()
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private container: HTMLElement | null = null;

  init(): boolean {
    const mapEl = document.getElementById("map");
    if (!mapEl) throw new Error("Map element not found");

    const container = document.createElement("div");
    container.id = "map-container";
    container.style.position = "relative";
    mapEl.parentElement!.insertBefore(container, mapEl);
    container.appendChild(mapEl);
    this.container = container;

    const canvas = document.createElement("canvas");
    canvas.id = "terrainCanvas";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.pointerEvents = "none";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.zIndex = String(getLayerZIndex("terrain"));
    canvas.width = mapEl.clientWidth || 960;
    canvas.height = mapEl.clientHeight || 540;
    container.appendChild(canvas);
    this.canvas = canvas;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(0, graphWidth, 0, graphHeight, -1, 1);

    this.subscribeD3Zoom();

    // Process pre-init registrations (register() before init() is explicitly safe)
    for (const config of this.pendingConfigs) {
      const group = new Group();
      group.renderOrder = config.renderOrder;
      config.setup(group);
      this.scene.add(group);
      this.layers.set(config.id, { config, group });
    }
    this.pendingConfigs = [];
    this.observeResize();

    return true;
  }

  register(config: WebGLLayerConfig): void {
    if (!this.scene) {
      // init() has not been called yet — queue for processing in init()
      this.pendingConfigs.push(config);
      return;
    }
    // Post-init registration: create group immediately
    const group = new Group();
    group.renderOrder = config.renderOrder;
    config.setup(group);
    this.scene.add(group);
    this.layers.set(config.id, { config, group });
  }

  unregister(id: string): void {
    const layer = this.layers.get(id);
    if (!layer || !this.scene) return;
    const scene = this.scene;
    layer.config.dispose(layer.group);
    scene.remove(layer.group);
    this.layers.delete(id);
    const anyVisible = [...this.layers.values()].some((l) => l.group.visible);
    if (this.canvas && !anyVisible) this.canvas.style.display = "none";
  }

  setVisible(id: string, visible: boolean): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.group.visible = visible;
    const anyVisible = [...this.layers.values()].some((l) => l.group.visible);
    if (this.canvas) this.canvas.style.display = anyVisible ? "block" : "none";
    if (visible) this.requestRender();
  }

  clearLayer(id: string): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.group.clear();
    this.requestRender();
  }

  requestRender(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  syncTransform(): void {
    if (!this.camera) return;
    const bounds = buildCameraBounds(
      viewX,
      viewY,
      scale,
      graphWidth,
      graphHeight,
    );
    this.camera.left = bounds.left;
    this.camera.right = bounds.right;
    this.camera.top = bounds.top;
    this.camera.bottom = bounds.bottom;
    this.camera.updateProjectionMatrix();
  }

  private subscribeD3Zoom(): void {
    viewbox.on("zoom.webgl", () => this.requestRender());
  }

  private observeResize(): void {
    if (!this.container || !this.renderer) return;
    const mapEl = this.container.querySelector("#map") ?? this.container;
    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (this.renderer && this.canvas && width > 0 && height > 0) {
        // updateStyle=false — CSS inset:0 handles canvas positioning.
        this.renderer.setSize(width, height, false);
        this.requestRender();
      }
    });
    this.resizeObserver.observe(mapEl);
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.syncTransform();
    for (const layer of this.layers.values()) {
      if (layer.group.visible) layer.config.render(layer.group);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

declare global {
  var WebGL2LayerFramework: WebGL2LayerFrameworkClass;
}

window.WebGL2LayerFramework = new WebGL2LayerFrameworkClass();

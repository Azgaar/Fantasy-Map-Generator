import { Group, OrthographicCamera, Scene, WebGLRenderer } from "three";

// ─── Pure exports (testable without DOM or WebGL) ────────────────────────────

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

// ─── Class ───────────────────────────────────────────────────────────────────

export class WebGL2LayerFrameworkClass {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: WebGLRenderer | null = null;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: assigned in init(); read in Story 1.3 render() + syncTransform()
  private camera: OrthographicCamera | null = null;
  private scene: Scene | null = null;
  private layers: Map<string, RegisteredLayer> = new Map();
  private pendingConfigs: WebGLLayerConfig[] = []; // queue for register() before init()
  private resizeObserver: ResizeObserver | null = null;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: read/written in Story 1.3 requestRender()
  private rafId: number | null = null;
  private container: HTMLElement | null = null;

  // Backing field — MUST NOT be declared readonly.
  // readonly fields can only be assigned in the constructor; init() sets _fallback
  // post-construction, which would cause a TypeScript type error with readonly.
  private _fallback = false;

  get hasFallback(): boolean {
    return this._fallback;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  init(): boolean {
    this._fallback = !detectWebGL2();
    if (this._fallback) return false;

    const mapEl = document.getElementById("map");
    if (!mapEl) {
      console.warn(
        "WebGL2LayerFramework: #map element not found — init() aborted",
      );
      return false;
    }

    // Wrap #map in a positioned container so the canvas can be a sibling with z-index
    const container = document.createElement("div");
    container.id = "map-container";
    container.style.position = "relative";
    mapEl.parentElement!.insertBefore(container, mapEl);
    container.appendChild(mapEl);
    this.container = container;

    // Canvas: sibling to #map, pointerless, z-index above SVG (AC1)
    const canvas = document.createElement("canvas");
    canvas.id = "terrainCanvas";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.pointerEvents = "none";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.zIndex = String(getLayerZIndex("terrain"));
    canvas.width = container.clientWidth || 960;
    canvas.height = container.clientHeight || 540;
    container.appendChild(canvas);
    this.canvas = canvas;

    // Three.js core objects (AC4)
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.scene = new Scene();
    this.camera = new OrthographicCamera(
      0,
      canvas.width,
      0,
      canvas.height,
      -1,
      1,
    );

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

  unregister(_id: string): void {
    // Story 1.3: call config.dispose(group); remove from layers Map; cleanup canvas if empty.
  }

  setVisible(_id: string, _visible: boolean): void {
    // Story 1.3: toggle group.visible; hide canvas only when ALL layers invisible (NFR-P6).
  }

  clearLayer(_id: string): void {
    // Story 1.3: group.clear() — wipes Mesh children without disposing renderer (NFR-P6).
  }

  requestRender(): void {
    // Story 1.3: RAF-coalesced render request; schedules this.render() via requestAnimationFrame.
    this.render();
  }

  syncTransform(): void {
    // Story 1.3: read window globals viewX/viewY/scale; apply buildCameraBounds to camera.
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private subscribeD3Zoom(): void {
    // viewbox is a D3 selection global available in the browser; guard for Node test env
    if (typeof (globalThis as any).viewbox === "undefined") return;
    (globalThis as any).viewbox.on("zoom.webgl", () => this.requestRender());
  }

  private observeResize(): void {
    if (!this.container || !this.renderer) return;
    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (this.renderer && this.canvas) {
        this.renderer.setSize(width, height);
        this.requestRender();
      }
    });
    this.resizeObserver.observe(this.container);
  }

  private render(): void {
    // Story 1.3: syncTransform → per-layer render(group) callbacks → renderer.render(scene, camera).
  }
}

// ─── Global registration (MUST be last line) ─────────────────────────────────
// Uses globalThis (≡ window in browsers) to support both browser runtime and
// Node.js test environments without a ReferenceError.
declare global {
  var WebGL2LayerFramework: WebGL2LayerFrameworkClass;
}
globalThis.WebGL2LayerFramework = new WebGL2LayerFrameworkClass();

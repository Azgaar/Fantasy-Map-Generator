import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCameraBounds,
  detectWebGL2,
  getLayerZIndex,
  WebGL2LayerFrameworkClass,
} from "./webgl-layer-framework";

// Three.js constructors are mocked so that Node-env init() tests work without
// a real WebGL context. These stubs only affect class-level tests that call
// init(); Story 1.1 pure-function tests never invoke Three.js constructors.
vi.mock("three", () => {
  // Must use regular `function` (not arrow) so vi.fn() can be called with `new`.
  const Group = vi.fn().mockImplementation(function (this: any) {
    this.renderOrder = 0;
    this.visible = true;
    this.clear = vi.fn();
  });
  const WebGLRenderer = vi.fn().mockImplementation(function (this: any) {
    this.setSize = vi.fn();
    this.render = vi.fn();
  });
  const Scene = vi.fn().mockImplementation(function (this: any) {
    this.add = vi.fn();
  });
  const OrthographicCamera = vi.fn().mockImplementation(function (this: any) {
    this.left = 0;
    this.right = 960;
    this.top = 0;
    this.bottom = 540;
  });
  return { Group, WebGLRenderer, Scene, OrthographicCamera };
});

// ─── buildCameraBounds ───────────────────────────────────────────────────────

describe("buildCameraBounds", () => {
  it("returns correct bounds for identity transform (viewX=0, viewY=0, scale=1)", () => {
    const b = buildCameraBounds(0, 0, 1, 960, 540);
    expect(b.left).toBe(0);
    expect(b.right).toBe(960);
    expect(b.top).toBe(0);
    expect(b.bottom).toBe(540);
  });

  it("top < bottom (Y-down convention matches SVG coordinate space)", () => {
    const b = buildCameraBounds(0, 0, 1, 960, 540);
    expect(b.top).toBeLessThan(b.bottom);
  });

  it("returns correct bounds at 2× zoom (viewport shows half the map area)", () => {
    const b = buildCameraBounds(0, 0, 2, 960, 540);
    expect(b.right).toBe(480);
    expect(b.bottom).toBe(270);
  });

  it("returns correct bounds with pan offset — viewX=-100 pans right, viewY=-50 pans down", () => {
    const b = buildCameraBounds(-100, -50, 1, 960, 540);
    expect(b.left).toBe(100); // -(-100) / 1
    expect(b.right).toBe(1060); // (960 - (-100)) / 1
    expect(b.top).toBe(50); // -(-50) / 1
  });

  it("handles extreme zoom values without NaN or Infinity", () => {
    const lo = buildCameraBounds(0, 0, 0.1, 960, 540);
    const hi = buildCameraBounds(0, 0, 50, 960, 540);
    expect(Number.isFinite(lo.left)).toBe(true);
    expect(Number.isFinite(lo.right)).toBe(true);
    expect(Number.isFinite(lo.top)).toBe(true);
    expect(Number.isFinite(lo.bottom)).toBe(true);
    expect(Number.isFinite(hi.left)).toBe(true);
    expect(Number.isFinite(hi.right)).toBe(true);
    expect(Number.isFinite(hi.top)).toBe(true);
    expect(Number.isFinite(hi.bottom)).toBe(true);
  });
});

// ─── detectWebGL2 ─────────────────────────────────────────────────────────────

describe("detectWebGL2", () => {
  it("returns false when canvas.getContext('webgl2') returns null", () => {
    const mockCanvas = {
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(detectWebGL2(mockCanvas)).toBe(false);
  });

  it("returns true when canvas.getContext('webgl2') returns a context object", () => {
    const mockCtx = { getExtension: () => null };
    const mockCanvas = {
      getContext: () => mockCtx,
    } as unknown as HTMLCanvasElement;
    expect(detectWebGL2(mockCanvas)).toBe(true);
  });

  it("calls loseContext() on the WEBGL_lose_context extension to release probe context", () => {
    const loseContext = vi.fn();
    const mockExt = { loseContext };
    const mockCtx = { getExtension: () => mockExt };
    const mockCanvas = {
      getContext: () => mockCtx,
    } as unknown as HTMLCanvasElement;
    detectWebGL2(mockCanvas);
    expect(loseContext).toHaveBeenCalledOnce();
  });
});

// ─── getLayerZIndex ───────────────────────────────────────────────────────────

describe("getLayerZIndex", () => {
  it("returns fallback z-index 2 when element is not found in the DOM", () => {
    // In Node.js test environment, document is undefined → fallback 2.
    // In jsdom environment, getElementById("nonexistent") returns null → also fallback 2.
    expect(getLayerZIndex("nonexistent-layer-id")).toBe(2);
  });
});

// ─── WebGL2LayerFrameworkClass ────────────────────────────────────────────────

describe("WebGL2LayerFrameworkClass", () => {
  let framework: WebGL2LayerFrameworkClass;

  beforeEach(() => {
    framework = new WebGL2LayerFrameworkClass();
  });

  it("hasFallback is false by default (backing field _fallback initialised to false)", () => {
    expect(framework.hasFallback).toBe(false);
  });

  it("register() before init() queues the config in pendingConfigs", () => {
    const config = {
      id: "test",
      anchorLayerId: "terrain",
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    framework.register(config);
    expect((framework as any).pendingConfigs).toHaveLength(1);
    expect((framework as any).pendingConfigs[0]).toBe(config);
  });

  it("register() queues multiple configs without throwing", () => {
    const makeConfig = (id: string) => ({
      id,
      anchorLayerId: id,
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    });
    framework.register(makeConfig("a"));
    framework.register(makeConfig("b"));
    expect((framework as any).pendingConfigs).toHaveLength(2);
  });

  it("setVisible() does not call config.dispose() (GPU state preserved, NFR-P6)", () => {
    const config = {
      id: "terrain",
      anchorLayerId: "terrain",
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    (framework as any).layers.set("terrain", {
      config,
      group: { visible: true },
    });
    (framework as any).canvas = { style: { display: "block" } };
    framework.setVisible("terrain", false);
    expect(config.dispose).not.toHaveBeenCalled();
  });

  it("requestRender() does not throw when called multiple times", () => {
    expect(() => {
      framework.requestRender();
      framework.requestRender();
      framework.requestRender();
    }).not.toThrow();
  });

  it("clearLayer() does not throw and preserves layer registration in the Map", () => {
    const config = {
      id: "terrain",
      anchorLayerId: "terrain",
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    (framework as any).layers.set("terrain", {
      config,
      group: { visible: true, clear: vi.fn() },
    });
    framework.clearLayer("terrain");
    // Layer registration remains in the Map — only geometry is wiped in the full implementation
    expect((framework as any).layers.has("terrain")).toBe(true);
  });

  it("constructor performs no side effects — all state fields initialised to null/empty", () => {
    expect((framework as any).renderer).toBeNull();
    expect((framework as any).scene).toBeNull();
    expect((framework as any).camera).toBeNull();
    expect((framework as any).canvas).toBeNull();
    expect((framework as any).container).toBeNull();
    expect((framework as any).resizeObserver).toBeNull();
    expect((framework as any).rafId).toBeNull();
    expect((framework as any).layers.size).toBe(0);
    expect((framework as any).pendingConfigs).toHaveLength(0);
  });
});

// ─── WebGL2LayerFrameworkClass — init() (Story 1.2) ──────────────────────────

describe("WebGL2LayerFrameworkClass — init()", () => {
  let framework: WebGL2LayerFrameworkClass;

  // Build a minimal document stub. The canvas mock satisfies both detectWebGL2()
  // (probe getContext call) and the DOM canvas element requirements (id/style/etc.).
  function buildDocumentMock({ webgl2 = true }: { webgl2?: boolean } = {}) {
    const mockCtx = webgl2
      ? { getExtension: () => ({ loseContext: vi.fn() }) }
      : null;
    const mockCanvas = {
      getContext: (type: string) => (type === "webgl2" ? mockCtx : null),
      id: "",
      width: 0,
      height: 0,
      style: { position: "", inset: "", pointerEvents: "", zIndex: "" },
      setAttribute: vi.fn(),
    };
    const mockContainer = {
      id: "",
      style: { position: "", zIndex: "" },
      appendChild: vi.fn(),
      clientWidth: 960,
      clientHeight: 540,
    };
    const mockMapEl = {
      parentElement: { insertBefore: vi.fn() },
    };
    return {
      createElement: vi.fn((tag: string) =>
        tag === "canvas" ? mockCanvas : mockContainer,
      ),
      getElementById: vi.fn((id: string) => (id === "map" ? mockMapEl : null)),
      _mocks: { mockCanvas, mockContainer, mockMapEl },
    };
  }

  beforeEach(() => {
    framework = new WebGL2LayerFrameworkClass();
    // ResizeObserver is not available in Node; stub it so observeResize() doesn't throw.
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn().mockImplementation(function (this: any) {
        this.observe = vi.fn();
        this.disconnect = vi.fn();
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false and sets hasFallback when WebGL2 is unavailable (AC2)", () => {
    vi.stubGlobal("document", buildDocumentMock({ webgl2: false }));
    const result = framework.init();
    expect(result).toBe(false);
    expect(framework.hasFallback).toBe(true);
  });

  it("returns false when #map element is missing — renderer remains null (AC2 guard)", () => {
    const doc = buildDocumentMock({ webgl2: true });
    doc.getElementById = vi.fn(() => null);
    vi.stubGlobal("document", doc);
    const result = framework.init();
    expect(result).toBe(false);
    expect((framework as any).renderer).toBeNull();
  });

  it("returns true and assigns renderer, scene, camera, canvas on success (AC4)", () => {
    vi.stubGlobal("document", buildDocumentMock({ webgl2: true }));
    const result = framework.init();
    expect(result).toBe(true);
    expect((framework as any).renderer).not.toBeNull();
    expect((framework as any).scene).not.toBeNull();
    expect((framework as any).camera).not.toBeNull();
    expect((framework as any).canvas).not.toBeNull();
  });

  it("processes pendingConfigs on init() — setup() called once, layer stored, queue flushed", () => {
    vi.stubGlobal("document", buildDocumentMock({ webgl2: true }));
    const config = {
      id: "terrain",
      anchorLayerId: "terrain",
      renderOrder: 1,
      setup: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
    };
    framework.register(config);
    expect((framework as any).pendingConfigs).toHaveLength(1);
    framework.init();
    expect(config.setup).toHaveBeenCalledOnce();
    expect((framework as any).layers.has("terrain")).toBe(true);
    expect((framework as any).pendingConfigs).toHaveLength(0);
  });

  it("attaches ResizeObserver to container on success (AC5)", () => {
    vi.stubGlobal("document", buildDocumentMock({ webgl2: true }));
    framework.init();
    expect((framework as any).resizeObserver).not.toBeNull();
  });
});

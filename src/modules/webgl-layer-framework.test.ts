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
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(0));
    expect(() => {
      framework.requestRender();
      framework.requestRender();
      framework.requestRender();
    }).not.toThrow();
    vi.unstubAllGlobals();
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

// ─── WebGL2LayerFrameworkClass — lifecycle & render loop (Story 1.3) ───────────

describe("WebGL2LayerFrameworkClass — lifecycle & render loop (Story 1.3)", () => {
  let framework: WebGL2LayerFrameworkClass;

  const makeConfig = (id = "terrain") => ({
    id,
    anchorLayerId: id,
    renderOrder: 1,
    setup: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  });

  beforeEach(() => {
    framework = new WebGL2LayerFrameworkClass();
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(42));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── requestRender() / RAF coalescing ──────────────────────────────────────

  it("requestRender() schedules exactly one RAF for three rapid calls (AC6)", () => {
    framework.requestRender();
    framework.requestRender();
    framework.requestRender();
    expect((globalThis as any).requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("requestRender() resets rafId to null after the frame callback executes (AC6)", () => {
    let storedCallback: (() => void) | null = null;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn().mockImplementation((cb: () => void) => {
        storedCallback = cb;
        return 42;
      }),
    );
    framework.requestRender();
    expect((framework as any).rafId).not.toBeNull();
    storedCallback!();
    expect((framework as any).rafId).toBeNull();
  });

  // ── syncTransform() ───────────────────────────────────────────────────────

  it("syncTransform() applies buildCameraBounds(0,0,1,960,540) to camera (AC8)", () => {
    const mockCamera = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      updateProjectionMatrix: vi.fn(),
    };
    (framework as any).camera = mockCamera;
    vi.stubGlobal("viewX", 0);
    vi.stubGlobal("viewY", 0);
    vi.stubGlobal("scale", 1);
    vi.stubGlobal("graphWidth", 960);
    vi.stubGlobal("graphHeight", 540);
    framework.syncTransform();
    const expected = buildCameraBounds(0, 0, 1, 960, 540);
    expect(mockCamera.left).toBe(expected.left);
    expect(mockCamera.right).toBe(expected.right);
    expect(mockCamera.top).toBe(expected.top);
    expect(mockCamera.bottom).toBe(expected.bottom);
    expect(mockCamera.updateProjectionMatrix).toHaveBeenCalledOnce();
  });

  it("syncTransform() uses ?? defaults when globals are absent (AC8)", () => {
    const mockCamera = {
      left: 99,
      right: 99,
      top: 99,
      bottom: 99,
      updateProjectionMatrix: vi.fn(),
    };
    (framework as any).camera = mockCamera;
    // No globals stubbed — ?? fallbacks (0, 0, 1, 960, 540) take effect
    framework.syncTransform();
    const expected = buildCameraBounds(0, 0, 1, 960, 540);
    expect(mockCamera.left).toBe(expected.left);
    expect(mockCamera.right).toBe(expected.right);
  });

  // ── render() — dispatch order ─────────────────────────────────────────────

  it("render() calls syncTransform, then per-layer render, then renderer.render in order (AC7)", () => {
    const order: string[] = [];
    const layerRenderFn = vi.fn(() => order.push("layer.render"));
    const mockRenderer = { render: vi.fn(() => order.push("renderer.render")) };
    const mockCamera = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      updateProjectionMatrix: vi.fn(),
    };
    (framework as any).renderer = mockRenderer;
    (framework as any).scene = {};
    (framework as any).camera = mockCamera;
    (framework as any).layers.set("terrain", {
      config: { ...makeConfig(), render: layerRenderFn },
      group: { visible: true },
    });
    const syncSpy = vi
      .spyOn(framework as any, "syncTransform")
      .mockImplementation(() => order.push("syncTransform"));
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return 1;
      }),
    );
    framework.requestRender();
    expect(order).toEqual(["syncTransform", "layer.render", "renderer.render"]);
    syncSpy.mockRestore();
  });

  it("render() skips invisible layers — config.render not called (AC7)", () => {
    const invisibleRenderFn = vi.fn();
    const mockRenderer = { render: vi.fn() };
    (framework as any).renderer = mockRenderer;
    (framework as any).scene = {};
    (framework as any).camera = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      updateProjectionMatrix: vi.fn(),
    };
    (framework as any).layers.set("terrain", {
      config: { ...makeConfig(), render: invisibleRenderFn },
      group: { visible: false },
    });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return 1;
      }),
    );
    framework.requestRender();
    expect(invisibleRenderFn).not.toHaveBeenCalled();
  });

  // ── setVisible() ──────────────────────────────────────────────────────────

  it("setVisible(false) sets group.visible=false without calling dispose (AC3, NFR-P6)", () => {
    const config = makeConfig();
    const group = { visible: true };
    (framework as any).layers.set("terrain", { config, group });
    (framework as any).canvas = { style: { display: "block" } };
    framework.setVisible("terrain", false);
    expect(group.visible).toBe(false);
    expect(config.dispose).not.toHaveBeenCalled();
  });

  it("setVisible(false) hides canvas when all layers become invisible (AC3)", () => {
    const canvas = { style: { display: "block" } };
    (framework as any).canvas = canvas;
    (framework as any).layers.set("terrain", {
      config: makeConfig(),
      group: { visible: true },
    });
    (framework as any).layers.set("rivers", {
      config: makeConfig("rivers"),
      group: { visible: false },
    });
    framework.setVisible("terrain", false);
    expect(canvas.style.display).toBe("none");
  });

  it("setVisible(true) calls requestRender() (AC4)", () => {
    const group = { visible: false };
    (framework as any).layers.set("terrain", { config: makeConfig(), group });
    (framework as any).canvas = { style: { display: "none" } };
    const renderSpy = vi.spyOn(framework, "requestRender");
    framework.setVisible("terrain", true);
    expect(group.visible).toBe(true);
    expect(renderSpy).toHaveBeenCalledOnce();
  });

  // ── clearLayer() ──────────────────────────────────────────────────────────

  it("clearLayer() calls group.clear() and preserves layer in the Map (AC5)", () => {
    const clearFn = vi.fn();
    (framework as any).layers.set("terrain", {
      config: makeConfig(),
      group: { visible: true, clear: clearFn },
    });
    framework.clearLayer("terrain");
    expect(clearFn).toHaveBeenCalledOnce();
    expect((framework as any).layers.has("terrain")).toBe(true);
  });

  it("clearLayer() does not call renderer.dispose (AC5, NFR-P6)", () => {
    const mockRenderer = { render: vi.fn(), dispose: vi.fn() };
    (framework as any).renderer = mockRenderer;
    (framework as any).layers.set("terrain", {
      config: makeConfig(),
      group: { visible: true, clear: vi.fn() },
    });
    framework.clearLayer("terrain");
    expect(mockRenderer.dispose).not.toHaveBeenCalled();
  });

  // ── unregister() ──────────────────────────────────────────────────────────

  it("unregister() calls dispose, removes from scene and Map (AC9)", () => {
    const config = makeConfig();
    const group = { visible: true };
    const mockScene = { remove: vi.fn() };
    (framework as any).scene = mockScene;
    (framework as any).canvas = { style: { display: "block" } };
    (framework as any).layers.set("terrain", { config, group });
    framework.unregister("terrain");
    expect(config.dispose).toHaveBeenCalledWith(group);
    expect(mockScene.remove).toHaveBeenCalledWith(group);
    expect((framework as any).layers.has("terrain")).toBe(false);
  });

  it("unregister() hides canvas when it was the last registered layer (AC9)", () => {
    const canvas = { style: { display: "block" } };
    (framework as any).canvas = canvas;
    (framework as any).scene = { remove: vi.fn() };
    (framework as any).layers.set("terrain", {
      config: makeConfig(),
      group: { visible: true },
    });
    framework.unregister("terrain");
    expect(canvas.style.display).toBe("none");
  });
});

// ─── WebGL2LayerFramework fallback no-op path (Story 2.3) ───────────────────

describe("WebGL2LayerFramework — fallback no-op path (Story 2.3)", () => {
  let framework: WebGL2LayerFrameworkClass;

  const makeConfig = () => ({
    id: "terrain",
    anchorLayerId: "terrain",
    renderOrder: 2,
    setup: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  });

  beforeEach(() => {
    framework = new WebGL2LayerFrameworkClass();
    (framework as any)._fallback = true;
  });

  it("hasFallback getter returns true when _fallback is set", () => {
    expect(framework.hasFallback).toBe(true);
  });

  it("register() queues config but does not call setup() when fallback is active", () => {
    // When _fallback=true, scene is null (init() exits early without creating scene).
    // register() therefore queues into pendingConfigs[] — setup() is never called.
    const config = makeConfig();
    expect(() => framework.register(config)).not.toThrow();
    expect(config.setup).not.toHaveBeenCalled();
  });

  it("setVisible() is a no-op when fallback is active — no exception for false", () => {
    expect(() => framework.setVisible("terrain", false)).not.toThrow();
  });

  it("setVisible() is a no-op when fallback is active — no exception for true", () => {
    expect(() => framework.setVisible("terrain", true)).not.toThrow();
  });

  it("clearLayer() is a no-op when fallback is active", () => {
    expect(() => framework.clearLayer("terrain")).not.toThrow();
  });

  it("requestRender() is a no-op when fallback is active — RAF not scheduled", () => {
    const rafMock = vi.fn().mockReturnValue(1);
    vi.stubGlobal("requestAnimationFrame", rafMock);
    expect(() => framework.requestRender()).not.toThrow();
    expect(rafMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("unregister() is a no-op when fallback is active", () => {
    expect(() => framework.unregister("terrain")).not.toThrow();
  });

  it("syncTransform() is a no-op when fallback is active", () => {
    expect(() => framework.syncTransform()).not.toThrow();
  });

  it("NFR-C1: no console.error emitted during fallback operations", () => {
    const errorSpy = vi.spyOn(console, "error");
    framework.register(makeConfig());
    framework.setVisible("terrain", false);
    framework.clearLayer("terrain");
    framework.requestRender();
    framework.unregister("terrain");
    framework.syncTransform();
    expect(errorSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

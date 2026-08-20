import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const applicationState = vi.hoisted(() => ({ destroy: vi.fn(), init: vi.fn(), render: vi.fn(), resize: vi.fn() }));

vi.mock("pixi.js", () => {
  class Application {
    canvas = Object.assign(new EventTarget(), { style: {} });
    renderer = {
      background: { color: "" },
      constructor: { name: "MockRenderer" },
      resize: applicationState.resize
    };
    stage = {
      children: [],
      eventMode: "auto",
      position: { set: vi.fn() },
      removeChildren: () => [],
      scale: { set: vi.fn() }
    };
    destroy = applicationState.destroy;
    init = applicationState.init;
    render = applicationState.render;
  }

  class EmptyDisplayObject {}
  return {
    Application,
    Assets: { load: vi.fn() },
    Buffer: EmptyDisplayObject,
    BufferUsage: { COPY_DST: 1, INDEX: 2, STATIC: 4, VERTEX: 8 },
    Container: EmptyDisplayObject,
    Geometry: EmptyDisplayObject,
    Graphics: EmptyDisplayObject,
    GraphicsContext: EmptyDisplayObject,
    Mesh: EmptyDisplayObject,
    Shader: EmptyDisplayObject,
    Sprite: EmptyDisplayObject
  };
});

import { PixiMapRenderer } from "./pixi-map-renderer";

const createSurface = () => {
  const children: unknown[] = [];
  return {
    appendChild: (child: unknown) => children.push(child),
    children,
    getBoundingClientRect: () => ({ height: 0, width: 0 }),
    style: {}
  } as unknown as HTMLElement & { children: unknown[] };
};

describe("PixiMapRenderer lifecycle", () => {
  beforeEach(() => {
    applicationState.destroy.mockClear();
    applicationState.init.mockClear();
    applicationState.render.mockClear();
    applicationState.resize.mockClear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn();
        observe = vi.fn();
      }
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it("mounts once, rejects a second surface, and destroys deterministically", async () => {
    const renderer = new PixiMapRenderer();
    const surface = createSurface();
    renderer.setCamera({ height: 600, scale: 1, width: 800, x: 0, y: 0 });

    await renderer.mount(surface);
    await renderer.mount(surface);
    expect(applicationState.init).toHaveBeenCalledOnce();
    expect(surface.children).toHaveLength(1);
    await expect(renderer.mount(createSurface())).rejects.toThrow("already mounted");

    renderer.destroy();
    expect(applicationState.destroy).toHaveBeenCalledOnce();
    expect(renderer.getSnapshot()).toMatchObject({ enabled: false, resourceBytes: 0, resourceCount: 0 });
  });

  it("supports destroy and remount without duplicating runtime state", async () => {
    const renderer = new PixiMapRenderer();
    await renderer.mount(createSurface());
    renderer.destroy();
    await renderer.mount(createSurface());

    expect(applicationState.init).toHaveBeenCalledTimes(2);
    expect(renderer.getSnapshot().enabled).toBe(true);
    renderer.destroy();
  });

  it("re-evaluates the injected DPR against the resolution budget on resize", async () => {
    let devicePixelRatio = 3;
    const renderer = new PixiMapRenderer({ getDevicePixelRatio: () => devicePixelRatio });
    renderer.setCamera({ height: 2160, scale: 1, width: 3840, x: 0, y: 0 });
    await renderer.mount(createSurface());

    expect(applicationState.init).toHaveBeenCalledWith(expect.objectContaining({ resolution: 1.01 }));
    expect(renderer.getSnapshot().resolution).toBe(1.01);

    devicePixelRatio = 1;
    renderer.resize({ height: 600, width: 800 });
    expect(applicationState.resize).toHaveBeenLastCalledWith(800, 600, 1);
    expect(renderer.getSnapshot().resolution).toBe(1);
    renderer.destroy();
  });

  it("tracks context loss, schedules reconstruction, and removes listeners on destroy", async () => {
    let scheduledFrame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      scheduledFrame = callback;
      return 7;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const renderer = new PixiMapRenderer();
    const surface = createSurface();
    await renderer.mount(surface);
    const canvas = surface.children[0] as EventTarget;

    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(renderer.getSnapshot().contextLost).toBe(true);

    canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(renderer.getSnapshot().contextLost).toBe(false);
    expect(scheduledFrame).toBeTypeOf("function");
    scheduledFrame?.(0);

    renderer.destroy();
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(renderer.getSnapshot().contextLost).toBe(false);
  });

  it("returns to a clean lifecycle baseline across repeated mount and destroy loops", async () => {
    const renderer = new PixiMapRenderer();
    for (let iteration = 0; iteration < 20; iteration++) {
      await renderer.mount(createSurface());
      renderer.destroy();
      expect(renderer.getSnapshot()).toMatchObject({ enabled: false, resourceBytes: 0, resourceCount: 0 });
    }

    expect(applicationState.init).toHaveBeenCalledTimes(20);
    expect(applicationState.destroy).toHaveBeenCalledTimes(20);
  });
});

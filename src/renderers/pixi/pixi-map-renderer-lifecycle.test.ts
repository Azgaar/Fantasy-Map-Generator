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
});

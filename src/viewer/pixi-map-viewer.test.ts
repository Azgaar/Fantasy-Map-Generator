import { afterEach, describe, expect, it, vi } from "vitest";
import type { MapRenderer } from "../renderers/core/map-renderer";
import { createRenderSnapshot } from "../renderers/scene/render-snapshot";
import { DEFAULT_PIXI_MAP_STYLE } from "../renderers/scene/styles";
import { mountPixiMapViewer, type PixiViewerRenderer } from "./pixi-map-viewer";
import { STATIC_VIEWER_WORLD } from "./static-map-fixture";

const createRenderer = (): PixiViewerRenderer =>
  ({
    destroy: vi.fn(),
    mount: vi.fn(async () => undefined),
    pick: vi.fn(() => null),
    render: vi.fn(async () => undefined),
    resize: vi.fn(),
    setCamera: vi.fn(),
    setLayerOrder: vi.fn(),
    setLayerVisibility: vi.fn()
  }) satisfies MapRenderer;

const createSurface = (width = 800, height = 600): HTMLElement =>
  ({
    getBoundingClientRect: () => ({ height, width }),
    style: {}
  }) as unknown as HTMLElement;

describe("Pixi map viewer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mounts and updates the production renderer contract without editor globals", async () => {
    const renderer = createRenderer();
    const world = structuredClone(STATIC_VIEWER_WORLD);
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    const camera = { height: 600, scale: 2, width: 800, x: 10, y: 20 };
    const surface = createSurface();

    const viewer = await mountPixiMapViewer({
      camera,
      createRenderer: () => renderer,
      interactive: false,
      layerVisibility: { borders: false, lakes: true },
      style,
      surface,
      world
    });

    expect(renderer.setCamera).toHaveBeenCalledWith(camera);
    expect(renderer.mount).toHaveBeenCalledWith(surface);
    expect(renderer.setLayerVisibility).toHaveBeenCalledWith("borders", false);
    expect(renderer.setLayerVisibility).toHaveBeenCalledWith("lakes", true);
    expect(renderer.render).toHaveBeenCalledWith(
      expect.any(Object),
      expect.not.objectContaining({ impossible: true }),
      expect.objectContaining({ invalidations: [{ kind: "world" }], requiresSceneBuild: true })
    );

    await viewer.render(world, style, [{ kind: "style", layer: "states" }]);
    expect(renderer.render).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ invalidations: [{ kind: "style", layer: "states" }], requiresSceneBuild: true })
    );
    viewer.destroy();
    viewer.destroy();
    expect(renderer.destroy).toHaveBeenCalledOnce();
  });

  it("loads versioned snapshots and exposes fit, layers, picking, resize, and events", async () => {
    const renderer = createRenderer();
    const surface = createSurface(1000, 500);
    const data = createRenderSnapshot({
      layerVisibility: { borders: true },
      style: structuredClone(DEFAULT_PIXI_MAP_STYLE),
      world: structuredClone(STATIC_VIEWER_WORLD)
    });
    const viewer = await mountPixiMapViewer({ createRenderer: () => renderer, data, interactive: false, surface });
    const events: string[] = [];
    viewer.subscribe(event => events.push(event.type));

    const fitted = viewer.fitBounds(undefined, 50);
    expect(fitted).toMatchObject({ height: 500, width: 1000, y: 50 });
    expect(fitted.scale).toBeCloseTo(20 / 3);
    expect(fitted.x).toBeCloseTo(500 / 3);
    viewer.setLayers({ borders: false, labels: true });
    viewer.resize({ height: 300, width: 400 });
    viewer.pick({ x: 10, y: 20 });
    await viewer.load(data);

    expect(renderer.setLayerVisibility).toHaveBeenCalledWith("borders", false);
    expect(renderer.resize).toHaveBeenCalledWith({ height: 300, width: 400 });
    expect(renderer.pick).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(events).toEqual(expect.arrayContaining(["camera", "layers", "resize", "pick", "load"]));
  });

  it("keeps two viewer instances isolated", async () => {
    const firstRenderer = createRenderer();
    const secondRenderer = createRenderer();
    const common = {
      interactive: false,
      style: structuredClone(DEFAULT_PIXI_MAP_STYLE),
      world: structuredClone(STATIC_VIEWER_WORLD)
    };
    const first = await mountPixiMapViewer({
      ...common,
      createRenderer: () => firstRenderer,
      surface: createSurface()
    });
    const second = await mountPixiMapViewer({
      ...common,
      createRenderer: () => secondRenderer,
      surface: createSurface()
    });

    first.setLayerVisibility("states", false);
    expect(firstRenderer.setLayerVisibility).toHaveBeenCalledWith("states", false);
    expect(secondRenderer.setLayerVisibility).not.toHaveBeenCalledWith("states", false);
    first.destroy();
    expect(firstRenderer.destroy).toHaveBeenCalledOnce();
    expect(secondRenderer.destroy).not.toHaveBeenCalled();
    second.destroy();
  });

  it("resolves physical assets and passes worker, credential, and base URL configuration to renderer factories", async () => {
    const renderer = createRenderer();
    const create = vi.fn(() => renderer);
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    style.texture.href = "textures/parchment.png";
    const viewer = await mountPixiMapViewer({
      assetPolicy: { baseUrl: "https://cdn.example/maps/", credentials: "include" },
      createRenderer: create,
      interactive: false,
      style,
      surface: createSurface(),
      workerUrl: "workers/scene-worker.js",
      world: structuredClone(STATIC_VIEWER_WORLD)
    });

    expect(create).toHaveBeenCalledWith({
      assetBaseUrl: "https://cdn.example/maps/",
      credentials: "include",
      workerUrl: "https://cdn.example/maps/workers/scene-worker.js"
    });
    expect(renderer.render).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        texture: expect.objectContaining({ href: "https://cdn.example/maps/textures/parchment.png" })
      }),
      expect.any(Object)
    );
    viewer.destroy();
  });

  it("loads configured fonts with credentials, restores after a hidden tab, and releases listeners and fonts", async () => {
    const renderer = createRenderer();
    const add = vi.fn();
    const remove = vi.fn();
    const ownerDocument = Object.assign(new EventTarget(), {
      fonts: { add, delete: remove },
      visibilityState: "hidden"
    });
    const surface = {
      getBoundingClientRect: () => ({ height: 600, width: 800 }),
      ownerDocument,
      style: {}
    } as unknown as HTMLElement;
    const load = vi.fn(async () => undefined);
    const FontFaceStub = vi.fn(
      class {
        load = load;
      }
    );
    const fetchFont = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8), ok: true }));
    vi.stubGlobal("FontFace", FontFaceStub);
    vi.stubGlobal("fetch", fetchFont);

    const viewer = await mountPixiMapViewer({
      assetPolicy: { baseUrl: "https://cdn.example/maps/", credentials: "include" },
      createRenderer: () => renderer,
      fonts: [{ family: "Map Serif", url: "fonts/map-serif.woff2" }],
      interactive: false,
      style: structuredClone(DEFAULT_PIXI_MAP_STYLE),
      surface,
      world: structuredClone(STATIC_VIEWER_WORLD)
    });

    expect(fetchFont).toHaveBeenCalledWith("https://cdn.example/maps/fonts/map-serif.woff2", {
      credentials: "include"
    });
    expect(load).toHaveBeenCalledOnce();
    expect(add).toHaveBeenCalledOnce();
    ownerDocument.visibilityState = "visible";
    ownerDocument.dispatchEvent(new Event("visibilitychange"));
    expect(renderer.resize).toHaveBeenCalledWith({ height: 600, width: 800 });

    viewer.destroy();
    expect(remove).toHaveBeenCalledOnce();
    vi.mocked(renderer.resize).mockClear();
    ownerDocument.dispatchEvent(new Event("visibilitychange"));
    expect(renderer.resize).not.toHaveBeenCalled();
  });

  it("fails explicitly when the host rejects a required configured asset", async () => {
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    style.texture.href = "private-paper.png";
    const create = vi.fn(() => createRenderer());
    await expect(
      mountPixiMapViewer({
        assetPolicy: { resolveAsset: () => null },
        createRenderer: create,
        interactive: false,
        style,
        surface: createSurface(),
        world: structuredClone(STATIC_VIEWER_WORLD)
      })
    ).rejects.toThrow("Required viewer texture asset is unavailable: private-paper.png");
    expect(create).not.toHaveBeenCalled();
  });

  it("supports pointer drag, pinch zoom, and wheel zoom without editor input globals", async () => {
    const renderer = createRenderer();
    const surface = Object.assign(new EventTarget(), {
      getBoundingClientRect: () => ({ height: 600, left: 0, top: 0, width: 800 }),
      setPointerCapture: vi.fn(),
      style: { touchAction: "pan-y" }
    }) as unknown as HTMLElement;
    const viewer = await mountPixiMapViewer({
      createRenderer: () => renderer,
      style: structuredClone(DEFAULT_PIXI_MAP_STYLE),
      surface,
      world: structuredClone(STATIC_VIEWER_WORLD)
    });
    vi.mocked(renderer.setCamera).mockClear();

    const pointer = (type: string, pointerId: number, clientX: number, clientY: number): void => {
      surface.dispatchEvent(Object.assign(new Event(type), { clientX, clientY, pointerId }));
    };
    pointer("pointerdown", 1, 100, 100);
    pointer("pointermove", 1, 120, 130);
    expect(renderer.setCamera).toHaveBeenCalledWith(expect.objectContaining({ x: 20, y: 90 }));
    pointer("pointerup", 1, 120, 130);

    pointer("pointerdown", 1, 100, 100);
    pointer("pointerdown", 2, 200, 100);
    pointer("pointermove", 2, 300, 100);
    expect(renderer.setCamera).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 16 }));
    pointer("pointerup", 1, 100, 100);
    pointer("pointerup", 2, 300, 100);

    const wheel = Object.assign(new Event("wheel", { cancelable: true }), {
      clientX: 400,
      clientY: 300,
      deltaY: -100
    });
    surface.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    viewer.destroy();
    expect(surface.style.touchAction).toBe("pan-y");
  });
});

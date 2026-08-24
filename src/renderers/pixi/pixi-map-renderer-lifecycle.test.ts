import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const applicationState = vi.hoisted(() => ({
  assetLoad: vi.fn(async () => ({ destroy: vi.fn(), height: 8, width: 8 })),
  assetUnload: vi.fn(async () => undefined),
  bitmapFontInstall: vi.fn(),
  bitmapFontUninstall: vi.fn(),
  bitmapTextCreate: vi.fn(),
  destroy: vi.fn(),
  extractCanvas: vi.fn(),
  hiddenAtExtract: [] as string[],
  init: vi.fn(),
  positionSet: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  scaleSet: vi.fn(),
  svgCreate: vi.fn(),
  stage: undefined as
    | { children: Array<{ children: unknown[]; label: string; visible: boolean; zIndex: number }> }
    | undefined
}));

vi.mock("pixi.js", () => {
  class DisplayObject {
    alpha = 1;
    children: DisplayObject[] = [];
    cullArea: unknown;
    cullable = false;
    eventMode = "auto";
    label = "";
    pivot = { set: vi.fn() };
    position = { set: vi.fn() };
    scale = { set: vi.fn() };
    visible = true;
    zIndex = 0;
    addChild(...children: DisplayObject[]) {
      this.children.push(...children);
      return children[0];
    }
    destroy() {}
    removeChildren() {
      return this.children.splice(0);
    }
    removeFromParent() {}
    sortChildren() {
      this.children.sort((first, second) => first.zIndex - second.zIndex);
    }
  }

  class Container extends DisplayObject {}

  class ColorMatrixFilter {
    destroy() {}
    grayscale() {}
    sepia() {}
  }

  class BlurFilter {
    destroy() {}
  }

  class Application {
    canvas = Object.assign(new EventTarget(), { style: {} });
    renderer = {
      background: { color: "" },
      constructor: { name: "MockRenderer" },
      extract: {
        canvas: applicationState.extractCanvas.mockImplementation((options: { target: DisplayObject }) => {
          const visit = (display: DisplayObject): string[] => [
            ...(display.visible || !display.label ? [] : [display.label]),
            ...display.children.flatMap(visit)
          ];
          applicationState.hiddenAtExtract = visit(options.target);
          return { height: 16, remove: vi.fn(), width: 16 };
        })
      },
      resize: applicationState.resize
    };
    stage = Object.assign(new Container(), {
      position: { set: applicationState.positionSet },
      scale: { set: applicationState.scaleSet }
    });
    destroy = applicationState.destroy;
    init = applicationState.init;
    render = applicationState.render;
    constructor() {
      applicationState.stage = this.stage;
    }
  }

  class Buffer {
    data: unknown;
    constructor(options: { data: unknown }) {
      this.data = options.data;
    }
    update() {}
  }

  class Geometry {
    destroy() {}
  }

  class GraphicsContext {
    arc() {
      return this;
    }
    bezierCurveTo() {
      return this;
    }
    circle() {
      return this;
    }
    closePath() {
      return this;
    }
    fill() {
      return this;
    }
    lineTo() {
      return this;
    }
    moveTo() {
      return this;
    }
    poly() {
      return this;
    }
    rect() {
      return this;
    }
    cut() {
      return this;
    }
    stroke() {
      return this;
    }
  }

  class Graphics extends DisplayObject {
    svg(source: string) {
      applicationState.svgCreate(source);
      return this;
    }
  }

  class Mesh extends DisplayObject {}

  class Shader {
    static from() {
      return new Shader();
    }
    destroy() {}
  }

  class Sprite extends DisplayObject {
    anchor = { set: vi.fn() };
  }

  class TilingSprite extends DisplayObject {}

  class Text extends DisplayObject {
    anchor = { set: vi.fn() };
    style: { fontFamily?: string | string[] };
    constructor(options?: { style?: { fontFamily?: string | string[] } }) {
      super();
      this.style = { ...options?.style };
    }
  }

  class BitmapText extends Text {
    constructor(options: { style?: { fontFamily?: string | string[] } }) {
      super(options);
      applicationState.bitmapTextCreate(options);
    }
  }

  class Rectangle {}

  return {
    Application,
    Assets: { load: applicationState.assetLoad, unload: applicationState.assetUnload },
    BitmapFontManager: {
      install: applicationState.bitmapFontInstall,
      uninstall: applicationState.bitmapFontUninstall
    },
    BitmapText,
    Buffer,
    BufferUsage: { COPY_DST: 1, INDEX: 2, STATIC: 4, VERTEX: 8 },
    Container,
    BlurFilter,
    ColorMatrixFilter,
    Geometry,
    Graphics,
    GraphicsContext,
    Mesh,
    Rectangle,
    Shader,
    Sprite,
    Text,
    TilingSprite,
    VERSION: "8.0.0-test"
  };
});

import type { PackedGraph } from "@/types/PackedGraph";
import { STATIC_VIEWER_WORLD } from "@/viewer/static-map-fixture";
import { coalesceInvalidations } from "../core/invalidation";
import { DEFAULT_PIXI_MAP_STYLE } from "../scene/styles";
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
    applicationState.extractCanvas.mockClear();
    applicationState.hiddenAtExtract = [];
    applicationState.assetLoad.mockClear();
    applicationState.assetUnload.mockClear();
    applicationState.bitmapFontInstall.mockClear();
    applicationState.bitmapFontUninstall.mockClear();
    applicationState.bitmapTextCreate.mockClear();
    applicationState.init.mockClear();
    applicationState.positionSet.mockClear();
    applicationState.render.mockClear();
    applicationState.resize.mockClear();
    applicationState.scaleSet.mockClear();
    applicationState.svgCreate.mockClear();
    applicationState.stage = undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn();
        observe = vi.fn();
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

    expect(applicationState.init).toHaveBeenCalledWith(expect.objectContaining({ antialias: true, resolution: 1.74 }));
    expect(renderer.getSnapshot().resolution).toBe(1.74);

    devicePixelRatio = 1;
    renderer.resize({ height: 600, width: 800 });
    expect(applicationState.resize).toHaveBeenLastCalledWith(800, 600, 1);
    expect(renderer.getSnapshot().resolution).toBe(1);
    renderer.destroy();
  });

  it("applies camera changes immediately to stay aligned with the SVG overlay", async () => {
    const requestFrame = vi.fn(() => 7);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    const renderer = new PixiMapRenderer();
    await renderer.mount(createSurface());
    applicationState.positionSet.mockClear();
    applicationState.render.mockClear();
    applicationState.scaleSet.mockClear();

    renderer.setCamera({ height: 600, scale: 2, width: 800, x: 10, y: 20 });

    expect(applicationState.positionSet).toHaveBeenCalledWith(10, 20);
    expect(applicationState.scaleSet).toHaveBeenCalledWith(2);
    expect(applicationState.render).toHaveBeenCalledOnce();
    expect(requestFrame).not.toHaveBeenCalled();
    renderer.destroy();
  });

  it("updates transforms before culling an invalidation-driven camera frame", async () => {
    const renderer = new PixiMapRenderer();

    await renderer.mount(createSurface());

    expect(applicationState.init).toHaveBeenCalledWith(expect.objectContaining({ culler: { updateTransform: true } }));
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

  it("accounts and releases retained geometry and relief textures", async () => {
    const renderer = new PixiMapRenderer({ resolveReliefIcon: () => "data:image/svg+xml,relief" });
    await renderer.mount(createSurface());
    await renderer.render(
      createWorld(),
      structuredClone(DEFAULT_PIXI_MAP_STYLE),
      coalesceInvalidations([{ kind: "world" }])
    );

    expect(renderer.getSnapshot()).toMatchObject({ resourceCount: 21, textureCacheEntries: 3 });
    expect(applicationState.assetLoad).toHaveBeenCalledTimes(3);

    renderer.clear();
    expect(renderer.getSnapshot()).toMatchObject({ resourceBytes: 0, resourceCount: 0, textureCacheEntries: 0 });
    expect(applicationState.assetUnload).toHaveBeenCalledTimes(3);
    renderer.destroy();
  });

  it("renders the editor-independent static viewer fixture through the production lifecycle", async () => {
    const renderer = new PixiMapRenderer();
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    await renderer.mount(createSurface());
    await renderer.render(STATIC_VIEWER_WORLD, style, coalesceInvalidations([{ kind: "world" }]));

    expect(renderer.getSnapshot()).toMatchObject({ cells: 2, enabled: true, resourceCount: 20 });
    expect(applicationState.stage?.children.map(child => child.label)).toEqual([
      "ocean",
      "landmass",
      "texture",
      "height",
      "lakes",
      "biomes",
      "cells",
      "grid",
      "coordinates",
      "compass",
      "rivers",
      "relief",
      "religions",
      "cultures",
      "states",
      "provinces",
      "trade",
      "zones",
      "borders",
      "routes",
      "temperature",
      "coastline",
      "ice",
      "goods",
      "markets",
      "precipitation",
      "population",
      "emblems",
      "labels",
      "burgIcons",
      "military",
      "markers"
    ]);
    renderer.setLayerVisibility("biomes", false);
    expect(applicationState.stage?.children.find(child => child.label === "biomes")?.visible).toBe(false);
    expect(applicationState.stage?.children.find(child => child.label === "states")?.visible).toBe(true);
    const reversedOrder = [...(applicationState.stage?.children.map(child => child.label) ?? [])].reverse();
    renderer.setLayerOrder(reversedOrder as Parameters<typeof renderer.setLayerOrder>[0]);
    expect(applicationState.stage?.children.map(child => child.label)).toEqual(reversedOrder);
    await renderer.render(STATIC_VIEWER_WORLD, style, coalesceInvalidations([{ kind: "world" }]));
    expect(applicationState.stage?.children.map(child => child.label)).toEqual(reversedOrder);
    renderer.destroy();
    expect(renderer.getSnapshot()).toMatchObject({ enabled: false, resourceBytes: 0, resourceCount: 0 });
  });

  it("builds Pixi-owned burg and marker layers from domain entities", async () => {
    const renderer = new PixiMapRenderer();
    const world = createWorld();
    world.burgs = [0 as never, { cell: 0, group: "capital", i: 1, port: 2, x: 2, y: 2 }];
    world.markers = [{ cell: 0, i: 4, icon: "data:image/png;base64,marker", type: "battle", x: 3, y: 3 }];
    await renderer.mount(createSurface());
    await renderer.render(world, structuredClone(DEFAULT_PIXI_MAP_STYLE), coalesceInvalidations([{ kind: "world" }]));

    expect(renderer.getSnapshot()).toMatchObject({ burgSymbols: 1, markerSymbols: 1, textureCacheEntries: 3 });
    expect(applicationState.stage?.children.find(child => child.label === "burgIcons")?.children.length).toBe(2);
    expect(applicationState.stage?.children.find(child => child.label === "markers")?.children.length).toBe(1);
    renderer.clear();
    expect(renderer.getSnapshot()).toMatchObject({ resourceBytes: 0, resourceCount: 0, textureCacheEntries: 0 });
    renderer.destroy();
  });

  it("renders compound and Watabou burg symbols from their SVG definitions", async () => {
    const resolveSymbolIcon = vi.fn(() => "data:image/svg+xml,burg-symbol");
    const renderer = new PixiMapRenderer({ resolveSymbolIcon });
    const world = createWorld();
    world.burgs = [0 as never, { cell: 0, group: "capital", i: 1, x: 2, y: 2 }];
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    style.burgIcons.icons.roles.capital!.icon = "watabou-capital";
    await renderer.mount(createSurface());
    await renderer.render(world, style, coalesceInvalidations([{ kind: "world" }]));

    expect(resolveSymbolIcon).toHaveBeenCalledWith(
      "icon-watabou-capital",
      expect.objectContaining({ fill: "#ffffff", viewBox: undefined })
    );
    expect(applicationState.assetLoad).toHaveBeenCalledWith("data:image/svg+xml,burg-symbol");
    expect(applicationState.stage?.children.find(child => child.label === "burgIcons")?.children.length).toBe(1);
    renderer.destroy();
  });

  it("builds Pixi-owned ocean pattern, height contours, and texture presentation", async () => {
    const renderer = new PixiMapRenderer();
    const world = createWorld() as PackedGraph & { climate: unknown };
    world.climate = {
      cells: { ...world.cells, prec: Uint8Array.from([0]), temp: Int8Array.from([0]) },
      points: [[2, 2]],
      requestedCells: 1,
      temperatureScale: "°C",
      vertices: world.vertices
    };
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    style.ocean.pattern.href = "pattern.png";
    style.texture.href = "texture.png";
    style.texture.mask = "water";
    style.height.land.filter = "url(#filter-sepia)";

    await renderer.mount(createSurface());
    await renderer.render(world as never, style, coalesceInvalidations([{ kind: "world" }]));

    expect(applicationState.stage?.children.find(child => child.label === "ocean")?.children.length).toBe(2);
    expect(applicationState.stage?.children.find(child => child.label === "texture")?.children.length).toBe(2);
    expect(applicationState.stage?.children.find(child => child.label === "height")?.children.length).toBe(2);
    expect(applicationState.svgCreate).toHaveBeenCalled();
    for (const [source] of applicationState.svgCreate.mock.calls) {
      expect(source).toMatch(/^<svg\b[^>]*>[\s\S]*<\/svg>$/);
    }
    expect(renderer.getSnapshot()).toMatchObject({
      missingTextureAssets: [],
      textureCacheEntries: 4,
      unsupportedHeightEffects: [],
      unsupportedTextureEffects: []
    });

    const raster = renderer.renderRasterFrame({
      frame: { height: 4, width: 4, x: 0, y: 0 },
      fullMap: { height: 4, width: 4 },
      hiddenLayers: ["labels", "ocean"],
      resolution: 1,
      transparentBackground: true
    });
    expect(applicationState.extractCanvas).toHaveBeenCalledWith(expect.objectContaining({ clearColor: "transparent" }));
    expect(applicationState.hiddenAtExtract).toEqual(expect.arrayContaining(["height:ocean", "labels", "ocean"]));
    expect(applicationState.stage?.children.find(child => child.label === "ocean")?.visible).toBe(true);
    raster.remove();

    renderer.clear();
    expect(applicationState.assetLoad).toHaveBeenCalledWith("pattern.png");
    expect(applicationState.assetLoad).toHaveBeenCalledWith("texture.png");
    expect(applicationState.assetUnload).toHaveBeenCalledTimes(4);
    renderer.destroy();
  });

  it("fails explicitly for required viewer assets in strict mode", async () => {
    applicationState.assetLoad.mockRejectedValueOnce(new Error("blocked by CORS"));
    const renderer = new PixiMapRenderer({ strictAssets: true });
    const style = structuredClone(DEFAULT_PIXI_MAP_STYLE);
    style.texture.href = "https://cdn.example/private-paper.png";
    await renderer.mount(createSurface());

    await expect(renderer.render(createWorld(), style, coalesceInvalidations([{ kind: "world" }]))).rejects.toThrow(
      "Required renderer map texture asset is unavailable: https://cdn.example/private-paper.png"
    );
    renderer.destroy();
  });

  it("builds Pixi-owned ice, goods, and market layers from domain entities", async () => {
    const renderer = new PixiMapRenderer({ resolveSymbolIcon: icon => `data:image/svg+xml,${icon}` });
    const world = createWorld() as PackedGraph & {
      goodsProduction: {
        getBurgProduction: () => Record<number, number>;
        getCellProduction: () => Record<number, number>;
      };
    };
    world.goods = [
      { color: "#996633", i: 1, icon: "good-wood", name: "Wood", tags: [], unit: "pile", value: 1, visible: true }
    ];
    world.cells.good = Uint16Array.from([1]);
    world.cells.market = Uint16Array.from([1]);
    world.burgs = [0 as never, { cell: 0, i: 1, production: [] as never[], x: 2, y: 2 }];
    world.goodsProduction = { getBurgProduction: () => ({ 1: 4 }), getCellProduction: () => ({ 1: 2 }) };
    world.ice = [
      {
        i: 1,
        points: [
          [0, 0],
          [4, 0],
          [0, 4]
        ],
        type: "glacier"
      }
    ];
    world.markets = [{ centerBurgId: 1, color: "#dababf", goods: {}, i: 1 }];
    await renderer.mount(createSurface());
    await renderer.render(world, structuredClone(DEFAULT_PIXI_MAP_STYLE), coalesceInvalidations([{ kind: "world" }]));

    expect(applicationState.stage?.children.find(child => child.label === "ice")?.children.length).toBeGreaterThan(0);
    expect(applicationState.stage?.children.find(child => child.label === "goods")?.children.length).toBeGreaterThan(0);
    expect(applicationState.stage?.children.find(child => child.label === "markets")?.children.length).toBeGreaterThan(
      0
    );
    expect(renderer.getSnapshot().textureCacheEntries).toBe(3);
    renderer.clear();
    expect(renderer.getSnapshot()).toMatchObject({ resourceBytes: 0, resourceCount: 0, textureCacheEntries: 0 });
    renderer.destroy();
  });

  it("builds Pixi-owned population and military layers from domain entities", async () => {
    const renderer = new PixiMapRenderer();
    const world = createWorld();
    world.cells.pop = Uint8Array.from([10]);
    world.states = [
      {} as never,
      {
        color: "#6699cc",
        i: 1,
        military: [
          {
            a: 100,
            bx: 2,
            by: 2,
            cell: 0,
            i: 3,
            icon: "data:image/png;base64,regiment",
            n: 0,
            name: "Regiment",
            s: 0,
            state: 1,
            t: 100,
            type: "melee",
            u: {},
            x: 2,
            y: 2
          }
        ]
      } as never
    ];
    await renderer.mount(createSurface());
    await renderer.render(world, structuredClone(DEFAULT_PIXI_MAP_STYLE), coalesceInvalidations([{ kind: "world" }]));

    expect(applicationState.stage?.children.find(child => child.label === "population")?.children.length).toBe(1);
    expect(applicationState.stage?.children.find(child => child.label === "military")?.children.length).toBe(1);
    expect(renderer.getSnapshot().textureCacheEntries).toBe(3);
    renderer.clear();
    expect(renderer.getSnapshot()).toMatchObject({ resourceBytes: 0, resourceCount: 0, textureCacheEntries: 0 });
    renderer.destroy();
  });

  it("builds and caches Pixi-owned emblems from domain heraldry", async () => {
    const renderer = new PixiMapRenderer({
      resolveEmblemIcon: async id => `data:image/svg+xml,${id}`
    });
    const world = createWorld();
    world.burgs = [0 as never, { cell: 0, coa: { t1: "vert" }, i: 1, x: 2, y: 2 }];
    world.provinces = [0 as never, { center: 0, coa: { t1: "or" }, i: 1, pole: [2, 2] } as never];
    world.states = [0 as never, { center: 0, coa: { t1: "gules" }, i: 1, pole: [2, 2] } as never];
    await renderer.mount(createSurface());
    await renderer.render(world, structuredClone(DEFAULT_PIXI_MAP_STYLE), coalesceInvalidations([{ kind: "world" }]));

    const emblems = applicationState.stage?.children.find(child => child.label === "emblems") as
      | { children: Array<{ label: string }> }
      | undefined;
    expect(emblems?.children.map(group => group.label)).toEqual(["emblems:burg", "emblems:province", "emblems:state"]);
    expect(renderer.getSnapshot()).toMatchObject({
      emblemSymbols: 3,
      missingEmblemAssets: [],
      unsupportedEmblemEffects: []
    });
    expect(renderer.getSnapshot().textureCacheEntries).toBe(5);
    renderer.clear();
    expect(renderer.getSnapshot()).toMatchObject({ resourceBytes: 0, resourceCount: 0, textureCacheEntries: 0 });
    renderer.destroy();
  });

  it("builds straight and curved Pixi labels with semantic group visibility", async () => {
    const renderer = new PixiMapRenderer();
    const world = createWorld() as ReturnType<typeof createWorld> & {
      labelRenderState: NonNullable<import("../scene/render-world").MapRenderWorld["labelRenderState"]>;
    };
    world.labelRenderState = {
      groups: [
        { name: "state", type: "state", zoom: { max: 4, min: null } },
        { layerDependency: "toggleRoutes", name: "route", type: "route", zoom: { max: 40, min: 2 } }
      ],
      labels: [
        { anchor: [2, 2], entityId: 1, group: "state", id: "stateLabel1", text: "North|Realm", type: "state" },
        {
          anchor: [2, 2],
          entityId: 2,
          group: "route",
          id: "routeLabel2",
          pathPoints: [
            [0, 2],
            [2, 1],
            [4, 2]
          ],
          text: "Road",
          type: "route"
        }
      ],
      resizeOnZoom: true,
      showAll: false,
      styles: {
        route: {
          fill: "#333333",
          filter: null,
          "font-family": "Arial",
          "font-size": "3%",
          "letter-spacing": 0,
          opacity: 1,
          stroke: "#ffffff",
          "stroke-width": 0,
          style: null
        },
        state: {
          fill: "#222222",
          filter: null,
          "font-family": "Almendra SC",
          "font-size": "20%",
          "letter-spacing": 1,
          opacity: 0.8,
          stroke: "#ffffff",
          "stroke-width": 0.5,
          style: "text-shadow: white 0px 1px 4px"
        }
      }
    };
    await renderer.mount(createSurface());
    renderer.setLayerVisibility("routes", false);
    await renderer.render(world, structuredClone(DEFAULT_PIXI_MAP_STYLE), coalesceInvalidations([{ kind: "world" }]));

    const labels = applicationState.stage?.children.find(child => child.label === "labels") as
      | { children: Array<{ children: unknown[]; label: string; visible: boolean }> }
      | undefined;
    expect(labels?.children.map(group => group.label)).toEqual(["labels:state", "labels:route"]);
    expect(labels?.children[0].children).toHaveLength(1);
    expect(labels?.children[1].visible).toBe(false);
    expect(renderer.getSnapshot()).toMatchObject({
      glyphAtlasEntries: 2,
      labelGlyphs: 5,
      unsupportedLabelEffects: []
    });
    expect(renderer.getSnapshot().missingLabelFonts).toEqual(["Almendra SC", "Arial"]);
    expect(applicationState.bitmapFontInstall).toHaveBeenCalledTimes(2);
    expect(applicationState.bitmapTextCreate).toHaveBeenCalledTimes(5);

    vi.useFakeTimers();
    renderer.setLayerVisibility("routes", true);
    renderer.setCamera({ height: 600, scale: 7, width: 800, x: 0, y: 0 });
    await vi.advanceTimersByTimeAsync(100);

    expect(applicationState.bitmapFontInstall).toHaveBeenCalledTimes(3);
    expect(applicationState.bitmapFontInstall.mock.calls.at(-1)?.[0].resolution).toBe(4);
    const refreshedText = labels?.children[1].children[0] as { children: Array<{ style: { fontFamily: string } }> };
    expect(refreshedText.children[0].style.fontFamily).toBe(
      applicationState.bitmapFontInstall.mock.calls.at(-1)?.[0].name
    );
    renderer.destroy();
    expect(applicationState.bitmapFontUninstall).toHaveBeenCalledTimes(3);
  });

  it("builds camera-aware coordinates with pinned bitmap labels and one visible density group", async () => {
    const renderer = new PixiMapRenderer();
    const world = createWorld() as ReturnType<typeof createWorld> & {
      coordinateRenderState: NonNullable<import("../scene/render-world").MapRenderWorld["coordinateRenderState"]>;
    };
    world.coordinateRenderState = {
      extent: { latN: 50, latS: 40, latT: 10, lonE: 20, lonT: 20, lonW: 0 },
      height: 100,
      width: 200
    };
    renderer.setCamera({ height: 100, scale: 4, width: 200, x: -20, y: -10 });
    await renderer.mount(createSurface());
    await renderer.render(world, structuredClone(DEFAULT_PIXI_MAP_STYLE), coalesceInvalidations([{ kind: "world" }]));

    const coordinates = applicationState.stage?.children.find(child => child.label === "coordinates") as
      | { children: Array<{ label: string; visible: boolean }> }
      | undefined;
    expect(coordinates?.children).toHaveLength(7);
    expect(coordinates?.children.filter(group => group.visible).map(group => group.label)).toEqual(["coordinates:0.5"]);
    expect(renderer.getSnapshot()).toMatchObject({
      coordinateLabels: expect.any(Number),
      coordinateLines: expect.any(Number),
      glyphAtlasEntries: 1,
      missingCoordinateFonts: ["monospace"],
      unsupportedCoordinateEffects: []
    });

    renderer.setCamera({ height: 100, scale: 1, width: 200, x: 0, y: 0 });
    expect(coordinates?.children.filter(group => group.visible).map(group => group.label)).toEqual(["coordinates:2"]);
    renderer.destroy();
  });

  it("picks transformed visible entities and falls through to cell-backed areas when hidden", async () => {
    const renderer = new PixiMapRenderer({ pickTolerancePixels: 8 });
    const world = createWorld();
    world.relief = [];
    world.markers = [{ cell: 0, i: 7, type: "battle", x: 3, y: 3 } as never];
    renderer.setCamera({ height: 100, scale: 2, width: 100, x: 10, y: 20 });
    await renderer.mount(createSurface());
    await renderer.render(world, structuredClone(DEFAULT_PIXI_MAP_STYLE), coalesceInvalidations([{ kind: "world" }]));

    expect(renderer.pick({ x: 16, y: 26 })).toMatchObject({
      distance: 0,
      domainId: 7,
      domainKind: "marker",
      mapPoint: { x: 3, y: 3 },
      screenPoint: { x: 16, y: 26 }
    });
    renderer.setLayerVisibility("markers", false);
    expect(renderer.pick({ x: 16, y: 26 })).toMatchObject({
      domainId: 1,
      domainKind: "state",
      kind: "area",
      subPart: { cellId: 0 }
    });
    renderer.destroy();
  });
});

function createWorld(): PackedGraph {
  return {
    addedLabels: [],
    biomes: [{}, { color: "#00aa00" }],
    burgs: [],
    cells: {
      area: Uint8Array.from([1]),
      b: [false],
      biome: Uint8Array.from([1]),
      burg: Uint8Array.from([0]),
      c: [[]],
      conf: Uint8Array.from([0]),
      culture: Uint8Array.from([0]),
      f: Uint8Array.from([0]),
      fl: Uint8Array.from([0]),
      g: [0],
      good: Uint16Array.from([0]),
      h: Uint8Array.from([30]),
      harbor: Uint8Array.from([0]),
      haven: Uint8Array.from([0]),
      i: [0],
      market: Uint16Array.from([0]),
      p: [[2, 2]],
      pop: Uint8Array.from([0]),
      province: Uint8Array.from([0]),
      r: Uint8Array.from([0]),
      religion: Uint8Array.from([0]),
      routes: {},
      s: Uint8Array.from([0]),
      state: Uint8Array.from([1]),
      t: Uint8Array.from([0]),
      v: [[0, 1, 2]]
    },
    cultures: [],
    deals: [],
    features: [],
    goods: [],
    ice: [],
    markers: [],
    markets: [],
    measurers: [],
    provinces: [],
    relief: [{ icon: "relief-mount-1", s: 8, x: 1, y: 1 }],
    religions: [],
    rivers: [],
    routes: [],
    states: [{}, { color: "#aa0000" }],
    vertices: {
      c: [
        [0, -1, -1],
        [0, -1, -1],
        [0, -1, -1]
      ],
      i: [0, 1, 2],
      p: [
        [0, 0],
        [4, 0],
        [0, 4]
      ],
      v: [
        [1, 2, 2],
        [0, 2, 2],
        [0, 1, 1]
      ],
      x: [0, 4, 0],
      y: [0, 0, 4]
    },
    zones: []
  } as unknown as PackedGraph;
}

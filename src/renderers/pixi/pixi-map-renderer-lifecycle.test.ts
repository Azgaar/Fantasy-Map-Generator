import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const applicationState = vi.hoisted(() => ({
  assetLoad: vi.fn(async () => ({ destroy: vi.fn(), height: 8, width: 8 })),
  assetUnload: vi.fn(async () => undefined),
  destroy: vi.fn(),
  init: vi.fn(),
  positionSet: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  scaleSet: vi.fn(),
  stage: undefined as { children: Array<{ children: unknown[]; label: string; visible: boolean }> } | undefined
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
    addChild(...children: DisplayObject[]) {
      this.children.push(...children);
      return children[0];
    }
    destroy() {}
    removeChildren() {
      return this.children.splice(0);
    }
    removeFromParent() {}
  }

  class Container extends DisplayObject {}

  class Application {
    canvas = Object.assign(new EventTarget(), { style: {} });
    renderer = {
      background: { color: "" },
      constructor: { name: "MockRenderer" },
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
    stroke() {
      return this;
    }
  }

  class Graphics extends DisplayObject {
    svg() {
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

  class Text extends DisplayObject {
    anchor = { set: vi.fn() };
  }

  class Rectangle {}

  return {
    Application,
    Assets: { load: applicationState.assetLoad, unload: applicationState.assetUnload },
    Buffer,
    BufferUsage: { COPY_DST: 1, INDEX: 2, STATIC: 4, VERTEX: 8 },
    Container,
    Geometry,
    Graphics,
    GraphicsContext,
    Mesh,
    Rectangle,
    Shader,
    Sprite,
    Text
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
    applicationState.assetLoad.mockClear();
    applicationState.assetUnload.mockClear();
    applicationState.init.mockClear();
    applicationState.positionSet.mockClear();
    applicationState.render.mockClear();
    applicationState.resize.mockClear();
    applicationState.scaleSet.mockClear();
    applicationState.stage = undefined;
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

    expect(renderer.getSnapshot()).toMatchObject({ resourceCount: 18, textureCacheEntries: 3 });
    expect(applicationState.assetLoad).toHaveBeenCalledTimes(3);

    renderer.clear();
    expect(renderer.getSnapshot()).toMatchObject({ resourceBytes: 0, resourceCount: 0, textureCacheEntries: 0 });
    expect(applicationState.assetUnload).toHaveBeenCalledTimes(3);
    renderer.destroy();
  });

  it("renders the editor-independent static viewer fixture through the production lifecycle", async () => {
    const renderer = new PixiMapRenderer();
    await renderer.mount(createSurface());
    await renderer.render(
      STATIC_VIEWER_WORLD,
      structuredClone(DEFAULT_PIXI_MAP_STYLE),
      coalesceInvalidations([{ kind: "world" }])
    );

    expect(renderer.getSnapshot()).toMatchObject({ cells: 2, enabled: true, resourceCount: 17 });
    expect(applicationState.stage?.children.map(child => child.label)).toEqual([
      "ocean",
      "landmass",
      "lakes",
      "biomes",
      "cells",
      "grid",
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
      "burgIcons",
      "military",
      "markers"
    ]);
    renderer.setLayerVisibility("biomes", false);
    expect(applicationState.stage?.children.find(child => child.label === "biomes")?.visible).toBe(false);
    expect(applicationState.stage?.children.find(child => child.label === "states")?.visible).toBe(true);
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

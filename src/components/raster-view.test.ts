// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { layerList, getMapURL, suspendOceanCache } = vi.hoisted(() => ({
  layerList: [
    { id: "ocean", elementId: "ocean", parent: "viewbox" },
    { id: "coordinates", elementId: "coordinates", parent: "viewbox" },
    { id: "trade", elementId: "tradeAnimation", parent: "viewbox" },
    { id: "journeys", elementId: "journeys", parent: "viewbox" },
    { id: "rulers", elementId: "ruler", parent: "viewbox" },
    { id: "debug", elementId: "debug", parent: "viewbox" },
    { id: "scaleBar", elementId: "scaleBar", parent: "map" }
  ],
  getMapURL: vi.fn(async (_type: string, _config: unknown) => "blob:map"),
  suspendOceanCache: vi.fn()
}));

vi.mock("@/components/layers", () => ({
  Layers: { all: layerList, get: (id: string) => layerList.find(layer => layer.id === id) }
}));
vi.mock("@/renderers/ocean-cache", () => ({ suspendOceanCache }));
vi.mock("@/renderers/viewport/viewport-renderer", async () => {
  const { viewport } = await import("@/components/viewport");
  return {
    ViewportLayers: {
      getVisibleBounds: () => {
        const { scale, x, y, width, height } = viewport;
        return { scale, x0: -x / scale, y0: -y / scale, x1: (width - x) / scale, y1: (height - y) / scale };
      }
    }
  };
});
vi.mock("@/services/io/export", () => ({ ExportMap: { getMapURL } }));

import { setViewportSize, setViewportTransform } from "@/components/viewport";
import { RasterView } from "./raster-view";

const context = { clearRect: vi.fn(), drawImage: vi.fn() };
const createImageBitmap = vi.fn(async (...args: unknown[]) => {
  const { resizeWidth, resizeHeight } = args[5] as { resizeWidth: number; resizeHeight: number };
  return { width: resizeWidth, height: resizeHeight, close: vi.fn() };
});
const canvas = () => document.getElementById("rasterView") as HTMLCanvasElement | null;
const idle = () => vi.runAllTimersAsync();
const configs = () => getMapURL.mock.calls.map(([, config]) => config as Record<string, unknown>);
const crops = () => createImageBitmap.mock.calls.map(args => args.slice(1, 5));

/** Turned on, with the overview built and shown */
async function shown(): Promise<void> {
  RasterView.setEnabled(true);
  await idle();
  expect(canvas()?.hidden).toBe(false);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = `<svg id="map"><g id="viewbox"><g id="ocean"></g><g id="coordinates"></g><g id="debug"></g></g></svg>`;
  Object.assign(globalThis, { options: { map: { graph: { width: 1000, height: 600 } } }, ERROR: false });
  vi.stubGlobal("createImageBitmap", createImageBitmap);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  HTMLImageElement.prototype.decode = () => Promise.resolve();
  getMapURL.mockClear();
  createImageBitmap.mockClear();
  setViewportSize(1000, 600);
  setViewportTransform(4, -1500, -900); // the view is x 375–625, y 225–375; the overview is sharp up to 5.16×
});

afterEach(() => {
  RasterView.setEnabled(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("RasterView", () => {
  it("puts a hidden canvas right before the map, suspends the ocean cache, and undoes both", () => {
    RasterView.setEnabled(true);
    expect(canvas()?.nextElementSibling?.id).toBe("map");
    expect(canvas()?.hidden).toBe(true);
    expect(suspendOceanCache).toHaveBeenLastCalledWith(true);

    RasterView.setEnabled(false);
    expect(canvas()).toBeNull();
    expect(suspendOceanCache).toHaveBeenLastCalledWith(false);
  });

  it("exports the whole map once and cuts the overview from it, without live layers or those outside the camera", async () => {
    await shown();

    expect(configs()).toHaveLength(1);
    const { region, exclude } = configs()[0] as { region: object; exclude: string[] };
    expect(region).toEqual({ x0: 0, y0: 0, x1: 1000, y1: 600, width: 1000, height: 600 });
    expect(exclude.sort()).toEqual(["coordinates", "debug", "journeys", "ruler", "scaleBar", "tradeAnimation"]);
    expect(crops()).toEqual([[0, 0, 1000, 600]]);
  });

  it("tiles a view zoomed past the overview from one snapshot of its level, nearest the centre first", async () => {
    setViewportTransform(8, -3600, -2100); // the view is x 450–575, y 262.5–337.5; tiles are 64 map units
    await shown();

    expect(configs()).toHaveLength(2);
    expect(configs()[1].region).toEqual({ x0: 0, y0: 0, x1: 1000, y1: 600, width: 8000, height: 4800 });
    expect(crops()).toHaveLength(1 + 16); // the overview, then 4×4 tiles with a one-tile margin
    expect(crops()[1]).toEqual([8 * 512, 4 * 512, 512, 512]);
  });

  it("carries every frame of a gesture and starts no work until it settles", async () => {
    await shown();

    setViewportTransform(8, -3600, -2100);
    expect(RasterView.follow()).toBe(true);
    expect(canvas()?.hasAttribute("data-moving")).toBe(true);
    await idle();
    expect(configs()).toHaveLength(1);

    document.getElementById("ocean")!.setAttribute("font-size", "3"); // the SVG catching up when it ends
    RasterView.settle();
    expect(canvas()?.hasAttribute("data-moving")).toBe(false);
    await idle();
    expect(configs()).toHaveLength(2); // the level-8 snapshot, not a rebuild of the overview
    expect(configs()[1].region).toMatchObject({ width: 8000 });
  });

  it("keeps showing the old bitmaps after an edit until new ones replace them", async () => {
    await shown();

    document.getElementById("ocean")!.setAttribute("fill", "red");
    await Promise.resolve();
    expect(canvas()?.hidden).toBe(false);
    await idle();
    expect(configs()).toHaveLength(2);
    expect(crops()).toHaveLength(2);
  });

  it("ignores changes in live layers and in the camera transform", async () => {
    await shown();

    document.getElementById("coordinates")!.append(document.createElementNS("http://www.w3.org/2000/svg", "text"));
    document.getElementById("debug")!.setAttribute("opacity", "0.5");
    document.getElementById("viewbox")!.setAttribute("transform", "scale(2)");
    await idle();
    expect(configs()).toHaveLength(1);
  });

  it("keeps fresh tiles once the cache is full, instead of evicting and redrawing them", async () => {
    const centre = (cx: number, cy: number) => setViewportTransform(16, 500 - cx * 16, 300 - cy * 16);
    centre(500, 300); // 32-unit tiles, about 20 per view
    await shown();
    for (const cx of [100, 300, 700, 900]) {
      for (const cy of [100, 300, 500]) {
        centre(cx, cy);
        RasterView.follow();
        RasterView.settle();
        await idle();
      }
    }

    const drawn = createImageBitmap.mock.calls.length;
    expect(drawn).toBeGreaterThan(1 + 160); // past the budget
    RasterView.settle();
    await idle();
    expect(createImageBitmap.mock.calls.length).toBe(drawn); // the view's tiles survived: nothing to redo
  });

  it("drops work that finishes after it was turned off", async () => {
    let finish: (url: string) => void = () => {};
    getMapURL.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
    RasterView.setEnabled(true);
    await vi.advanceTimersByTimeAsync(200);

    RasterView.setEnabled(false);
    finish("blob:map");
    await idle();
    expect(canvas()).toBeNull();
    expect(createImageBitmap).not.toHaveBeenCalled();
  });
});

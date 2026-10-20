// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cacheOceanLayer, clearOceanCache, getRasterRegion, restoreOceanVectors } from "./ocean-cache";
import type { ViewportRenderContext } from "./viewport/viewport-renderer";

const view = vi.hoisted(() => ({
  bounds: { x0: 400, y0: 200, x1: 800, y1: 400, scale: 2 },
  render: (_context: ViewportRenderContext) => {}
}));
vi.mock("./viewport/viewport-renderer", () => ({
  ViewportLayers: {
    register: ({ render }: { render: typeof view.render }) => {
      view.render = render;
    },
    getContext: () => ({ root: document, bounds: view.bounds }),
    getVisibleBounds: () => view.bounds
  }
}));

const decode = vi.fn<() => Promise<void>>();
const sources: string[] = [];
const revoke = vi.fn();
let urlIndex = 0;

beforeEach(() => {
  document.body.innerHTML = `<svg><defs><g id="featurePaths"><path id="feature_1" d="M0 0H10V10Z" /></g>
    <mask id="bands-mask"><use href="#feature_1" /></mask></defs>
    <g id="viewbox"><g id="oceanBands" opacity="0.5" mask="url(#bands-mask)"><rect fill="blue" width="100" height="100" /></g></g></svg>`;
  vi.stubGlobal("options", {
    map: { graph: { width: 2000, height: 1000 } },
    app: { performance: { shapeRendering: "optimizeSpeed" } }
  });
  view.bounds = { x0: 400, y0: 200, x1: 800, y1: 400, scale: 2 };
  sources.length = 0;
  decode.mockReset().mockResolvedValue();
  revoke.mockClear();
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      decode() {
        sources.push(this.src);
        return decode();
      }
    }
  );
  vi.stubGlobal("URL", { createObjectURL: () => `blob:cache-${++urlIndex}`, revokeObjectURL: revoke });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob()));
});

afterEach(() => {
  clearOceanCache("oceanBands");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const group = () => document.getElementById("oceanBands") as unknown as SVGGElement;
const render = () => view.render({ root: document, bounds: view.bounds });
const bitmap = () => group().querySelector(":scope > image");

test("bounds raster memory by the viewport and caps high-DPI allocations", () => {
  const small = getRasterRegion(view.bounds, 100000, 100000, 1)!;
  const huge = getRasterRegion({ x0: 0, y0: 0, x1: 10000, y1: 10000, scale: 4 }, 10000, 10000, 4)!;
  expect(small.width).toBeLessThan(2000);
  expect(huge.width * huge.height).toBeLessThanOrEqual(16_010_000);
  expect(getRasterRegion({ ...view.bounds, x0: 3000, x1: 4000 }, 2000, 1000, 1)).toBeUndefined();
});

test("restores identical editable vectors in a clone without changing the live cache", async () => {
  const original = group().outerHTML;
  cacheOceanLayer(group(), ["bands-mask"]);
  await vi.waitFor(() => expect(bitmap()).not.toBeNull());
  const clone = document.querySelector("svg")!.cloneNode(true) as SVGSVGElement;
  restoreOceanVectors(clone);
  expect(clone.querySelector("#oceanBands")!.outerHTML).toBe(original);
  expect(clone.querySelector("image, defs[data-ocean-cache]")).toBeNull();
  expect(bitmap()).not.toBeNull();
  const svg = new DOMParser().parseFromString(decodeURIComponent(sources[0].split(",")[1]), "image/svg+xml");
  expect(svg.getElementById("feature_1")).not.toBeNull();
  expect(svg.getElementById("bands-mask")).not.toBeNull();
});

test("reuses the bitmap during nearby pans and refreshes at a new zoom resolution", async () => {
  cacheOceanLayer(group(), ["bands-mask"]);
  await vi.waitFor(() => expect(bitmap()).not.toBeNull());
  const first = bitmap()!.getAttribute("href");
  view.bounds = { ...view.bounds, x0: 450, x1: 850 };
  render();
  expect(decode).toHaveBeenCalledTimes(2);
  view.bounds.scale = 4;
  render();
  await vi.waitFor(() => expect(bitmap()!.getAttribute("href")).not.toBe(first));
  expect(revoke).toHaveBeenCalledWith(first);
});

test("falls back to vectors when panning outside the cached area", async () => {
  cacheOceanLayer(group(), ["bands-mask"]);
  await vi.waitFor(() => expect(bitmap()).not.toBeNull());
  decode.mockImplementation(() => new Promise(() => {}));
  view.bounds = { ...view.bounds, x0: 1400, x1: 1800 };
  render();
  expect(bitmap()).toBeNull();
  expect(group().querySelector(':scope > use[href="#oceanBands-source"]')).not.toBeNull();
});

test("invalidates cached geometry when shared coastline paths change", async () => {
  cacheOceanLayer(group(), ["bands-mask"]);
  await vi.waitFor(() => expect(bitmap()).not.toBeNull());
  document.getElementById("feature_1")!.setAttribute("d", "M0 0H20V20Z");
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(4));
  expect(decodeURIComponent(sources[2])).toContain("M0 0H20V20Z");
});

test("a pending decode cannot overwrite restored vectors or a replaced map", async () => {
  let resolve!: () => void;
  decode.mockImplementation(
    () =>
      new Promise<void>(done => {
        resolve = done;
      })
  );
  const original = group().outerHTML;
  cacheOceanLayer(group(), ["bands-mask"]);
  restoreOceanVectors(document);
  resolve();
  await new Promise(done => setTimeout(done, 0));
  expect(group().outerHTML).toBe(original);
  expect(bitmap()).toBeNull();
});

test("decode failure leaves vectors visible and cache disposal releases its blob", async () => {
  decode.mockRejectedValueOnce(new Error("decode failed"));
  cacheOceanLayer(group(), ["bands-mask"]);
  await new Promise(done => setTimeout(done, 0));
  expect(group().querySelector(":scope > use")).not.toBeNull();
  render();
  await vi.waitFor(() => expect(bitmap()).not.toBeNull());
  const url = bitmap()!.getAttribute("href");
  clearOceanCache("oceanBands");
  expect(revoke).toHaveBeenCalledWith(url);
});

test("a failed zoom refresh restores vectors instead of leaving a low-resolution bitmap", async () => {
  cacheOceanLayer(group(), ["bands-mask"]);
  await vi.waitFor(() => expect(bitmap()).not.toBeNull());
  const url = bitmap()!.getAttribute("href");
  decode.mockRejectedValueOnce(new Error("out of memory"));
  view.bounds.scale = 8;
  render();
  await vi.waitFor(() => expect(bitmap()).toBeNull());
  expect(group().querySelector(":scope > use")).not.toBeNull();
  expect(revoke).toHaveBeenCalledWith(url);
});

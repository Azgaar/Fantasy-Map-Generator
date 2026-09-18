// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/components/viewport";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import { getIsolines } from "@/utils/pathUtils";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));
vi.mock("@/utils/pathUtils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils/pathUtils")>()),
  getIsolines: vi.fn()
}));

import "@/generators/styles";
import { drawMarkets, highlightMarketOff, highlightMarketOn } from "./draw-markets";

function territory(x: number, y = 0, size = 100): { polygons: [number, number][][] } {
  return {
    polygons: [
      [
        [x, y],
        [x + size, y],
        [x + size, y + size],
        [x, y + size]
      ]
    ]
  };
}

beforeEach(() => {
  mocks.layerOn = true;
  document.body.innerHTML = '<svg id="map"><g id="markets"></g></svg>';
  globalThis.pack = {
    cells: { market: new Uint16Array([1, 2]) },
    markets: [
      { i: 1, centerBurgId: 1, color: "#ff0000", goods: {} },
      { i: 2, centerBurgId: 2, color: "#00ff00", goods: {} }
    ],
    burgs: [{}, { i: 1, x: 50, y: 50 }, { i: 2, x: 550, y: 50 }]
  } as never;
  styles.markets.options = { size: 3, fontSize: 5, icon: "🛒" };
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
  vi.mocked(getIsolines)
    .mockReset()
    .mockReturnValue({ 1: territory(0), 2: territory(500) });
});

test("panning culls territories and centers without rebuilding their paths", () => {
  drawMarkets();
  expect(document.querySelector("#market1 .fill")).not.toBeNull();
  expect(document.querySelector("#market1 circle")).not.toBeNull();
  expect(document.getElementById("market2")).toBeNull();
  const markup = document.getElementById("markets")!.innerHTML;
  ViewportLayers.renderNow();
  expect(document.getElementById("markets")!.innerHTML).toBe(markup);
  setViewportTransform(1, -500, 0);
  ViewportLayers.renderNow();
  expect(document.getElementById("market1")).toBeNull();
  expect(document.querySelector("#market2 circle")).not.toBeNull();
  expect(getIsolines).toHaveBeenCalledTimes(1);
});

test("territories intersecting the viewport render even when their centers are offscreen", () => {
  pack.burgs[1].x = 1000;
  vi.mocked(getIsolines).mockReturnValue({ 1: territory(-500, -500, 1500), 2: territory(500) });
  drawMarkets();
  expect(document.querySelector("#market1 .fill")).not.toBeNull();
  expect(document.querySelector("#market1 circle")).toBeNull();
  expect(document.querySelector("#market1 .border")?.getAttribute("clip-path")).toBe("url(#market-clip-1)");
});

test("center artwork at the edge renders independently of its territory", () => {
  pack.burgs[2].x = 185;
  drawMarkets();
  expect(document.querySelector("#market2 text")).not.toBeNull();
  expect(document.querySelector("#market2 .fill")).toBeNull();
  pack.burgs[2].x = 190;
  ViewportLayers.renderNow();
  expect(document.getElementById("market2")).toBeNull();
});

test("zoom updates icon sizing and full-map export restores every market at scale one", () => {
  setViewportTransform(4, 0, 0);
  drawMarkets();
  expect(document.querySelector("#market1 circle")?.getAttribute("r")).toBe("3.25");
  expect(document.querySelector("#market1 text")?.getAttribute("font-size")).toBe("5.25px");
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#markets > g")).toHaveLength(2);
  expect(clone.querySelector("#market2 circle")?.getAttribute("r")).toBe("4");
  expect(clone.querySelector("#market2 text")?.getAttribute("font-size")).toBe("6px");
  expect(document.getElementById("market2")).toBeNull();
  expect(document.querySelector("#market1 circle")?.getAttribute("r")).toBe("3.25");
  const markup = clone.innerHTML;
  ViewportLayers.renderTo(clone);
  expect(clone.innerHTML).toBe(markup);
  expect(getIsolines).toHaveBeenCalledTimes(1);
});

test("redraw picks up territory painting, styles, centers and deletion", () => {
  drawMarkets();
  const oldPath = document.querySelector("#market1 .fill")!.getAttribute("d");
  vi.mocked(getIsolines).mockReturnValue({ 1: territory(10) });
  pack.markets[0].color = "#0000ff";
  pack.markets.pop();
  pack.burgs[1].x = 70;
  styles.markets.options.icon = "🏰";
  styles.markets.options.size = 8;
  drawMarkets();
  expect(document.querySelector("#market1 .fill")?.getAttribute("d")).not.toBe(oldPath);
  expect(document.querySelector("#market1 .fill")?.getAttribute("fill")).toBe("#0000ff");
  expect(document.querySelector("#market1 circle")?.getAttribute("cx")).toBe("70");
  expect(document.querySelector("#market1 circle")?.getAttribute("r")).toBe("9");
  expect(document.querySelector("#market1 text")?.textContent).toBe("🏰");
  expect(document.querySelectorAll("#markets > g")).toHaveLength(1);
});

test("replacement map and territory arrays invalidate cached geometry", () => {
  drawMarkets();
  vi.mocked(getIsolines).mockReturnValue({ 1: territory(500) });
  globalThis.pack = { ...pack, burgs: [{}] } as never;
  ViewportLayers.renderNow();
  expect(document.getElementById("market1")).toBeNull();
  vi.mocked(getIsolines).mockReturnValue({ 1: territory(0) });
  pack.cells.market = new Uint16Array([1]);
  ViewportLayers.renderNow();
  expect(document.querySelector("#market1 .fill")).not.toBeNull();
  expect(getIsolines).toHaveBeenCalledTimes(3);
});

test("viewport rendering leaves disabled layers empty", () => {
  mocks.layerOn = false;
  ViewportLayers.renderNow();
  expect(document.getElementById("markets")!.childElementCount).toBe(0);
  expect(getIsolines).not.toHaveBeenCalled();
  mocks.layerOn = true;
  drawMarkets();
  expect(document.getElementById("market1")).not.toBeNull();
});

test("delegated hover ignores movement within a market and highlights rebuilt groups", () => {
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = [];
  Element.prototype.animate = vi.fn(() => {
    const animation = { cancel: vi.fn(), onfinish: null };
    animations.push(animation);
    return animation as unknown as Animation;
  });
  Element.prototype.getAnimations = () => [];
  drawMarkets();
  ViewportLayers.renderNow();
  const circle = document.querySelector("#market1 circle")!;
  circle.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  expect(document.querySelectorAll("#market1 .highlight")).toHaveLength(1);
  expect(animations).toHaveLength(1);
  circle.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: circle.nextElementSibling }));
  expect(animations).toHaveLength(1);
  circle.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  animations[1].onfinish!();
  expect(document.querySelector("#market1 .highlight")).toBeNull();
  highlightMarketOn(1);
  highlightMarketOn(1);
  expect(document.querySelectorAll("#market1 .highlight")).toHaveLength(1);
  highlightMarketOff(1);
  animations.at(-1)!.onfinish!();
  expect(document.querySelector("#market1 .highlight")).toBeNull();
});

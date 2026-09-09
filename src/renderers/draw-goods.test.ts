// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/components/viewport";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/components/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));

import "@/generators/styles";
import { drawGoods } from "./draw-goods";

// two cells, one at the origin and one far to the right, each producing one good
const CELLS = [
  [50, 50],
  [550, 50]
];

type Production = Record<number, number>;
const getCellProduction = vi.fn<(cellId: number) => Production>();
const getBurgProduction = vi.fn<(burg: { i: number }) => Production>();

beforeEach(() => {
  mocks.layerOn = true;
  document.body.innerHTML = /* html */ `<svg id="map">
      <g id="goods"><g id="goodsCells"></g><g id="goodsIcons"></g><g id="goodsBurgs"></g></g>
    </svg>`;
  globalThis.pack = {
    cells: {
      i: [0, 1],
      p: CELLS,
      good: [1, 2],
      v: [
        [0, 1, 2],
        [3, 4, 5]
      ]
    },
    vertices: {
      p: [
        [40, 40],
        [60, 40],
        [50, 60],
        [540, 40],
        [560, 40],
        [550, 60]
      ]
    },
    goods: [
      { i: 1, name: "Grain", color: "#ff0000", icon: "icon-grain", visible: true },
      { i: 2, name: "Iron", color: "#00ff00", icon: "icon-iron", visible: true }
    ],
    burgs: [{}, { i: 1, x: 50, y: 60, production: {} }, { i: 2, x: 550, y: 60, production: {} }]
  } as never;
  globalThis.Goods = {
    get: (id: number) => pack.goods.find(good => good.i === id),
    getBiomesProduction: () => ({}),
    getStroke: () => "#333"
  } as never;
  globalThis.Production = { getCellProduction, getBurgProduction } as never;
  globalThis.Pack = { getPolygon: (cellId: number) => pack.cells.v[cellId].map(v => pack.vertices.p[v]) } as never;
  getCellProduction.mockReset().mockImplementation(cellId => (cellId === 0 ? { 1: 4 } : { 2: 8 }) as Production);
  getBurgProduction.mockReset().mockImplementation(burg => (burg.i === 1 ? { 1: 5, 2: 2 } : { 2: 9 }) as Production);
  styles.goods.goodsIcons.options = { size: 4, circle: true };
  styles.goods.goodsBurgs.options = { size: 3 };
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
});

test("panning culls each sublayer without recomputing production", () => {
  drawGoods();
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(1);
  expect(document.querySelectorAll("#goodsIcons > g")).toHaveLength(1);
  expect(document.querySelectorAll("#goodsBurgs > g")).toHaveLength(1);
  expect(document.querySelector("#goodsIcons > g")?.getAttribute("data-i")).toBe("1");
  expect(document.querySelector("#goodsBurgs > g")?.getAttribute("data-id")).toBe("1");

  const markup = document.getElementById("goods")!.innerHTML;
  ViewportLayers.renderNow();
  expect(document.getElementById("goods")!.innerHTML).toBe(markup);

  setViewportTransform(1, -500, 0);
  ViewportLayers.renderNow();
  expect(document.querySelector("#goodsIcons > g")?.getAttribute("data-i")).toBe("2");
  expect(document.querySelector("#goodsBurgs > g")?.getAttribute("data-id")).toBe("2");
  expect(document.querySelector("#goodsCells polygon")?.getAttribute("fill")).toBe("#00ff00");
  expect(getCellProduction).toHaveBeenCalledTimes(2); // once per cell, at build time only
  expect(getBurgProduction).toHaveBeenCalledTimes(2);
});

test("cell opacity is normalized against the map-wide maximum, not the visible one", () => {
  drawGoods();
  const first = document.querySelector("#goodsCells polygon");
  expect(first?.getAttribute("fill-opacity")).toBe("0.55"); // 4 of a 8 maximum that is off-screen
  expect(first?.getAttribute("points")).toBe("40,40 60,40 50,60");

  setViewportTransform(1, -500, 0);
  ViewportLayers.renderNow();
  expect(document.querySelector("#goodsCells polygon")?.getAttribute("fill-opacity")).toBe("1");
});

test("style options are applied on the next frame, without rebuilding the scene", () => {
  drawGoods();
  expect(document.querySelector("#goodsIcons circle")?.getAttribute("r")).toBe("2");
  expect(document.querySelector("#goodsIcons use")?.getAttribute("width")).toBe("4");

  styles.goods.goodsIcons.options.size = 10;
  styles.goods.goodsIcons.options.circle = false;
  styles.goods.goodsBurgs.options.size = 6;
  ViewportLayers.renderNow();
  expect(document.querySelector("#goodsIcons circle")).toBeNull();
  expect(document.querySelector("#goodsIcons use")?.getAttribute("width")).toBe("10");
  expect(document.querySelector("#goodsBurgs rect")?.getAttribute("height")).toBe("8.4");
  expect(getCellProduction).toHaveBeenCalledTimes(2);
});

test("burg plates keep the three biggest producers, biggest first", () => {
  getBurgProduction.mockImplementation(() => ({ 1: 1, 2: 9 }));
  drawGoods();
  const circles = [...document.querySelectorAll("#goodsBurgs circle")].map(c => c.getAttribute("fill"));
  const values = [...document.querySelectorAll("#goodsBurgs text")].map(t => t.textContent);
  expect(circles).toEqual(["#00ff00", "#ff0000"]);
  expect(values).toEqual(["9", "1"]);
});

test("hidden goods drop out of every sublayer", () => {
  pack.goods[0].visible = false;
  drawGoods();
  expect(document.querySelectorAll("#goodsIcons > g")).toHaveLength(0); // cell 0's good is hidden
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(0);
  expect(document.querySelectorAll("#goodsBurgs text")).toHaveLength(1);
  expect(document.querySelector("#goodsBurgs text")?.textContent).toBe("2");

  pack.goods[1].visible = false;
  drawGoods();
  expect(document.getElementById("goods")!.textContent).toBe("");
});

test("full-map export renders every good at once, leaving the live map culled", () => {
  drawGoods();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#goodsCells polygon")).toHaveLength(2);
  expect(clone.querySelectorAll("#goodsIcons > g")).toHaveLength(2);
  expect(clone.querySelectorAll("#goodsBurgs > g")).toHaveLength(2);
  expect(document.querySelectorAll("#goodsIcons > g")).toHaveLength(1);
});

test("a replacement map invalidates the cached production", () => {
  drawGoods();
  globalThis.pack = { ...pack, goods: [{ ...pack.goods[0], color: "#0000ff" }] } as never;
  ViewportLayers.renderNow();
  expect(document.querySelector("#goodsCells polygon")?.getAttribute("fill")).toBe("#0000ff");
  expect(getCellProduction).toHaveBeenCalledTimes(4);
});

test("viewport rendering leaves a disabled layer empty", () => {
  drawGoods();
  mocks.layerOn = false;
  document.getElementById("goodsCells")!.replaceChildren(); // the layer registry erases the content when hidden
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(0);

  mocks.layerOn = true;
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(1);
});

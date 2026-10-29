// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize, setViewportTransform } from "@/renderers/viewport/viewport";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";

const mocks = vi.hoisted(() => ({ layerOn: true }));
vi.mock("@/renderers/layers", () => ({ Layers: { isOn: () => mocks.layerOn } }));
vi.mock("@/model/icons", () => ({
  Icons: { load: vi.fn().mockResolvedValue(undefined), href: (id: string) => `#${id}` }
}));

import "@/model/styles/styles";
import { Goods } from "@/model/economy/goods-generator";
import { Production } from "@/model/economy/production-generator";
import { Pack } from "@/model/graph/pack-generator";
import { drawGoods } from "./draw-goods";

// two cells, one at the origin and one far to the right, each producing one good
const CELLS = [
  [50, 50],
  [550, 50]
];

type Output = Record<number, number>;
const cellOutput = vi.fn<(cellId: number) => Output>(); // each cell's rural output
const getBurgProduction = vi.fn<(burg: { i: number }) => Output>();

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
      { i: 1, name: "Grain", color: "#ff0000", icon: "goods-grain", value: 1, visible: true },
      { i: 2, name: "Iron", color: "#00ff00", icon: "goods-iron", value: 1, visible: true }
    ],
    burgs: [{}, { i: 1, x: 50, y: 60, production: {} }, { i: 2, x: 550, y: 60, production: {} }]
  } as never;
  Object.assign(Goods, {
    get: (id: number) => pack.goods.find(good => good.i === id),
    getStroke: () => "#333"
  });
  Object.assign(Production, { getRuralOutput: () => Array.from(pack.cells.i, cellOutput), getBurgProduction });
  Object.assign(Pack, { getPolygon: (cellId: number) => pack.cells.v[cellId].map(v => pack.vertices.p[v]) });
  cellOutput.mockReset().mockImplementation(cellId => (cellId === 0 ? { 1: 4 } : { 2: 8 }) as Output);
  getBurgProduction.mockReset().mockImplementation(burg => (burg.i === 1 ? { 1: 5, 2: 2 } : { 2: 9 }) as Output);
  styles.goods.groups.goodsCells.options = { render: true };
  styles.goods.groups.goodsIcons.options = { render: true, size: 4, circle: true };
  styles.goods.groups.goodsBurgs.options = { render: true, size: 3 };
  setViewportSize(100, 100);
  setViewportTransform(1, 0, 0);
});

test("panning culls each sublayer without recomputing production", async () => {
  await drawGoods();
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
  expect(cellOutput).toHaveBeenCalledTimes(2); // once per cell, at build time only
  expect(getBurgProduction).toHaveBeenCalledTimes(2);
});

test("cell opacity is normalized against the map-wide maximum, not the visible one", async () => {
  await drawGoods();
  const first = document.querySelector("#goodsCells polygon");
  expect(first?.getAttribute("fill-opacity")).toBe("0.55"); // 4 of a 8 maximum that is off-screen
  expect(first?.getAttribute("points")).toBe("40,40 60,40 50,60");

  setViewportTransform(1, -500, 0);
  ViewportLayers.renderNow();
  expect(document.querySelector("#goodsCells polygon")?.getAttribute("fill-opacity")).toBe("1");
});

test("style options are applied on the next frame, without rebuilding the scene", async () => {
  await drawGoods();
  expect(document.querySelector("#goodsIcons circle")?.getAttribute("r")).toBe("2");
  expect(document.querySelector("#goodsIcons use")?.getAttribute("width")).toBe("4");

  styles.goods.groups.goodsIcons.options.size = 10;
  styles.goods.groups.goodsIcons.options.circle = false;
  styles.goods.groups.goodsBurgs.options.size = 6;
  ViewportLayers.renderNow();
  expect(document.querySelector("#goodsIcons circle")).toBeNull();
  expect(document.querySelector("#goodsIcons use")?.getAttribute("width")).toBe("10");
  expect(document.querySelector("#goodsBurgs path")?.getAttribute("d")).toContain("A9,9"); // 1.5 times the size
  expect(cellOutput).toHaveBeenCalledTimes(2);
});

test("icon lines follow the style at the marker's proportions", async () => {
  styles.goods.groups.goodsIcons.attrs.stroke = "#123456";
  styles.goods.groups.goodsIcons.attrs["stroke-width"] = 0.3;
  styles.goods.groups.goodsIcons.options.size = 6;
  await drawGoods();
  const use = document.querySelector("#goodsIcons use");
  expect(use?.getAttribute("stroke")).toBe("#123456");
  expect(use?.getAttribute("stroke-width")).toBe("2"); // 40% of 0.3 map units, in a 100-unit frame 6 units wide
});

test("hidden goods drop out of every sublayer, burg pies included", async () => {
  pack.goods[0].visible = false;
  await drawGoods();
  expect(document.querySelectorAll("#goodsIcons > g")).toHaveLength(0); // cell 0's good is hidden
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(0);
  const pie = document.querySelector('#goodsBurgs > g[data-id="1"] circle'); // only iron is left: a full circle
  expect(pie?.getAttribute("data-goods")).toBe("2");
  expect(pie?.getAttribute("fill")).toBe("#00ff00");
});

test("an icon sits at its cell's center, or on a burg's cell at the burg, in the middle of its pie", async () => {
  pack.cells.burg = [1, 0] as never;
  setViewportTransform(0.1, 0, 0);
  await drawGoods();
  const [onBurg, plain] = document.querySelectorAll<SVGGElement>("#goodsIcons > g");
  expect(onBurg.querySelector("circle")?.getAttribute("cy")).toBe("60"); // burg 1 stands at 50,60
  expect(onBurg.dataset.cell).toBe("0");
  expect(plain.querySelector("circle")?.getAttribute("cy")).toBe("50");
});

test("each sublayer can be switched off in the style", async () => {
  await drawGoods();
  styles.goods.groups.goodsCells.options.render = false;
  styles.goods.groups.goodsBurgs.options.render = false;
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(0);
  expect(document.querySelectorAll("#goodsBurgs > g")).toHaveLength(0);
  expect(document.querySelectorAll("#goodsIcons > g")).toHaveLength(1);
});

test("with no good selected, cells show their output value in their most valuable good's color, with every icon and burg", async () => {
  for (const good of pack.goods) good.visible = false;
  pack.goods[1].value = 10; // one iron is worth ten grain
  cellOutput.mockImplementation(cellId => (cellId === 0 ? { 1: 4 } : { 1: 20, 2: 8 }) as Output);
  setViewportTransform(0.1, 0, 0);
  await drawGoods();

  const cells = [...document.querySelectorAll("#goodsCells polygon")].map(polygon => [
    polygon.getAttribute("fill"),
    polygon.getAttribute("fill-opacity")
  ]);
  expect(cells).toEqual([
    ["#ff0000", "1"], // 4 saturates: the 95th percentile of two cells is the lower
    ["#00ff00", "1"] // 80 of iron outweighs 20 of grain
  ]);
  expect(document.querySelectorAll("#goodsIcons > g")).toHaveLength(2);

  // burg values 25 and 90 both saturate: pies of 1.5 times the plate icon setting, a single good a full circle
  const [mixed, single] = document.querySelectorAll<SVGGElement>("#goodsBurgs > g[data-id]");
  const sectors = [...mixed.querySelectorAll("path")].map(path => [path.dataset.goods, path.getAttribute("fill")]);
  expect(sectors).toEqual([
    ["2", "#00ff00"], // 20 of 25: iron first
    ["1", "#ff0000"]
  ]);
  expect(single.querySelector("circle")?.getAttribute("r")).toBe("4.5");
});

test("a burg pie shows its five most valuable goods and the rest as one sector", async () => {
  pack.goods = Array.from({ length: 7 }, (_, index) => ({
    i: index + 1,
    name: `Good ${index + 1}`,
    color: `#00000${index + 1}`,
    icon: "",
    value: index + 1
  })) as never;
  getBurgProduction.mockImplementation(() => Object.fromEntries(pack.goods.map(good => [good.i, 1])));
  await drawGoods();

  const goods = [...document.querySelectorAll<SVGPathElement>('#goodsBurgs > g[data-id="1"] path')].map(
    path => path.dataset.goods
  );
  expect(goods).toEqual(["7", "6", "5", "4", "3", "2,1"]);
});

test("full-map export renders every good at once, leaving the live map culled", async () => {
  await drawGoods();
  const clone = document.getElementById("map")!.cloneNode(true) as SVGSVGElement;
  ViewportLayers.renderTo(clone);
  expect(clone.querySelectorAll("#goodsCells polygon")).toHaveLength(2);
  expect(clone.querySelectorAll("#goodsIcons > g")).toHaveLength(2);
  expect(clone.querySelectorAll("#goodsBurgs > g")).toHaveLength(2);
  expect(document.querySelectorAll("#goodsIcons > g")).toHaveLength(1);
});

test("a replacement map invalidates the cached production", async () => {
  await drawGoods();
  globalThis.pack = { ...pack, goods: [{ ...pack.goods[0], color: "#0000ff" }] } as never;
  ViewportLayers.renderNow();
  expect(document.querySelector("#goodsCells polygon")?.getAttribute("fill")).toBe("#0000ff");
  expect(cellOutput).toHaveBeenCalledTimes(4);
});

test("viewport rendering leaves a disabled layer empty", async () => {
  await drawGoods();
  mocks.layerOn = false;
  document.getElementById("goodsCells")!.replaceChildren(); // the layer registry erases the content when hidden
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(0);

  mocks.layerOn = true;
  ViewportLayers.renderNow();
  expect(document.querySelectorAll("#goodsCells polygon")).toHaveLength(1);
});

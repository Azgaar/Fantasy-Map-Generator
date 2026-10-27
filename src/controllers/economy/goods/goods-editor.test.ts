// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/renderers/layers", () => ({
  Layers: { show: vi.fn(), hide: vi.fn(), has: () => false, draw: vi.fn(), isOn: () => false }
}));
vi.mock("@/ui/tooltips", () => ({ tip: vi.fn(), clearMainTip: vi.fn() }));
vi.mock("@/ui/map/viewbox-events", () => ({ applyDefaultViewboxEvents: vi.fn() }));
vi.mock("@/model/icons", () => ({ Icons: { retry: vi.fn(), href: (id: string) => `#${id}` } }));
vi.mock("@/controllers", () => ({ Controllers: {} }));

import "@/model/styles/styles";
import { Goods } from "@/model/economy/goods-generator";
import { dialogState } from "@/ui/dialog/state";
import { GoodsEditor } from "./goods-editor";

const good = (i: number, name: string, tags: string[]) => ({
  i,
  name,
  tags,
  color: "#fff",
  icon: "",
  value: 1,
  unit: ""
});

beforeEach(() => {
  dialogState.remove("goodsEditor", "filters");
  document.body.innerHTML = /* html */ `<div id="dialogs"></div><svg></svg>`;
  vi.stubGlobal("options", { app: { mode: null } });
  vi.stubGlobal("pack", {
    cells: { i: [] },
    burgs: [],
    markets: [],
    deals: [],
    goods: [good(1, "Grain", ["food"]), good(2, "Iron", ["metal"]), good(3, "Bread", ["food", "baked"])]
  });
  Object.assign(Goods, { get: (id: number) => pack.goods.find(g => g.i === id), getBiomesProduction: () => ({}) });
});

const search = (query: string) => {
  const input = document.getElementById("goodsSearch") as HTMLInputElement;
  input.value = query;
  input.dispatchEvent(new Event("input"));
  return [...document.querySelectorAll<HTMLElement>("#goodsBody .goods")].map(line => line.dataset.id);
};

it("filters goods by name or tag", () => {
  GoodsEditor.open();
  expect(search("ir")).toEqual(["2"]);
  expect(search("food").toSorted()).toEqual(["1", "3"]);
  expect(search("#bak")).toEqual(["3"]);
  expect(search("").toSorted()).toEqual(["1", "2", "3"]);
});

// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize } from "@/components/viewport";
import { Styles } from "@/generators/styles";
import { ViewportLayers } from "@/renderers/viewport/viewport-renderer";
import "./draw-cells";

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => true, draw: vi.fn() } }));

beforeEach(() => {
  document.body.innerHTML = '<svg id="map"><g id="cells"><g id="cellIndexes"></g></g></svg>';
  Styles.set(Styles.parse(Styles.defaults));
  globalThis.customization = 0;
  globalThis.grid = { spacing: 10 } as unknown as typeof grid;
  globalThis.pack = {
    cells: {
      i: [0, 1],
      p: [
        [5, 5],
        [500, 500]
      ]
    }
  } as unknown as typeof pack;
  setViewportSize(1000, 1000);
});

const indexes = () => document.querySelector("#cellIndexes")!;
const render = (bounds = { scale: 1, x0: 0, y0: 0, x1: 100, y1: 100 }) => ViewportLayers.renderTo(document, bounds);

test("draws nothing until indexes are shown, then the cells in view, centered", () => {
  render();
  expect(indexes().children).toHaveLength(0);

  styles.cells.groups.cellIndexes.options.show = true;
  render();
  expect(Array.from(indexes().children, text => text.textContent)).toEqual(["0"]);
  expect(indexes().getAttribute("font-size")).toBe("1.5"); // spacing 10 * size 0.15
  expect(indexes().getAttribute("text-anchor")).toBe("middle");
  expect(indexes().hasAttribute("transform")).toBe(false);
});

test("shifts the numbers by the style dx/dy in font-size units", () => {
  Object.assign(styles.cells.groups.cellIndexes.options, { show: true, dx: 1, dy: -0.5 });
  render();
  expect(indexes().getAttribute("transform")).toBe("translate(1.5 -0.75)");
});

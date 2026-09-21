// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import { setViewportSize } from "@/components/viewport";
import { Styles } from "@/generators/styles";
import { drawRelief } from "./draw-relief-icons";

vi.mock("@/components/layers", () => ({ Layers: { isOn: () => true, draw: vi.fn() } }));
vi.mock("@/components/icon-sets", () => ({
  IconSets: { ensureAll: vi.fn().mockResolvedValue(undefined), reliefSets: () => [] }
}));

beforeEach(() => {
  document.body.innerHTML = '<svg id="map"><g id="viewbox"><g id="terrain"></g></g></svg>';
  globalThis.styles = Styles.parse(undefined);
  globalThis.pack = { relief: [{ type: "mount", x: 10, y: 20, s: 4 }] } as unknown as typeof pack;
  setViewportSize(1000, 1000);
});

test("the style size scales the drawn icon about its anchor without touching the data", async () => {
  styles.relief.options.size = 1;
  await drawRelief();
  let use = document.querySelector("#terrain use")!;
  expect(use.getAttribute("x")).toBe("10");
  expect(use.getAttribute("y")).toBe("20");
  expect(use.getAttribute("width")).toBe("4");

  styles.relief.options.size = 2;
  await drawRelief();
  use = document.querySelector("#terrain use")!;
  expect(use.getAttribute("x")).toBe("8"); // 10 - (8 - 4) / 2
  expect(use.getAttribute("y")).toBe("18"); // 20 - (8 - 4) / 2: the anchor stays at (12, 22)
  expect(use.getAttribute("width")).toBe("8");
  expect(pack.relief[0]).toEqual({ type: "mount", x: 10, y: 20, s: 4 });
});

test("a bigger icon above a smaller one stays behind it, at any size", async () => {
  // pack.relief is ordered by the anchor; the big icon's box bottom is lower, but its anchor is not,
  // so it must draw first and the smaller hill below it must cover it
  globalThis.pack = {
    relief: [
      { type: "mount", x: 0, y: 0, s: 40 }, // anchor 20, box bottom 40
      { type: "hill", x: 30, y: 20, s: 12 } // anchor 26, box bottom 32
    ]
  } as unknown as typeof pack;

  for (const size of [1, 0.5, 3]) {
    styles.relief.options.size = size;
    await drawRelief();
    const uses = Array.from(document.querySelectorAll("#terrain use"));
    expect(uses, `size ${size}`).toHaveLength(2);
    // the drawn anchor is the data anchor at every size, so the array order stays the paint order
    const anchors = uses.map(use => Number(use.getAttribute("y")) + Number(use.getAttribute("height")) / 2);
    expect(anchors, `size ${size}`).toEqual([20, 26]);
  }
});

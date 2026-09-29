import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/generators/styles", () => ({
  Styles: {
    set: (value: typeof styles) => {
      globalThis.styles = value;
    }
  }
}));

import { capture, restore } from "./snapshot";

afterEach(() => vi.unstubAllGlobals());

test("restores entity notes and nested options without a legacy notes global", () => {
  vi.stubGlobal("pack", { burgs: [0, { i: 1, name: "Kelmora", note: "<p>before</p>" }] });
  vi.stubGlobal("grid", { cells: { h: new Uint8Array([20, 40]) } });
  vi.stubGlobal("options", { map: { seed: "123" } });
  vi.stubGlobal("styles", { states: { opacity: 1 } });
  const drawAll = vi.fn();
  vi.stubGlobal("Layers", { drawAll });
  capture();
  pack.burgs[1].note = "<p>after</p>";
  options.map.seed = "456";
  expect(restore()).toBe(true);
  expect(pack.burgs[1].note).toBe("<p>before</p>");
  expect(options.map.seed).toBe("123");
  expect(grid.cells.h).toEqual(new Uint8Array([20, 40]));
  expect(drawAll).toHaveBeenCalledOnce();
});

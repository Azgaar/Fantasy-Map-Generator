// Browser-mode test (vitest.browser.config.ts): drawVignette applies the store's geometry to
// the #vignette-rect defs resource - the projection rows' old job.
import { beforeEach, expect, test } from "vitest";
import "@/generators/styles";
import { drawVignette } from "./draw-vignette";

beforeEach(() => {
  document.body.innerHTML = `<svg id="map"><defs><mask id="vignette-mask"><rect id="vignette-rect"></rect></mask></defs><g id="vignette"></g></svg>`;
});

const layer = { getEl: () => document.getElementById("vignette") } as never;

test("drawVignette writes the mask rect geometry from the store", () => {
  styles.vignette.options = { x: "1%", y: "2%", width: "98%", height: "96%", rx: "7%", ry: "8%", filter: "blur(9px)" };
  drawVignette(layer);
  const rect = document.getElementById("vignette-rect")!;
  expect(rect.getAttribute("x")).toBe("1%");
  expect(rect.getAttribute("width")).toBe("98%");
  expect(rect.getAttribute("ry")).toBe("8%");
  expect(rect.getAttribute("filter")).toBe("blur(9px)");
});

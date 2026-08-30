// Browser-mode test (vitest.browser.config.ts): drawTexture derives the image from the store
// and clamps out-of-range shifts instead of emitting invalid negative sizes.
import { beforeEach, expect, test } from "vitest";
import "@/generators/styles";
import { drawTexture } from "./draw-texture";

beforeEach(() => {
  document.body.innerHTML = `<svg id="map"><g id="texture"></g></svg>`;
  globalThis.graphWidth = 800;
  globalThis.graphHeight = 600;
});

const layer = { getEl: () => document.getElementById("texture") } as never;

test("drawTexture builds the image from the store", () => {
  styles.texture.options = { href: "./t.jpg", x: 10, y: 20 };
  drawTexture(layer);
  const image = document.querySelector("#texture image")!;
  expect(image.getAttribute("href")).toBe("./t.jpg");
  expect(image.getAttribute("x")).toBe("10");
  expect(image.getAttribute("width")).toBe("790");
});

test("drawTexture clamps a shift beyond the map size to a zero-size image", () => {
  styles.texture.options = { href: "./t.jpg", x: 0, y: 653 };
  drawTexture(layer);
  const image = document.querySelector("#texture image")!;
  expect(Number(image.getAttribute("height"))).toBe(0);
  expect(Number(image.getAttribute("width"))).toBe(800);
});

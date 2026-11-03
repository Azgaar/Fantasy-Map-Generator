// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";
import { restoreFeatureMaskBounds, updateFeatureMaskBounds } from "./mask-bounds";
import { setViewportSize, setViewportTransform } from "./viewport";

beforeEach(() => {
  document.body.innerHTML = `<svg id="map"><defs>
    <mask id="land"><use href="#island" fill="white"/><use href="#lake" fill="black"/></mask>
    <mask id="water"><rect width="100%" height="100%" fill="white"/></mask>
    <mask id="custom" x="10" width="100"/>
  </defs></svg>`;
  setViewportSize(1920, 1080);
  setViewportTransform(20, -29040, -1460);
});

test("follows panning and resizing while keeping mask surfaces within the viewport", () => {
  updateFeatureMaskBounds();
  const mask = document.querySelector("#land")!;
  expect(Number(mask.getAttribute("width")) * 20).toBeCloseTo(1922);

  setViewportSize(1280, 720);
  setViewportTransform(20, -24000, -10000);
  updateFeatureMaskBounds();
  expect(Number(mask.getAttribute("x"))).toBeCloseTo(1199.95);
  expect(Number(mask.getAttribute("y"))).toBeCloseTo(499.95);
  expect(Number(mask.getAttribute("width")) * 20).toBeCloseTo(1282);
  expect(Number(mask.getAttribute("height")) * 20).toBeCloseTo(722);
});

test("restores complete masks for save/export clones without changing the live map or lake holes", () => {
  const original = document.querySelector("#map")!.outerHTML;
  updateFeatureMaskBounds();
  const live = document.querySelector("#map")!;
  const clone = live.cloneNode(true) as SVGSVGElement;
  restoreFeatureMaskBounds(clone);

  expect(clone.outerHTML).toBe(original);
  expect(live.querySelector("#land")!.getAttribute("maskUnits")).toBe("userSpaceOnUse");
});

test("panning during an asynchronous export leaves the export clone's masks complete", () => {
  updateFeatureMaskBounds();
  const clone = document.querySelector("#map")!.cloneNode(true) as SVGSVGElement;
  clone.id = "fantasyMap";
  restoreFeatureMaskBounds(clone);
  document.body.append(clone);
  const exported = clone.outerHTML;

  setViewportTransform(10, -2000, -1000);
  updateFeatureMaskBounds();
  expect(clone.outerHTML).toBe(exported);
});

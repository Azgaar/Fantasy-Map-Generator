// Browser-mode test (vitest.browser.config.ts): drawNebulae replaces its clouds and defs on a
// redraw, and the speed performance preset swaps the turbulence filters for fade gradients.
import { beforeEach, expect, test } from "vitest";
import { Layers } from "@/renderers/layers";
import "@/model/options/options-model"; // installs the options global
import "@/model/styles/styles";
import "@/utils/logger"; // installs the TIME/INFO globals the renderers gate their timers on
import { drawNebulae } from "./draw-nebulae";

beforeEach(() => {
  document.body.innerHTML = `<svg id="map"><g id="viewbox"><g id="nebulae" data-layer="nebulae">
      <g id="ion" data-group="ion"></g>
      <g id="dust" data-group="dust"></g>
      <g id="neutral" data-group="neutral"></g>
    </g></g></svg>`;
  options.map.graph = { width: 800, height: 600, points: 10000, sampling: "square", jitter: 0 };
  options.map.seed = "nebula-dom";
  options.app.performance = { shapeRendering: "geometricPrecision", stateHalos: true, viewportRedraw: "continuous" };
  styles.nebulae.options = { count: 4, size: 18, softness: 4 };
});

const layer = { getEl: () => document.getElementById("nebulae") } as never;
const root = () => document.getElementById("nebulae")!;
const ellipses = () => root().querySelectorAll("ellipse");
const clusters = () => root().querySelectorAll("[data-group] > g");

test("draws the clusters into the gas groups, one turbulence filter per cluster", () => {
  drawNebulae(layer);
  expect(ellipses().length).toBeGreaterThan(0);
  expect(root().querySelectorAll("defs filter").length).toBe(styles.nebulae.options.count);
  for (const cluster of clusters()) expect(cluster.getAttribute("filter")).toMatch(/^url\(#nebulae-filter-\d+\)$/);
});

test("replaces instead of appends on a second draw", () => {
  drawNebulae(layer);
  const first = ellipses().length;
  drawNebulae(layer);
  expect(ellipses().length).toBe(first);
  expect(root().querySelectorAll("defs").length).toBe(1);
});

test("the speed preset swaps the filters for one fade gradient per palette", () => {
  options.app.performance = { shapeRendering: "optimizeSpeed", stateHalos: false, viewportRedraw: "settled" };
  drawNebulae(layer);
  expect(root().querySelector("filter")).toBeNull();
  expect(root().querySelectorAll("radialGradient").length).toBe(3);
  for (const cluster of clusters()) expect(cluster.getAttribute("filter")).toBeNull();
  for (const ellipse of ellipses()) expect(ellipse.getAttribute("fill")).toMatch(/^url\(#nebulae-fade-\w+\)$/);
});

test("erase clears the clouds and the defs with them", () => {
  Layers.show("nebulae");
  expect(ellipses().length).toBeGreaterThan(0);
  Layers.hide("nebulae");
  expect(ellipses().length).toBe(0);
  expect(root().querySelector("defs")).toBeNull();
});

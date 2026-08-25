// Browser-mode test (vitest.browser.config.ts): the coordinates renderer takes its base label
// size from the store, not the retired data-size attribute.
import { beforeEach, expect, test } from "vitest";
import "@/generators/styles";
import { drawCoordinates } from "./draw-coordinates";

beforeEach(() => {
  document.body.innerHTML = `<svg id="map" width="800" height="600">
      <g id="viewbox"><g id="coordinates"></g></g>
    </svg>`;
  globalThis.scale = 4;
  globalThis.graphWidth = 800;
  globalThis.graphHeight = 600;
  globalThis.mapCoordinates = { lonT: 100, lonW: -50, lonE: 50, latN: 40, latS: -40, latT: 80 };
});

test("drawCoordinates sizes labels from the store, ignoring data-size", () => {
  styles.coordinates.options.fontSize = 20;
  document.getElementById("coordinates")!.setAttribute("data-size", "99");

  drawCoordinates();

  const rendered = Number(document.getElementById("coordinates")!.getAttribute("font-size"));
  expect(rendered).toBeCloseTo(20 / 4 ** 0.8, 2);
});

// Browser-mode test (vitest.browser.config.ts): drawStarDensity writes each band's isolines into
// its own group, caps at the level count, and empties a map with no burgs. The isoline pass is
// mocked: the field builder has its own suite and getIsolines is stock code.
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isolines: {} as Record<number, { fill?: string }> }));
vi.mock("@/utils/pathUtils", async importOriginal => ({
  ...(await importOriginal<typeof import("@/utils/pathUtils")>()),
  getIsolines: vi.fn(() => mocks.isolines)
}));

import "@/components/options-model"; // installs the options global
import "@/generators/styles";
import "@/services/logging"; // installs the TIME/INFO globals the renderers gate their timers on
import { getIsolines } from "@/utils/pathUtils";
import { drawStarDensity } from "./draw-star-density";

beforeEach(() => {
  mocks.isolines = { 2: { fill: "M2,2 L4,4" }, 5: { fill: "M0,0 L1,1" } };
  document.body.innerHTML = `<svg id="map"><g id="viewbox"><g id="starDensity" data-layer="starDensity">
      ${[1, 2, 3, 4, 5, 6].map(band => `<g id="band${band}" data-group="band${band}"></g>`).join("")}
    </g></g></svg>`;
  options.map.graph = { width: 1000, height: 100, points: 10000 };
  styles.starDensity.options = { levels: 5, reach: 150, populationWeight: 0.5 };
  vi.mocked(getIsolines).mockClear();
  globalThis.pack = {
    cells: {
      i: [0, 1, 2, 3, 4],
      c: [[1], [0, 2], [1, 3], [2, 4], [3]],
      p: [
        [50, 50],
        [150, 50],
        [250, 50],
        [350, 50],
        [450, 50]
      ],
      h: [50, 50, 50, 50, 50]
    },
    burgs: [{}, { i: 1, cell: 1, x: 150, y: 50, population: 100 }]
  } as never;
});

const layer = { getEl: () => document.getElementById("starDensity") } as never;
const band = (id: number) => document.getElementById(`band${id}`)!;

test("writes each band's paths into its own group", () => {
  drawStarDensity(layer);
  expect(band(5).querySelector("path")?.getAttribute("d")).toBe("M0,0 L1,1");
  expect(band(2).querySelector("path")?.getAttribute("d")).toBe("M2,2 L4,4");
  expect(band(6).children.length).toBe(0); // the map has five levels, the sixth stays empty
  expect(band(1).children.length).toBe(0); // the mock carries no band-1 isoline
});

test("feeds the field's bands to the isoline pass", () => {
  drawStarDensity(layer);
  const getType = vi.mocked(getIsolines).mock.calls.at(-1)![1];
  expect(getType(1)).toBe(5); // the system's own cell is the peak band
  expect(getType(0)).toBe(1); // a third of the peak at the kernel edge
  expect(getType(3)).toBeNull(); // beyond the reach, no band, no isoline
});

test("replaces instead of appends on a second draw", () => {
  drawStarDensity(layer);
  const first = band(5).innerHTML;
  drawStarDensity(layer);
  expect(band(5).innerHTML).toBe(first);
  expect(band(5).children.length).toBe(1);
});

test("is empty, without a throw, on a map with no burgs", () => {
  globalThis.pack = { cells: { ...globalThis.pack.cells }, burgs: [{}] } as never;
  drawStarDensity(layer);
  for (let id = 1; id <= 6; id++) expect(band(id).children.length).toBe(0);
  expect(getIsolines).not.toHaveBeenCalled();
});

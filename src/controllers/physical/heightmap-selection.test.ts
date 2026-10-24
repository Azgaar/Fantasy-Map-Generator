// @vitest-environment jsdom
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { generate } from "@/app/lifecycle";
import { GenerationPipeline } from "@/model/generation-pipeline";
import { Pins } from "@/model/options/pins";
import { drawHeights } from "@/renderers/heightmap/draw-heightmap";
import "@/model/graph/grid-generator";
import "@/model/physical/heightmap-generator";
import { Grid } from "@/model/graph/grid-generator";
import { Options } from "@/model/options/options-model";
import { HeightmapGenerator } from "@/model/physical/heightmap-generator";
import { dialogButton } from "@/ui/dialog/dialog-testing";

const { regenerate } = vi.hoisted(() => ({ regenerate: vi.fn() }));
vi.mock("@/ui/app-commands", () => ({ App: { syncOptionInputs: vi.fn(), regeneratePrompt: regenerate } }));
vi.mock("@/ui/dialog/dialog", async importOriginal => {
  const { Dialog } = await importOriginal<typeof import("@/ui/dialog/dialog")>();
  return { Dialog: Object.assign(Dialog, { confirm: vi.fn() }) };
});
vi.mock("@/app/chrome/tabs/options-tab", () => ({ syncOptionInputs: vi.fn() }));
vi.mock("@/app/shell", () => ({ initShell: vi.fn(), warnIfServerless: vi.fn() }));
vi.mock("@/ui/map/zoom", () => ({ invokeActiveZooming: vi.fn(), resetZoom: vi.fn() }));
vi.mock("@/services/url-params", () => ({ checkLoadParameters: vi.fn() }));
vi.mock("@/services/logging", () => ({ logStats: vi.fn() }));
vi.mock("@/services", () => ({ Services: {} }));
vi.mock("@/data/heightmap-templates", () => ({
  heightmapTemplates: { test: { name: "Test", probability: 1, template: "Hill 1 40 75-75 75-75" } }
}));
vi.mock("@/data/precreated-heightmaps", () => ({ precreatedHeightmaps: {} }));
vi.mock("@/renderers/heightmap/draw-heightmap", () => ({
  drawHeightmap: vi.fn(),
  drawHeights: vi.fn(() => "data:image/png;base64,")
}));

let selection: typeof import("./heightmap-selection");

beforeAll(async () => {
  document.body.innerHTML = '<div id="dialogs"></div>';
  localStorage.clear();
  options = Options.getDefaultOptions();
  options.map.graph = { width: 800, height: 600, points: 1000, sampling: "square", jitter: 0.9 };
  options.generation.graph = { width: 800, height: 600, density: 1, sampling: "square", jitter: 0.9 };
  globalThis.grid = Grid.generate("old");
  vi.spyOn(GenerationPipeline, "run").mockImplementation(async ({ graph }) => {
    Grid.prepare(graph);
    await HeightmapGenerator.generate();
  });
  selection = await import("./heightmap-selection");
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllTimers();
});

it.each([
  { width: 1600, height: 900, density: 1, points: 1000, sampling: "square", jitter: 0.9 },
  { width: 800, height: 600, density: 2, points: 2000, sampling: "square", jitter: 0.9 },
  { width: 800, height: 600, density: 1, points: 1000, sampling: "hexPointy", jitter: 0 }
] as const)("builds the selected preview for $width × $height, $points points on $sampling", async requested => {
  const { width, height, density, points, sampling, jitter } = requested;
  options.map.graph = { width: 800, height: 600, points: 1000, sampling: "square", jitter: 0.9 };
  globalThis.grid = Grid.generate("old");
  const original = structuredClone(options.map);
  options.generation.graph = { width, height, density, sampling, jitter };
  options.generation.template = "test";
  Pins.clear("points");
  selection.HeightmapSelection.open();
  expect(options.map).toEqual(original);

  const previewHeights = Array.from(vi.mocked(drawHeights).mock.calls.at(-1)![0].heights);
  dialogButton("New Map", "heightmapSelection").click();
  const config = regenerate.mock.calls.at(-1)![0];
  expect(config).toMatchObject({ width: requested.width, height: requested.height, points: requested.points });

  await generate(config);
  expect(options.map.graph).toEqual({ width, height, points, sampling, jitter });
  expect(grid.sampling).toBe(sampling);
  expect(grid.spacing).toBe(Math.round(Math.sqrt((requested.width * requested.height) / requested.points) * 100) / 100);
  expect(grid.points.some(([x]) => x > requested.width * 0.9)).toBe(true);
  const generated = grid.cells.h;
  expect(Array.from(generated)).toEqual(previewHeights);
  expect(Math.max(...generated)).toBeGreaterThan(0);
});

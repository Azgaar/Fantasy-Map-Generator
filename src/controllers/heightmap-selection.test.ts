// @vitest-environment jsdom
import Alea from "alea";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { generate } from "@/components/lifecycle";
import { Pins } from "@/components/pins";
import { GenerationPipeline } from "@/generators/generation-pipeline";
import { drawHeights } from "@/renderers/draw-heightmap";
import "@/generators/grid-generator";
import "@/generators/heightmap-generator";

vi.mock("@/components/dialog/dialog-helpers", () => ({ closeDialogs: vi.fn(), confirmationDialog: vi.fn() }));
vi.mock("@/components/options/tabs/options-tab", () => ({ syncOptionInputs: vi.fn() }));
vi.mock("@/components/shell", () => ({ initShell: vi.fn(), warnIfServerless: vi.fn() }));
vi.mock("@/components/zoom", () => ({ invokeActiveZooming: vi.fn(), resetZoom: vi.fn() }));
vi.mock("@/services/url-params", () => ({ checkLoadParameters: vi.fn() }));
vi.mock("@/services/logging", () => ({ logStats: vi.fn() }));
vi.mock("@/services", () => ({ Services: {} }));
vi.mock("@/data/heightmap-templates", () => ({
  heightmapTemplates: { test: { name: "Test", probability: 1, template: "Hill 1 40 75-75 75-75" } }
}));
vi.mock("@/data/precreated-heightmaps", () => ({ precreatedHeightmaps: {} }));
vi.mock("@/renderers/draw-heightmap", () => ({
  drawHeightmap: vi.fn(),
  drawHeights: vi.fn(() => "data:image/png;base64,")
}));

const dialog = vi.fn();
const regenerate = vi.fn();
let selection: typeof import("./heightmap-selection");

beforeAll(async () => {
  document.body.innerHTML = '<div id="dialogs"></div>';
  localStorage.clear();
  options = Options.getDefaultOptions();
  options.map.graph = { width: 800, height: 600, points: 1000, sampling: "square", jitter: 0.9 };
  options.generation.graph = { width: 800, height: 600, density: 1, sampling: "square", jitter: 0.9 };
  globalThis.grid = Grid.generate("old");
  vi.stubGlobal("aleaPRNG", Alea);
  vi.stubGlobal("$", () => ({ dialog }));
  vi.stubGlobal("regeneratePrompt", regenerate);
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
  const settings = dialog.mock.calls.at(-1)![0];
  settings.buttons["New Map"].call(document.getElementById("heightmapSelection"));
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

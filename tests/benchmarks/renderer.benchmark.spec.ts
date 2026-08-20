import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  summarizeRendererBenchmark,
  type RendererBenchmarkBackend,
  type RendererBenchmarkObservation,
  type RendererBenchmarkPhase,
  type RendererBenchmarkReport
} from "../../src/services/renderer-benchmark";
import { RENDERER_BENCHMARK_FIXTURES, type RendererBenchmarkFixture } from "./fixtures";

const BACKENDS: readonly RendererBenchmarkBackend[] = ["svg", "pixi"];
const CAMERA_SAMPLES = 30;
const LAYER_SAMPLES = 20;
const REQUESTED_RUNS = Number(process.env.RENDERER_BENCHMARK_RUNS ?? 2);
const RUNS = Number.isInteger(REQUESTED_RUNS) && REQUESTED_RUNS > 0 ? REQUESTED_RUNS : 2;
const BENCHMARK_CASES = RENDERER_BENCHMARK_FIXTURES.flatMap(fixture =>
  BACKENDS.flatMap(backend => Array.from({ length: RUNS }, (_, index) => ({ backend, fixture, run: index + 1 })))
);

test.describe.configure({ mode: "serial", timeout: 10 * 60_000 });

for (const { backend, fixture, run } of BENCHMARK_CASES) {
  test(`${fixture.id} / ${backend} / run ${run}`, async ({ page }, testInfo) => {
      const query = new URLSearchParams({ height: "720", options: "default", width: "1280" });
      query.set("renderer", backend);
      if (backend === "pixi") {
        query.set("pixiTheme", "states");
      }
      await page.goto(`/?${query}`);
      await page.waitForFunction(() => Boolean((window as any).pack?.cells?.i?.length), { timeout: 120_000 });

      await loadFixture(page, fixture);
      if (backend === "pixi") {
        await page.waitForFunction(() => (window as any).PixiMapPrototype?.getSnapshot()?.enabled === true, {
          timeout: 120_000
        });
      }

      const firstPaint = await page.evaluate(async () => {
        const started = performance.now();
        (window as any).drawLayers();
        await nextPaint();
        return performance.now() - started;

        async function nextPaint(): Promise<void> {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
      });

      const cameraFrames = await page.evaluate(async sampleCount => {
        const durations: number[] = [];
        for (let index = 0; index < sampleCount; index++) {
          const started = performance.now();
          (window as any).setMapZoom(1 + (index % 10) * 0.1);
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          durations.push(performance.now() - started);
        }
        return durations;
      }, CAMERA_SAMPLES);

      const layerChanges = await page.evaluate(async sampleCount => {
        const durations: number[] = [];
        for (let index = 0; index < sampleCount; index++) {
          const started = performance.now();
          (window as any).toggleStates();
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          durations.push(performance.now() - started);
        }
        return durations;
      }, LAYER_SAMPLES);

      const runtime = await page.evaluate(() => {
        const performanceSnapshot = (window as any).MapPerformance.getSnapshot();
        const pixiSnapshot = (window as any).PixiMapPrototype?.getSnapshot() ?? null;
        const canvas = document.querySelector<HTMLCanvasElement>("#pixi-map-prototype canvas");
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
        return {
          canvas: canvas
            ? {
                height: canvas.height,
                resolution: pixiSnapshot?.resolution ?? window.devicePixelRatio,
                width: canvas.width
              }
            : null,
          deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
          domNodes: document.querySelectorAll("#map *").length,
          hardwareConcurrency: navigator.hardwareConcurrency,
          jsHeapBytes: memory?.usedJSHeapSize ?? null,
          longTasks: performanceSnapshot.longTasks,
          pixiSnapshot,
          samples: performanceSnapshot.samples,
          userAgent: navigator.userAgent
        };
      });

      const observations: RendererBenchmarkObservation[] = [
        { duration: firstPaint, phase: "first-paint", sequence: 0 },
        ...toObservations("camera-frame", cameraFrames),
        ...toObservations("layer-change", layerChanges),
        ...runtime.samples.flatMap(({ duration, name }: { duration: number; name: string }) => {
          const phase = toBenchmarkPhase(name, backend);
          return phase ? [{ duration, phase, sequence: 0 }] : [];
        })
      ];
      const report: RendererBenchmarkReport = {
        backend,
        canvas: runtime.canvas,
        domNodes: runtime.domNodes,
        environment: {
          browser: `${testInfo.project.name} ${testInfo.project.use.browserName ?? ""}`.trim(),
          deviceMemoryGb: runtime.deviceMemoryGb,
          devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
          hardwareConcurrency: runtime.hardwareConcurrency,
          renderer: runtime.pixiSnapshot?.renderer ?? null,
          userAgent: runtime.userAgent,
          viewport: { height: 720, width: 1280 }
        },
        fixture:
          fixture.kind === "generated"
            ? { id: fixture.id, requestedCells: fixture.requestedCells, seed: fixture.seed }
            : { id: fixture.id, legacyMap: fixture.mapFile },
        generatedAt: new Date().toISOString(),
        jsHeapBytes: runtime.jsHeapBytes,
        longTasks: runtime.longTasks,
        observations,
        resourceBytes: runtime.pixiSnapshot?.resourceBytes ?? 0,
        resourceCount: runtime.pixiSnapshot?.resourceCount ?? 0,
        run,
        schemaVersion: 1,
        summaries: summarizeRendererBenchmark(observations)
      };

      expect(report.observations.length).toBeGreaterThan(CAMERA_SAMPLES + LAYER_SAMPLES);
      await testInfo.attach("renderer-benchmark-report", {
        body: JSON.stringify(report),
        contentType: "application/json"
      });
    });
}

async function loadFixture(page: import("@playwright/test").Page, fixture: RendererBenchmarkFixture): Promise<void> {
  if (fixture.kind === "legacy") {
    await page.locator("#mapToLoad").setInputFiles(path.resolve(fixture.mapFile));
    await expect(page.locator("#tooltip")).toContainText("Map is successfully loaded", { timeout: 120_000 });
    return;
  }

  await page.evaluate(
    async ({ densityControl, seed }) => {
      (window as any).changeCellsDensity(densityControl);
      await (window as any).generate({ seed });
    },
    { densityControl: fixture.densityControl, seed: fixture.seed }
  );
  await page.waitForFunction(
    ({ requestedCells, seed }) =>
      (window as any).seed === seed && (window as any).grid?.cellsDesired === requestedCells,
    { requestedCells: fixture.requestedCells, seed: fixture.seed },
    { timeout: 5 * 60_000 }
  );
}

function toObservations(
  phase: RendererBenchmarkPhase,
  durations: readonly number[]
): RendererBenchmarkObservation[] {
  return durations.map((duration, sequence) => ({ duration, phase, sequence }));
}

function toBenchmarkPhase(name: string, backend: RendererBenchmarkBackend): RendererBenchmarkPhase | null {
  if (name === "generation:total") return "generation";
  if (backend === "pixi" && name === "pixi:scene-build") return "scene-build";
  if (backend === "pixi" && name === "pixi:gpu-submit") return "gpu-upload";
  if (backend === "svg" && name === "render:total") return "scene-build";
  return null;
}

import { expect, test } from "@playwright/test";

const benchmark = process.env.LABEL_BENCHMARK ? test : test.skip;

benchmark("compare full DOM, viewport labels, and diagnostic PathLabel hiding", async ({ page }) => {
  const results: Record<string, { nodes: number; p95: number; total: number }> = {};
  for (const mode of ["full", "viewport", "hide-paths"] as const) {
    await page.goto("/?seed=viewport-labels-1464&width=1280&height=720");
    await page.waitForFunction(() => (window as typeof window & { mapId?: number }).mapId !== undefined, {
      timeout: 60000
    });
    results[mode] = await page.evaluate(async mode => {
      setMapZoom(9);
      await frames(3);

      if (mode === "full") {
        const mapData = await Services.Save.prepareMapData();
        const full = new DOMParser().parseFromString(mapData.split("\r\n")[5], "image/svg+xml");
        document.getElementById("labels")!.replaceWith(full.querySelector("#labels")!);
        document.getElementById("textPaths")!.replaceWith(full.querySelector("#textPaths")!);
        window.updateViewportLayers = () => undefined;
        window.renderViewportLayersNow = () => undefined;
      } else if (mode === "hide-paths") {
        const style = document.createElement("style");
        style.textContent = "#labels text:has(textPath){display:none}";
        document.head.appendChild(style);
      }

      const durations: number[] = [];
      const started = performance.now();
      for (let i = 0; i < 80; i++) {
        const before = performance.now();
        panMap(i % 2 ? -4 : 4, 0);
        await frames(1);
        durations.push(performance.now() - before);
      }
      durations.sort((a, b) => a - b);
      return {
        nodes: document.querySelectorAll("#labels text, #textPaths path[data-label-type]").length,
        p95: durations[Math.floor(durations.length * 0.95)],
        total: performance.now() - started
      };

      function frames(count: number): Promise<void> {
        return new Promise(resolve => {
          const next = () => (--count ? requestAnimationFrame(next) : resolve());
          requestAnimationFrame(next);
        });
      }
    }, mode);
  }

  console.table(results);
  expect(results.viewport.nodes).toBeLessThan(results.full.nodes * 0.2);
});

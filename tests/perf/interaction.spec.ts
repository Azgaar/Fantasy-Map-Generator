import path from "path";
import { test } from "@playwright/test";

// Both refs load the exact same fixture, so any timing difference is down to the code, not
// the data. Uses the most recent fixture so map-loading itself (a fixed migration cost paid
// once per gesture) doesn't dominate the interaction being measured.
const FIXTURE_PATH = path.join(__dirname, "../fixtures/1.143.1.map");

test("zoom and pan gesture over a loaded map", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.waitForSelector("#mapToLoad", { state: "attached" });
  await page.locator("#mapToLoad").setInputFiles(FIXTURE_PATH);
  await page.waitForFunction(() => (window as unknown as { mapId?: unknown }).mapId !== undefined, {
    timeout: 120_000
  });
  // Let the initial render settle so it isn't counted as part of the gesture.
  await page.waitForTimeout(500);

  const map = page.locator("#map");
  const box = await map.boundingBox();
  if (!box) throw new Error("#map has no bounding box");
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  const start = Date.now();

  await page.mouse.move(centerX, centerY);
  // Zoom in
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -120);
  }
  // Pan across the map
  await page.mouse.move(centerX - 150, centerY - 100);
  await page.mouse.down();
  await page.mouse.move(centerX + 150, centerY + 100, { steps: 20 });
  await page.mouse.up();
  // Zoom back out
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 120);
  }

  // Let the trailing rAF-scheduled reconcile/redraw work (ViewportLayers.schedule, etc.) finish.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const durationMs = Date.now() - start;

  console.log(`PERF_RESULT ${JSON.stringify({ suite: "interaction", case: "zoom-pan gesture", metrics: { gesture: durationMs } })}`);
});

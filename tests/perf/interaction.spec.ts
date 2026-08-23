import fs from "fs";
import path from "path";
import { test } from "@playwright/test";

// Picks the newest fixture by version rather than hardcoding a filename, so this doesn't need a
// manual bump every time a new tests/fixtures/*.map is added. Both refs resolve this at runtime
// against their own checked-out fixtures directory, so any timing difference is down to the code,
// not the data (as long as the compared refs' fixture sets agree, which they should outside a PR
// that itself adds a newer fixture).
function findLatestFixture(): string {
  const fixturesDir = path.join(__dirname, "../fixtures");
  const versioned = fs
    .readdirSync(fixturesDir)
    .filter(name => /^\d+\.\d+\.\d+\.map$/.test(name))
    .sort((a, b) => {
      const toParts = (name: string) => name.replace(/\.map$/, "").split(".").map(Number);
      const [aParts, bParts] = [toParts(a), toParts(b)];
      for (let i = 0; i < 3; i++) {
        if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
      }
      return 0;
    });

  const latest = versioned.at(-1);
  if (!latest) throw new Error(`No versioned .map fixture found in ${fixturesDir}`);
  return path.join(fixturesDir, latest);
}

const FIXTURE_PATH = findLatestFixture();

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

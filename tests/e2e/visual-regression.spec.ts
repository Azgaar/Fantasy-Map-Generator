/**
 * Pixel regression on the root SVG (#map). Baselines are maintained on a single machine;
 * this suite is skipped in CI (see describeVisual below).
 *
 * Run locally before large refactors: npm run test:e2e
 * Refresh PNG baselines only when the visual change is intentional:
 *   npm run test:e2e:update-visual
 * End-frame snapshots for all E2E tests live next to each spec; refresh everything:
 *   npm run test:e2e:update-snapshots
 */
import path from "path";
import { expect, test, waitForMapSvgReady } from "./fixtures";

/** Pixel baselines are recorded against the dev server; skip on CI until snapshots are cross-platform. */
const describeVisual = process.env.CI ? test.describe.skip : test.describe;

describeVisual("Visual regression", () => {
  test.describe.configure({
    mode: "serial",
    timeout: 180000,
  });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("seeded generation matches baseline", async ({ page }) => {
    await page.goto("");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("?seed=test-seed&width=1280&height=720");

    await waitForMapSvgReady(page);

    await expect(page.locator("#map")).toHaveScreenshot("seeded-generation.png");
  });

  test("loaded demo.map matches baseline", async ({ page }) => {
    await page.goto("");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.waitForSelector("#mapToLoad", { state: "attached" });

    const fileInput = page.locator("#mapToLoad");
    const mapFilePath = path.join(__dirname, "../fixtures/demo.map");
    await fileInput.setInputFiles(mapFilePath);

    await waitForMapSvgReady(page);

    await expect(page.locator("#map")).toHaveScreenshot("loaded-demo-map.png");
  });
});
